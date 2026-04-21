import { createAuthenticatedClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/app/header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, role')
    .eq('user_id', user.id)
    .single()

  return (
    <>
      <Header
        displayName={profile?.display_name ?? ''}
        role={(profile?.role as 'patient' | 'clinician') ?? 'patient'}
      />
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </>
  )
}
