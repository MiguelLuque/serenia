import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'
import { prepareRegeneration, rollbackRegeneration } from '@/lib/server/assessments/regenerate'

const row = { id: 'a-1', session_id: 's-1', status: 'rejected', rejection_reason: 'Revisar riesgo', clinical_notes: 'Nota sintética' }
function client(data: unknown = row, fetchError: unknown = null, rpcData = true, rpcError: unknown = null) {
  const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data, error: fetchError }) }
  const rpc = vi.fn(async () => ({ data: rpcData, error: rpcError }))
  return { supabase: { from: () => chain, rpc } as unknown as SupabaseClient<Database>, rpc }
}
describe('regeneration RPC boundary', () => {
  it('preserves context and claims the expected rejected version', async () => {
    const { supabase, rpc } = client()
    expect(await prepareRegeneration(supabase, 'a-1')).toEqual({ sessionId: 's-1', originalStatus: 'rejected', rejectionContext: { rejectionReason: 'Revisar riesgo', clinicalNotes: 'Nota sintética' } })
    expect(rpc).toHaveBeenCalledWith('regenerate_assessment_atomic', { p_assessment_id: 'a-1', p_expected_status: 'rejected' })
  })
  it('accepts a manual-review placeholder with null context', async () => {
    const { supabase } = client({ ...row, status: 'requires_manual_review', rejection_reason: null, clinical_notes: null })
    expect(await prepareRegeneration(supabase, 'a-1')).toMatchObject({ originalStatus: 'requires_manual_review', rejectionContext: { rejectionReason: '', clinicalNotes: null } })
  })
  it.each([
    [null, 'no existe'],
    [{ ...row, status: 'draft_ai' }, 'Solo se puede regenerar'],
    [{ ...row, session_id: null }, 'no está vinculado'],
  ])('rejects invalid persisted preconditions', async (data, message) => {
    const { supabase, rpc } = client(data)
    await expect(prepareRegeneration(supabase, 'a-1')).rejects.toThrow(message as string)
    expect(rpc).not.toHaveBeenCalled()
  })
  it('surfaces read failure', async () => {
    const { supabase } = client(null, { message: 'read failed' })
    await expect(prepareRegeneration(supabase, 'a-1')).rejects.toThrow('read failed')
  })
  it('surfaces transaction failure', async () => {
    const { supabase } = client(row, null, false, { message: 'Clinician required' })
    await expect(prepareRegeneration(supabase, 'a-1')).rejects.toThrow('Clinician required')
  })
  it('rejects a lost race without authorizing a second enqueue', async () => {
    const { supabase } = client(row, null, false)
    await expect(prepareRegeneration(supabase, 'a-1')).rejects.toThrow('ya fue actualizado')
  })
  it('requests conditional rollback to the captured original status', async () => {
    const { supabase, rpc } = client()
    await rollbackRegeneration(supabase, 'a-1', 'requires_manual_review')
    expect(rpc).toHaveBeenCalledWith('regenerate_assessment_atomic', { p_assessment_id: 'a-1', p_expected_status: 'requires_manual_review', p_restore: true })
  })
  it('reports a rollback failure without hiding the enqueue error', async () => {
    const { supabase } = client(row, null, false, { message: 'rollback failed' })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(rollbackRegeneration(supabase, 'a-1', 'rejected')).resolves.toBeUndefined()
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })
})
