---
name: bai
code: BAI
domain: anxiety
version: 1.0
language: es-ES
scoring_strategy: sum
source_reference: "Beck, A.T., & Steer, R.A. (1988). BAI — versión cuadernillo facilitado por @psicologo el 2026-05-02"
last_reviewed: 2026-05-03
owner: "@psicologo"
---

# BAI — Inventario de Ansiedad de Beck (ES)

Inventario de 21 ítems sobre síntomas comunes de ansiedad **en la última semana, incluyendo hoy**. Puntuación 0–63.

> Copy literal del cuadernillo facilitado por Pablo (`ANSIEDAD_BECK.pdf`, archivo en `docs/handoff/respuesta de pablo/`). No editar los ítems sin firma clínica.

## Disparo (regla en el system prompt)

Sólo se propone tras un **GAD-7 con banda `moderate` o superior** (puntuación ≥10), para profundizar.

## Instrucciones que ve el paciente

A continuación encontrará una lista de síntomas comunes de la ansiedad. Lea cada uno de los ítems atentamente, e indique cuánto le ha afectado **en la última semana incluyendo hoy**.

## Opciones (comunes a todos los ítems)

| Valor | Etiqueta        |
|-------|-----------------|
| 0     | En absoluto     |
| 1     | Levemente       |
| 2     | Moderadamente   |
| 3     | Severamente     |

## Items

1. Torpe o entumecido.
2. Acalorado.
3. Con temblor en las piernas.
4. Incapaz de relajarse.
5. Con temor a que ocurra lo peor.
6. Mareado, o que se le va la cabeza.
7. Con latidos del corazón fuertes y acelerados.
8. Inestable.
9. Atemorizado o asustado.
10. Nervioso.
11. Con sensación de bloqueo.
12. Con temblores en las manos.
13. Inquieto, inseguro.
14. Con miedo a perder el control.
15. Con sensación de ahogo.
16. Con temor a morir.
17. Con miedo.
18. Con problemas digestivos.
19. Con desvanecimientos.
20. Con rubor facial.
21. Con sudores, fríos o calientes.

## Bandas de severidad

| Rango | Banda      |
|-------|------------|
| 0–21  | `minimal`  |
| 22–35 | `moderate` |
| 36–63 | `severe`   |

> **Desviación del plan.** El plan original (`docs/superpowers/plans/refactored-sparking-koala.md`) proponía 4 bandas (0-7 / 8-15 / 16-25 / 26-63). Pablo firmó **3 bandas** el 2026-05-03 (archivo `01-cuestionarios.md`). Documentado en ADR-024.
