import { createAuthenticatedClient } from '@/lib/server/supabase/server'
import { redirect } from 'next/navigation'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'
import { progressiveProfileEnabled } from '@/lib/server/profile/config'
import { patientDisplayName } from '@/lib/shared/clinician/display-name'
import { BrandOrb } from '@/components/brand/brand-mark'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, informal_name, role')
    .eq('user_id', user.id)
    .single()

  return (
    <SidebarProvider>
      <AppSidebar
        displayName={patientDisplayName(profile) ?? ''}
        role={(profile?.role as 'patient' | 'clinician') ?? 'patient'}
        profileMemoryEnabled={progressiveProfileEnabled(process.env, user.id)}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-stone-900/5 bg-background/85 px-3 backdrop-blur-lg md:hidden">
          <SidebarTrigger aria-label="Abrir menú" className="size-10" />
          <span className="flex items-center gap-2 font-semibold tracking-tight text-stone-900">
            <BrandOrb className="size-6" />
            Serenia
          </span>
        </header>
        <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 md:py-10">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
