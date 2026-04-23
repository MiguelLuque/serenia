# Plan 6 — Continuidad entre sesiones

**Branch base:** `main` (con Plan 5 mergeado).
**Branch de trabajo:** `feat/plan-6-cross-session-continuity`.

## Contexto

Hoy la IA entra a cada sesión **en frío**. El chat en [app/api/chat/route.ts](serenia/app/api/chat/route.ts) ensambla un system prompt con solo `crisisNotice + questionnaireNotice + timeNotice + basePrompt`; no consulta `assessments` ni historial de ninguna clase. Un paciente que vuelve para su quinta sesión recibe el mismo tratamiento que uno que abre la primera.

Este plan corrige esa asimetría: la IA gana contexto longitudinal **validado por un clínico humano** (y, limitadamente, contexto *no validado* cuando hay latencia de revisión), con un lifecycle de acuerdos terapéuticos propio y reglas deterministas de seguridad y de re-administración de cuestionarios.

## Objetivo al terminar el plan

- El chat inyecta un `patientContextBlock` determinista en el system prompt antes de `streamText`.
- El bloque se construye de dos fuentes, en este orden de preferencia:
  - **Tier A — Validado**: el `assessment` más reciente del paciente en `status IN ('reviewed_confirmed','reviewed_modified')`, con tope de antigüedad de 90 días.
  - **Tier B — No validado**: si no hay Tier A pero sí hay al menos una sesión cerrada con `assessment` en `status='draft_ai'`, se inyecta un bloque *reducido* rotulado "sin revisión clínica" que lleva solo `chief_complaint`, `presenting_issues` y los cuestionarios puntuados — **nunca** `preliminary_impression` ni `recommended_actions_for_clinician`.
- Los **acuerdos terapéuticos entre sesiones** viven en una tabla `patient_tasks` relacional (no dentro de `summary_json`) con lifecycle `pendiente → cumplida / parcial / no_realizada / no_abordada`. La tabla sobrevive a rechazos de informe y permite cerrar el ciclo sin duplicar datos.
- La IA **abre con un check-in de seguridad determinista** cuando una función unificada `derivePatientRiskState(ctx)` devuelve `watch | active | acute` — con regla explícita de **recuperación** (un `reviewed_*` posterior con `suicidality='none'` resetea el estado).
- Nunca entran al contexto del modelo: `preliminary_impression`, `recommended_actions_for_clinician`, `rejection_reason`, `patient_facing_summary`, ni el `mood_affect` / `cognitive_patterns` libres del clínico.
- El paciente ve sus propias tareas acordadas en su dashboard (lectura) y una pieza de copy de transparencia que explica el modelo de memoria.
- Toda la inyección está **detrás de un feature flag** (`FEATURE_CROSS_SESSION_CONTEXT`) y **toda la inyección queda auditada** en la tabla `patient_context_injections`.
- La bandeja clínica gana una cabecera longitudinal mínima (nº de sesión, días desde la anterior, sparkline PHQ-9/GAD-7, tareas abiertas).

## Fuera de alcance

- **Embeddings / RAG / pgvector.** Diferido a un Plan 7+ si, tras observar pacientes de larga duración, el snapshot comprime demasiado.
- **`session_summaries` generados por Haiku al cerrar.** La pareja assessment+tareas ya cubre el 90 % del valor. Re-evaluar si el Tier B resulta insuficiente.
- **Gráficos ricos en el panel clínico.** La cabecera longitudinal es un sparkline textual + conteos.
- **Asignación paciente↔clínico + audit log detallado de accesos.** Sigue fuera (estaba reservado desde Plan 5).
- **Edición por el clínico del `patientContextBlock`.** La fuente es siempre el assessment + `patient_tasks`; si quiere cambiar lo que ve la IA, edita esas entidades.
- **Ampliar el schema del `summary_json`** con nuevos campos tipo `factores_protectores`, `antecedentes_relevantes`, `objetivos_terapeuticos` estructurados. Plan 6 trabaja con las claves que ya existen. Si se decide ampliar, es plan aparte (y una migración de prompts del generador).

---

## Pre-requisitos

- Plan 5 mergeado en `main` con sus migraciones aplicadas.
- Paquete **`server-only`** añadido a `dependencies` (hoy no está en `package.json`). Añadir en T0 con `pnpm add server-only`.
- Al menos un paciente con un `assessment` en `reviewed_confirmed` o `reviewed_modified` y otro con solo `draft_ai` en la BD de dev — para poder probar Tier A y Tier B.

### Decisiones fijadas

