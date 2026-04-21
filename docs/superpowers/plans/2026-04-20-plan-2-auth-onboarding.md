# Plan 2 — Auth, registro y onboarding de perfil

**Branch base:** `feat/plan-1-foundations` (merge a `main` antes de empezar).
**Branch de trabajo:** `feat/plan-2-auth-onboarding`.

## Objetivo

Al terminar este plan:
- Un usuario puede registrarse con email + password, verificar su email y crear su cuenta.
- Tras registrarse, se le obliga a completar un perfil socio-demográfico antes de acceder al resto de la app.
- Existe un gate de edad ≥18.
- El usuario acepta los consentimientos requeridos (tratamiento de datos + cláusula clínica).
- El sistema distingue entre pacientes y clínicos (campo `role`).
- Hay middleware que protege rutas autenticadas y redirige a onboarding si el perfil está incompleto.
- El primer clínico/admin se puede promover con un script.

## Fuera de alcance

- OAuth social (Google/Apple). Solo email+password.
- Magic link. Se deja para una iteración futura.
- Reset de password por email. Supabase lo soporta; lo activamos pero sin página custom todavía.
- Eliminar cuenta desde UI (el RPC `gdpr_erase_user` ya existe — UI en Plan 6).

---

## Pre-requisitos

Antes de empezar:
- `feat/plan-1-foundations` merged a `main`.
- `npx supabase login` + `npx supabase link --project-ref brpozobkoatabctjjadc` ya hecho (necesario para regenerar types).
- Proyecto Supabase tiene el flag *Confirm email* activado (Authentication → Providers → Email).

---

## Task 1: Migración — añadir `role` y campos de perfil

**Files:**
- Create: `supabase/migrations/20260420000001_user_profiles_extend.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- supabase/migrations/20260420000001_user_profiles_extend.sql

-- Role del usuario: paciente o clínico (admin).
create type user_role as enum ('patient', 'clinician');

alter table user_profiles
  add column role           user_role not null default 'patient',
  add column display_name   text,
  add column birth_date     date,
  add column sex            text check (sex in ('female', 'male', 'non_binary', 'prefer_not_say')),
  add column country        text,
  add column city           text,
  add column employment     text check (employment in ('employed', 'unemployed', 'student', 'retired', 'homemaker', 'other')),
  add column relationship_status text check (relationship_status in ('single', 'in_relationship', 'married', 'divorced', 'widowed', 'other')),
  add column living_with    text check (living_with in ('alone', 'with_family', 'with_partner', 'with_roommates', 'other')),
  add column prior_therapy  boolean,
  add column current_medication boolean,
  add column reason_for_consulting text;

-- onboarding_status ya existe en enums.sql (migración 20260419000001).
-- Añadimos el campo si no está ya en user_profiles.
alter table user_profiles
  add column onboarding_status onboarding_status not null default 'not_started';
```

> Si `onboarding_status` ya estaba en `user_profiles` porque la migración 04 lo añadió, elimina la segunda cláusula.

- [ ] **Step 2: Verificar schema**

```bash
grep onboarding_status supabase/migrations/20260419000002_user_tables.sql
```

Si aparece ya el campo, quita el segundo `ALTER TABLE` de esta migración.

- [ ] **Step 3: Aplicar y commitear**

```bash
npx supabase db push
git add supabase/migrations/20260420000001_user_profiles_extend.sql
git commit -m "feat: extend user_profiles with role and demographic fields"
```

---

## Task 2: Migración — trigger de creación de perfil

**Files:**
- Create: `supabase/migrations/20260420000002_user_profile_trigger.sql`

Cuando Supabase Auth crea una fila en `auth.users`, queremos que automáticamente aparezca una fila en `user_profiles` con `role='patient'` y `onboarding_status='not_started'`.

- [ ] **Step 1: Escribir el trigger**

