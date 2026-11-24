'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registerAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoaderCircle } from 'lucide-react'
import { authButtonClass, authErrorClass, authInputClass, authLabelClass } from '@/components/auth/field-styles'

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, undefined)

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <div
          role="alert"
          aria-live="polite"
          className={authErrorClass}
        >
          {state.error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email" className={authLabelClass}>Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@email.com" className={authInputClass} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className={authLabelClass}>Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          className={authInputClass}
          required
          autoComplete="new-password"
        />
        <p className="text-xs text-stone-500">
          Mínimo 8 caracteres, una mayúscula y un número.
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white/70 p-3.5 text-sm leading-relaxed text-stone-600">
        <input type="checkbox" name="consent" className="mt-1 size-4 shrink-0 accent-teal-700" />
        <span>Entiendo que es un entorno de pruebas con <Link href="/terminos" className="underline">borrador técnico de uso</Link> e <Link href="/privacidad" className="underline">información provisional de privacidad</Link>. La aceptación vigente se completa en el perfil.</span>
      </label>
      <Button type="submit" disabled={pending} className={authButtonClass}>
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {pending ? 'Creando…' : 'Crear cuenta'}
      </Button>
    </form>
  )
}