- **Fuente de verdad del contexto validado** = fila más reciente de `assessments` del paciente con `status IN ('reviewed_confirmed','reviewed_modified')` cuyo `reviewed_at > now() - interval '90 days'`. Si existe pero tiene más de 90 días → se degrada a un bloque "contexto histórico" con tono más blando.
- **Fuente de verdad del Tier B** = última sesión **cerrada** del paciente cuyo `assessment` está en `status='draft_ai'` o `'rejected'`. Nunca se leen hipótesis del draft.
- **Lifecycle de tareas** = tabla `patient_tasks` (T1). `summary_json` NO guarda tareas. El generador IA las propone en el draft vía un nuevo campo de snapshot de salida (`proposed_tasks`), que al confirmarse el informe se **materializa** como filas en `patient_tasks` (T5).
- **Exclusiones fijas del modelo** (no entran nunca al prompt): `preliminary_impression`, `recommended_actions_for_clinician`, `rejection_reason`, `patient_facing_summary`, `mood_affect`, `cognitive_patterns`.
- **Prompt ordering:** `basePrompt` (identidad estable) → `riskOpeningNotice` (si procede) → `crisisNotice` → `questionnaireNotice` → `timeNotice` → `patientContextBlock` (último = más reciente/específico).
- **Feature flag:** `FEATURE_CROSS_SESSION_CONTEXT` en `.env`. Si `!== 'on'`, el chat se comporta exactamente como antes de Plan 6 (sin contexto, sin riskOpeningNotice, sin telemetría). Off por defecto hasta firmar la copy clínica.
- **Sign-off clínico:** antes de activar el flag en producción, el clínico revisor de Plan 5 debe firmar la copy literal del `patientContextBlock` y del `riskOpeningNotice`.
  - _Nota (actualización 2026-04-24): la política "off por defecto hasta firmar" y "antes de activar el flag en producción, debe firmarse" aplica sólo a la **activación post-lanzamiento oficial**. El pre-launch path vigente permite encender el flag antes del sign-off (smoke pass como único prerrequisito) mientras la app no tenga usuarios reales — ver [feature-flags.md](../../operations/feature-flags.md), sección _Estado por defecto_. Cuando se lance oficialmente, esta condición vuelve a aplicar tal cual está escrita aquí arriba._
- **Tier es un snapshot al arranque de la sesión, no un live feed.** `buildPatientContext` se evalúa una vez al primer `/api/chat` de la sesión y el resultado (tier, acuerdos, riskState) se inyecta en el system prompt de todos los turnos siguientes de esa misma sesión. Si el clínico valida el draft **durante** una sesión Tier B activa (promoviéndolo a `reviewed_confirmed`), la sesión en curso sigue con el contexto Tier B; la promoción a Tier A aplica solo en la **siguiente** sesión que abra el paciente. No es un bug — cambiar de tier entre turnos rompería el contrato de apertura (turn-1 sin referencias concretas). Ver comentario sobre `buildPatientContext` en [lib/patient-context/builder.ts](serenia/lib/patient-context/builder.ts).

---

## Task 1 — Tabla `patient_tasks` + RLS + backfill de datos existentes

Nueva migración: `20260424000001_patient_tasks.sql`.

```sql
create type patient_task_status as enum
  ('pendiente','cumplida','parcial','no_realizada','no_abordada');

create table patient_tasks (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references auth.users(id) on delete cascade,
  acordada_en_session_id   uuid not null references clinical_sessions(id) on delete cascade,
  acordada_en_assessment_id uuid not null references assessments(id) on delete cascade,
  descripcion              text not null check (char_length(descripcion) between 3 and 500),
  nota                     text check (nota is null or char_length(nota) <= 300),
  estado                   patient_task_status not null default 'pendiente',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  closed_at                timestamptz,
  closed_by_assessment_id  uuid references assessments(id) on delete set null
);

create index idx_patient_tasks_user_open
  on patient_tasks(user_id, created_at desc)
  where estado in ('pendiente','parcial');

create index idx_patient_tasks_session
  on patient_tasks(acordada_en_session_id);

alter table patient_tasks enable row level security;

create policy patient_tasks_select_own on patient_tasks
  for select using (user_id = auth.uid());
create policy patient_tasks_select_clinician on patient_tasks
  for select using (is_clinician());
create policy patient_tasks_insert_clinician on patient_tasks
  for insert with check (is_clinician());
create policy patient_tasks_update_clinician on patient_tasks
  for update using (is_clinician()) with check (is_clinician());
-- sin delete: el estado `no_abordada` cubre el borrado lógico.

create trigger patient_tasks_touch
  before update on patient_tasks
  for each row execute function touch_updated_at();
```

Si la función `touch_updated_at()` no existe en el schema, crearla en la misma migración.

**Backfill:** ninguno. Partimos de tabla vacía. Los assessments existentes no tienen tareas estructuradas.

Tests (SQL + RLS via vitest):
- Paciente ve sus propias tareas y solo las suyas.
- Clínico ve tareas de cualquier paciente.
- Paciente **no** puede `insert` ni `update`.

---

## Task 2 — `AssessmentSchema`: añadir `proposed_tasks` al draft del generador

Archivo: [lib/assessments/generator.ts](serenia/lib/assessments/generator.ts).

```ts
export const ProposedTaskSchema = z.object({
  descripcion: z.string().min(3).max(500),
  nota: z.string().max(300).optional(),
})

export const AssessmentSchema = z.object({
  // ... campos existentes sin cambios ...
  proposed_tasks: z.array(ProposedTaskSchema).default([]),
})
```

**Importante:**
- `proposed_tasks` vive solo en el `summary_json` del draft y de sus revisiones. No es un "lifecycle store" — es un snapshot de qué tareas propone el asistente al cerrar esta sesión.
- El LLM **no** escribe fechas, IDs, ni estados. Solo `descripcion` y `nota`. La fecha (`acordada_en`) la sella el servidor al materializar en `patient_tasks` (T5).
- Actualizar [docs/agents/prompts/clinical-report.md](serenia/docs/agents/prompts/clinical-report.md) para que el generador extraiga tareas explícitas ("voy a probar X", "quedo en hacer Y") y devuelva `proposed_tasks: []` cuando no hay nada claro. No inventar.

