/** Preserve source/provenance without turning an automatic lexical event into
 * a confirmed clinical finding. The stored event and its severity are intact. */
export function formatRiskEventForAssessment(row: {
  created_at: string; risk_type: string; severity: string; source_type: string; payload_json: unknown
}): string {
  const payload = row.payload_json
  const lexical = payload && typeof payload === 'object' && !Array.isArray(payload)
    && 'signal' in payload && payload.signal === 'textual_crisis'
  return `- ${row.created_at}: ${row.risk_type} (${row.severity}) from ${row.source_type}${lexical
    ? ' — observación léxica automática pendiente de contraste con el relato; no es ideación o urgencia confirmada por sí sola'
    : ''}`
}
