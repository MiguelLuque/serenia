# Plan 6 — Sign-off clínico de la copy generada

**Fecha:** 2026-04-23
**Estado:** pendiente de firma.
**Plan relacionado:** [2026-04-23-plan-6-cross-session-continuity.md](../plans/2026-04-23-plan-6-cross-session-continuity.md)

---

## Contexto

Plan 6 introduce **continuidad entre sesiones** en Serenia: la IA deja de entrar en frío a cada sesión y pasa a recibir un `patientContextBlock` derivado del último assessment del paciente (validado por el clínico en el caso ideal, o un draft no validado como degradación), junto con un `riskOpeningNotice` cuando hay estado de riesgo residual.

Esto significa que **pacientes reales van a ver copy generado por IA que menciona datos de sesiones previas** — acuerdos pendientes, síntomas registrados, estado de riesgo. La IA también puede abrir con avisos de continuidad cuando el estado es `watch`, `active` o `acute`. Todo este texto se inyecta en el system prompt y condiciona la conversación.

Antes del **lanzamiento oficial a usuarios reales**, un clínico debe revisar y firmar el literal del copy relevante, asegurándose de que:

- Es clínicamente seguro en los tres estados de riesgo.
- El tono es apropiado para pacientes en recuperación y para pacientes en crisis.
- Las menciones a "tu psicólogo" están alineadas con el rol real de la persona que revisa.
- Los avisos de crisis dirigen a la **Línea 024** de forma correcta.

Este sign-off es **requisito para el lanzamiento oficial a usuarios reales** (activación post-lanzamiento, ver [feature-flags.md](../../operations/feature-flags.md) — sección _Estado por defecto_). En pre-lanzamiento (estado actual a 2026-04-23), el flag `FEATURE_CROSS_SESSION_CONTEXT` puede encenderse en cualquier entorno sin este sign-off firmado, bajo el prerrequisito del smoke checklist, pero el sign-off debe completarse antes de abrir el producto a pacientes fuera del equipo.

---

## Copy que requiere aprobación

Todas las citas son verbatim del código en `main` a fecha de 2026-04-23. Si al revisar se quiere cambiar algún literal, hay que editar el archivo fuente correspondiente y re-solicitar firma (ver sección _Follow-up_).

### 1. Línea de transparencia en el dashboard del paciente

Fuente: [app/app/page.tsx:43](../../../app/app/page.tsx) (CardTitle del bloque), [app/app/page.tsx:44-46](../../../app/app/page.tsx) (CardDescription) y [app/app/page.tsx:72-73](../../../app/app/page.tsx) (nota al pie cuando hay acuerdos abiertos).

Título del bloque (CardTitle, L43):

> Tus acuerdos recientes

Descripción bajo el título (CardDescription, L44-46):

> Lo que acordaste con tu psicólogo para esta semana.

Nota al pie, solo cuando `tasks.length > 0` (L72-73):

> Estos acuerdos los revisó tu psicólogo después de tu última sesión. Serenia los tendrá presentes la próxima vez que hables con ella.

Variante cuando aún no hay acuerdos ([app/app/page.tsx:50-53](../../../app/app/page.tsx)):

> Aún no hay acuerdos. Aparecerán aquí cuando tu psicólogo revise tu próxima sesión.

### 2. Risk opening notices (tres ramas)

Fuente: [lib/patient-context/render.ts](../../../lib/patient-context/render.ts), función `computeRiskOpeningNotice`, líneas 386-397.

Cada rama devuelve el aviso seguido de `\n\n---\n\n` como terminador que separa este bloque del resto del system prompt. Se firma la cadena completa (texto + separador), tal como la ve el modelo.

**Rama `acute`** (L391):

```
[AVISO DE CONTINUIDAD — RIESGO AGUDO] Protocolo de crisis inmediato: valida sin alarmismo, ofrece Línea 024 textualmente, si hay señales de riesgo inmediato llama a close_session con reason='crisis_detected'. No inicies otras líneas de conversación hasta asegurar la continuidad de riesgo.

---

```

