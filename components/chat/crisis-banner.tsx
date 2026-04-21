export function CrisisBanner() {
  return (
    <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
      Si estás en crisis:{' '}
      <a href="tel:024" className="font-medium underline underline-offset-2">
        Línea 024
      </a>{' '}
      (gratuito, 24h) ·{' '}
      <a href="tel:112" className="font-medium underline underline-offset-2">
        112 emergencias
      </a>
    </div>
  )
}
