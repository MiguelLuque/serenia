'use server'

import { redirect } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { createSession } from '@/lib/sessions/service'

export async function startSessionAction() {
  const supabase = await createAuthenticatedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const session = await createSession(supabase, user.id)
  redirect(`/app/sesion/${session.id}`)
}