**Rama `active`** (L393):

```
[AVISO DE CONTINUIDAD — RIESGO ACTIVO] Abre con un check-in cálido y específico sobre cómo está hoy respecto a la ideación reportada. Si el paciente abre con afecto positivo claro, haz el check-in en UNA frase breve y devuélvele el espacio inmediatamente. Ten la Línea 024 lista.

---

```

**Rama `watch`** (L395):

```
[AVISO DE CONTINUIDAD — VIGILANCIA] En la sesión / informe anterior se registraron señales leves. Abre normalmente, pero mantén atención a reaparición; si el paciente abre con afecto positivo, no fuerces un check-in de seguridad.

---

```

(La rama `none` devuelve `null` — no se inyecta nada.)

### 3. Tier A — instrucciones para la IA

Fuente: [lib/patient-context/render.ts:99-105](../../../lib/patient-context/render.ts), constante `TIER_A_INSTRUCTIONS`.

> Instrucciones para esta sesión:
> - Esto es un contexto heredado; no presumas continuidad en tu primer mensaje.
> - En tu PRIMER mensaje está prohibido citar contenido concreto del snapshot (tareas, síntomas, puntuaciones, nombres). Abre con una invitación abierta.
> - A partir del tercer turno, si el paciente no ha abierto tema por su cuenta y la conversación ha llegado a una pausa natural, puedes ofrecer un puente hacia UN (no dos) acuerdo pendiente, como opción y no como agenda: "si te apetece, podemos mirar cómo fue lo de X, o si prefieres empezar por otra cosa, también".
> - Si el paciente contradice el snapshot, valida primero ("tienes razón, gracias por aclararlo"), no justifiques la fuente, y sigue por donde él lleva.
> - No cites al clínico, no cites diagnósticos ni hipótesis clínicas, no repitas datos privados como muestra de memoria.
> - No re-explores en profundidad lo ya mapeado en el snapshot.

### 4. Historic — instrucción adicional

Fuente: [lib/patient-context/render.ts:107-108](../../../lib/patient-context/render.ts), constante `HISTORIC_EXTRA_INSTRUCTION`. Se añade como bullet extra a `TIER_A_INSTRUCTIONS` cuando el assessment validado más reciente tiene más de 90 días.

> - Trata este snapshot como referencia de hace meses; el paciente probablemente ha cambiado. Pregunta antes de asumir.

_Nota:_ el plan (L620) se refiere a esto como `HISTORIC_INSTRUCTIONS`. En el código real la constante se llama `HISTORIC_EXTRA_INSTRUCTION` y no es una instrucción completa independiente — es un bullet que se concatena a `TIER_A_INSTRUCTIONS`. El contenido efectivo visto por el modelo es `TIER_A_INSTRUCTIONS` + `\n` + ese bullet. Se firma tal cual.

### 5. Tier B — instrucciones para la IA

Fuente: [lib/patient-context/render.ts:112-114](../../../lib/patient-context/render.ts), constante `TIER_B_INSTRUCTIONS`.

> Instrucciones para esta sesión:
> - Este resumen NO está revisado por un clínico. Úsalo solo para no empezar completamente en frío. No cites hipótesis clínicas ni diagnósticos — no hay ninguno validado.
> - Mismas reglas de apertura que con contexto validado: turn 1 sin referencias concretas, ofrece puente solo a partir del turn 3, valida si el paciente contradice.

### 6. Hint de retake de cuestionarios

Fuente: [lib/patient-context/questionnaire-rules.ts](../../../lib/patient-context/questionnaire-rules.ts), función `computeHintForEntry`, líneas 37-44. El template se adjunta como bullet extra a las instrucciones Tier A / historic / Tier B cuando se cumple una de las dos reglas.

