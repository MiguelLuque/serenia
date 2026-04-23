# Plan 6 — Smoke E2E checklist

**Fecha:** 2026-04-23
**Plan relacionado:** [2026-04-23-plan-6-cross-session-continuity.md](../plans/2026-04-23-plan-6-cross-session-continuity.md)
**Documento hermano:** [2026-04-23-plan-6-cross-session-continuity-signoff.md](./2026-04-23-plan-6-cross-session-continuity-signoff.md)
**Procedimiento del flag:** [docs/operations/feature-flags.md](../../operations/feature-flags.md)

## Propósito

Verificación manual end-to-end del comportamiento de Plan 6 antes de encender `FEATURE_CROSS_SESSION_CONTEXT=on` en un entorno nuevo (dev, preview, producción). Los 8 pasos cubren Tier A, Tier B, ciclo de acuerdos y regla de recuperación del `riskState`. Se espera que un técnico ejecute la checklist completa y firme al final.

---

## Prerrequisitos

- [ ] `FEATURE_CROSS_SESSION_CONTEXT=on` en el entorno de prueba (ver [feature-flags.md](../../operations/feature-flags.md) para el procedimiento exacto).
- [ ] Re-deploy hecho tras cambiar el flag (si aplica, en Vercel) o dev server reiniciado (si es local).
- [ ] Tres pacientes de prueba disponibles con historiales distintos:
  - **Paciente A** — sin historia previa. Se usará para los pasos 1-6 (crear sesión 1, cerrar, revisar, crear sesión 2).
  - **Paciente B** — con una sesión ya cerrada y un `assessment` en `status='draft_ai'` sin revisar. Se usa en el paso 7.
  - **Paciente C** — con una sesión previa cerrada por `crisis_detected` hace ≥10 días y último `assessment.summary_json.risk_assessment.suicidality='passive'`. Se usa en el paso 8.
- [ ] Acceso al SQL editor de Supabase del entorno (para los snippets de verificación).
- [ ] Un usuario clínico válido en el entorno (para revisar el informe en el paso 2 y 4).

### Fixtures para Paciente B y Paciente C

Paciente A no requiere setup — es cualquier usuario nuevo sin historial.

Paciente B y Paciente C sí necesitan estado previo en BD. Ejecuta en el SQL editor sustituyendo los UUID. Los fixtures asumen que los usuarios (`auth.users`) y sus `user_profiles` con `role='patient'` ya existen en el entorno.

```sql
-- Paciente B: 1 sesión cerrada + assessment en draft_ai sin revisar
-- (genera Tier B en la siguiente sesión).
with new_conv as (
  insert into conversations (user_id)
  values ('<USER_B_ID>')
  returning id
),
new_session as (
  insert into clinical_sessions (conversation_id, user_id, status, opened_at, closed_at, closure_reason)
  select id, '<USER_B_ID>', 'closed', now() - interval '3 days', now() - interval '3 days' + interval '30 minutes', 'natural_end'
  from new_conv
  returning id, user_id
)
insert into assessments (user_id, session_id, generated_by, assessment_type, summary_json, status)
select
  user_id,
  id,
  'ai',
  'closure',
  jsonb_build_object(
    'narrative', 'Paciente de prueba Tier B — contenido no revisado.',
    'risk_assessment', jsonb_build_object('suicidality', 'none')
  ),
  'draft_ai'
from new_session;
```

