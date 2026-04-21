import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  const isPublic =
    path.startsWith('/login') ||
    path.startsWith('/registro') ||
    path.startsWith('/auth/callback') ||
    path === '/'

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (path === '/login' || path === '/registro')) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  if (user && path.startsWith('/app')) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_status')
      .eq('user_id', user.id)
      .single()
    if (profile?.onboarding_status !== 'complete') {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  if (user && path === '/onboarding') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_status')
      .eq('user_id', user.id)
      .single()
    if (profile?.onboarding_status === 'complete') {
      return NextResponse.redirect(new URL('/app', request.url))
    }
  }

  return response
}
