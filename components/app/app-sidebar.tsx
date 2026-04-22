'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, NotebookText, LogOut } from 'lucide-react'
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
} from '@/components/ui/sidebar'
import { logoutAction } from '@/app/(auth)/actions'

interface AppSidebarProps {
  displayName: string
  role: 'patient' | 'clinician'
}

const patientNav = [
  { href: '/app', label: 'Inicio', icon: Home },
  { href: '/app/sesiones', label: 'Sesiones', icon: NotebookText },
]

export function AppSidebar({ displayName, role }: AppSidebarProps) {
  const pathname = usePathname()
  const items = patientNav

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="px-2 py-1">
          <p className="text-xs text-muted-foreground">
            {role === 'clinician' ? 'Panel clínico' : 'Serenia'}
          </p>
          <p className="truncate text-sm font-medium">
            {displayName || 'Sin nombre'}
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive =
                  item.href === '/app'
                    ? pathname === '/app'
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
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
      <SidebarFooter>
        <form action={logoutAction}>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="submit"
                tooltip="Cerrar sesión"
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
