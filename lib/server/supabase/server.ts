import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import type { Database } from '@/lib/shared/supabase/types'

export async function createAuthenticatedClient(response?: NextResponse) {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet, headers) => {
          if (response) {
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
            Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value))
          }
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch (error) {
            // Server Components are read-only; the proxy owns refresh there.
            // Keep unexpected storage errors visible in actions/route handlers.
            if (!(error instanceof Error) || !error.message.includes('Cookies can only be modified')) throw error
          }
        },
      },
    }
  )
}

export function createServiceRoleClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
