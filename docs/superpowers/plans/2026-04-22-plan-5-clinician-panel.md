# Plan 5 — Panel clínico

**Branch base:** `main` (con Plan 4 ya mergeado).
**Branch de trabajo:** `feat/plan-5-clinician-panel`.

## Objetivo

Al terminar este plan, cualquier usuario con `role='clinician'`:
- Entra a `/app` y ve una **bandeja** con sesiones cerradas, no revisadas primero y por `closed_at` desc, con badges de crisis/pendiente.
- Desde la bandeja abre el detalle del paciente: identidad, tendencias (historial PHQ-9/GAD-7), `risk_events`, lista de sesiones.
- Abre el detalle de una sesión y ve el informe completo (`summary_json`) en secciones legibles + transcripción colapsable.
- **Edita** cualquier campo del informe y guarda (genera nueva versión con `supersedes_assessment_id`).
- **Marca como revisado** (`reviewed_confirmed` si sin cambios, `reviewed_modified` si editó) y la sesión desaparece de pendientes.
- La navegación del sidebar cambia a "Bandeja / Pacientes" cuando `role='clinician'`.

## Fuera de alcance

- Asignación paciente↔clínico (en Plan 5 cualquier clínico ve todo).
- Notificaciones push/email al clínico cuando hay un informe nuevo.
- Audit log de accesos/ediciones del clínico — Plan 6.
- Chat entre clínico y paciente.
- Exportar informe a PDF.

---

## Pre-requisitos

- Plan 4 mergeado en `main`.
- Existe al menos un usuario con `user_profiles.role='clinician'` para probar (crearlo manualmente en Supabase si hace falta).
- `is_clinician()` ya existe (`20260420000003_rls_clinician_read.sql`).

Decisiones fijadas:
- Edición versiona: guardamos una **nueva fila** en `assessments` con `supersedes_assessment_id` apuntando a la anterior y `generated_by='clinician'`. La sesión referencia siempre la más reciente (queries ordenan por `created_at` desc y filtran `supersedes_assessment_id is null`… o usamos una columna `current` — decidir en T5).
- `status`:
  - Generador IA → `draft_ai` (ya implementado).
  - Clínico abre y marca sin editar → `reviewed_confirmed`.
  - Clínico edita + guarda + marca → `reviewed_modified` (fila nueva, la anterior pasa a `superseded`).
  - Clínico rechaza → `rejected` (sin fila nueva).
- El paciente sigue viendo `patient_facing_summary` de la versión `reviewed_*` si existe; si no, de la `draft_ai`.

---

## Task 1: RLS — clínicos leen/editan datos clínicos

Nueva migración que extiende lo que `is_clinician()` ya cubre.

**Selects** (añadir política `..._select_clinician` con `using (is_clinician())`):
- `clinical_sessions`
- `messages`
- `conversations`
- `questionnaire_instances`
- `questionnaire_items` (ya puede ser público, revisar)
- `questionnaire_answers`
- `questionnaire_results`
- `questionnaire_definitions` (ya puede ser público)
- `assessments`
- `risk_events`

**Inserts** para versionado de informes:
- `assessments` ya tiene `assessments_insert_own` — añadir `assessments_insert_clinician` con `with check (is_clinician())` para permitir al clínico insertar filas donde `user_id != auth.uid()` (insertará filas con `user_id` del paciente).

**Updates**:
- `assessments_update_clinician` con `using (is_clinician()) with check (is_clinician())` para marcar status/superseded.

Tests (Vitest): mock con `is_clinician()` true/false, verificar que clínico ve sesiones ajenas y paciente no ve las de otros.

---

## Task 2: Bandeja clínica

Reemplaza el placeholder actual en `app/app/page.tsx` (rama `role === 'clinician'`).

`lib/clinician/inbox.ts`:
```ts
export async function getClinicianInbox(supabase) {
  // 1. select closed sessions + latest assessment per session
  // 2. left join user_profiles (display_name)
  // 3. left join risk_events (count, max severity)
  // 4. order: (status != 'draft_ai' ? 1 : 0), closed_at desc
  // 5. return array of { sessionId, userId, displayName, closedAt, closureReason, assessmentStatus, hasCrisis, topRisk }
}
```

Página (server component) renderiza `<InboxList rows={rows} />` con un `<Card>` por fila:
- Nombre del paciente + fecha relativa
- Badge estado: "Sin revisar" (rojo), "Revisado" (verde), etc.
- Badge extra "CRISIS" si `closure_reason='crisis_detected'`
- Link a `/app/clinica/sesion/[id]`

Criterio de orden:
```sql
order by (status = 'draft_ai') desc, closed_at desc
```

Tests: unit del ordering con 3 filas mixtas.

---

## Task 3: Detalle del paciente

