import React from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ profile: { display_name: '', informal_name: 'Caso navegador', role: 'patient' } }))
vi.mock('@/lib/server/supabase/server', () => ({
  createAuthenticatedClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'fictional-patient' } } }) },
    from: () => ({
      select: (columns: string) => ({ eq: () => ({ single: async () => ({
        data: Object.fromEntries(columns.split(',').map((key) => key.trim()).map((key) => [key, mocks.profile[key as keyof typeof mocks.profile]])),
      }) }) }),
    }),
  }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), usePathname: () => '/app' }))
import AppLayout from '@/app/app/layout'
import { AppSidebar } from '@/components/app/app-sidebar'

beforeEach(() => { mocks.profile.display_name = '' })

async function sidebarName() {
  const layout = await AppLayout({ children: null })
  const sidebar = React.Children.toArray(layout.props.children).find((child) => React.isValidElement(child) && child.type === AppSidebar)
  if (!React.isValidElement<{ displayName: string }>(sidebar)) throw new Error('Missing app sidebar')
  return sidebar.props.displayName
}

it('uses the preferred intake name when the legacy display name is empty', async () => {
  expect(await sidebarName()).toBe('Caso navegador')
})

it('retains the existing nonempty display name precedence', async () => {
  mocks.profile.display_name = 'Nombre existente'
  expect(await sidebarName()).toBe('Nombre existente')
})