Regla **severe** (score ≥ 15 y más de 7 días, L38):

> el ${label} del paciente era severo y tiene más de una semana; considera proponerlo de nuevo si el encuadre de la sesión lo permite.

Regla **moderate** (score ≥ 10 y más de 14 días, L43):

> el último ${label} del paciente estaba en rango moderado y tiene más de dos semanas; si la sesión lo permite, podría ser un buen momento para re-administrarlo.

`${label}` es `'PHQ-9'` o `'GAD-7'` según el cuestionario. Si PHQ-9 y GAD-7 cumplen regla a la vez, los hints se concatenan con un espacio (L78 de la misma función).

### 7. Headers de contexto (Tier A / historic / Tier B / none)

Fuente: [lib/patient-context/render.ts](../../../lib/patient-context/render.ts), función `renderPatientContextBlockWithMeta`.

Tier A (L318):

> [CONTEXTO DEL PACIENTE — última revisión clínica de hace ${ageInDays} días]

Historic (L324):

> [CONTEXTO HISTÓRICO DEL PACIENTE — última revisión de hace ${ageInDays} días; puede estar desactualizado]

Tier B (L339):

> [CONTEXTO DEL PACIENTE — sesión anterior sin revisión clínica todavía]

None (primera sesión, L367-371):

> [CONTEXTO DEL PACIENTE — primera sesión]
> No hay evaluación clínica previa ni sesiones anteriores registradas con este paciente. Usa la postura de intake habitual.

---

## Copy adicional para visibilidad (no requiere firma en este sign-off)

Estos literales viven en `/api/chat/route.ts` y no son estrictamente parte de Plan 6 — existían antes y comparten system prompt con el `patientContextBlock`. Se citan aquí para que el clínico tenga visibilidad del prompt completo; su revisión formal corresponde al plan original que los introdujo.

### Aviso de tiempo

Fuente: [app/api/chat/route.ts:84-92](../../../app/api/chat/route.ts).

> [AVISO DE TIEMPO]
> Quedan ${minutesRemaining} minutos de la sesión. Empieza a cerrar si procede: resume lo hablado, pregunta cómo se va el paciente, y despídete. Si llegas al límite, llama a close_session con reason='time_limit'.

### Aviso de crisis (disparado por el detector de crisis en turno del usuario)

Fuente: [app/api/chat/route.ts:95-102](../../../app/api/chat/route.ts).

> [AVISO DE SEGURIDAD — ALERTA ACTIVADA]
> El último mensaje del paciente contiene señales de crisis (${crisis.matchedTerms.join(', ')}). Activa el protocolo de crisis AHORA: valida, mide riesgo con calma, ofrece la Línea 024 textualmente, marca la sesión para revisión del psicólogo, y considera llamar a close_session con reason='crisis_detected' si el riesgo es inmediato.

### Aviso de resultado de cuestionario — ASQ riesgo agudo

Fuente: [app/api/chat/route.ts:266-272](../../../app/api/chat/route.ts).

> [RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]
> El item 5 del ASQ es positivo. Activa el protocolo de crisis AHORA: valida sin alarmismo, ofrece la Línea 024 textualmente, marca para revisión clínica inmediata, y considera llamar a close_session con reason='crisis_detected' si el riesgo es inmediato. NO propongas otros cuestionarios ni sigas la exploración normal.

### Aviso de resultado de cuestionario — genérico

Fuente: [app/api/chat/route.ts:279-286](../../../app/api/chat/route.ts).

> [RESULTADO DE CUESTIONARIO — ${def.code}]
> Puntuación: ${result.total_score} (${result.severity_band}).
> Flags: ${flagsLabel}.
> El paciente ha completado el cuestionario. Acknowledge con tacto, valida el esfuerzo, explícale qué significa la puntuación en términos no clínicos (sin citar cifras), y continúa la sesión. NO diagnostiques. Menciona que tu psicólogo revisará el informe.