Ruta: `/app/clinica/paciente/[userId]/page.tsx` (server component).

Bloques:
1. Cabecera: `display_name`, edad (si hay), contacto de emergencia.
2. **Tendencias cuestionarios**: tabla con cada puntuación PHQ-9 / GAD-7 histórica (code, fecha, score, band). Sin gráfico por ahora — tabla simple ordenada por fecha desc.
3. **Eventos de riesgo**: lista de `risk_events` con tipo, severidad, fecha, session_id link.
4. **Sesiones**: lista cronológica con estado del informe y link al detalle.

Query en `lib/clinician/patient.ts`.

---

## Task 4: Detalle del informe

Ruta: `/app/clinica/sesion/[sessionId]/page.tsx`.

Flujo server:
1. Fetch `clinical_sessions` + `assessments` (la "vigente": mayor `created_at` sin `supersedes_assessment_id` apuntando a ella).
2. Fetch `messages` de la conversación.
3. Pasa todo a `<AssessmentView>` (client para toggle edit).

Secciones visibles del `summary_json`:
- Motivo de consulta (chief_complaint)
- Problemas presentes (lista)
- Estado anímico / afecto
- Patrones cognitivos (lista)
- Evaluación de riesgo (suicidality, self_harm, notes)
- Cuestionarios completados (code, score, band, flags)
- Áreas a explorar
- Impresión preliminar
- Acciones recomendadas al clínico (lista)
- Resumen para el paciente (lo que ve él)

Footer:
- Transcripción de la sesión en un `<details>` colapsable. Cada mensaje con rol ("Paciente"/"Serenia") y timestamp.

Acciones:
- Botón "Editar informe" (entra a modo edición — T5).
- Botón "Marcar como revisado sin cambios" (T6).
- Botón "Rechazar informe" (T6).

---

## Task 5: Edición del informe

Componente `<AssessmentEditor>` client que recibe el JSON actual y renderiza un form:
- `<Textarea>` para strings libres (chief_complaint, mood_affect, notes, preliminary_impression, patient_facing_summary).
- Lista editable (add/remove) para arrays de strings (presenting_issues, cognitive_patterns, areas_for_exploration, recommended_actions_for_clinician).
- `<Select>` para enums (suicidality, self_harm).
- Los cuestionarios (questionnaires[]) NO son editables — vienen del scoring.

Submit server action en `app/app/clinica/sesion/[sessionId]/actions.ts`:
1. Valida con el mismo `AssessmentSchema` de Plan 4.
2. Insert nuevo `assessments` row con `generated_by='clinician'`, `status='reviewed_modified'`, `supersedes_assessment_id=<id anterior>`, `reviewed_by=auth.uid()`, `reviewed_at=now()`.
3. Update fila anterior → `status='superseded'`.
4. `revalidatePath('/app')`.

Validación: Zod como en generador. Si rompe, el action devuelve error.

Tests: unit del action con supabase mockeado, comprobar inserción + update anterior.

---

## Task 6: Marcar revisado / rechazado

Dos server actions en el mismo archivo de T5:
- `markReviewedAction(assessmentId)`: update fila → `status='reviewed_confirmed'`, `reviewed_by`, `reviewed_at`. Sin fila nueva.
- `rejectAssessmentAction(assessmentId, reason)`: update → `status='rejected'` + opcionalmente guarda `reason` en un campo (ver si hay, si no añadir `rejection_reason text` en migración).

Ambas llaman `revalidatePath('/app')`.

Test unit: mock supabase, verificar update fields.

---

## Task 7: Sidebar variante clínico

En `components/app/app-sidebar.tsx` usar la prop `role`:
- Si `role==='clinician'`: items `Bandeja (/app)`, `Pacientes (/app/clinica/pacientes)` — crear pagina índice que liste pacientes únicos con al menos una sesión cerrada.
- Si `role==='patient'`: items actuales (Inicio, Sesiones).

No tocar `/app/sesiones` — sigue siendo del paciente.

---

## Task 8: Tests y verificación

- Unit: RLS helpers, inbox ordering, edit action, markReviewed action.
- Smoke E2E: crear un usuario clínico manualmente, loguearse, ver la bandeja con la sesión que el paciente acaba de cerrar, abrir, editar un campo, guardar, verificar nueva fila en DB, marcar revisado, verificar que sale de pendientes.
- `npx tsc --noEmit`, suite completa, `next build`.

---

## Notas de diseño

- Todo el contenido clínico (labels de las secciones del informe) vive en `docs/agents/clinical-report.md` — el clínico podrá editarlo para cambiar terminología futura.
- Los textos del sidebar y botones son español peninsular ("Bandeja", "Revisar", "Rechazar").
- Revisar riesgo LGPD/GDPR en Plan 6: por ahora el clínico ve TODO; en Plan 6 añadimos asignación + audit log.
