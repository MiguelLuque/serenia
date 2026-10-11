import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getUser: vi.fn(), redirect: vi.fn((path: string) => { throw Error(`redirect:${path}`) }) }))
vi.mock('@/lib/server/supabase/server', () => ({ createAuthenticatedClient: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
import { submitProfile } from '@/app/onboarding/actions'
const values = { informalName: 'Ana', pronouns: 'ella', birthDate: '1990-01-15', reasonForConsulting: 'Llevo semanas con ansiedad y no puedo dormir.', acceptance: 'on', acceptanceVersion: 'technical-draft-2026-10-11' }
function form(input = values) { const result = new FormData(); Object.entries(input).forEach(([k,v]) => result.set(k,v)); return result }
beforeEach(() => { mocks.rpc.mockReset().mockResolvedValue({ error: null }); mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: 'patient' } }, error: null }); mocks.redirect.mockClear() })
it('persists validated intake and current acceptance in one owner RPC', async () => {
 await expect(submitProfile(undefined,form())).rejects.toThrow('redirect:/app')
 expect(mocks.rpc).toHaveBeenCalledWith('complete_patient_onboarding',{ p_informal_name:'Ana',p_pronouns:'ella',p_birth_date:'1990-01-15',p_reason:values.reasonForConsulting,p_version:'technical-draft-2026-10-11',p_accepted:true })
})
it.each([{ pronouns: 'otro' },{ informalName: '' },{ birthDate: '2000-02-30' },{ birthDate: '2090-01-01' },{ reasonForConsulting: 'corto' },{ acceptance: '' },{ acceptanceVersion: 'old' }])('rejects invalid/current acceptance data before writing %j', async changes => {
 expect((await submitProfile(undefined,form({ ...values,...changes })))?.error).toBeTruthy(); expect(mocks.rpc).not.toHaveBeenCalled()
})
it('rejects a stale auth user when getUser reports an error', async () => {
 mocks.getUser.mockResolvedValue({ data: { user: { id: 'patient' } }, error: Error('expired') })
 expect((await submitProfile(undefined,form()))?.error).toBe('No autenticado'); expect(mocks.rpc).not.toHaveBeenCalled()
})
it('DB failure does not redirect or mark success', async () => {
 mocks.rpc.mockResolvedValue({ error: Error('offline') })
 expect((await submitProfile(undefined,form()))?.error).toBe('No se pudo guardar el perfil'); expect(mocks.redirect).not.toHaveBeenCalled()
})