```sql
-- supabase/migrations/20260420000002_user_profile_trigger.sql

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, role, onboarding_status)
  values (new.id, 'patient', 'not_started');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
```

- [ ] **Step 2: Aplicar y commitear**

```bash
npx supabase db push
git add supabase/migrations/20260420000002_user_profile_trigger.sql
git commit -m "feat: auto-create user_profiles row on auth.users insert"
```

---

## Task 3: Regenerar tipos Supabase

- [ ] **Step 1: Regenerar types.ts**

```bash
npx supabase gen types typescript --linked > lib/supabase/types.ts
```

- [ ] **Step 2: Verificar**

```bash
grep -E "user_role|role:" lib/supabase/types.ts | head -5
npx tsc --noEmit
```

Expected: la enum `user_role` aparece, typecheck 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "chore: regenerate supabase types after user_profiles extension"
```

---

## Task 4: Middleware de sesión (Next.js)

**Files:**
- Create: `middleware.ts`
- Create: `lib/supabase/middleware.ts`

- [ ] **Step 1: Helper de middleware**

Crear `lib/supabase/middleware.ts`:

```ts
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

  return response
}
```

- [ ] **Step 2: Root middleware**

Crear `middleware.ts` en la raíz:

```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts lib/supabase/middleware.ts
git commit -m "feat: Next.js middleware for Supabase session handling"
```

---

## Task 5: Schemas de validación (Zod)

**Files:**
- Create: `lib/auth/schemas.ts`
- Create: `tests/auth/schemas.test.ts`

- [ ] **Step 1: Test primero**

```ts
// tests/auth/schemas.test.ts
import { describe, it, expect } from 'vitest'
import {
  RegisterSchema,
  LoginSchema,
  ProfileSchema,
  isAdult,
} from '@/lib/auth/schemas'

describe('RegisterSchema', () => {
  it('acepta email y password válidos', () => {
    const r = RegisterSchema.safeParse({ email: 'a@b.com', password: 'Abcdef12', consent: true })
    expect(r.success).toBe(true)
  })
  it('rechaza password corta', () => {
    const r = RegisterSchema.safeParse({ email: 'a@b.com', password: 'Abc1', consent: true })
    expect(r.success).toBe(false)
  })
  it('exige consent=true', () => {
    const r = RegisterSchema.safeParse({ email: 'a@b.com', password: 'Abcdef12', consent: false })
    expect(r.success).toBe(false)
  })
})

describe('LoginSchema', () => {
  it('acepta email y password no vacíos', () => {
    expect(LoginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true)
  })
})

describe('isAdult', () => {
  it('true para ≥18', () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 18)
    expect(isAdult(d)).toBe(true)
  })
  it('false para <18', () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 17)
    expect(isAdult(d)).toBe(false)
  })
})