**Load-boundary parse (critical, evita crash con datos legacy):**
- En [lib/clinician/session-detail.ts](serenia/lib/clinician/session-detail.ts), al leer `assessment.summary_json`, aplicar `AssessmentSchema.parse(row.summary_json)` para hidratar cualquier fila antigua con `proposed_tasks: []`.
- Lo mismo en [lib/clinician/patient.ts](serenia/lib/clinician/patient.ts) cuando devuelva summaries.

Tests:
- Parsear un summary_json sin `proposed_tasks` → valida con `[]`.
- Parsear un summary_json con 2 proposed_tasks válidas → preserva el array.
- `ProposedTaskSchema.descripcion` con 2 chars → falla.

---

## Task 3 — Editor y panel clínico: ver y editar `proposed_tasks` + pre-poblar tareas heredadas

Archivos:
- [components/clinician/assessment-view.tsx](serenia/components/clinician/assessment-view.tsx): nueva sección **"Tareas propuestas en esta sesión"** (renderiza `summary.proposed_tasks`).
- [components/clinician/assessment-editor.tsx](serenia/components/clinician/assessment-editor.tsx): lista editable (add / remove / reorder) para `proposed_tasks`, con `<Input>` `descripcion` y `<Textarea>` `nota`. Sin campo `estado` aquí — las proposed tasks siempre salen `pendiente` cuando se materialicen.

**Pre-poblado de tareas heredadas (la pieza que evita que el ciclo se muera):**

En el detalle de sesión, además del assessment actual, mostrar un bloque **"Acuerdos heredados de sesiones anteriores"** con las filas de `patient_tasks` del paciente cuyo `estado IN ('pendiente','parcial')`. Cada fila con:

- Descripción (read-only).
- Fecha y sesión de origen (link al detalle de esa sesión).
- `<Select>` de `estado` con los 5 valores — el clínico puede cerrar el ciclo con un click.
- `<Textarea>` para `nota` opcional.

Al guardar el informe (T4), las filas de `patient_tasks` que el clínico haya tocado se `UPDATE` con el nuevo `estado`, `nota`, `closed_at = now()` (si pasa a estado terminal), `closed_by_assessment_id = <nuevo assessment_id>`.

Submit:
- El editor sigue llamando a [saveAssessmentAction](serenia/app/app/clinica/sesion/[sessionId]/actions.ts) — nueva versión firma `{ assessmentId, sessionId, userId, summary, inherited_task_updates }` donde `inherited_task_updates` es `Array<{id, estado, nota}>`. Se valida con Zod en el action.
- El `cleaned` que se construye ya incluye `proposed_tasks` vía `...draft`; añadir test de regresión para que un añadido de tarea no se pierda silenciosamente.

Tests (RTL):
- Editor abre con `summary` legacy (sin `proposed_tasks`) → no crashea, lista vacía.
- Añadir 2 proposed_tasks → submit → action recibe array de longitud 2.
- Cambiar `estado` de una tarea heredada → action recibe update correspondiente.

---

## Task 4 — `saveAssessmentAction` + `markReviewedAction` materializan `patient_tasks`

Archivo: [app/app/clinica/sesion/[sessionId]/actions.ts](serenia/app/app/clinica/sesion/[sessionId]/actions.ts).

Extender el flujo existente con, en la **misma transacción** que crea/actualiza el assessment:

1. Aplicar `inherited_task_updates` → `update patient_tasks set estado=$, nota=$, closed_at = case when estado in ('cumplida','no_realizada','no_abordada') then now() else null end, closed_by_assessment_id=$ where id=$ and user_id=$`.
2. Materializar `proposed_tasks` en nuevas filas de `patient_tasks` con:
   - `user_id` = paciente
   - `acordada_en_session_id` = id de la sesión del assessment
   - `acordada_en_assessment_id` = id del assessment **recién insertado**
   - `estado` = `pendiente`
   - `descripcion`, `nota` = del `proposed_tasks`

**Ojo al rechazar:** `rejectAssessmentAction` **no** materializa tareas. Las tareas extraídas por el generador sobreviven solo en `summary_json.proposed_tasks` del draft rechazado, disponibles si el clínico decide luego generar otro informe para la misma sesión (fuera de alcance para v1).

**Ojo al `reviewed_modified`:** cuando el clínico edita un draft ya existente, las tareas heredadas (de sesiones previas) se updatean como siempre, pero las `proposed_tasks` de ESTA sesión se materializan según el estado *editado* por el clínico, no el que propuso el generador. Para evitar duplicados si ya existían filas materializadas por una revisión anterior: antes de insertar, `delete from patient_tasks where acordada_en_assessment_id in (<cadena supersedes>) and closed_at is null`. Esto limpia propuestas de revisiones previas del mismo cierre que aún no se han cerrado.

Tests (mock supabase):
- `saveAssessmentAction` con 2 proposed_tasks + 1 inherited_task_update → 1 update + 2 inserts en `patient_tasks`.
- `markReviewedAction` sin cambios → materializa `proposed_tasks` tal cual estaban en el draft.
- `rejectAssessmentAction` → 0 escrituras en `patient_tasks`.

---

## Task 5 — `derivePatientRiskState` unificado

Nuevo módulo server-only: [lib/clinical/risk-rules.ts](serenia/lib/clinical/risk-rules.ts).

```ts
import 'server-only'

export type PatientRiskState = 'none' | 'watch' | 'active' | 'acute'

export function derivePatientRiskState(input: {
  lastValidatedAssessment: { reviewedAt: string; suicidality: 'none'|'passive'|'active'|'acute' } | null
  openRiskEvents: Array<{ severity: string; createdAt: string }>
  previousSession: { closedAt: string; closureReason: string | null } | null
}): PatientRiskState
```

