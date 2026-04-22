import type { Database } from '@/lib/supabase/types'

export type AssessmentStatus = Database['public']['Enums']['assessment_status']

export type AssessmentStatusLabel = {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
}

/**
 * Map an assessment status (or null when no assessment exists yet) to a
 * Spanish user-facing label and shadcn Badge variant.
 */
export function assessmentStatusLabel(
  status: AssessmentStatus | null
): AssessmentStatusLabel {
  if (status === null) {
    return { label: 'Sin informe', variant: 'outline' }
  }
  switch (status) {
    case 'draft_ai':
    case 'pending_clinician_review':
      return { label: 'Sin revisar', variant: 'destructive' }
    case 'reviewed_confirmed':
    case 'reviewed_modified':
      return { label: 'Revisado', variant: 'secondary' }
    case 'rejected':
      return { label: 'Rechazado', variant: 'outline' }
    case 'superseded':
      return { label: 'Sustituido', variant: 'outline' }
  }
}
