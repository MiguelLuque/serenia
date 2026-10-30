'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { setProfileEnabledAction, reviewProfileObservationAction, type ProfileActionResult } from '@/app/app/perfil/actions'
import type { ProfileMemoryPage } from '@/lib/shared/profile/schema'

type Observation = ProfileMemoryPage['observations'][number]
type Source = { quote: string; source_created_at: string }
const categories: Record<Observation['category'], string> = {
  concern: 'Preocupación', goal: 'Objetivo', context: 'Contexto', functioning: 'Vida cotidiana',
  resource: 'Recurso', preference: 'Preferencia', history: 'Antecedente', agreement: 'Acuerdo',
}
const timeScopes: Record<Observation['time_scope'], string> = {
  current: 'Actual en la fecha de la cita', historical: 'Relatado como pasado', unspecified: 'Sin momento especificado',
}
const statuses: Record<Observation['status'], string> = {
  pending: 'Extraído · pendiente de tu revisión', confirmed: 'Confirmado por ti', rejected: 'Descartado por ti', superseded: 'Sustituido',
}
const dateFormat = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid' })
function SourceDate({ value }: { value: string }) {
  return <time dateTime={value}>{dateFormat.format(new Date(value))}</time>
}

export function ProfileMemoryView({ memory, replacementSources = {}, isOlderPage = false }: {
  memory: ProfileMemoryPage | null
  isOlderPage?: boolean
  replacementSources?: Record<string, Source>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<ProfileActionResult | null>(null)
  function save(action: () => Promise<ProfileActionResult>) {
    if (pending) return
    setResult(null)
    startTransition(async () => {
      try { setResult(await action()) }
      catch { setResult({ ok: false, error: 'No se pudo guardar el cambio. Inténtalo de nuevo.' }) }
    })
  }
  const observationsById = new Map(memory?.observations.map(observation => [observation.id, observation]))

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/app" className="text-sm underline underline-offset-4">Volver a la conversación</Link>
        <h1 className="text-2xl font-semibold">Lo que recuerda Serenia</h1>
        <p>Si activas la memoria, Serenia podrá extraer citas de tus mensajes nuevos para dar contexto a próximas conversaciones. Puede equivocarse o recoger algo que ya no sea actual. Activarla no recupera automáticamente conversaciones anteriores.</p>
        <p>Son palabras que has compartido, no diagnósticos. Confirmar una cita significa que la confirmas tú: no es una validación clínica ni una revisión de Pablo.</p>
        <p>Para corregir un dato, cuéntalo en la conversación. Se conservará como una nueva cita para revisar, sin editar tus palabras anteriores.</p>
        <p>Desactivar detiene nuevas extracciones y el uso de estas citas como contexto. Conserva las citas para que puedas revisarlas o descartarlas y no borra tus conversaciones, escalas ni informes. No puede deshacer una petición al modelo que ya haya comenzado.</p>
      </div>
      {isOlderPage ? <Link href="/app/perfil" className="text-sm underline underline-offset-4">Volver a citas recientes</Link> : null}
      {memory === null ? (
        <div className="space-y-3">
          <p role="alert">No se pudo cargar la memoria. Puedes seguir conversando o volver a intentarlo.</p>
          <Button variant="outline" onClick={() => router.refresh()}>Recargar perfil</Button>
        </div>
      ) : (
        <>
          <section aria-label="Activación de la memoria" className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">Memoria {memory.enabled ? 'activada' : 'desactivada'}</p>
            <Button disabled={pending} onClick={() => save(() => setProfileEnabledAction(!memory.enabled))}>
              {pending ? 'Guardando…' : memory.enabled ? 'Desactivar memoria' : 'Activar memoria'}
            </Button>
          </section>
          {result ? result.ok ? <p role="status">Cambio guardado.</p> : (
            <div className="space-y-2">
              <p role="alert">{result.error}</p>
              {result.conflict ? <Button variant="outline" onClick={() => { setResult(null); router.refresh() }}>Recargar perfil</Button> : null}
            </div>
          ) : null}
          {memory.pending_jobs > 0 ? <p>Hay mensajes pendientes de procesar. Las citas aparecerán cuando puedan incorporarse; puedes seguir conversando y recargar el perfil más tarde.</p> : null}
          {memory.failed_jobs > 0 ? <p>Algunos mensajes no pudieron incorporarse a la memoria. Puedes seguir conversando; las citas que ya ves siguen disponibles para revisar.</p> : null}
          <section aria-label="Citas recordadas" className="space-y-4" aria-busy={pending}>
            {memory.observations.length === 0 ? <p>Todavía no hay citas guardadas.</p> : memory.observations.map(observation => {
              const prior = observation.supersedes_id ? observationsById.get(observation.supersedes_id) ?? replacementSources[observation.supersedes_id] : undefined
              return (
                <article key={observation.id} className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm text-muted-foreground">{categories[observation.category]} · Mensaje tuyo del <SourceDate value={observation.source_created_at} /></p>
                  <blockquote className="whitespace-pre-wrap break-words border-l-2 pl-3">{observation.quote}</blockquote>
                  <p className="text-sm">{timeScopes[observation.time_scope]}</p>
                  <p className="font-medium">{statuses[observation.status]}</p>
                  {observation.disputed ? <p>En disputa: hay una corrección pendiente. Esta cita no se usa como un dato confirmado mientras se revisa.</p> : null}
                  {observation.status === 'pending' && observation.supersedes_id ? (
                    <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
                      {prior ? <><p>Si confirmas, sustituiría esta cita anterior del <SourceDate value={prior.source_created_at} />:</p><blockquote className="whitespace-pre-wrap break-words">{prior.quote}</blockquote></> : <p>No se pudo mostrar la cita anterior a la que se refiere esta corrección. Tenlo en cuenta antes de confirmar; puedes recargar el perfil.</p>}
                    </div>
                  ) : null}
                  {observation.status === 'pending' || observation.status === 'confirmed' ? (
                    <div className="flex flex-wrap gap-2">
                      {observation.status === 'pending' ? <Button disabled={pending} onClick={() => save(() => reviewProfileObservationAction({ observationId: observation.id, action: 'confirm', expectedUpdatedAt: observation.updated_at }))}>Confirmar</Button> : null}
                      <Button variant="outline" disabled={pending} onClick={() => save(() => reviewProfileObservationAction({ observationId: observation.id, action: 'reject', expectedUpdatedAt: observation.updated_at }))}>Descartar</Button>
                    </div>
                  ) : null}
                </article>
              )
            })}
          </section>
          {memory.next_cursor ? (
            <Link href={`/app/perfil?${new URLSearchParams({ before_created_at: memory.next_cursor.source_created_at, before_id: memory.next_cursor.id })}`} className="inline-block text-sm underline underline-offset-4">Ver citas anteriores</Link>
          ) : null}
        </>
      )}
    </div>
  )
}
