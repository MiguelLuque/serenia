'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, NotebookText, LogOut, Inbox, Users, Brain } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { logoutAction } from '@/app/(auth)/actions'
import { BrandOrb } from '@/components/brand/brand-mark'

interface AppSidebarProps {
  displayName: string
  role: 'patient' | 'clinician'
  profileMemoryEnabled?: boolean
}

const patientNav = [
  { href: '/app', label: 'Inicio', icon: Home },
  { href: '/app/sesiones', label: 'Sesiones', icon: NotebookText },
]

const clinicianNav = [
  { href: '/app', label: 'Bandeja', icon: Inbox },
  { href: '/app/clinica/pacientes', label: 'Pacientes', icon: Users },
]

function isNavItemActive(href: string, pathname: string): boolean {
  if (href === '/app') return pathname === '/app'
  // Keep "Pacientes" highlighted on any /app/clinica/* route, including
  // the patient detail route /app/clinica/paciente/:userId.
  if (href === '/app/clinica/pacientes') {
    return pathname.startsWith('/app/clinica')
  }
  return pathname.startsWith(href)
}

export function AppSidebar({ displayName, role, profileMemoryEnabled = false }: AppSidebarProps) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const items = role === 'clinician' ? clinicianNav : profileMemoryEnabled
    ? [...patientNav, { href: '/app/perfil', label: 'Lo que recuerda Serenia', icon: Brain }]
    : patientNav

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-4 px-3 pt-4 group-data-[collapsible=icon]:px-2">
        <Link
          href="/app"
          onClick={() => { if (isMobile) setOpenMobile(false) }}
          className="flex items-center gap-2.5 rounded-md text-lg font-semibold tracking-tight text-stone-900 outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center"
        >
          <BrandOrb className="size-7" />
          <span className="group-data-[collapsible=icon]:hidden">Serenia</span>
        </Link>
        <div className="rounded-xl border border-sidebar-border bg-white/60 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <p className="text-xs text-muted-foreground">
            {role === 'clinician' ? 'Panel clínico' : 'Tu espacio'}
          </p>
          <p className="truncate text-sm font-medium">
            {displayName || 'Sin nombre'}
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-3 group-data-[collapsible=icon]:px-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = isNavItemActive(item.href, pathname)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} aria-current={isActive ? 'page' : undefined} onClick={() => { if (isMobile) setOpenMobile(false) }} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className="h-10 rounded-lg px-3 data-active:bg-white data-active:text-primary data-active:shadow-sm data-active:ring-1 data-active:ring-stone-900/5"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 pb-4 group-data-[collapsible=icon]:px-2">
        <form action={logoutAction}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="submit"
                tooltip="Cerrar sesión"
                className="h-10 rounded-lg px-3 text-muted-foreground"
              >
                <LogOut />
                <span>Cerrar sesión</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
