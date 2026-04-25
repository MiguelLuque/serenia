import { SAFETY_RESOURCES } from '@/lib/clinical/safety-resources'

export function CrisisBanner() {
  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
      Si estás en crisis:{' '}
      <a
        href={SAFETY_RESOURCES.suicide.href}
        className="font-medium underline underline-offset-2"
      >
        {SAFETY_RESOURCES.suicide.name}
      </a>{' '}
      (gratuito, 24h) ·{' '}
      <a
        href={SAFETY_RESOURCES.emergency.href}
        className="font-medium underline underline-offset-2"
      >
        {SAFETY_RESOURCES.emergency.phone} emergencias
      </a>
    </div>
  )
}