**Reglas** (en orden de prioridad, primera que matchee gana):

1. `openRiskEvents.some(e => e.severity === 'critical')` → `acute`.
2. `lastValidatedAssessment?.suicidality === 'acute'` → `acute`.
3. `lastValidatedAssessment?.suicidality === 'active'` → `active`.
4. **Regla de recuperación:** si `lastValidatedAssessment.suicidality === 'none'` Y su `reviewedAt` es posterior al último `openRiskEvents[i].createdAt` y al `previousSession.closedAt` cuando este tiene `closureReason='crisis_detected'` → `none`. El clínico acaba de decir "está estable", se respeta.
5. `lastValidatedAssessment?.suicidality === 'passive'` AND `reviewedAt > now() - 21 días` → `watch`.
6. `openRiskEvents.some(e => e.severity === 'high')` AND `createdAt > now() - 21 días` → `watch`.
7. `previousSession?.closureReason === 'crisis_detected'` AND `closedAt > now() - 21 días` → `watch`. Si la recuperación (regla 4) aplica, esto queda capado a `none`.
8. Por defecto → `none`.

Consumidores:
- `buildPatientContext` (T6) incluye `riskState` en el resultado.
- `computeRiskOpeningNotice` (T8) se activa si `riskState !== 'none'`.
- La bandeja clínica (T11) puede mostrar un badge de riesgo derivado de esta misma función.

Tests unitarios (12+ casos): cada rama + recovery + decay a 21 días.

---

## Task 6 — `buildPatientContext(supabase, userId)`

Nuevo módulo server-only: [lib/patient-context/builder.ts](serenia/lib/patient-context/builder.ts).

```ts
import 'server-only'

export type PatientContextTier = 'none' | 'historic' | 'tierB' | 'tierA'

export type PatientContext = {
  tier: PatientContextTier
  isFirstSession: boolean
  patient: { displayName: string | null; age: number | null }
  validated: {
    reviewedAt: string
    summary: Pick<AssessmentSummary,
      'chief_complaint' | 'presenting_issues' | 'areas_for_exploration' | 'risk_assessment' | 'questionnaires'>
    ageInDays: number
  } | null
  tierBDraft: {
    closedAt: string
    summary: Pick<AssessmentSummary,
      'chief_complaint' | 'presenting_issues' | 'questionnaires'>
  } | null
  recentQuestionnaires: Array<{
    code: 'PHQ9' | 'GAD7' | 'ASQ'
    score: number
    band: string
    scoredAt: string
    deltaVsPrevious: number | null
  }>
  openRiskEvents: Array<{ severity: string; createdAt: string; riskType: string }>
  previousSession: { closedAt: string; closureReason: string | null; daysAgo: number } | null
  pendingTasks: Array<{ id: string; descripcion: string; estado: 'pendiente'|'parcial'; acordadaEn: string }>
  sessionNumber: number
  riskState: PatientRiskState
}

export async function buildPatientContext(
  supabase: Supabase,
  userId: string,
): Promise<PatientContext>
```

Queries (paralelas con `Promise.all`):

1. **Último validado** (Tier A candidate):
   ```
   select id, reviewed_at, summary_json
   from assessments
   where user_id = $userId
     and status in ('reviewed_confirmed','reviewed_modified')
   order by reviewed_at desc
   limit 1
   ```
   Si `reviewed_at > now() - interval '90 days'` → tier = `tierA`. Si existe pero más viejo → tier = `historic`.

2. **Último draft** (Tier B candidate), solo si no hay tier A:
   ```
   select a.summary_json, s.closed_at
   from assessments a
   join clinical_sessions s on s.id = a.session_id
   where a.user_id = $userId
     and a.status in ('draft_ai','rejected')
     and s.status = 'closed'
   order by s.closed_at desc
   limit 1
   ```
   Si existe → tier = `tierB`. Si no hay nada → `isFirstSession = true`, tier = `none`.

3. **Cuestionarios recientes:**
   ```
   select qr.total_score, qr.severity_band, qr.created_at, qd.code
   from questionnaire_results qr
   join questionnaire_instances qi on qi.id = qr.instance_id
   join questionnaire_definitions qd on qd.id = qi.questionnaire_id
   where qi.user_id = $userId and qd.code in ('PHQ9','GAD7','ASQ')
   order by qr.created_at desc
   limit 18
   ```
   Agrupar en JS por `code`, quedarse con 2 por code (suficiente para calcular delta), emitir hasta 3.

4. **Risk events abiertos** (usa `status`, no `resolved_at`):
   ```
   select risk_type, severity, created_at
   from risk_events
   where user_id = $userId and status = 'open'
   order by created_at desc
   limit 10
   ```

5. **Sesión anterior cerrada** (la actual está `open`, así que `status='closed'` ya la excluye):
   ```
   select closed_at, closure_reason
   from clinical_sessions
   where user_id = $userId and status = 'closed'
   order by closed_at desc
   limit 1
   ```

6. **Tareas pendientes abiertas:**
   ```
   select id, descripcion, estado, created_at, acordada_en_assessment_id
   from patient_tasks
   where user_id = $userId and estado in ('pendiente','parcial')
   order by created_at desc
   limit 10
   ```