describe('ProfileSchema', () => {
  it('exige adulto', () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() - 10)
    const r = ProfileSchema.safeParse({
      displayName: 'Ana',
      birthDate: d.toISOString().slice(0, 10),
      sex: 'female',
      country: 'ES',
      city: 'Madrid',
      employment: 'employed',
      relationshipStatus: 'single',
      livingWith: 'alone',
      priorTherapy: false,
      currentMedication: false,
      reasonForConsulting: 'Ansiedad',
    })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Implementación**

```ts
// lib/auth/schemas.ts
import { z } from 'zod'

export function isAdult(birthDate: Date): boolean {
  const today = new Date()
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())
  return birthDate.getTime() <= cutoff.getTime()
}

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().regex(PASSWORD_RE, 'Mínimo 8 caracteres, una mayúscula y un número'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar los términos' }) }),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const ProfileSchema = z.object({
  displayName: z.string().min(1).max(80),
  birthDate: z.string().refine((s) => isAdult(new Date(s)), 'Debes ser mayor de 18 años'),
  sex: z.enum(['female', 'male', 'non_binary', 'prefer_not_say']),
  country: z.string().min(2).max(64),
  city: z.string().min(1).max(120),
  employment: z.enum(['employed', 'unemployed', 'student', 'retired', 'homemaker', 'other']),
  relationshipStatus: z.enum(['single', 'in_relationship', 'married', 'divorced', 'widowed', 'other']),
  livingWith: z.enum(['alone', 'with_family', 'with_partner', 'with_roommates', 'other']),
  priorTherapy: z.boolean(),
  currentMedication: z.boolean(),
  reasonForConsulting: z.string().min(10).max(2000),
})

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ProfileInput = z.infer<typeof ProfileSchema>
```

- [ ] **Step 3: Run tests**

```bash
npm test -- tests/auth/schemas.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add lib/auth/schemas.ts tests/auth/schemas.test.ts
git commit -m "feat: auth and profile Zod schemas with adult gate"
```

---

## Task 6: Server actions — register, login, logout

**Files:**
- Create: `app/(auth)/actions.ts`

- [ ] **Step 1: Implementación**

```ts
// app/(auth)/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { RegisterSchema, LoginSchema } from '@/lib/auth/schemas'

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
```

- [ ] **Step 2: Verificar build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/actions.ts
git commit -m "feat: server actions for register, login, logout"
```

---

## Task 7: Callback route para confirmación de email

**Files:**
- Create: `app/auth/callback/route.ts`

Supabase redirige aquí tras la confirmación de email con `?code=<exchange>`.

```ts
// app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  if (code) {
    const supabase = await createAuthenticatedClient()
    await supabase.auth.exchangeCodeForSession(code)
  }
  return NextResponse.redirect(`${origin}/app`)
}
```

Commit:

```bash
git add app/auth/callback/route.ts
git commit -m "feat: auth callback for email confirmation"
```

---

## Task 8: Páginas de registro y login

**Files:**
- Create: `app/(auth)/registro/page.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/(auth)/registro/verifica-email/page.tsx`
- Create: `components/auth/register-form.tsx`
- Create: `components/auth/login-form.tsx`

- [ ] **Step 1: Componentes de formulario**

Implementar con `useActionState` (React 19) + shadcn (`Input`, `Label`, `Button`). Los formularios llaman a las server actions. Textos en español.

- [ ] **Step 2: Páginas simples**

```tsx
// app/(auth)/registro/page.tsx
import { RegisterForm } from '@/components/auth/register-form'
export default function Page() {
  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-2xl font-semibold mb-6">Crear cuenta</h1>
      <RegisterForm />
    </div>
  )
}
```

Página `verifica-email` con mensaje estático ("revisa tu bandeja de entrada").

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\) components/auth
git commit -m "feat: login and register pages"
```

---

## Task 9: Onboarding — formulario de perfil

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `app/onboarding/actions.ts`
- Create: `components/onboarding/profile-form.tsx`

El paciente llega aquí tras confirmar email. Formulario con todos los campos socio-demográficos; al enviar, actualiza `user_profiles` y marca `onboarding_status='completed'`.

- [ ] **Step 1: Action**

```ts
// app/onboarding/actions.ts
'use server'
import { redirect } from 'next/navigation'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { ProfileSchema } from '@/lib/auth/schemas'

export async function submitProfile(_prev: unknown, formData: FormData) {
  const parsed = ProfileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('user_profiles')
    .update({
      display_name: parsed.data.displayName,
      birth_date: parsed.data.birthDate,
      sex: parsed.data.sex,
      country: parsed.data.country,
      city: parsed.data.city,
      employment: parsed.data.employment,
      relationship_status: parsed.data.relationshipStatus,
      living_with: parsed.data.livingWith,
      prior_therapy: parsed.data.priorTherapy,
      current_medication: parsed.data.currentMedication,
      reason_for_consulting: parsed.data.reasonForConsulting,
      onboarding_status: 'completed',
    })
    .eq('user_id', user.id)

  if (error) return { error: 'No se pudo guardar el perfil' }
  redirect('/app')
}
```