### Mensaje al paciente cuando la sesión expira por tiempo

Fuente: [app/api/chat/route.ts:57](../../../app/api/chat/route.ts).

> Se ha alcanzado el límite de tiempo de la sesión. He preparado las notas para que tu psicólogo las revise. Nos vemos en la próxima sesión.

---

## Perfiles de paciente de ejemplo

Para cada perfil, contrasta mentalmente qué bloques del copy de arriba se le inyectarían y si el tono es el adecuado. Si alguno se siente mal en algún perfil, marca `no` en el criterio correspondiente y abre issue.

### Perfil 1 — En recuperación

- **Historia:** 6 sesiones previas. Último assessment validado hace 12 días con `suicidality='none'` tras haber estado en `passive`. PHQ-9 bajó de 18 → 8. Acuerdos: 1 cumplido, 1 pendiente.
- **Estado que genera el sistema:** `tier='tierA'`, `riskState='none'`.
- **Copy que vería:** Header Tier A (§7), `TIER_A_INSTRUCTIONS` (§3), línea de transparencia en dashboard (§1, con el acuerdo pendiente citado). **NO** hay `riskOpeningNotice`.
- **A verificar:** el tono de §1 y §3 no da por hecho que el paciente sigue mal; la IA no abrirá con check-in de seguridad.

### Perfil 2 — Ansiedad moderada persistente

- **Historia:** 4 sesiones. Último assessment validado hace 20 días con GAD-7 = 12 (moderado). `suicidality='none'` siempre. Sin acuerdos abiertos.
- **Estado que genera el sistema:** `tier='tierA'`, `riskState='none'`.
- **Copy que vería:** Header Tier A (§7), `TIER_A_INSTRUCTIONS` (§3), hint de retake moderate (§6) adjunto como bullet extra por GAD-7 > 14 días. **NO** hay `riskOpeningNotice`.
- **A verificar:** el hint de §6 ("podría ser un buen momento para re-administrarlo") es clínicamente apropiado como sugerencia, no como obligación.

### Perfil 3 — Depresión severa con ideación activa

- **Historia:** 3 sesiones. Último assessment validado hace 5 días con PHQ-9 = 22 (severo), `suicidality='active'`. 2 acuerdos pendientes.
- **Estado que genera el sistema:** `tier='tierA'`, `riskState='active'` (regla: `suicidality==='active'` en `lib/clinical/risk-rules.ts:48`).
- **Copy que vería:** Header Tier A (§7), `riskOpeningNotice` rama `active` (§2), `TIER_A_INSTRUCTIONS` (§3), línea de transparencia con los 2 acuerdos (§1), hint de retake severe para PHQ-9 (§6) si aplica el umbral.
- **A verificar:** la secuencia risk notice → instrucciones → acuerdos en el system prompt guía al modelo a check-in breve si hay afecto positivo; el acuerdo pendiente no tapa la señal de seguridad.

### Perfil 4 — Crisis aguda, sesión previa cerrada por `crisis_detected`

- **Historia:** sesión anterior cerrada por `crisis_detected` hace 10 días. Último assessment validado con `suicidality='acute'`. El paciente abre sesión siguiente.
- **Estado que genera el sistema:** `tier='tierA'`, `riskState='acute'` (regla: `suicidality==='acute'` en `lib/clinical/risk-rules.ts:46`).
- **Copy que vería:** Header Tier A (§7), `riskOpeningNotice` rama `acute` (§2), `TIER_A_INSTRUCTIONS` (§3). La copy de crisis del dashboard (no cubierta aquí; vive en `app/app/page.tsx` fuera del bloque de continuidad) acompaña al paciente en la pantalla de inicio.
- **A verificar:** la rama `acute` de §2 menciona Línea 024 textualmente y ordena no abrir otras líneas de conversación hasta asegurar continuidad de riesgo.