7. **Número de sesión:** `count(*) from clinical_sessions where user_id = $userId and status = 'closed'` + 1 (la que está abierta).

Tests:
- Sin historia → `tier = 'none'`, `isFirstSession = true`.
- Con `draft_ai` pero sin validado → `tier = 'tierB'`.
- Con `reviewed_modified` de hace 15 días → `tier = 'tierA'`.
- Con `reviewed_confirmed` de hace 120 días → `tier = 'historic'`.
- Con `reviewed_confirmed` más un `draft_ai` posterior → devuelve el validado (tier A), **no** el draft.
- Con 2 PHQ-9 → delta correctamente calculado y signed.
- Con 1 `risk_event` `status='open'` → aparece en `openRiskEvents`.

---

## Task 7 — Índices de BD para los 6 queries

Nueva migración: `20260424000002_indexes_patient_context.sql`.

```sql
-- Query 1/2: assessments por paciente ordenados por reviewed_at, filtrados por status
create index if not exists idx_assessments_user_reviewed
  on assessments(user_id, reviewed_at desc)
  where status in ('reviewed_confirmed','reviewed_modified');

-- Query 2: draft más reciente por paciente
create index if not exists idx_assessments_user_session_status
  on assessments(user_id, session_id)
  where status in ('draft_ai','rejected');

-- Query 5: última sesión cerrada por paciente
create index if not exists idx_clinical_sessions_user_closed
  on clinical_sessions(user_id, closed_at desc)
  where status = 'closed';

-- Query 4: risk events abiertos por paciente
create index if not exists idx_risk_events_user_open
  on risk_events(user_id, created_at desc)
  where status = 'open';
```

Los índices de `patient_tasks` ya van en T1. Los de `questionnaire_instances(user_id)` ya existen (verificar en migraciones anteriores; añadir si no).

---

## Task 8 — `renderPatientContextBlock` + `computeRiskOpeningNotice`

Nuevo módulo server-only: [lib/patient-context/render.ts](serenia/lib/patient-context/render.ts).

```ts
import 'server-only'

export function renderPatientContextBlock(ctx: PatientContext): string
export function computeRiskOpeningNotice(ctx: PatientContext): string | null
```

**Bloque Tier A (validado reciente):**

```
[CONTEXTO DEL PACIENTE — última revisión clínica de hace <N> días]

Paciente: <displayName>, <edad> años. Sesión nº <N> (han pasado <M> días desde la anterior).

Motivo de consulta:
<chief_complaint>

Síntomas presentes:
- <presenting_issues[i]>

Cuestionarios recientes:
- PHQ-9: <score> (<band>) el <fecha> — antes <score-previo> (<delta signed>)
- GAD-7: ...

Áreas a explorar pendientes:
- <areas_for_exploration[i]>

Acuerdos abiertos de sesiones anteriores:
- "<descripcion>" (<estado>, acordada el <fecha>)

Riesgo clínico registrado:
- Ideación suicida: <suicidality> — autolesión: <self_harm>

Instrucciones para esta sesión:
- Esto es un contexto heredado; no presumas continuidad en tu primer mensaje.
- En tu PRIMER mensaje está prohibido citar contenido concreto del snapshot (tareas, síntomas, puntuaciones, nombres). Abre con una invitación abierta.
- A partir del tercer turno, si el paciente no ha abierto tema por su cuenta y la conversación ha llegado a una pausa natural, puedes ofrecer un puente hacia UN (no dos) acuerdo pendiente, como opción y no como agenda: "si te apetece, podemos mirar cómo fue lo de X, o si prefieres empezar por otra cosa, también".
- Si el paciente contradice el snapshot, valida primero ("tienes razón, gracias por aclararlo"), no justifiques la fuente, y sigue por donde él lleva.
- No cites al clínico, no cites diagnósticos ni hipótesis clínicas, no repitas datos privados como muestra de memoria.
- No re-explores en profundidad lo ya mapeado en el snapshot.

---
```

**Bloque `historic` (>90 días):** idéntico al Tier A pero con cabecera *"[CONTEXTO HISTÓRICO DEL PACIENTE — última revisión de hace <N> días; puede estar desactualizado]"* y una instrucción adicional *"trata este snapshot como referencia de hace meses; el paciente probablemente ha cambiado. Pregunta antes de asumir"*. Sin sección de acuerdos abiertos si todos los `patient_tasks` son anteriores al propio assessment histórico.

**Bloque Tier B (no validado):**

```
[CONTEXTO DEL PACIENTE — sesión anterior sin revisión clínica todavía]

Paciente: <displayName>, <edad> años. Sesión nº <N> (han pasado <M> días desde la anterior).

En la sesión anterior se registró:
- Motivo: <chief_complaint>
- Temas presentes: <presenting_issues[i]>
- Cuestionarios: <si hay>

Instrucciones para esta sesión:
- Este resumen NO está revisado por un clínico. Úsalo solo para no empezar completamente en frío. No cites hipótesis clínicas ni diagnósticos — no hay ninguno validado.
- Mismas reglas de apertura que con contexto validado: turn 1 sin referencias concretas, ofrece puente solo a partir del turn 3, valida si el paciente contradice.

---
```

**Primera sesión (`tier='none'` y no hay draft anterior):**

```
[CONTEXTO DEL PACIENTE — primera sesión]
No hay evaluación clínica previa ni sesiones anteriores registradas con este paciente. Usa la postura de intake habitual.

---
```

