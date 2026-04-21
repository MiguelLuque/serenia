'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { RegisterSchema, LoginSchema } from '@/lib/auth/schemas'
import { closeSession, getOrResolveActiveSession } from '@/lib/sessions/service'

type ActionState = { error?: string } | undefined

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = RegisterSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    consent: formData.get('consent') === 'on',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createAuthenticatedClient()
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback` },
  })
  if (error) return { error: traducirSupabaseError(error.message) }

  redirect('/registro/verifica-email')
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return { error: 'Credenciales inválidas' }

  const supabase = await createAuthenticatedClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: traducirSupabaseError(error.message) }

  revalidatePath('/', 'layout')
  redirect('/app')
}

export async function logoutAction() {
  const supabase = await createAuthenticatedClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const active = await getOrResolveActiveSession(supabase, user.id)
    if (active) await closeSession(supabase, active.id, 'user_request')
  }
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

function traducirSupabaseError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email o contraseña incorrectos'
  if (msg.includes('User already registered')) return 'Ya existe una cuenta con ese email'
  if (msg.includes('Email not confirmed')) return 'Debes verificar tu email primero'
  return 'Error de autenticación'
}
