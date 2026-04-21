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
        <Label htmlFor="displayName">Nombre o alias</Label>
        <Input id="displayName" name="displayName" type="text" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="birthDate">Fecha de nacimiento</Label>
        <Input id="birthDate" name="birthDate" type="date" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sex">Sexo</Label>
        <select
          id="sex"
          name="sex"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">Selecciona…</option>
          <option value="female">Mujer</option>
          <option value="male">Hombre</option>
          <option value="non_binary">No binario</option>
          <option value="prefer_not_say">Prefiero no decirlo</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="country">País</Label>
        <Input id="country" name="country" type="text" required defaultValue="ES" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">Ciudad</Label>
        <Input id="city" name="city" type="text" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="employment">Situación laboral</Label>
        <select
          id="employment"
          name="employment"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">Selecciona…</option>
          <option value="employed">Empleado/a</option>
          <option value="unemployed">En paro</option>
          <option value="student">Estudiante</option>
          <option value="retired">Jubilado/a</option>
          <option value="homemaker">Tareas del hogar</option>
          <option value="other">Otro</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="relationshipStatus">Estado civil</Label>
        <select
          id="relationshipStatus"
          name="relationshipStatus"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">Selecciona…</option>
          <option value="single">Soltero/a</option>
          <option value="in_relationship">En pareja</option>
          <option value="married">Casado/a</option>
          <option value="divorced">Divorciado/a</option>
          <option value="widowed">Viudo/a</option>
          <option value="other">Otro</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="livingWith">Con quién vives</Label>
        <select
          id="livingWith"
          name="livingWith"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
        >
          <option value="">Selecciona…</option>
          <option value="alone">Solo/a</option>
          <option value="with_family">Con familia</option>
          <option value="with_partner">Con pareja</option>
          <option value="with_roommates">Con compañeros/as</option>
          <option value="other">Otro</option>
        </select>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="priorTherapy" className="mt-1" />
        <span>He ido a terapia antes</span>
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="currentMedication" className="mt-1" />
        <span>Actualmente tomo medicación psiquiátrica</span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="reasonForConsulting">¿Qué te trae a Serenia?</Label>
        <Textarea
          id="reasonForConsulting"
          name="reasonForConsulting"
          required
          minLength={10}
          rows={4}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Guardando…' : 'Completar perfil'}
      </Button>
    </form>
  )
}
