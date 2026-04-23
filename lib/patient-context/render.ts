import 'server-only'
import type { PatientContext } from '@/lib/patient-context/builder'

// ── Date formatting ──────────────────────────────────────────────────────────

/** Convert ISO date string (YYYY-MM-DD or ISO datetime) to DD/MM/YYYY */
function formatDate(iso: string): string {
  const datePart = iso.split('T')[0] ?? iso
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year}`
}

// ── Questionnaire helpers ────────────────────────────────────────────────────

const CODE_LABELS: Record<string, string> = {
  PHQ9: 'PHQ-9',
  GAD7: 'GAD-7',
  ASQ: 'ASQ',
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  return String(delta)
}

function renderQuestionnaires(
  recentQuestionnaires: PatientContext['recentQuestionnaires'],
): string {
  if (recentQuestionnaires.length === 0) return ''

  const lines = recentQuestionnaires.map((q) => {
    const label = CODE_LABELS[q.code] ?? q.code
    const date = formatDate(q.scoredAt)
    const base = `- ${label}: ${q.score} (${q.band}) el ${date}`
    if (q.deltaVsPrevious !== null) {
      return `${base} — antes ${formatDelta(q.deltaVsPrevious)}`
    }
    return base
  })

  return `Cuestionarios recientes:\n${lines.join('\n')}`
}

// ── Text truncation helpers ──────────────────────────────────────────────────

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

function renderList(items: string[], maxLen: number, maxItems: number): string[] {
  return items.slice(0, maxItems).map((item) => truncate(item, maxLen))
}

// ── Patient header ───────────────────────────────────────────────────────────

function renderPatientLine(
  ctx: PatientContext,
): string {
  const name = ctx.patient.displayName ?? 'el paciente'
  const agePart = ctx.patient.age !== null ? `, ${ctx.patient.age} años` : ''
  const sessionPart = `Sesión nº ${ctx.sessionNumber}`
  const daysPart =
    ctx.previousSession !== null
      ? ` (han pasado ${ctx.previousSession.daysAgo} días desde la anterior)`
      : ''

  return `Paciente: ${name}${agePart}. ${sessionPart}${daysPart}.`
}

// ── Pending tasks ────────────────────────────────────────────────────────────

function renderPendingTasks(tasks: PatientContext['pendingTasks']): string {
  if (tasks.length === 0) return ''

  const shown = tasks.slice(0, 5)
  const overflow = tasks.length - shown.length

  const lines = shown.map(
    (t) => `- "${t.descripcion}" (${t.estado}, acordada el ${formatDate(t.acordadaEn)})`,
  )
  if (overflow > 0) {
    lines.push(`- +${overflow} acuerdos más`)
  }

  return `Acuerdos abiertos de sesiones anteriores:\n${lines.join('\n')}`
}

// ── Risk assessment ──────────────────────────────────────────────────────────

function renderRiskAssessment(
  risk: { suicidality: string; self_harm: string },
): string {
  return `Riesgo clínico registrado:\n- Ideación suicida: ${risk.suicidality} — autolesión: ${risk.self_harm}`
}

// ── Tier A / historic instructions ──────────────────────────────────────────

const TIER_A_INSTRUCTIONS = `Instrucciones para esta sesión:
- Esto es un contexto heredado; no presumas continuidad en tu primer mensaje.
- En tu PRIMER mensaje está prohibido citar contenido concreto del snapshot (tareas, síntomas, puntuaciones, nombres). Abre con una invitación abierta.
- A partir del tercer turno, si el paciente no ha abierto tema por su cuenta y la conversación ha llegado a una pausa natural, puedes ofrecer un puente hacia UN (no dos) acuerdo pendiente, como opción y no como agenda: "si te apetece, podemos mirar cómo fue lo de X, o si prefieres empezar por otra cosa, también".
- Si el paciente contradice el snapshot, valida primero ("tienes razón, gracias por aclararlo"), no justifiques la fuente, y sigue por donde él lleva.
- No cites al clínico, no cites diagnósticos ni hipótesis clínicas, no repitas datos privados como muestra de memoria.
- No re-explores en profundidad lo ya mapeado en el snapshot.`

const HISTORIC_EXTRA_INSTRUCTION =
  '- Trata este snapshot como referencia de hace meses; el paciente probablemente ha cambiado. Pregunta antes de asumir.'

// ── Tier B instructions ──────────────────────────────────────────────────────

const TIER_B_INSTRUCTIONS = `Instrucciones para esta sesión:
- Este resumen NO está revisado por un clínico. Úsalo solo para no empezar completamente en frío. No cites hipótesis clínicas ni diagnósticos — no hay ninguno validado.
- Mismas reglas de apertura que con contexto validado: turn 1 sin referencias concretas, ofrece puente solo a partir del turn 3, valida si el paciente contradice.`

// ── Block assembly helpers ────────────────────────────────────────────────────

type AssembleResult = { block: string; truncatedSections: string[] }

function assembleTierAOrHistoric(
  ctx: PatientContext,
  header: string,
  isHistoric: boolean,
): AssembleResult {
  const validated = ctx.validated!
  const summary = validated.summary

  const chiefComplaint = truncate(summary.chief_complaint, 300)

  const presentingIssues = renderList(summary.presenting_issues, 120, 6)
  const areasForExploration = renderList(summary.areas_for_exploration, 120, 6)

  // For historic: omit pending tasks if ALL tasks predate the validated assessment
  let tasksSection = ''
  if (ctx.pendingTasks.length > 0) {
    if (isHistoric) {
      const reviewedAt = validated.reviewedAt
      const somePostdate = ctx.pendingTasks.some((t) => t.acordadaEn >= reviewedAt)
      if (somePostdate) {
        tasksSection = renderPendingTasks(ctx.pendingTasks)
      }
    } else {
      tasksSection = renderPendingTasks(ctx.pendingTasks)
    }
  }

  const riskSection = renderRiskAssessment(summary.risk_assessment)
  const questionnairesSection = renderQuestionnaires(ctx.recentQuestionnaires)
  const patientLine = renderPatientLine(ctx)

  const instructions = isHistoric
    ? `${TIER_A_INSTRUCTIONS}\n${HISTORIC_EXTRA_INSTRUCTION}`
    : TIER_A_INSTRUCTIONS

  // Build sections conditionally
  const parts: string[] = []
  parts.push(header)
  parts.push('')
  parts.push(patientLine)
  parts.push('')
  parts.push(`Motivo de consulta:\n${chiefComplaint}`)

  if (presentingIssues.length > 0) {
    parts.push('')
    parts.push(`Síntomas presentes:\n${presentingIssues.map((i) => `- ${i}`).join('\n')}`)
  }

  if (questionnairesSection) {
    parts.push('')
    parts.push(questionnairesSection)
  }

  if (areasForExploration.length > 0) {
    parts.push('')
    parts.push(
      `Áreas a explorar pendientes:\n${areasForExploration.map((i) => `- ${i}`).join('\n')}`,
    )
  }

  if (tasksSection) {
    parts.push('')
    parts.push(tasksSection)
  }

  parts.push('')
  parts.push(riskSection)
  parts.push('')
  parts.push(instructions)
  parts.push('')
  parts.push('---')

  let block = parts.join('\n')
  const truncatedSections: string[] = []

  // ── Truncation by priority (2500-char cap) ────────────────────────────────
  if (block.length <= 2500) return { block, truncatedSections }

  // Step 1: drop areas_for_exploration section
  truncatedSections.push('areas_for_exploration')
  const partsNoAreas: string[] = []
  partsNoAreas.push(header)
  partsNoAreas.push('')
  partsNoAreas.push(patientLine)
  partsNoAreas.push('')
  partsNoAreas.push(`Motivo de consulta:\n${chiefComplaint}`)

  if (presentingIssues.length > 0) {
    partsNoAreas.push('')
    partsNoAreas.push(`Síntomas presentes:\n${presentingIssues.map((i) => `- ${i}`).join('\n')}`)
  }

  if (questionnairesSection) {
    partsNoAreas.push('')
    partsNoAreas.push(questionnairesSection)
  }

  if (tasksSection) {
    partsNoAreas.push('')
    partsNoAreas.push(tasksSection)
  }

  partsNoAreas.push('')
  partsNoAreas.push(riskSection)
  partsNoAreas.push('')
  partsNoAreas.push(instructions)
  partsNoAreas.push('')
  partsNoAreas.push('---')

  block = partsNoAreas.join('\n')
  if (block.length <= 2500) return { block, truncatedSections }

  // Step 2: also drop presenting_issues section
  truncatedSections.push('presenting_issues')
  const partsNoPresenting: string[] = []
  partsNoPresenting.push(header)
  partsNoPresenting.push('')
  partsNoPresenting.push(patientLine)
  partsNoPresenting.push('')
  partsNoPresenting.push(`Motivo de consulta:\n${chiefComplaint}`)

  if (questionnairesSection) {
    partsNoPresenting.push('')
    partsNoPresenting.push(questionnairesSection)
  }

  if (tasksSection) {
    partsNoPresenting.push('')
    partsNoPresenting.push(tasksSection)
  }

  partsNoPresenting.push('')
  partsNoPresenting.push(riskSection)
  partsNoPresenting.push('')
  partsNoPresenting.push(instructions)
  partsNoPresenting.push('')
  partsNoPresenting.push('---')

  block = partsNoPresenting.join('\n')
  if (block.length <= 2500) return { block, truncatedSections }

  // Step 3: truncate chief_complaint to 150 chars and hard-cut at 2500
  truncatedSections.push('chief_complaint_capped')
  const shortComplaint = truncate(summary.chief_complaint, 150)
  const partsFinal: string[] = []
  partsFinal.push(header)
  partsFinal.push('')
  partsFinal.push(patientLine)
  partsFinal.push('')
  partsFinal.push(`Motivo de consulta:\n${shortComplaint}`)

  if (questionnairesSection) {
    partsFinal.push('')
    partsFinal.push(questionnairesSection)
  }

  if (tasksSection) {
    partsFinal.push('')
    partsFinal.push(tasksSection)
  }

  partsFinal.push('')
  partsFinal.push(riskSection)
  partsFinal.push('')
  partsFinal.push(instructions)
  partsFinal.push('')
  partsFinal.push('---')

  block = partsFinal.join('\n')
  if (block.length <= 2500) return { block, truncatedSections }

  return { block: block.slice(0, 2500), truncatedSections }
}

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * Assemble the patient-context block for the system prompt and report which
 * sections (if any) were dropped by the 2500-char truncation cascade.
 *
 * Only tierA/historic paths can truncate; tierB and 'none' blocks are compact
 * by construction and always return `truncatedSections: []`.
 */
export function renderPatientContextBlockWithMeta(
  ctx: PatientContext,
): { block: string; truncatedSections: string[] } {
  switch (ctx.tier) {
    case 'tierA': {
      const ageInDays = ctx.validated!.ageInDays
      const header = `[CONTEXTO DEL PACIENTE — última revisión clínica de hace ${ageInDays} días]`
      return assembleTierAOrHistoric(ctx, header, false)
    }

    case 'historic': {
      const ageInDays = ctx.validated!.ageInDays
      const header = `[CONTEXTO HISTÓRICO DEL PACIENTE — última revisión de hace ${ageInDays} días; puede estar desactualizado]`
      return assembleTierAOrHistoric(ctx, header, true)
    }

    case 'tierB': {
      const draft = ctx.tierBDraft!
      const summary = draft.summary

      const chiefComplaint = truncate(summary.chief_complaint, 300)
      const presentingIssues = renderList(summary.presenting_issues, 120, 6)

      const patientLine = renderPatientLine(ctx)
      const questionnairesSection = renderQuestionnaires(ctx.recentQuestionnaires)

      const parts: string[] = []
      parts.push('[CONTEXTO DEL PACIENTE — sesión anterior sin revisión clínica todavía]')
      parts.push('')
      parts.push(patientLine)
      parts.push('')
      parts.push('En la sesión anterior se registró:')
      parts.push(`- Motivo: ${chiefComplaint}`)

      if (presentingIssues.length > 0) {
        parts.push(`- Temas presentes: ${presentingIssues.join(', ')}`)
      }

      if (questionnairesSection) {
        parts.push(`- Cuestionarios: ${ctx.recentQuestionnaires.map((q) => `${CODE_LABELS[q.code] ?? q.code} ${q.score} (${q.band})`).join(', ')}`)
      }

      parts.push('')
      parts.push(TIER_B_INSTRUCTIONS)
      parts.push('')
      parts.push('---')

      return { block: parts.join('\n'), truncatedSections: [] }
    }

    case 'none':
    default: {
      const block = [
        '[CONTEXTO DEL PACIENTE — primera sesión]',
        'No hay evaluación clínica previa ni sesiones anteriores registradas con este paciente. Usa la postura de intake habitual.',
        '',
        '---',
      ].join('\n')
      return { block, truncatedSections: [] }
    }
  }
}

/**
 * Thin wrapper that returns only the rendered block string. Kept for callers
 * (and tests) that don't need truncation metadata.
 */
export function renderPatientContextBlock(ctx: PatientContext): string {
  return renderPatientContextBlockWithMeta(ctx).block
}

export function computeRiskOpeningNotice(ctx: PatientContext): string | null {
  switch (ctx.riskState) {
    case 'none':
      return null
    case 'acute':
      return "[AVISO DE CONTINUIDAD — RIESGO AGUDO] Protocolo de crisis inmediato: valida sin alarmismo, ofrece Línea 024 textualmente, si hay señales de riesgo inmediato llama a close_session con reason='crisis_detected'. No inicies otras líneas de conversación hasta asegurar la continuidad de riesgo."
    case 'active':
      return '[AVISO DE CONTINUIDAD — RIESGO ACTIVO] Abre con un check-in cálido y específico sobre cómo está hoy respecto a la ideación reportada. Si el paciente abre con afecto positivo claro, haz el check-in en UNA frase breve y devuélvele el espacio inmediatamente. Ten la Línea 024 lista.'
    case 'watch':
      return '[AVISO DE CONTINUIDAD — VIGILANCIA] En la sesión / informe anterior se registraron señales leves. Abre normalmente, pero mantén atención a reaparición; si el paciente abre con afecto positivo, no fuerces un check-in de seguridad.'
  }
}
