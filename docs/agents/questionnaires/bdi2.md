---
name: bdi2
code: BDI2
domain: depression
version: 1.0
language: es-ES
scoring_strategy: sum_max_per_group
source_reference: "Beck, A.T., Steer, R.A., & Brown, G.K. (1996). BDI-II — versión cuadernillo facilitado por @psicologo el 2026-05-02"
last_reviewed: 2026-05-03
owner: "@psicologo"
---

# BDI-II — Inventario de Depresión de Beck-II (ES)

Inventario de 21 grupos de afirmaciones para evaluar la severidad sintomática depresiva en las **últimas 2 semanas, incluyendo el día de hoy**. Puntuación 0–63.

> Copy literal del cuadernillo facilitado por Pablo (`DEPRESIÓN_BECK.pdf`, archivo en `docs/handoff/respuesta de pablo/`). No editar los ítems sin firma clínica.

## Disparo (regla en el system prompt)

Sólo se propone tras un **PHQ-9 con banda `moderate` o superior** (puntuación ≥10), para profundizar.

## Instrucciones que ve el paciente

Este cuestionario consta de 21 grupos de afirmaciones. Por favor, lea con atención cada uno de ellos. Luego elija uno de cada grupo, el que mejor describa el modo como se ha sentido **las últimas dos semanas, incluyendo el día de hoy**. Si varios enunciados de un mismo grupo le parecen igualmente apropiados, marque el número más alto.

## Opciones por grupo

Cada grupo tiene **4 opciones** (0, 1, 2, 3). Los grupos 16 (sueño) y 18 (apetito) tienen variantes `a` y `b` para los niveles 1, 2 y 3 (mismo valor numérico, distinto contenido). Si el paciente marca varias respuestas en un grupo, se toma la **puntuación más alta**.

## Items

### 1. Tristeza
- 0: No me siento triste.
- 1: Me siento triste gran parte del tiempo.
- 2: Me siento triste todo el tiempo.
- 3: Me siento tan triste o soy tan infeliz que no puedo soportarlo.

### 2. Pesimismo
- 0: No estoy desalentado respecto de mi futuro.
- 1: Me siento más desalentado respecto de mi futuro que lo que solía estarlo.
- 2: No espero que las cosas funcionen para mí.
- 3: Siento que no hay esperanza para mi futuro y que sólo puede empeorar.

### 3. Fracaso
- 0: No me siento como un fracasado.
- 1: He fracasado más de lo que hubiera debido.
- 2: Cuando miro hacia atrás, veo muchos fracasos.
- 3: Siento que como persona soy un fracaso total.

### 4. Pérdida de placer
- 0: Obtengo tanto placer como siempre por las cosas de las que disfruto.
- 1: No disfruto tanto de las cosas como solía hacerlo.
- 2: Obtengo muy poco placer de las cosas que solía disfrutar.
- 3: No puedo obtener ningún placer de las cosas de las que solía disfrutar.

### 5. Sentimientos de culpa
- 0: No me siento particularmente culpable.
- 1: Me siento culpable respecto de varias cosas que he hecho o que debería haber hecho.
- 2: Me siento bastante culpable la mayor parte del tiempo.
- 3: Me siento culpable todo el tiempo.

### 6. Sentimientos de castigo
- 0: No siento que esté siendo castigado.
- 1: Siento que tal vez pueda ser castigado.
- 2: Espero ser castigado.
- 3: Siento que estoy siendo castigado.

### 7. Disconformidad con uno mismo
- 0: Siento acerca de mí lo mismo que siempre.
- 1: He perdido la confianza en mí mismo.
- 2: Estoy decepcionado conmigo mismo.
- 3: No me gusto a mí mismo.

### 8. Autocrítica
- 0: No me critico ni me culpo más de lo habitual.
- 1: Estoy más crítico conmigo mismo de lo que solía estarlo.
- 2: Me critico a mí mismo por todos mis errores.
- 3: Me culpo a mí mismo por todo lo malo que sucede.

### 9. Pensamientos o deseos suicidas
- 0: No tengo ningún pensamiento de matarme.
- 1: He tenido pensamientos de matarme, pero no lo haría.
- 2: Querría matarme.
- 3: Me mataría si tuviera la oportunidad de hacerlo.

