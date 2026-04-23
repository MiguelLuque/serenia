# Plan 6 — Sign-off clínico de la copy generada

**Fecha:** 2026-04-23
**Estado:** pendiente de firma.
**Plan relacionado:** [2026-04-23-plan-6-cross-session-continuity.md](../plans/2026-04-23-plan-6-cross-session-continuity.md)

---

## Contexto

Plan 6 introduce **continuidad entre sesiones** en Serenia: la IA deja de entrar en frío a cada sesión y pasa a recibir un `patientContextBlock` derivado del último assessment del paciente (validado por el clínico en el caso ideal, o un draft no validado como degradación), junto con un `riskOpeningNotice` cuando hay estado de riesgo residual.

Esto significa que **pacientes reales van a ver copy generado por IA que menciona datos de sesiones previas** — acuerdos pendientes, síntomas registrados, estado de riesgo. La IA también puede abrir con avisos de continuidad cuando el estado es `watch`, `active` o `acute`. Todo este texto se inyecta en el system prompt y condiciona la conversación.

Antes de encender el flag `FEATURE_CROSS_SESSION_CONTEXT` en producción, un clínico debe revisar y firmar el literal del copy relevante, asegurándose de que:

- Es clínicamente seguro en los tres estados de riesgo.
- El tono es apropiado para pacientes en recuperación y para pacientes en crisis.
- Las menciones a "tu psicólogo" están alineadas con el rol real de la persona que revisa.
- Los avisos de crisis dirigen a la **Línea 024** de forma correcta.

El flag queda `off` hasta que este documento esté firmado por dos revisores.

---

## Copy que requiere aprobación

Todas las citas son verbatim del código en `main` a fecha de 2026-04-23. Si al revisar se quiere cambiar algún literal, hay que editar el archivo fuente correspondiente y re-solicitar firma (ver sección _Follow-up_).

### 1. Línea de transparencia en el dashboard del paciente

Fuente: [app/app/page.tsx:44-46](../../../app/app/page.tsx) (CardDescription del bloque "Tus acuerdos recientes") y [app/app/page.tsx:72-73](../../../app/app/page.tsx) (nota al pie cuando hay acuerdos abiertos).

> Lo que acordaste con tu psicólogo para esta semana.

> Estos acuerdos los revisó tu psicólogo después de tu última sesión. Serenia los tendrá presentes la próxima vez que hables con ella.

Variante cuando aún no hay acuerdos ([app/app/page.tsx:50-53](../../../app/app/page.tsx)):

> Aún no hay acuerdos. Aparecerán aquí cuando tu psicólogo revise tu próxima sesión.

### 2. Risk opening notices (tres ramas)

Fuente: [lib/patient-context/render.ts](../../../lib/patient-context/render.ts), función `computeRiskOpeningNotice`, líneas 386-397.

**Rama `acute`** (L391):

> [AVISO DE CONTINUIDAD — RIESGO AGUDO] Protocolo de crisis inmediato: valida sin alarmismo, ofrece Línea 024 textualmente, si hay señales de riesgo inmediato llama a close_session con reason='crisis_detected'. No inicies otras líneas de conversación hasta asegurar la continuidad de riesgo.

**Rama `active`** (L393):

> [AVISO DE CONTINUIDAD — RIESGO ACTIVO] Abre con un check-in cálido y específico sobre cómo está hoy respecto a la ideación reportada. Si el paciente abre con afecto positivo claro, haz el check-in en UNA frase breve y devuélvele el espacio inmediatamente. Ten la Línea 024 lista.

**Rama `watch`** (L395):

> [AVISO DE CONTINUIDAD — VIGILANCIA] En la sesión / informe anterior se registraron señales leves. Abre normalmente, pero mantén atención a reaparición; si el paciente abre con afecto positivo, no fuerces un check-in de seguridad.

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

### Revisor clínico primario

- Revisado por: `___________________________________`
- Fecha: `___________________________________`
- Firma: `___________________________________`

### Revisor clínico independiente (segundo par de ojos)

- Revisado por: `___________________________________`
- Fecha: `___________________________________`
- Firma: `___________________________________`

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

El flag `FEATURE_CROSS_SESSION_CONTEXT` **no debe encenderse en producción** hasta que este documento esté firmado por ambos revisores (primario e independiente). El procedimiento operativo del flag está en [docs/operations/feature-flags.md](../../operations/feature-flags.md).