_Nota sobre la rama `watch`:_ no se exhibe con un perfil dedicado para no alargar la sección. Se dispara cuando (a) `suicidality='passive'` con `reviewed_at` dentro de los últimos 21 días, (b) hay un evento de riesgo abierto de severidad `high` dentro de 21 días, o (c) la sesión anterior se cerró por `crisis_detected` dentro de 21 días y el último assessment validado no devolvió `none` (`lib/clinical/risk-rules.ts:62-85`). El literal firmado es la rama `watch` de §2.

### Detalle: caminos de cómputo en `derivePatientRiskState`

Referencia de lo que mapea cada estado de riesgo, para que al revisar los perfiles no haya ambigüedad sobre qué combinación de entradas dispara cada rama. Fuente: [`lib/clinical/risk-rules.ts`](../../../lib/clinical/risk-rules.ts), función `derivePatientRiskState` (orden de evaluación de arriba abajo — la primera rama que coincide gana).

**`riskState='acute'`** — dos caminos:
1. Algún `open_risk_event` tiene `severity='critical'` (`lib/clinical/risk-rules.ts:44`). Independiente del assessment.
2. El último `assessment` validado reporta `risk_assessment.suicidality='acute'` (`lib/clinical/risk-rules.ts:46`). Cubre el Perfil 4.

**`riskState='active'`** — un único camino:
1. El último `assessment` validado reporta `risk_assessment.suicidality='active'` (`lib/clinical/risk-rules.ts:48`). Cubre el Perfil 3.

Explícitamente **no** hay un camino de la forma "passive + crisis_detected recient → active": esa combinación cae en `watch` (ver caminos (a) y (c) de abajo). Escalar de `passive` a `active` requiere una re-evaluación clínica que actualice el `summary_json.risk_assessment.suicidality` del assessment.

**`riskState='watch'`** — tres caminos (todos requieren que las ramas de `acute` y `active` no hayan disparado antes):
1. `suicidality='passive'` y `reviewed_at` dentro de los últimos 21 días (`lib/clinical/risk-rules.ts:62-68`).
2. Algún `open_risk_event` con `severity='high'` creado dentro de los últimos 21 días (`lib/clinical/risk-rules.ts:70-78`).
3. `previous_session.closure_reason='crisis_detected'` dentro de los últimos 21 días (`lib/clinical/risk-rules.ts:80-85`). **Nota sobre el orden de evaluación:** este camino (path 3) se evalúa **después** de la rama de recuperación `'none'` (`lib/clinical/risk-rules.ts:50-60`, que corre antes que los tres paths de `watch`). Por tanto, si el último assessment validado tiene `suicidality='none'` y `reviewedAt > crisis.closedAt`, `derivePatientRiskState` ya ha devuelto `'none'` antes de llegar aquí y path 3 no se ejecuta. En el resto de combinaciones (assessment más reciente que la crisis pero con `suicidality !== 'none'`, o assessment anterior a la crisis), path 3 sí dispara y fija `watch`.

**`riskState='none'`** — dos formas:
1. El último assessment tiene `suicidality='none'` **y** todos los `open_risk_events` y la sesión `crisis_detected` (si existe) son anteriores a ese assessment (`lib/clinical/risk-rules.ts:50-60`). Es la regla de recuperación que valida el paso 8 del smoke.
2. Fallback por defecto cuando ningún path de `acute`/`active`/`watch` ha disparado (`lib/clinical/risk-rules.ts:87`). Cubre al Perfil 1 cuando ya no queda señal reciente.

Ventana de decay: constante `DECAY_WINDOW_MS = 21 * 24 * 60 * 60 * 1000` (`lib/clinical/risk-rules.ts:30`).

---

## Criterios de aprobación

