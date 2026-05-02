'use client'

import { useActionState } from 'react'
import { submitProfile } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ProfileForm() {
  const [state, formAction, pending] = useActionState(submitProfile, undefined)

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="informalName">
          Nombre por el que prefieres que te llamemos
        </Label>
        <Input
          id="informalName"
          name="informalName"
          type="text"
          required
          minLength={1}
          maxLength={80}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pronouns">Pronombres</Label>
        <select
          id="pronouns"
          name="pronouns"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">Selecciona…</option>
          <option value="el">Él</option>
          <option value="ella">Ella</option>
          <option value="elle">Elle</option>
          <option value="prefer_not_say">Prefiero no decirlo</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate">Fecha de nacimiento</Label>
        <Input id="birthDate" name="birthDate" type="date" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reasonForConsulting">¿Qué te trae a Serenia?</Label>
        <Textarea
          id="reasonForConsulting"
          name="reasonForConsulting"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Guardando…' : 'Completar perfil'}
      </Button>
    </form>
  )
}
