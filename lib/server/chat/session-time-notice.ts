import { sessionTiming } from '@/lib/shared/chat/session-time'

export function buildSessionTimeNotice(openedAt: string, now = Date.now()) {
  const { expiresAt } = sessionTiming(openedAt, now)
  const minutes = Math.max(0, Math.ceil((expiresAt - now) / 60_000))
  return `[TIEMPO DE SESIÓN] Quedan ${minutes} minutos del máximo de 60 minutos (reloj del servidor). ${minutes <= 10
    ? 'Avisa con calma si aún no lo has hecho, recoge lo importante y acuerda un siguiente paso breve. No abras exploraciones largas ni nuevos cuestionarios. Evita repetir propuestas de cierre si la persona ya respondió.'
    : 'Ajusta el ritmo al tiempo disponible; no es necesario anunciar el contador en cada respuesta.'} El límite lo aplica el servidor; no depende de aceptar una propuesta. Una propuesta de cierre anticipado sí necesita confirmación. No afirmes que el cierre o el informe ya están guardados: solo el servidor confirma ese resultado. La seguridad inmediata tiene prioridad.\n`
}
