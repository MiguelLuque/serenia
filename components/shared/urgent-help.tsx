import { SAFETY_RESOURCES } from '@/lib/shared/safety-resources'

/**
 * Aviso fijo de ayuda inmediata para páginas públicas y de acceso.
 *
 * Regla de copy (Miguel, 24-11-2026): los avisos fijos hablan de «necesitar
 * ayuda inmediata», nunca de hacerse daño ni de quitarse la vida. Las
 * preguntas clínicas del chat siguen su propio protocolo.
 */
export function UrgentHelpText({ linkClassName = '', lead = true }: { linkClassName?: string; lead?: boolean }) {
  const { suicide, emergency } = SAFETY_RESOURCES
  return (
    <>
      {lead && (
        <>
          <strong className="font-semibold">Serenia no es un servicio de urgencias.</strong>{' '}
        </>
      )}
      Si necesitas ayuda inmediata, llama a la{' '}
      <a className={linkClassName} href={suicide.href}>
        {suicide.name}
      </a>{' '}
      (gratuita, 24 horas) o al{' '}
      <a className={linkClassName} href={emergency.href}>
        {emergency.phone}
      </a>{' '}
      en caso de emergencia.
    </>
  )
}

/** Versión en texto plano, para respuestas de FAQ y similares. */
export const URGENT_HELP_SENTENCE = `si necesitas ayuda inmediata, llama a la ${SAFETY_RESOURCES.suicide.name} (gratuita, 24 horas) o al ${SAFETY_RESOURCES.emergency.phone} en caso de emergencia.`
