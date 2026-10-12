'use client'

import Link from 'next/link'
import { CURRENT_ACCEPTANCE_VERSION } from '@/lib/shared/onboarding/acceptance'
import { useActionState } from 'react'
import { submitProfile } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export function ProfileForm({ initial }: { initial?: { informal_name: string; pronouns: string | null; birth_date: string | null; reason_for_consulting: string | null } }) {
  const [state, formAction, pending] = useActionState(submitProfile, undefined)

  return (
    // A returned validation error fulfills the action and triggers React's form
    // reset. Successful onboarding redirects, so preserve the draft on reset.
    <form action={formAction} onReset={(event) => event.preventDefault()} className="space-y-6">
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
          defaultValue={initial?.informal_name}
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
          defaultValue={initial?.pronouns ?? ''}
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
        <Input id="birthDate" name="birthDate" type="date" defaultValue={initial?.birth_date ?? ''} required />
        <p className="text-sm text-slate-600">Acceso para personas de 18 años o más.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reasonForConsulting">¿Qué te trae a Serenia?</Label>
        <Textarea
          id="reasonForConsulting"
          name="reasonForConsulting"
          defaultValue={initial?.reason_for_consulting ?? ''}
          required
          minLength={10}
          maxLength={2000}
          rows={4}
        />
      </div>

      <input type="hidden" name="acceptanceVersion" value={CURRENT_ACCEPTANCE_VERSION} />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptance" required className="mt-1" />
        <span>He leído el <Link href="/terminos" className="underline">borrador técnico de uso</Link> y la <Link href="/privacidad" className="underline">información provisional de privacidad</Link> ({CURRENT_ACCEPTANCE_VERSION}). Entiendo las limitaciones de la IA y que no hay atención de emergencias ni revisión humana inmediata garantizada. Esta aceptación se registra con fecha y versión para pruebas; no autoriza un lanzamiento.</span>
      </label>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Guardando…' : 'Completar perfil'}
      </Button>
    </form>
  )
}