**Reglas de truncado:**
- `chief_complaint` → cap 300 chars.
- Cada item de `presenting_issues` / `areas_for_exploration` → cap 120 chars; máx 6 items por sección.
- Bloque total → cap 2500 chars. Si excede, truncar por prioridad: primero `areas_for_exploration`, luego `presenting_issues`, nunca `chief_complaint` ni `riesgo`.
- La lista de acuerdos pendientes → cap 5 items. Más allá indicar "+N acuerdos más".

**`computeRiskOpeningNotice(ctx)`:**

Devuelve un bloque solo si `ctx.riskState !== 'none'`. Contenido parametrizado por `riskState`:

- `acute`: *"[AVISO DE CONTINUIDAD — RIESGO AGUDO] Protocolo de crisis inmediato: valida sin alarmismo, ofrece Línea 024 textualmente, si hay señales de riesgo inmediato llama a close_session con reason='crisis_detected'. No inicies otras líneas de conversación hasta asegurar la continuidad de riesgo."*
- `active`: *"[AVISO DE CONTINUIDAD — RIESGO ACTIVO] Abre con un check-in cálido y específico sobre cómo está hoy respecto a la ideación reportada. Si el paciente abre con afecto positivo claro, haz el check-in en UNA frase breve y devuélvele el espacio inmediatamente. Ten la Línea 024 lista."*
- `watch`: *"[AVISO DE CONTINUIDAD — VIGILANCIA] En la sesión / informe anterior se registraron señales leves. Abre normalmente, pero mantén atención a reaparición; si el paciente abre con afecto positivo, no fuerces un check-in de seguridad."*

Este bloque va **después** de `basePrompt` y **antes** de `crisisNotice`, para que la regla determinista preceda a las alertas del turno actual.

Tests:
- Tier A con paciente `riskState='none'` → render incluye sección de acuerdos, no incluye riskOpeningNotice.
- Tier B → render no incluye `preliminary_impression` aunque el draft lo tenga.
- `historic` → aparece el disclaimer.
- Bloque > 2500 chars → se trunca respetando prioridades.
- Todas las exclusiones duras (`preliminary_impression`, `recommended_actions_for_clinician`, etc.) comprobadas vía `expect(block).not.toContain(field)`.

---

## Task 9 — Regla determinista de re-administración PHQ-9 / GAD-7

Nuevo módulo server-only: [lib/patient-context/questionnaire-rules.ts](serenia/lib/patient-context/questionnaire-rules.ts).

```ts
import 'server-only'

export function computeQuestionnaireRetakeHint(ctx: PatientContext): string | null
```

Reglas (cualquiera matchea → devuelve hint):

- PHQ-9 último `score >= 15` y `scoredAt < now() - 7 días` → *"el PHQ-9 del paciente era severo y tiene más de una semana; considera proponerlo de nuevo si el encuadre de la sesión lo permite."*
- PHQ-9 último `score >= 10` y `scoredAt < now() - 14 días` → equivalente, tono más suave.
- GAD-7 mismas bandas: `>= 15` / 7d, `>= 10` / 14d.
- Si ambos aplican, combinar en un solo hint.

El hint se añade al final del `patientContextBlock` bajo la sección *"Instrucciones para esta sesión"* — **no** es un tool ni fuerza a que el modelo los proponga, solo le indica que es clínicamente indicado. La decisión de llamar al tool `propose_questionnaire` sigue siendo del modelo.

Tests: cada banda + combinación PHQ + GAD + ninguno.

---

## Task 10 — Integración en `/api/chat` + feature flag + telemetría

Archivo: [app/api/chat/route.ts](serenia/app/api/chat/route.ts).

```ts
const featureOn = process.env.FEATURE_CROSS_SESSION_CONTEXT === 'on'

let patientContextBlock = ''
let riskOpeningNotice = ''
let contextTelemetry: ContextTelemetry | null = null

if (featureOn) {
  const ctx = await buildPatientContext(supabase, user.id)
  patientContextBlock = renderPatientContextBlock(ctx) + computeQuestionnaireRetakeHint(ctx) ?? ''
  riskOpeningNotice = computeRiskOpeningNotice(ctx) ?? ''
  contextTelemetry = {
    tier: ctx.tier,
    riskState: ctx.riskState,
    blockCharCount: patientContextBlock.length,
    pendingTasksCount: ctx.pendingTasks.length,
    riskTriggered: riskOpeningNotice.length > 0,
    lastValidatedAssessmentId: ctx.validated?./* id interno en builder */,
    truncatedSections: /* calculado por renderPatientContextBlock si trunca */,
  }
  await logContextInjection(supabase, {
    userId: user.id,
    sessionId: session.id,
    ...contextTelemetry,
  })
}

const systemPrompt = [
  basePrompt,
  riskOpeningNotice,
  crisisNotice,
  questionnaireNotice,
  timeNotice,
  patientContextBlock,
].join('')
```

Nueva tabla + migración `20260424000003_patient_context_injections.sql`:

```sql
create table patient_context_injections (
  id                              uuid primary key default gen_random_uuid(),
  user_id                         uuid not null references auth.users(id) on delete cascade,
  session_id                      uuid not null references clinical_sessions(id) on delete cascade,
  created_at                      timestamptz not null default now(),
  tier                            text not null check (tier in ('none','historic','tierB','tierA')),
  risk_state                      text not null check (risk_state in ('none','watch','active','acute')),
  block_char_count                integer not null,
  pending_tasks_count             integer not null,
  risk_triggered                  boolean not null,
  last_validated_assessment_id    uuid references assessments(id) on delete set null,
  truncated_sections              text[] not null default '{}'
);

create index idx_pci_user on patient_context_injections(user_id, created_at desc);

alter table patient_context_injections enable row level security;
-- Solo lectura clínica + servicio.
create policy pci_select_clinician on patient_context_injections
  for select using (is_clinician());
-- Insert solo vía service_role (el backend usa cliente autenticado pero la RLS del paciente
-- no debería dejarle escribir); delegamos a un helper server-side que usa service role.
```

