import { createAuthenticatedClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'

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
    <SidebarProvider>
      <AppSidebar
        displayName={profile?.display_name ?? ''}
        role={(profile?.role as 'patient' | 'clinician') ?? 'patient'}
      />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-medium">Serenia</span>
        </header>
        <main className="mx-auto w-full max-w-4xl p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
