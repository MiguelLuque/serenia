# Changelog de prompts y protocolos

Cada cambio en roles, protocolos o prompts debe registrarse aquí con motivo clínico.

| Fecha      | Archivo                                   | Cambio                           | Autor         | Motivo clínico      |
|------------|-------------------------------------------|----------------------------------|---------------|---------------------|
| 2026-04-21 | roles/session-therapist.md                | Versión inicial                  | @psicologo    | Puesta en marcha    |
| 2026-04-21 | protocols/crisis.md                       | Versión inicial                  | @psicologo    | Puesta en marcha    |
| 2026-04-21 | protocols/session-flow.md                 | Versión inicial                  | @psicologo    | Puesta en marcha    |
| 2026-04-21 | prompts/session-therapist.md              | Versión inicial                  | @psicologo    | Puesta en marcha    |
| 2026-04-25 | prompts/session-therapist.md              | T3a v2 — anti-repetición safety  | @psicologo    | Bug Paciente A: IA repreguntaba seguridad tras ASQ negativo |
| 2026-04-25 | prompts/clinical-report.md                | Reglas anti-sobreclasificación   | @psicologo    | Plan 7 T-B — disclaimers ASQ vs PHQ-9 ítem 9 |
| 2026-05-02 | prompts/session-therapist.draft-v2.md     | Borrador v2.0 (Plan 8)           | @claude       | Pendiente firma Pablo. TCC/ACT, 8 sesiones, C-SSRS sustituye ASQ, lista negra ampliada |
| 2026-05-02 | prompts/clinical-report.draft-v2.md       | Borrador v2.0 (Plan 8)           | @claude       | Pendiente firma Pablo. Nuevos campos protocol_phase + techniques_applied; bandas ampliadas BDI-II/BAI/STAI/HAM-D |
| 2026-05-02 | roles/session-therapist.md                | Borrado                          | @claude       | Plan 8 ADR-020: rol redefinido en prompts/session-therapist.md (v1.1 vivo, draft-v2 pendiente Pablo). Doc obsoleto. |
| 2026-05-02 | protocols/session-flow.md                 | Borrado                          | @claude       | Plan 8 ADR-015: flujo migra a protocolo de 8 sesiones documentado en chat-flow.md. Doc obsoleto. |
| 2026-05-02 | questionnaires/asq.md                     | Borrado                          | @claude       | Plan 8 Fase 1+2 sustituye ASQ por C-SSRS (ADR-016). Copy clínica del ASQ vive en BD seed hasta Fase 2. |
| 2026-05-03 | questionnaires/{bdi2,bai,stai,cssrs}.md   | Versiones iniciales              | @psicologo    | Copy literal de los 4 cuadernillos firmados por Pablo (PDFs en `handoff/respuesta de pablo/`). Sustituye HAM-D que queda en standby. |
| 2026-05-03 | prompts/session-therapist.draft-v2.md     | Bump a v2.1.0-draft (11 cambios) | @claude       | Recoge ediciones firmadas por Pablo: agencia, validación 2x, tecnicismos+explicación, ejemplos individualizados, psicoeducación como paso 0, problemas espontáneos, copy de rechazo nuevo, salida del protocolo, frecuencia semanal, referencia a clínico (Pablo si conoce), HAM-D fuera. |
| 2026-05-03 | prompts/clinical-report.draft-v2.md       | Bump a v2.1.0-draft (5 cambios)  | @claude       | Recoge ediciones firmadas por Pablo: campo `diagnostic_impression` (solo clínico), aclaración `substance_use_acute='suspected'` con literatura, `patient_facing_summary` SÍ recuerda tareas, sin SLA visible al usuario, HAM-D fuera. |
| 2026-05-03 | architecture/decisions.md                 | ADR-024                          | @claude       | Desviaciones del Plan 8 tras feedback de Pablo: HAM-D fuera, BAI 3 bandas, STAI por sexo, C-SSRS lifetime + override since-last-visit, toggle clinician-knows-user, edad mínima 18, diagnósticos fuera de scope, frecuencia semanal estricta, orientación diagnóstica. |
