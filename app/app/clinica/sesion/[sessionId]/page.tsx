import { notFound } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { getSessionDetail } from '@/lib/server/clinician/session-detail'
import { AssessmentView } from '@/components/clinician/assessment-view'

export default async function ClinicianSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  const supabase = await createAuthenticatedClient()
  const detail = await getSessionDetail(supabase, sessionId)

  if (!detail) {
    notFound()
  }

  return <AssessmentView detail={detail} />
}