| # | Criterio | Resultado | Notas |
|---|---|---|---|
| 1 | ¿El copy es clínicamente seguro en los tres estados de riesgo (watch / active / acute)? | ☐ sí / ☐ no | |
| 2 | ¿El tono es apropiado para pacientes en distintos estados (recuperación, ansiedad moderada, depresión severa, ideación pasiva)? | ☐ sí / ☐ no | |
| 3 | ¿La mención de "tu psicólogo" está alineada con el rol real de la persona que revisa los assessments? | ☐ sí / ☐ no | |
| 4 | ¿Los avisos de crisis dirigen correctamente a la **Línea 024**? | ☐ sí / ☐ no | |
| 5 | ¿Las instrucciones Tier A / Tier B al modelo son coherentes con la política de "turn 1 sin referencias concretas, puente opcional a partir del turn 3"? | ☐ sí / ☐ no | |
| 6 | ¿El hint de retake de cuestionarios respeta los umbrales clínicos habituales (severe > 7 días, moderate > 14 días)? | ☐ sí / ☐ no | |

Si algún criterio es **no**, no firmar; abrir issue siguiendo el _Follow-up_.

---

## Firmas

La aprobación clínica de este documento **requiere las dos firmas clínicas de abajo** (revisor primario y revisor independiente). Las dos firmas son clínicas — el técnico que ejecuta el smoke E2E no cuenta como aprobación clínica, su rol es verificar reproducibilidad técnica del flujo (ver `2026-04-23-plan-6-smoke-checklist.md`, sección _Firma del smoke_) y es independiente de esta firma clínica.

### Revisor clínico primario

Persona clínicamente cualificada que revisa la copy firmada en este documento en profundidad.

- Revisado por: `___________________________________`
- Cualificación / rol: `___________________________________`
- Fecha: `___________________________________`
- Firma: `___________________________________`

### Revisor clínico independiente (segundo par de ojos)

Segunda persona clínicamente cualificada, distinta del revisor primario, que audita la misma copy de forma independiente.

- Revisado por: `___________________________________`
- Cualificación / rol: `___________________________________`
- Fecha: `___________________________________`
- Firma: `___________________________________`

**Ambas firmas son requisito**: una sola firma clínica (sea primaria o independiente) no basta. Si un revisor marca algún criterio como `no` en la sección _Criterios de aprobación_, no se firma hasta que el issue se haya cerrado (ver _Follow-up_).

---

## Follow-up

Si durante la revisión se detecta texto problemático:

1. **No firmar este documento.**
2. Abrir un issue en el repo describiendo qué literal es problemático, por qué, y qué cambio se propone.
3. Actualizar el archivo fuente correspondiente ([`lib/patient-context/render.ts`](../../../lib/patient-context/render.ts), [`lib/patient-context/questionnaire-rules.ts`](../../../lib/patient-context/questionnaire-rules.ts), [`app/app/page.tsx`](../../../app/app/page.tsx), o [`app/api/chat/route.ts`](../../../app/api/chat/route.ts)).
4. Abrir PR con el cambio y enlazarlo al issue.
5. Tras merge, **re-generar este documento con las nuevas citas verbatim** y volver a solicitar firma a ambos revisores.

---

## Dependencia

Este sign-off es **requisito para el lanzamiento oficial a usuarios reales**: el flag `FEATURE_CROSS_SESSION_CONTEXT` no debe tocar a pacientes fuera del equipo hasta que este documento esté firmado por ambos revisores (primario e independiente).

En pre-lanzamiento (estado actual a 2026-04-23, sin usuarios reales), el flag puede encenderse en cualquier entorno sin este sign-off firmado, siempre que el smoke checklist haya pasado al menos una vez en ese entorno o en uno equivalente. Esta excepción expira en el lanzamiento oficial: a partir de ese momento vuelve a aplicarse la política estricta de "flag off hasta firmar + Fase 2 de métricas desplegada". El procedimiento operativo completo del flag — incluida la transición entre modos pre- y post-lanzamiento — está en [docs/operations/feature-flags.md](../../operations/feature-flags.md), sección _Estado por defecto_.
