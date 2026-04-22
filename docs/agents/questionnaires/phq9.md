---
name: phq9
code: PHQ9
domain: depression
version: 1.0
language: es-ES
scoring_strategy: sum
source_reference: "Kroenke K, Spitzer RL, Williams JB. The PHQ-9. J Gen Intern Med. 2001"
last_reviewed: 2026-04-21
owner: "@psicologo"
---

# PHQ-9 — Patient Health Questionnaire-9 (ES)

Cuestionario validado de cribado de síntomas depresivos de las últimas 2 semanas. Puntuación 0–27.

## Instrucciones que ve el paciente

Durante las **últimas 2 semanas**, ¿con qué frecuencia te han molestado los siguientes problemas?

## Opciones (comunes a todos los items)

| Valor | Etiqueta |
|-------|----------|
| 0 | Ningún día |
| 1 | Varios días |
| 2 | Más de la mitad de los días |
| 3 | Casi todos los días |

## Items

1. Poco interés o placer en hacer cosas.
2. Te has sentido decaído/a, deprimido/a o sin esperanzas.
3. Problemas para dormir o dormir demasiado.
4. Te has sentido cansado/a o con poca energía.
5. Poco apetito o has comido en exceso.
6. Te has sentido mal contigo mismo/a — o que eres un fracaso o que has defraudado a tu familia.
7. Dificultad para concentrarte en cosas como leer o ver la tele.
8. Te has movido o hablado tan despacio que otras personas lo han notado — o al contrario, has estado tan inquieto/a que te movías más de lo habitual.
9. Pensamientos de que estarías mejor muerto/a o de hacerte daño de alguna forma.

**Flag de riesgo:** item 9 con valor ≥ 1 ⇒ crear `risk_event` `suicidal_ideation` severity `high`, `requires_review=true`.

## Bandas de severidad

| Rango | Banda |
|-------|-------|
| 0–4   | `minimal` |
| 5–9   | `mild` |
| 10–14 | `moderate` |
| 15–19 | `moderately_severe` |
| 20–27 | `severe` |