- [ ] **Step 2: Form**

UI con shadcn: un solo paso vertical, labels claros en español, validación cliente + servidor. Sin pasos múltiples por ahora (KISS).

- [ ] **Step 3: Commit**

```bash
git add app/onboarding components/onboarding
git commit -m "feat: onboarding profile form"
```

---

## Task 10: Guard de onboarding

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Ampliar middleware**

Si `user` autenticado y `path` empieza por `/app` y `onboarding_status != 'completed'`, redirigir a `/onboarding`.

```ts
// dentro de updateSession, tras obtener `user`:
if (user && path.startsWith('/app')) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_status')
    .eq('user_id', user.id)
    .single()
  if (profile?.onboarding_status !== 'completed') {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }
}

if (user && path === '/onboarding') {
  // si ya está completo, fuera de onboarding
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('onboarding_status')
    .eq('user_id', user.id)
    .single()
  if (profile?.onboarding_status === 'completed') {
    return NextResponse.redirect(new URL('/app', request.url))
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts lib/supabase/middleware.ts
git commit -m "feat: middleware guard for onboarding completion"
```

---

## Task 11: Dashboard placeholder por rol

**Files:**
- Create: `app/app/page.tsx`
- Create: `app/app/layout.tsx`
- Create: `components/app/header.tsx`

`/app` muestra un saludo diferente según `role`:
- `patient`: "Hola, {displayName}. Aquí podrás iniciar una sesión (próximamente)." + botón logout
- `clinician`: "Panel clínico (próximamente)." + botón logout

El layout lee el perfil una vez y lo pasa al header.

- [ ] **Step 1: Implementación**

```tsx
// app/app/layout.tsx
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
      <Header displayName={profile?.display_name ?? ''} role={profile?.role ?? 'patient'} />
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </>
  )
}
```

```tsx
// app/app/page.tsx
import { createAuthenticatedClient } from '@/lib/supabase/server'

export default async function AppHome() {
  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, display_name')
    .eq('user_id', user!.id)
    .single()

  if (profile?.role === 'clinician') {
    return <p className="text-slate-600">Panel clínico (próximamente — Plan 5).</p>
  }
  return (
    <div>
      <h2 className="text-xl font-semibold">Hola, {profile?.display_name}.</h2>
      <p className="mt-2 text-slate-600">
        Aquí podrás iniciar una sesión con Serenia. Chat y sesiones llegan en los Planes 3 y 4.
      </p>
    </div>
  )
}
```

`Header` es un componente simple con el nombre + botón logout (llama a `logoutAction`).

- [ ] **Step 2: Commit**

```bash
git add app/app components/app
git commit -m "feat: authenticated app shell with role-aware home"
```

---

## Task 12: Script para promover a clínico

**Files:**
- Create: `scripts/promote-clinician.ts`

- [ ] **Step 1: Script**

```ts
// scripts/promote-clinician.ts
// Uso: npx dotenv -e .env.local -- npx tsx scripts/promote-clinician.ts <email>
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]
if (!email) {
  console.error('Uso: promote-clinician.ts <email>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data: users, error: listErr } = await supabase.auth.admin.listUsers()
if (listErr) {
  console.error(listErr)
  process.exit(1)
}
const match = users.users.find((u) => u.email === email)
if (!match) {
  console.error(`No hay usuario con email ${email}`)
  process.exit(1)
}

const { error } = await supabase
  .from('user_profiles')
  .update({ role: 'clinician' })
  .eq('user_id', match.id)

if (error) {
  console.error(error)
  process.exit(1)
}
console.log(`Usuario ${email} promovido a clinician`)
```

- [ ] **Step 2: Instalar dependencias si hace falta**

```bash
npm install -D tsx dotenv-cli
```

- [ ] **Step 3: Commit**

