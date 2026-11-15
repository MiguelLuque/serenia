'use client'

import { CrisisBanner } from '@/components/chat/crisis-banner'

export default function SessionError({ retry }: { retry: () => void }) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div role="alert">
        <h1 className="font-semibold">No se ha podido cargar la sesión</h1>
        <p>Inténtalo de nuevo para comprobar su estado.</p>
      </div>
      <button type="button" onClick={retry} className="rounded border border-slate-300 px-3 py-2 underline">
        Reintentar
      </button>
      <CrisisBanner />
    </div>
  )
}
