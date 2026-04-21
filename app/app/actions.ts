'use server'

import { redirect } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import {
  closeSession,
  createSession,
  getOrResolveActiveSession,
} from '@/lib/sessions/service'

export async function startSessionAction() {
  const supabase = await createAuthenticatedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const existing = await getOrResolveActiveSession(supabase, user.id)
  if (existing) redirect(`/app/sesion/${existing.id}`)

  const session = await createSession(supabase, user.id)
  redirect(`/app/sesion/${session.id}`)
}

export async function endSessionAction(formData: FormData) {
  const sessionId = formData.get('sessionId')
  if (typeof sessionId !== 'string') redirect('/app')

  const supabase = await createAuthenticatedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: session } = await supabase
    .from('clinical_sessions')
    .select('id, status')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (session?.status === 'open') {
    await closeSession(supabase, session.id, 'user_request')
  }

  redirect('/app')
}