```bash
git add scripts/promote-clinician.ts package.json package-lock.json
git commit -m "feat: script to promote a user to clinician role"
```

---

## Task 13: RLS — clínicos pueden leer todos los perfiles de pacientes

La tabla `user_profiles` actualmente tiene RLS `select using (user_id = auth.uid())`. Los clínicos necesitan leer perfiles de pacientes para el panel (Plan 5). Preparamos la política ahora.

**Files:**
- Create: `supabase/migrations/20260420000003_rls_clinician_read.sql`

```sql
-- supabase/migrations/20260420000003_rls_clinician_read.sql

-- Función helper: ¿el usuario actual es clínico?
create or replace function is_clinician()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from user_profiles
    where user_id = auth.uid() and role = 'clinician'
  );
$$;

-- Política adicional: clínicos leen todos los user_profiles.
create policy "user_profiles_select_clinician"
  on user_profiles for select
  using (is_clinician());
```

Commit:

```bash
git add supabase/migrations/20260420000003_rls_clinician_read.sql
git commit -m "feat: RLS policy letting clinicians read all user profiles"
```

---

## Task 14: Landing page pública

**Files:**
- Modify: `app/page.tsx`

La home pública ya existe de Plan 1. Actualizar con enlaces a `/login` y `/registro`.

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-4xl font-semibold text-slate-800">Serenia</h1>
        <p className="mt-3 text-slate-500">Apoyo conversacional para ansiedad y depresión.</p>
      </div>
      <div className="flex gap-3">
        <a className="rounded-full bg-slate-900 px-5 py-2.5 text-white" href="/registro">
          Crear cuenta
        </a>
        <a className="rounded-full border border-slate-300 px-5 py-2.5" href="/login">
          Entrar
        </a>
      </div>
    </main>
  )
}
```

Commit:

```bash
git add app/page.tsx
git commit -m "feat: public landing with auth CTAs"
```

---

## Task 15: Verificación final

- [ ] **Step 1: Tests**

```bash
npm test
```

Esperado: todos los tests del Plan 1 + los nuevos de schemas pasan.

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Smoke test manual**

```bash
npm run dev
```

Probar en el navegador:
1. `/` muestra landing → clic "Crear cuenta"
2. `/registro` — validación de password, consent, gate de edad (viene en onboarding)
3. Submit → `/registro/verifica-email`
4. Abrir email de Supabase (consola dev de Supabase) → clic enlace → redirige a `/auth/callback` → `/app` → middleware redirige a `/onboarding`
5. Rellenar perfil → envío → `/app` muestra "Hola, {displayName}"
6. Logout → vuelve a `/`
7. Login → `/app`
8. Promover usuario con el script → logout/login → `/app` muestra "Panel clínico"

- [ ] **Step 4: Commit final**

```bash
git commit --allow-empty -m "feat: Plan 2 auth & onboarding complete"
```

- [ ] **Step 5: PR**

```bash
git push -u origin feat/plan-2-auth-onboarding
gh pr create --title "feat: Plan 2 — auth & onboarding" --body "$(cat <<'EOF'
## Resumen
- Registro con email+password y verificación.
- Perfil socio-demográfico obligatorio antes de acceder a /app.
- Middleware que protege rutas y gestiona onboarding.
- Rol patient/clinician con política RLS y script de promoción.

## Tests
- [ ] Registro → email → login → onboarding → /app
- [ ] Usuario sin perfil completo es redirigido a /onboarding
- [ ] Script promote-clinician.ts cambia el role
- [ ] Clínico ve panel placeholder en /app
EOF
)"
```

---

## Deliverables

- Registro, login, logout funcionando end-to-end.
- Perfil socio-demográfico obligatorio con gate de edad ≥18.
- Dos roles (`patient`, `clinician`) con política RLS y script admin.
- Middleware que protege rutas y fuerza onboarding.
- UI en español.

**Siguiente:** Plan 3 — Chat con la IA y cuestionarios embebidos.
