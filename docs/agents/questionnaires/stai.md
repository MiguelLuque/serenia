---
name: stai
code: STAI
domain: anxiety
version: 1.0
language: es-ES
scoring_strategy: stai_formula
source_reference: "Spielberger, C.D. (1983). STAI — versión cuadernillo facilitado por @psicologo el 2026-05-02 (TEA Ediciones, ES)"
last_reviewed: 2026-05-03
owner: "@psicologo"
---

# STAI — Inventario de Ansiedad Estado-Rasgo (ES)

40 ítems totales: 20 de **estado** (cómo se siente *ahora mismo, en este momento*) + 20 de **rasgo** (cómo se siente *en general, en la mayoría de las ocasiones*). Puntuación cruda por subescala 0–60. Bandas distintas por sexo.

> Copy literal del cuadernillo facilitado por Pablo (`ANSIEDAD_STAI.pdf`, archivo en `docs/handoff/respuesta de pablo/`). No editar los ítems sin firma clínica.

## Disparo (regla en el system prompt)

Sólo se propone tras un **BAI con banda `moderate` o superior**, y siempre que el paciente describa ansiedad crónica (>6 meses, no reactiva). Si la ansiedad es claramente reactiva a un evento puntual, no se propone STAI.

## Escalas

### Ansiedad-Estado (ítems 1-20)

> Instrucciones: A continuación encontrará unas frases que se utilizan corrientemente para describirse uno a sí mismo. Lea cada frase y señale la puntuación de 0 a 3 que indique mejor cómo se *siente usted ahora mismo*, en este momento. No hay respuestas buenas ni malas. No emplee demasiado tiempo en cada frase y conteste señalando la respuesta que mejor describa su situación presente.

| Valor | Etiqueta     |
|-------|--------------|
| 0     | Nada         |
| 1     | Algo         |
| 2     | Bastante     |
| 3     | Mucho        |

1. Me siento calmado.
2. Me siento seguro.
3. Estoy tenso.
4. Estoy contrariado.
5. Me siento cómodo (estoy a gusto).
6. Me siento alterado.
7. Estoy preocupado ahora por posibles desgracias futuras.
8. Me siento descansado.
9. Me siento angustiado.
10. Me siento confortable.
11. Tengo confianza en mí mismo.
12. Me siento nervioso.
13. Estoy desasosegado.
14. Me siento muy «atado» (como oprimido).
15. Estoy relajado.
16. Me siento satisfecho.
17. Estoy preocupado.
18. Me siento aturdido y sobreexcitado.
19. Me siento alegre.
20. En este momento me siento bien.

### Ansiedad-Rasgo (ítems 21-40)

> Instrucciones: A continuación encontrará unas frases que se utilizan corrientemente para describirse uno a sí mismo. Lea cada frase y señale la puntuación de 0 a 3 que indique mejor cómo se *siente usted en general*, en la mayoría de las ocasiones. No hay respuestas buenas ni malas. No emplee demasiado tiempo en cada frase y conteste señalando la respuesta que mejor describa cómo se siente usted generalmente.

| Valor | Etiqueta     |
|-------|--------------|
| 0     | Casi nunca   |
| 1     | A veces      |
| 2     | A menudo     |
| 3     | Casi siempre |

21. Me siento bien.
22. Me canso rápidamente.
23. Siento ganas de llorar.
24. Me gustaría ser tan feliz como otros.
25. Pierdo oportunidades por no decidirme pronto.
26. Me siento descansado.
27. Soy una persona tranquila, serena y sosegada.
28. Veo que las dificultades se amontonan y no puedo con ellas.
29. Me preocupo demasiado por cosas sin importancia.
30. Soy feliz.
31. Suelo tomar las cosas demasiado seriamente.
32. Me falta confianza en mí mismo.
33. Me siento seguro.
34. No suelo afrontar las crisis o dificultades.
35. Me siento triste (melancólico).
36. Estoy satisfecho.
37. Me rondan y molestan pensamientos sin importancia.
38. Me afectan tanto los desengaños que no puedo olvidarlos.
39. Soy una persona estable.
40. Cuando pienso sobre asuntos y preocupaciones actuales me pongo tenso y agitado.

## Scoring

### Ítems directos vs invertidos

| Subescala | Directos                                          | Inversos                                |
|-----------|---------------------------------------------------|-----------------------------------------|
| Estado    | 3, 4, 6, 7, 9, 12, 13, 14, 17, 18                 | 1, 2, 5, 8, 10, 11, 15, 16, 19, 20      |
| Rasgo     | 22, 23, 24, 25, 28, 29, 31, 32, 34, 35, 37, 38, 40 | 21, 26, 27, 30, 33, 36, 39             |

### Inversión de puntuación (sólo para ítems inversos)

| Respuesta | Valor invertido |
|-----------|-----------------|
| 0         | 3               |
| 1         | 2               |
| 2         | 1               |
| 3         | 0               |

### Fórmula final

- **Estado** = `30 + (suma directos) - (suma inversos sin invertir)` ⇒ rango [0, 60]
- **Rasgo** = `21 + (suma directos) - (suma inversos sin invertir)` ⇒ rango [0, 60]

Equivalente operacional: invertir cada ítem inverso (0↔3, 1↔2) y sumar los 20 ítems de cada subescala. Las constantes (30 estado, 21 rasgo) compensan el rango de los ítems inversos antes de la transformación.

## Bandas por sexo

> ⚠️ El cuadernillo de Pablo da bandas separadas para hombres y mujeres. Para asignar la banda necesitamos un **`sex` clínico** (no `pronouns`, que es independiente). Mapping pendiente de cierre con Pablo (ADR-024 documenta la decisión provisional: si `pronouns ∈ {él}` ⇒ hombre; `{ella}` ⇒ mujer; otros ⇒ usar el corte de mujeres como conservador, marcar `band_assignment_uncertain=true` para revisión clínica).

### HOMBRES

| Subescala | Sin ansiedad | Promedio | Ligeramente alta | Alta    |
|-----------|--------------|----------|------------------|---------|
| Estado    | 0–13         | 14–19    | 20–28            | 29–60   |
| Rasgo     | 0–13         | 14–19    | 20–25            | 26–60   |

### MUJERES

| Subescala | Sin ansiedad | Promedio | Ligeramente alta | Alta    |
|-----------|--------------|----------|------------------|---------|
| Estado    | 0–14         | 15–22    | 23–31            | 32–60   |
| Rasgo     | 0–16         | 17–25    | 26–32            | 33–60   |

Mapping de banda interna: `none` (sin), `mild` (promedio), `moderate` (ligeramente alta), `severe` (alta). El nombre en español del cuadernillo se conserva en el campo `band_label` para mostrar al clínico.

## Subscores

`subscores: { state: { score, band }, trait: { score, band } }`. La banda global del cuestionario es la **más alta de las dos subescalas**.

> **Desviación del plan.** El plan original (`docs/superpowers/plans/refactored-sparking-koala.md`, T1.3) asumía cortes únicos por subescala (≥45 alto). Pablo firmó **bandas distintas por sexo y subescala** el 2026-05-03 — diferencia clínicamente relevante para mujeres jóvenes. Documentado en ADR-024.
