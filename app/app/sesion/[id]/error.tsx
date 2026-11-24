'use client'

import { CrisisBanner } from '@/components/chat/crisis-banner'

export default function SessionError({ retry }: { retry: () => void }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 rounded-2xl border border-stone-200/80 bg-white p-5">
      <div role="alert">
        <h1 className="landing-serif text-2xl text-stone-900">No se ha podido cargar la sesión</h1>
        <p className="mt-1 text-muted-foreground">Inténtalo de nuevo para comprobar su estado.</p>
      </div>
      <button type="button" onClick={retry} className="inline-flex min-h-10 items-center rounded-full bg-primary px-5 font-medium text-primary-foreground hover:bg-teal-800">
        Reintentar
      </button>
      <CrisisBanner />
    </div>
  )
}