Helper: [lib/patient-context/telemetry.ts](serenia/lib/patient-context/telemetry.ts) con `logContextInjection` usando el cliente service-role existente en el proyecto (verificar patrón en otros helpers — si no existe, crear uno mínimo).

**Importante:** el insert de telemetría es **fire-and-forget** — un `await` simple pero con `.catch(err => console.error(...))` para no tumbar el chat si la tabla falla.

Tests de integración (vitest con supabase mock):
- Flag off → system prompt idéntico al pre-Plan-6.
- Flag on + paciente sin historia → system prompt contiene solo el bloque "primera sesión".
- Flag on + Tier A + riesgo watch → ambos bloques presentes en el orden correcto.
- Flag on → una fila escrita en `patient_context_injections`.

---

## Task 11 — Inbox clínica + detalle de paciente: cabecera longitudinal y tareas abiertas

Archivos:
- [lib/clinician/inbox.ts](serenia/lib/clinician/inbox.ts): extender `InboxRow` con `sessionNumber`, `daysSincePrevious`, `phq9Trend: number[]`, `gad7Trend: number[]`, `openTasksCount`, `riskState` (derivado vía `derivePatientRiskState`).
- [components/clinician/inbox-list.tsx](serenia/components/clinician/inbox-list.tsx): renderizar una línea adicional por tarjeta: `Sesión nº N · X días desde la anterior · PHQ-9: 18→15→12 · 2 acuerdos abiertos`. Badge de riskState si != 'none'.
- [lib/clinician/patient.ts](serenia/lib/clinician/patient.ts) + [app/app/clinica/paciente/[userId]/page.tsx](serenia/app/app/clinica/paciente/[userId]/page.tsx): bloque nuevo **"Acuerdos abiertos"** listando `patient_tasks` con `estado IN ('pendiente','parcial')`, con link a la sesión de origen.

Las queries del inbox usan agregaciones por paciente — **asegurar que no introducen N+1**: una sola query a `patient_tasks` agrupando por `user_id`, otra a `questionnaire_results` agrupando por `user_id+code` (ya ordenada, tomar las últimas 3 por paciente en JS tras un `limit 100` razonable).

Tests: mock de 2 pacientes distintos → counts y trends correctos por paciente.

---

## Task 12 — UX paciente: vista de acuerdos + copy de transparencia

Archivos:
- [app/app/page.tsx](serenia/app/app/page.tsx) (rama paciente, dashboard): nuevo bloque **"Tus acuerdos recientes"** que lee `patient_tasks` del usuario actual con `estado IN ('pendiente','parcial')`, read-only. Si está vacío, no se renderiza.
- [app/app/page.tsx](serenia/app/app/page.tsx) o componente del header del dashboard: una línea de copy en letra pequeña: *"Tu psicólogo revisa cada sesión. En la siguiente, tu asistente recordará lo que haya quedado validado por tu revisión clínica."* Texto editable en un fichero de i18n simple (`lib/i18n/es.ts`) si no existe ya patrón similar.

La vista usa RLS `patient_tasks_select_own` — no hace falta policy nueva.

Tests: RTL del componente con 0 tareas → no renderiza; con 2 → renderiza ambas con descripción y fecha.

---

## Task 13 — Kill switch, métricas, verificación

**Kill switch.** `FEATURE_CROSS_SESSION_CONTEXT` en [.env.example](serenia/.env.example). Documentar en README que, por defecto, no se activa. El sign-off clínico se graba en `docs/superpowers/specs/` como un `.md` firmado.

**Métrica primaria (instrumentada antes de activar el flag):**
- Nueva tabla `continuity_references` o campo `metadata` en `messages` para marcar "este mensaje del paciente referencia continuidad" (regex ligera sobre patrones como `como te dije`, `lo del …`, `la última vez`, `sigo con`, `ya te comenté`). Esto lo puede hacer un job ligero on-insert o un cron que analice los últimos 7 días y vuelque a una vista materializada.
- Definición exacta del cálculo (en SQL o TS): `continuity_reference_rate = COUNT(distinct session_id where patient_message_matched) / COUNT(distinct session_id where session_number >= 3)`.
- Target: `>= 25 %` a las 4 semanas de activar el flag. `< 10 %` → desactivar flag, reworkear.

**Métrica secundaria:**
- `pending_task_closure_rate` = `COUNT(patient_tasks updated_to terminal in next review) / COUNT(patient_tasks pendientes al inicio de la sesión)`. Calcular ad-hoc. Target `>= 70 %`.

**Métrica de seguridad (creepy-open):**
- En la primera semana tras activar el flag, muestrear 50 session-openings y contar cuántos `first_assistant_message` referencian contenido específico del snapshot (tareas, síntomas nombrados). Threshold: `<= 2 %`. Si se supera, endurecer la regla del turn 1.

