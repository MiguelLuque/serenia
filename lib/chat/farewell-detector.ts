import type { UIMessage } from 'ai'

/**
 * Plan 7 T3c — detección server-side de "despedida sin tool de cierre".
 *
 * El prompt prohíbe explícitamente que el asistente diga frases conversacionales
 * de despedida sin haber invocado antes el tool de cierre correspondiente
 * (`propose_close_session` / `confirm_close_session` / `close_session_crisis`).
 *
 * Esta función inspecciona los `parts` del último responseMessage del asistente
 * y devuelve `true` si:
 *   - Algún `text` part contiene una frase de despedida, Y
 *   - NO hay ningún `tool-*` part de cierre en el mismo turno.
 *
 * Es una señal para `console.warn` (audit trail), NO un bloqueador.
 */

const FAREWELL_PATTERNS: RegExp[] = [
  /lo\s+dejamos\s+aqu[ií]/i,
  /por\s+hoy\s+(ya\s+)?est[áa]/i,
  /hasta\s+la\s+pr[óo]xima/i,
  /nos\s+vemos/i,
  /(?:^|[\s,.;])cu[íi]date(?:[\s,.;]|$)/i,
  /(?:^|[\s,.;])cu[íi]date\s+mucho/i,
  /buenas\s+noches\s*[.!]?$/i,
  /(?:^|[\s,.;])un\s+abrazo(?:[\s,.;]|$)/i,
]

const CLOSE_TOOL_NAMES = new Set([
  'propose_close_session',
  'confirm_close_session',
  'close_session_crisis',
])

type Part = UIMessage['parts'][number]

function isTextPart(part: Part): part is Extract<Part, { type: 'text' }> {
  return part?.type === 'text'
}

function isCloseToolPart(part: Part): boolean {
  // AI SDK v6 emits tool parts as `tool-<toolName>`. We also accept the bare
  // tool name in case future SDK versions normalize the shape.
  if (!part || typeof part !== 'object') return false
  const type = (part as { type?: unknown }).type
  if (typeof type !== 'string') return false
  if (CLOSE_TOOL_NAMES.has(type)) return true
  if (type.startsWith('tool-')) {
    const toolName = type.slice('tool-'.length)
    return CLOSE_TOOL_NAMES.has(toolName)
  }
  return false
}

export function textContainsFarewell(text: string): boolean {
  if (!text) return false
  for (const pattern of FAREWELL_PATTERNS) {
    if (pattern.test(text)) return true
  }
  return false
}

export function detectFarewellWithoutCloseTool(parts: Part[]): boolean {
  if (!Array.isArray(parts) || parts.length === 0) return false

  const fullText = parts
    .filter(isTextPart)
    .map((p) => p.text ?? '')
    .join('\n')

  if (!textContainsFarewell(fullText)) return false

  const hasCloseTool = parts.some(isCloseToolPart)
  return !hasCloseTool
}