```sql
-- Paciente C: sesión previa cerrada por crisis_detected hace 10 días
-- + último assessment validado con suicidality='passive' (genera riskOpeningNotice watch o active).
with new_conv as (
  insert into conversations (user_id)
  values ('<USER_C_ID>')
  returning id
),
new_session as (
  insert into clinical_sessions (conversation_id, user_id, status, opened_at, closed_at, closure_reason)
  select id, '<USER_C_ID>', 'closed', now() - interval '10 days', now() - interval '10 days' + interval '15 minutes', 'crisis_detected'
  from new_conv
  returning id, user_id
)
insert into assessments (user_id, session_id, generated_by, assessment_type, summary_json, status, review_status, reviewed_by, reviewed_at)
select
  user_id,
  id,
  'ai',
  'closure',
  jsonb_build_object(
    'narrative', 'Paciente de prueba con ideación pasiva.',
    'risk_assessment', jsonb_build_object('suicidality', 'passive')
  ),
  'reviewed_confirmed',
  'reviewed',
  '<CLINICIAN_ID>',
  now() - interval '10 days' + interval '1 hour'
from new_session;
```

Confirmación rápida tras ejecutar:

```sql
-- Verifica que B tiene exactamente un draft_ai y C tiene un reviewed_confirmed con passive.
select
  u.id as user_id,
  (select count(*) from assessments where user_id = u.id and status = 'draft_ai') as drafts,
  (select summary_json -> 'risk_assessment' ->> 'suicidality' from assessments
   where user_id = u.id and status in ('reviewed_confirmed','reviewed_modified')
   order by reviewed_at desc limit 1) as last_suicidality
from auth.users u
where u.id in ('<USER_B_ID>','<USER_C_ID>');
```

**Pass:** fila B → `drafts=1`, `last_suicidality` null; fila C → `drafts=0`, `last_suicidality='passive'`.

---

## Los 8 pasos

### 1. Paciente A — primera sesión

- [ ] Paciente A abre sesión 1.
- [ ] **Esperado:** bloque "primera sesión" presente en el system prompt (header `[CONTEXTO DEL PACIENTE — primera sesión]`). La IA NO menciona historia del paciente.

### 2. Cerrar sesión 1 y revisar

- [ ] Cerrar la sesión de Paciente A.
- [ ] El clínico abre la bandeja, entra al informe, confirma el draft y extrae (o deja que el generador proponga) **dos acuerdos**.
- [ ] **Esperado:** informe queda en `status='reviewed_confirmed'`. Dos filas en `patient_tasks` con `estado='pendiente'` asociadas al assessment.

### 3. Paciente A — sesión 2 (Tier A)

- [ ] Paciente A abre sesión 2.
- [ ] **Esperado:** bloque **Tier A** (header `[CONTEXTO DEL PACIENTE — última revisión clínica de hace N días]`). Turn 1 de la IA: NO cita tareas ni datos del snapshot (apertura abierta). En los turnos 3-5, si el paciente no trae nada propio y la conversación llega a pausa natural, la IA puede ofrecer UN acuerdo como opción (no como agenda).

### 4. Clínico revisa sesión 2 y cierra un acuerdo

- [ ] Cerrar la sesión 2 de Paciente A.
- [ ] Clínico abre el informe de la sesión 2.
- [ ] **Esperado:** las dos tareas heredadas están pre-pobladas en el editor del informe. El clínico marca una como `cumplida`, guarda, confirma el informe.

### 5. Verificar cierre de tareas en BD

- [ ] Ejecutar el snippet SQL 2 (abajo).
- [ ] **Esperado:** la fila de la tarea marcada cumplida tiene `closed_at IS NOT NULL` y `closed_by_assessment_id` apuntando al assessment de la sesión 2.

### 6. Verificar telemetría de inyección

- [ ] Ejecutar el snippet SQL 1 (abajo).
- [ ] **Esperado:** última fila de `patient_context_injections` para el `user_id` de Paciente A tiene `tier='tierA'`.

### 7. Smoke Tier B con Paciente B

- [ ] Paciente B abre una nueva sesión.
- [ ] **Esperado:** bloque **Tier B** con header `[CONTEXTO DEL PACIENTE — sesión anterior sin revisión clínica todavía]`. Las instrucciones para el modelo incluyen la frase "Este resumen NO está revisado por un clínico". No hay `preliminary_impression` ni `recommended_actions_for_clinician` en el bloque.

### 8. Smoke de recuperación del `riskState` con Paciente C