**Smoke E2E manual (con flag on en dev):**
1. Paciente A, primera sesión → bloque "primera sesión" presente en prompt, IA no menciona historia.
2. Cerrar sesión; clínico revisa y confirma con 2 tareas extraídas.
3. Paciente A abre sesión 2 → bloque Tier A. Turn 1 de la IA: no cita tareas. Turn 3-5: si el paciente no lo trae, la IA ofrece una tarea como opción, no como agenda.
4. Clínico abre el informe de la sesión 2 → ve las 2 tareas heredadas pre-pobladas en el editor, cambia una a `cumplida`, guarda.
5. Verificar en `patient_tasks` que el update tiene `closed_at`, `closed_by_assessment_id`.
6. Verificar fila en `patient_context_injections` con `tier='tierA'`.
7. Smoke del Tier B: paciente B con una sesión cerrada y draft pendiente de revisión → abre sesión 2 → bloque Tier B con cabecera "sin revisión clínica".
8. Smoke del riskState: paciente C cerró por `crisis_detected` hace 10 días y último assessment `suicidality='passive'` → bloque `riskOpeningNotice` presente, estado `watch`. Clínico revisa nuevo informe con `suicidality='none'` → en la siguiente sesión `riskState = 'none'` (recuperación).

`npx tsc --noEmit`, suite completa (T1-T12 tests), `next build`.

---

## Alcance y secuencia

- **T0 preparación:** `pnpm add server-only`, rama nueva, feature flag en env.
- **T1 → T13** en orden. Cada task cierra con commit convencional propio.
- Estimación realista: **~2 semanas** con la revisión subagent-driven (implementer + spec reviewer + code-quality por task).

### Phase split opcional

Si hace falta entregar valor antes:

**Fase 1 (ship A):** T0, T1, T2, T3, T4, T5, T6, T7, T8, T10, T13 (solo smoke + kill switch). Entrega Tier A + Tier B + acuerdos. ~1.5 semanas.

**Fase 2 (ship B):** T9 (re-take rule), T11 (cabecera inbox), T12 (UX paciente + transparencia), métricas primaria/secundaria instrumentadas. ~4-5 días.

El kill switch permite la Fase 1 en producción con una minoría de pacientes antes de enchufar la Fase 2.

---

## Notas de diseño

- **Server-only.** Todo `lib/patient-context/*` y `lib/clinical/risk-rules.ts` importa `'server-only'` en la primera línea. Cliente **nunca** debe importar de ahí.
- **Zero-leak.** Los bloques del prompt se construyen siempre con un allowlist de claves del `summary`, nunca con spread. Una nueva clave que añadamos al schema en el futuro **no** entra al modelo hasta que se añada explícitamente al `Pick<>` de `PatientContext` y al render.
- **PII de `display_name`.** El nombre del paciente viene de `user_profiles.display_name` y es texto libre. El render escapa saltos de línea y trunca a 80 chars. No hay scrubbing de contenido.
- **Nombres de terceros en textos libres.** No hay un scrubber automático. El riesgo lo asume el clínico al revisar el informe (es su responsabilidad no poner nombres identificables en `chief_complaint`). Documentar en el onboarding del clínico. Candidato a plan futuro si aparece un incidente.
- **Prompt caching.** El `patientContextBlock` ES estable dentro de una sesión (cambia entre sesiones, no entre turnos). Candidato claro para [cache_control](https://docs.claude.com/en/docs/build-with-claude/prompt-caching) de Anthropic: marcar el bloque como `ephemeral` para cachear desde turn 2 en adelante. Si la AI SDK v6 expone `providerOptions.anthropic.cacheControl`, aplicarlo en T10. Baja el coste a ~1/10 desde turn 2.
- **GDPR.** Este plan **no** persiste nada nuevo sobre el paciente que la BD no tuviera ya — excepto la telemetría (`patient_context_injections`) y las tareas (`patient_tasks`), ambas dentro del mismo modelo de datos del paciente y cubiertas por `on delete cascade` en el right-to-erasure existente.
- **Localización.** Textos en ES-ES consolidados en un fichero constante (`lib/patient-context/copy.ts`) para facilitar revisión del clínico. Candidato a `.md` editable en v2.

---

## Coste esperado y presupuesto de tokens

- Bloque Tier A típico: ~1600 chars ≈ ~530 tokens.
- Añadido a cada turn sin prompt caching: ~530 tok × ~30 turns/sesión ≈ ~16k tokens/sesión de overhead.
- Con prompt caching Anthropic: coste ~1/10 desde el turn 2 → ~530 + (2 × 29) ≈ ~1.7k tokens/sesión de overhead.
- Monitor: alerta en Vercel/Supabase si `avg(block_char_count)` de `patient_context_injections` sube >1.5× el baseline tras deploy.

## Preguntas abiertas (para antes de empezar, no bloqueantes)

1. ¿Aplicamos prompt caching de Anthropic desde T10? (Recomendación: sí, pero verificar que `llm.conversational()` lo expone; si no, ticket aparte.)
2. El Tier B se activa **solo** si no hay Tier A. ¿Y si hay Tier A pero muy viejo (`historic`) y además un draft más reciente? Propuesta: preferimos el `historic` con disclaimer; el draft se ignora para evitar mezclar dos fuentes. Decidir.
3. La regex de continuity-references es lenguaje-específica. Aceptable que sea ES-ES only y se extienda cuando lleguen otros idiomas.
4. ¿Activamos el flag por defecto en `preview` de Vercel para probarlo en deployments de PRs, y solo off en production? (Recomendación: sí.)
