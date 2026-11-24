'use client'

import { useActionState } from 'react'
import { loginAction } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoaderCircle } from 'lucide-react'
import { authButtonClass, authErrorClass, authInputClass, authLabelClass } from '@/components/auth/field-styles'

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined)

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
          autoComplete="current-password"
        />
      </div>
      <Button type="submit" disabled={pending} className={authButtonClass}>
        {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
        {pending ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
