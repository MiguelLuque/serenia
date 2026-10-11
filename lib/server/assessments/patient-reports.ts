import 'server-only'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/shared/supabase/types'

const ReportSchema = z.object({
  sessionId: z.string(),
  state: z.enum(['available', 'pending_review', 'rejected', 'unavailable']),
  summary: z.string().nullable(),
})
export type PatientReport = z.infer<typeof ReportSchema>
export const REPORT_STATE_COPY: Record<Exclude<PatientReport['state'], 'available'>, string> = {
  pending_review: 'Resumen pendiente de revisión clínica. No hay un plazo de revisión garantizado.',
  rejected: 'El informe se ha rechazado y su resumen no está disponible.',
  unavailable: 'Esta sesión no tiene un resumen autorizado disponible.',
}

/** DB owns version/status selection; never fetch the internal assessment here. */
export async function getPatientReports(client: SupabaseClient<Database>, sessionIds: string[]): Promise<Map<string, PatientReport>> {
  if (!sessionIds.length) return new Map()
  const { data, error } = await client.rpc('get_patient_session_reports', { p_session_ids: sessionIds })
  if (error) throw error
  const reports = z.array(ReportSchema).parse(data)
  return new Map(reports.map(report => [report.sessionId, report]))
}
