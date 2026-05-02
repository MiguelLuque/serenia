---
name: asq
code: ASQ
domain: risk
version: 1.0
language: es-ES
scoring_strategy: conditional
source_reference: "Horowitz LM et al. Ask Suicide-Screening Questions (ASQ). NIMH"
last_reviewed: 2026-04-21
owner: "@psicologo"
status: deprecated-2026-05-02
deprecated_reason: "Plan 8 Fase 1 sustituye ASQ por C-SSRS (Columbia Suicide Severity Rating Scale, screener) con granularidad de 5 bandas (negative / low_risk / moderate_risk / high_risk / acute_risk) — ver ADR-016. La eliminación física del cuestionario ASQ + scorer + branches del safety-state ocurre en Fase 1 T1.7 + Fase 2. Mantener este doc como referencia histórica hasta entonces."
---

> ⚠️ **DEPRECATED 2026-05-02** — ver `deprecated_reason` en frontmatter. ASQ será reemplazado por C-SSRS en Plan 8 Fase 1+2. La especificación nueva está en `docs/handoff/para-pablo-plan-8/01-cuestionarios.md` sección C-SSRS.

# ASQ — Ask Suicide-Screening Questions (ES)

Cribado breve de riesgo suicida. 4 items binarios; si cualquiera es positivo, se aplica el ítem 5 (riesgo agudo).

## Instrucciones que ve el paciente

Voy a hacerte unas preguntas cortas. Responde con sinceridad — tu psicólogo va a revisar esta conversación.

## Opciones (items 1–4 y 5)

| Valor | Etiqueta |
|-------|----------|
| 0 | No |
| 1 | Sí |

## Items 1–4 (screening)

1. En las últimas semanas, ¿has deseado estar muerto/a?
2. En las últimas semanas, ¿has sentido que tu familia o amigos/as estarían mejor si tú no estuvieras?
3. En la última semana, ¿has pensado en suicidarte?
4. ¿Alguna vez has intentado suicidarte?

## Item 5 (solo si algún item 1–4 es "Sí")

5. ¿Estás pensando en suicidarte ahora mismo?

## Scoring

- Cualquier "Sí" en items 1–4 ⇒ banda `positive`. `requires_review=true`.
- Todos los items 1–4 en "No" ⇒ banda `negative`.
- Si banda `positive` **Y** item 5 = "Sí" ⇒ `flags: [{itemOrder:5, reason:"acute_risk"}]` ⇒ `risk_event` `suicidal_ideation` severity `critical` + activar protocolo de crisis inmediato.
- Si banda `positive` sin item 5 positivo ⇒ `risk_event` `suicidal_ideation` severity `high`.