- [ ] Paciente C abre una nueva sesión inmediatamente.
- [ ] **Esperado inicial:** bloque contiene `riskOpeningNotice` (rama `watch` — header `[AVISO DE CONTINUIDAD — VIGILANCIA]`). La IA abre normal pero con atención a reaparición.
- [ ] Cerrar esa sesión. Clínico revisa, genera nuevo assessment con `summary_json.risk_assessment.suicidality='none'`, confirma.
- [ ] Paciente C abre una sesión siguiente.
- [ ] **Esperado tras recuperación:** `riskState='none'` — no hay `riskOpeningNotice` en el system prompt. Ejecutar snippet SQL 3 para confirmar el estado del `suicidality` en el último assessment.

---

## SQL de verificación

### Snippet 1 — Última inyección de contexto para Paciente A

Reemplazar `<USER_A_ID>` con el UUID real.

```sql
select
  created_at,
  tier,
  risk_state,
  block_char_count,
  pending_tasks_count,
  risk_triggered,
  last_validated_assessment_id,
  truncated_sections
from patient_context_injections
where user_id = '<USER_A_ID>'
order by created_at desc
limit 1;
```

**Pass:** `tier = 'tierA'` tras el paso 3 / paso 6.

### Snippet 2 — Cierre de tarea en `patient_tasks` tras paso 4

Reemplazar `<USER_A_ID>`.

```sql
select
  id,
  descripcion,
  estado,
  closed_at,
  closed_by_assessment_id,
  created_at
from patient_tasks
where user_id = '<USER_A_ID>'
  and closed_at is not null
  and closed_by_assessment_id is not null
order by closed_at desc
limit 5;
```

**Pass:** al menos una fila con `estado='cumplida'`, `closed_at` del momento en que el clínico guardó el informe de sesión 2, y `closed_by_assessment_id` = id del assessment de sesión 2.

### Snippet 3 — Sesión cerrada por crisis + último suicidality para Paciente C

Reemplazar `<USER_C_ID>`.

```sql
-- última sesión cerrada por crisis
select
  id,
  opened_at,
  closed_at,
  closure_reason
from clinical_sessions
where user_id = '<USER_C_ID>'
  and closure_reason = 'crisis_detected'
order by closed_at desc
limit 1;

-- último assessment validado con suicidality
select
  id,
  session_id,
  status,
  reviewed_at,
  summary_json -> 'risk_assessment' ->> 'suicidality' as suicidality
from assessments
where user_id = '<USER_C_ID>'
  and status in ('reviewed_confirmed', 'reviewed_modified')
order by reviewed_at desc
limit 1;
```

**Pass:** primera query devuelve la sesión de hace ≥10 días. Segunda query, tras el paso 8, devuelve `suicidality='none'` y la siguiente sesión de Paciente C ya no inyecta `riskOpeningNotice`.

---

## Criterios de rollback

Si algún paso falla (expected ≠ observed) o aparece comportamiento no esperado (copy distinto al firmado, filas telemétricas ausentes, tareas no heredadas, `riskOpeningNotice` donde no corresponde, IA citando snapshot en turn 1):

1. Volver `FEATURE_CROSS_SESSION_CONTEXT` a `off` en el entorno afectado — ver [feature-flags.md](../../operations/feature-flags.md) sección _Kill switch_.
2. Re-desplegar para que el flag tenga efecto.
3. Abrir un issue con: paso que falló, output esperado vs observado, user_id involucrado, timestamp, logs relevantes y, si procede, captura del system prompt inyectado.
4. No volver a encender el flag hasta que el issue esté cerrado y haya nuevo smoke verde.

---

## Firma del smoke

- Ejecutado por: `___________________________________`
- Entorno: ☐ dev  ☐ preview  ☐ production
- Fecha: `___________________________________`
- Resultado global: ☐ pass  ☐ fail (si fail, enlazar issue: `______________________`)
- Firma: `___________________________________`
