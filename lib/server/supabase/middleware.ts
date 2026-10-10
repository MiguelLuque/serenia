import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/shared/supabase/types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const refreshHeaders = new Headers()
  function redirect(path: string) {
    const redirected = NextResponse.redirect(new URL(path, request.url))
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie))
    refreshHeaders.forEach((value, name) => redirected.headers.set(name, value))
    return redirected
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          const previousCookies = response.cookies.getAll()
          response = NextResponse.next({ request })
          previousCookies.forEach(cookie => response.cookies.set(cookie))
          Object.entries(headers).forEach(([name, value]) => refreshHeaders.set(name, value))
          refreshHeaders.forEach((value, name) => response.headers.set(name, value))
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
    return redirect('/login')
  }

  if (user && (path === '/login' || path === '/registro')) {
    return redirect('/app')
  }

  if (user && path.startsWith('/app')) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_status')
      .eq('user_id', user.id)
      .single()
    if (profile?.onboarding_status !== 'complete') {
      return redirect('/onboarding')
    }
  }

  if (user && path === '/onboarding') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_status')
      .eq('user_id', user.id)
      .single()
    if (profile?.onboarding_status === 'complete') {
      return redirect('/app')
    }
  }

  return response
}
