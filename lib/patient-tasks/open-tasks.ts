import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

export type PatientOpenTask = {
  id: string
  descripcion: string
  createdAt: string
  acordadaEnSessionId: string
  estado: 'pendiente' | 'parcial'
}

/**
 * Fetch the patient's currently-open agreements (tasks the clinician
 * validated but the patient has not yet closed with a follow-up). Scoped
 * by `user_id` both here and via RLS. Ordered newest first and capped at
 * 20 rows — the UI surfaces a short list on the home dashboard; we don't
 * page beyond that today.
 */
export async function getPatientOpenTasks(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PatientOpenTask[]> {
  const { data, error } = await supabase
    .from('patient_tasks')
    .select('id, descripcion, created_at, acordada_en_session_id, estado')
    .eq('user_id', userId)
    .in('estado', ['pendiente', 'parcial'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error

  return (data ?? [])
    .filter(
      (t): t is typeof t & { estado: 'pendiente' | 'parcial' } =>
        t.estado === 'pendiente' || t.estado === 'parcial',
    )
    .map((t) => ({
      id: t.id,
      descripcion: t.descripcion,
      createdAt: t.created_at,
      acordadaEnSessionId: t.acordada_en_session_id,
      estado: t.estado,
    }))
}