**Flag de riesgo:** ítem 9 con valor ≥ 1 ⇒ crear `risk_event` `suicidal_ideation` severity proporcional al valor (`low` para 1, `high` para 2-3), `requires_review=true`. Si C-SSRS no se ha administrado en la sesión, anotar en el informe que conviene proponerlo.

### 10. Llanto
- 0: No lloro más de lo que solía hacerlo.
- 1: Lloro más de lo que solía hacerlo.
- 2: Lloro por cualquier pequeñez.
- 3: Siento ganas de llorar pero no puedo.

### 11. Agitación
- 0: No estoy más inquieto o tenso que lo habitual.
- 1: Me siento más inquieto o tenso que lo habitual.
- 2: Estoy tan inquieto o agitado que me es difícil quedarme quieto.
- 3: Estoy tan inquieto o agitado que tengo que estar siempre en movimiento o haciendo algo.

### 12. Pérdida de interés
- 0: No he perdido el interés en otras actividades o personas.
- 1: Estoy menos interesado que antes en otras personas o cosas.
- 2: He perdido casi todo el interés en otras personas o cosas.
- 3: Me es difícil interesarme por algo.

### 13. Indecisión
- 0: Tomo mis propias decisiones tan bien como siempre.
- 1: Me resulta más difícil que de costumbre tomar decisiones.
- 2: Encuentro mucha más dificultad que antes para tomar decisiones.
- 3: Tengo problemas para tomar cualquier decisión.

### 14. Desvalorización
- 0: No siento que yo no sea valioso.
- 1: No me considero a mí mismo tan valioso y útil como solía considerarme.
- 2: Me siento menos valioso cuando me comparo con otros.
- 3: Siento que no valgo nada.

### 15. Pérdida de energía
- 0: Tengo tanta energía como siempre.
- 1: Tengo menos energía que la que solía tener.
- 2: No tengo suficiente energía para hacer demasiado.
- 3: No tengo energía suficiente para hacer nada.

### 16. Cambios en los hábitos de sueño
- 0: No he experimentado ningún cambio en mis hábitos de sueño.
- 1a: Duermo un poco más que lo habitual.
- 1b: Duermo un poco menos que lo habitual.
- 2a: Duermo mucho más que lo habitual.
- 2b: Duermo mucho menos que lo habitual.
- 3a: Duermo la mayor parte del día.
- 3b: Me despierto 1-2 horas más temprano y no puedo volver a dormirme.

### 17. Irritabilidad
- 0: No estoy tan irritable que lo habitual.
- 1: Estoy más irritable que lo habitual.
- 2: Estoy mucho más irritable que lo habitual.
- 3: Estoy irritable todo el tiempo.

### 18. Cambios en el apetito
- 0: No he experimentado ningún cambio en mi apetito.
- 1a: Mi apetito es un poco menor que lo habitual.
- 1b: Mi apetito es un poco mayor que lo habitual.
- 2a: Mi apetito es mucho menor que antes.
- 2b: Mi apetito es mucho mayor que lo habitual.
- 3a: No tengo apetito en absoluto.
- 3b: Quiero comer todo el día.

### 19. Dificultad de concentración
- 0: Puedo concentrarme tan bien como siempre.
- 1: No puedo concentrarme tan bien como habitualmente.
- 2: Me es difícil mantener la mente en algo por mucho tiempo.
- 3: Encuentro que no puedo concentrarme en nada.

### 20. Cansancio o fatiga
- 0: No estoy más cansado o fatigado que lo habitual.
- 1: Me fatigo o me canso más fácilmente que lo habitual.
- 2: Estoy demasiado fatigado o cansado para hacer muchas de las cosas que solía hacer.
- 3: Estoy demasiado fatigado o cansado para hacer la mayoría de las cosas que solía hacer.

### 21. Pérdida de interés en el sexo
- 0: No he notado ningún cambio reciente en mi interés por el sexo.
- 1: Estoy menos interesado en el sexo de lo que solía estarlo.
- 2: Estoy mucho menos interesado en el sexo.
- 3: He perdido completamente el interés en el sexo.

## Bandas de severidad

| Rango | Banda             |
|-------|-------------------|
| 0–13  | `minimal`         |
| 14–19 | `mild`            |
| 20–28 | `moderate`        |
| 29–63 | `severe`          |

Bandas firmadas por Pablo el 2026-05-03 (archivo `01-cuestionarios.md`). El plan original mencionaba 4 bandas idénticas — sin desviación.
