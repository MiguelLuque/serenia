# Architecture Decision Records (ADR)

**Documento vivo.** Cada decisión arquitectónica que afecte cómo está construido Serenia se registra aquí. Una entrada por decisión.

Formato de cada entrada:

- **Contexto**: el problema o pregunta que motivó la decisión.
- **Decisión**: lo que se acordó.
- **Consecuencias**: qué implica (ventajas + trade-offs aceptados).
- **Estado**: `vigente` / `revisada por <ADR-N>` / `obsoleta`.

Las entradas viejas se conservan aunque se revisen. Si una decisión se reemplaza, se cita el ADR que la sustituye.

---

## ADR-001 — `proxy.ts` en lugar de `middleware.ts` (Next.js 16)

**Fecha:** 2026-04-19 (Plan 1)
**Estado:** vigente

**Contexto:** Next.js 16 renombra `middleware.ts` a `proxy.ts` y cambia la API. La app debe arrancar en Next.js 16 desde el día 1.

**Decisión:** usar `proxy.ts` en la raíz del proyecto. Cualquier mención a `middleware.ts` en planes o docs se trata como typo y se migra silenciosamente.

**Consecuencias:**
- El equipo debe leer la guía de Next.js 16 en `node_modules/next/dist/docs/` antes de tocar el archivo. Memoria del proyecto: `nextjs16_proxy_not_middleware`.
- Si una versión futura de Next.js renombra de nuevo, ADR-N revisará esto.

---

## ADR-002 — Plan 6: tres tiers de contexto cross-sesión (none / Tier A / Tier B / historic)

**Fecha:** 2026-04-23 (Plan 6)
**Estado:** revisada por ADR-014

**Contexto:** la IA en sesiones N>1 debía recibir contexto del último informe clínico, pero no toda la información. Hay campos meta-clínicos (`recommended_actions_for_clinician`, `rejection_reason`) que son para el supervisor humano y podrían sesgar a la IA si los lee.

**Decisión:** clasificar campos del `summary_json` en 4 tiers según validación clínica:
- **Tier A**: último assessment con `status` en `('reviewed_confirmed', 'reviewed_modified')` y `reviewed_at` en los últimos 90 días.
- **Tier B**: hay sesión cerrada pero el último assessment está en `draft_ai` (sin revisar).
- **Tier historic**: validado pero >90 días.
- **none**: primera sesión.

Excluir explícitamente `recommended_actions_for_clinician`, `preliminary_impression`, `rejection_reason`, `patient_facing_summary`, `mood_affect`, `cognitive_patterns` del bloque que recibe la IA.

**Consecuencias:**
- La IA opera con info clínica filtrada y validada.
- Riesgo: la IA no sabe partes del paciente que el clínico sí sabe — puede pedir info repetida o no respetar el marco terapéutico ya establecido. Esto se materializó en bugs de Plan 7 (Paciente Jaime).

**Revisado por ADR-014** (Plan 7 directiva del fundador "no puede haber información del paciente que el agente no conozca o no pueda acceder"): se revierten exclusiones de `mood_affect`, `cognitive_patterns`, `preliminary_impression`, `patient_facing_summary` y `clinical_notes`.

---

## ADR-003 — Vercel Workflow DevKit (WDK) para `generateAssessment` async

**Fecha:** 2026-04-24 (Plan 7 T6)
**Estado:** vigente

**Contexto:** la generación del informe al cierre de sesión llama al LLM (~12s). Hacerlo síncrono dentro del POST de `confirm_close_session` deja al paciente colgado. Si el LLM falla, la sesión queda cerrada sin informe (silencio en `try/catch`).

**Decisión:** mover `generateAssessment` a un workflow async con Vercel WDK. Dos pasos: encolar (rápido, en el request) + ejecutar el workflow en background (con retries). Nuevo estado `requires_manual_review` cuando los retries fallan, visible al clínico.

**Consecuencias:**
- POST de cierre responde <500ms.
- Robustez ante fallos del LLM.
- Nueva dependencia: `@vercel/workflow` + Vercel WDK runtime.
- Coste: requiere despliegue en Vercel para que WDK funcione (en local con `pnpm dev` también funciona).

---

## ADR-004 — Cuestionario `proposed_tasks` con `nullable()` para OpenAI strict mode

**Fecha:** 2026-04-24 (Plan 7 T-B fix)
**Estado:** vigente

**Contexto:** OpenAI structured outputs en strict mode exige que todos los campos tipados como `optional` o con `default` no aparezcan en `required` del JSON Schema. Esto rompe la generación cuando el campo existe.

**Decisión:** todos los campos opcionales del schema de generación del informe usan `.nullable()` (no `.optional()` ni `.default()`). El generator schema y el load schema están separados:
- `AssessmentGenerationSchema`: strict, sin defaults — usado por `generateObject`.
- `AssessmentSchema`: con defaults — usado en lectura para tolerar legacy.

**Consecuencias:**
- LLM genera siempre todos los campos.
- Lectura de rows antiguas sigue funcionando con defaults.
- Patrón: cualquier campo nuevo del schema sigue esta separación.

---

## ADR-005 — Unique index parcial sobre `assessments` (excluyendo superseded/rejected)

**Fecha:** 2026-04-24 (Plan 7 T-B fix)
**Estado:** vigente

**Contexto:** el workflow de generación de informe asume idempotencia con un unique index sobre `(session_id) where assessment_type='closure'`. Pero al aplicar la migration en BD prod, falla: la sesión `afcf87ca` tiene 2 rows `closure` (una `superseded` por edición del clínico, otra `reviewed_modified`). Esto es por diseño del flujo de versionado de Plan 5.

**Decisión:** el unique index es parcial — excluye los estados "muertos":
```sql
create unique index assessments_session_closure_live_unique
  on assessments (session_id)
  where assessment_type = 'closure'
    and status not in ('superseded', 'rejected');
```

**Consecuencias:**
- Solo una fila "viva" por sesión (draft_ai, reviewed_confirmed, reviewed_modified, requires_manual_review, pending_clinician_review).
- Versionado del clínico (editar → supersedes anterior + crea nueva) sigue funcionando.
- Regeneración tras `rejected` (Plan 7 T-B) también respeta la unicidad.

---

## ADR-006 — `safetyState` tipado con 7 variantes (no boolean) para anti-repetición

**Fecha:** 2026-04-26 (Plan 7 T3a v2)
**Estado:** revisada por ADR-016

**Contexto:** en Plan 7 T3a v1, la heurística `hasPriorSafetyCheck` retornaba `boolean` basado en regex sobre texto del assistant. El smoke real con Paciente Jaime detectó dos bugs: (a) el ASQ se disparó como tool call no como texto, y la regex no lo detectaba; (b) un boolean no captura la diferencia entre "ASQ pendiente", "ASQ negativo", "ASQ positivo no agudo", "ASQ acute risk".

**Decisión:** introducir un tipo discriminado `SafetyState` con 7 variantes derivado de la BD primaria (questionnaire_instances + questionnaire_results) + heurística textual como fallback. Cada variante dispara una variante distinta del `crisisNotice` con copy específico. Override `[RE-ESCALADA]` cuando hay señal nueva post-cribado.

**Consecuencias:**
- Anti-repetición fina: el LLM ve "ASQ negativo, no repreguntes salvo señal nueva específica" en vez de un bloque imperativo de crisis.
- Más mantenimiento: cualquier nuevo cuestionario de seguridad (C-SSRS en Plan 8) requiere extender la unión.

**Revisado por ADR-016** (Plan 8 Fase 2 sustituye ASQ por C-SSRS): los nombres de variantes pasan de `asq_*` a `cssrs_*` y se añade granularidad `low_risk` vs `moderate_risk`.

---

## ADR-007 — Persistencia íntegra de `parts` en `messages.parts` (UIMessage de AI SDK v6)

**Fecha:** 2026-04-24 (Plan 7 T1)
**Estado:** vigente

**Contexto:** `saveAssistantMessage` extraía solo el último `text` del `responseMessage`. Tool calls (`propose_close_session`, `propose_questionnaire`, etc.) NO se persistían. Tras recargar la página, `detectServerClose(messages)` no funcionaba porque los tool parts se perdían.

**Decisión:** el campo `messages.parts` (jsonb) almacena el `UIMessage['parts']` íntegro de AI SDK v6 — text + tool calls + tool results + reasoning. Validación con `safeValidateUIMessages` en la frontera de hidratación con estrategia batch-then-isolate (un row malformado no rompe toda la sesión).

**Consecuencias:**
- Estado de la conversación es serializable y rehidratable.
- Habilita features futuras: regeneración con histórico de tool calls, audit trail.
- Coste: el tamaño de `messages.parts` crece (no solo text). Aceptable hoy por volumen bajo.

---

## ADR-008 — Cierre de sesión vía tool obligatorio (split propose/confirm)

**Fecha:** 2026-04-24 (Plan 7 T3c, Plan 4.2)
**Estado:** vigente

**Contexto:** la IA cerraba sesiones diciendo "lo dejamos aquí, cuídate" sin llamar a ningún tool, y la sesión quedaba `status='open'` en BD. El paciente creía que terminó. Por otro lado, Plan 4.2 ya había split `close_session` en `propose_close_session` (sin side-effect) + `confirm_close_session` (cierra) para evitar cierres en falso.

**Decisión:** vinculante en el system prompt: prohibido decir frases de despedida sin haber llamado al tool de cierre correspondiente. Detección server-side en `onFinish` que loguea cuando se detecta despedida sin tool — audit no-bloqueante.

**Consecuencias:**
- Sesiones cerradas de forma consistente entre paciente, BD y UI.
- Rigidez aceptada: si el modelo improvisa una despedida, queda anómalo (audit lo captura para revisión humana).

---

## ADR-009 — Anti-repetición de safety check vía estado server-side

**Fecha:** 2026-04-26 (Plan 7 T3a)
**Estado:** vigente

**Contexto:** el `crisisNotice` se reinyectaba en cada turno donde `detectCrisis(lastUserText)` matchea palabras de riesgo, sin tracking de "ya pregunté en esta sesión". La IA preguntaba 3-4 veces por seguridad ante respuestas claras del paciente.

**Decisión:** la decisión de qué `crisisNotice` inyectar se basa en el estado server-side del cribado (BD), no solo en el último mensaje. Si ya hay ASQ scored sin riesgo agudo en la sesión, el notice cambia a una variante que prohíbe re-preguntar salvo señal nueva específica.

**Consecuencias:**
- La IA respeta el contexto de la sesión.
- Si el clínico borra el `questionnaire_results` row a mano (raro), la heurística vuelve a "primera vez". Aceptable.

---

## ADR-010 — Memoria intra-sesión vinculante en el prompt

**Fecha:** 2026-04-26 (Plan 7 T3 ampliada)
**Estado:** vigente

**Contexto:** la IA pedía info que el paciente ya había dado ("¿desde cuándo?" tras decir "1 año"). La sección "memoria intra-sesión" era recomendación, no obligación.

**Decisión:** convertir la sección en regla vinculante con cita textual obligatoria al parafrasear, y prohibido pedir datos demográficos/temporales ya respondidos.

**Consecuencias:**
- LLM más coherente conversacionalmente.
- El prompt es más largo. Aceptable.

---

## ADR-011 — Detector léxico de crisis es señal, no orden

**Fecha:** 2026-04-26 (Plan 7 T3d)
**Estado:** vigente

**Contexto:** el `crisisNotice` usaba lenguaje imperativo ("Activa el protocolo de crisis AHORA") cada vez que el detector léxico matchea palabras como "desbordado" o "desaparecer". El LLM obedecía, ignorando el contexto donde el paciente las usaba.

**Decisión:** el copy del `crisisNotice` "primera vez" instruye al LLM a leer el contexto antes de decidir si activar protocolo. El detector léxico actúa como aviso ("aparecieron palabras que pueden indicar riesgo emocional"), no como orden imperativa.

**Consecuencias:**
- Menos falsos positivos de protocolo de crisis.
- Riesgo: si el LLM minimiza una verbalización clara, podría ignorar señal real. Mitigado con el override `[RE-ESCALADA]` en términos de alta-señal.

---

## ADR-012 — Anti-persistencia tras rechazo

**Fecha:** 2026-04-26 (Plan 7 T3e)
**Estado:** vigente

**Contexto:** cuando el paciente rechaza una sugerencia de la IA, la IA encadenaba alternativas en cascada. Comportamiento de coach, no de psicóloga.

**Decisión:** vinculante: tras un rechazo, validar la respuesta y ceder iniciativa al paciente (preguntar "¿qué crees que sí podrías?"). Prohibido encadenar 2+ alternativas seguidas.

**Consecuencias:**
- Conversación más respetuosa.
- Riesgo: la IA puede quedar bloqueada si el paciente rechaza repetidamente. Mitigado con la regla "valida y deja espacio".

---

## ADR-013 — Onboarding clínico como bloque `[INTAKE INICIAL DEL PACIENTE]` en sesión 1

**Fecha:** 2026-04-25 (Plan 7 T-A → diferida → Plan 8 Fase 3)
**Estado:** vigente (a implementar en Plan 8 Fase 3)

**Contexto:** la IA no sabía el nombre informal, pronombres, edad ni motivo de consulta del paciente al iniciar sesión 1. Esto causaba bugs de personalización (femenino genérico, no usar el nombre).

**Decisión:** post-signup, una pantalla de intake clínico captura 4 campos: nombre informal, pronombres, edad/fecha de nacimiento, motivo de consulta. Se inyecta como bloque `[INTAKE INICIAL DEL PACIENTE]` al system prompt de sesión 1.

**Consecuencias:**
- Sesión 1 personalizada desde el primer mensaje.
- Coste: una pantalla de fricción extra entre signup y primer chat.

---

## ADR-014 — Reversión de exclusiones del Tier A (Plan 7 T-1)

**Fecha:** 2026-04-25 (Plan 7 T-1)
**Estado:** vigente; **revisa ADR-002**

**Contexto:** ADR-002 excluía `mood_affect`, `cognitive_patterns`, `preliminary_impression`, `patient_facing_summary` del bloque que recibe la IA. Tras el bug del Paciente Jaime, el fundador estableció la directiva "no puede haber información del paciente que el agente no conozca o no pueda acceder".

**Decisión:** revertir esas exclusiones. Solo se mantienen excluidos `recommended_actions_for_clinician` (meta-instrucciones para el humano supervisor) y `rejection_reason` (artefacto de QA interno).

**Consecuencias:**
- La IA opera con la foto clínica completa del paciente.
- Se introduce un campo nuevo `clinical_notes` (notas privadas del clínico durante revisión, también visibles al agente).
- Más tokens en el contexto. Aceptable.

---

## ADR-015 — Plan 8: protocolo de 8 sesiones rígido y hardcoded

**Fecha:** 2026-05-02 (Plan 8)
**Estado:** vigente

**Contexto:** Pablo entrega un protocolo TCC/ACT de 8 sesiones con foco/técnicas/tareas/racional por sesión. Decisión de diseño: ¿modelar como tabla configurable (`session_protocol_templates`) o hardcoded en código + prompt?

**Decisión:** **rígido y hardcoded**. Las 8 fases viven en `lib/protocol/render-phase.ts` (renderer del bloque) + `docs/agents/prompts/session-therapist.md` (reglas por fase). Sin tabla configurable.

**Consecuencias:**
- Más simple, más predecible.
- Coherente con "Serenia psicóloga TCC/ACT" como producto.
- Trade-off aceptado: ajustar el protocolo requiere PR. Si la flexibilidad se vuelve crítica, refactorizar a tabla es factible (la lógica está aislada en un módulo).

---

## ADR-016 — Plan 8: ASQ → C-SSRS como cribado de seguridad

**Fecha:** 2026-05-02 (Plan 8)
**Estado:** vigente; **revisa ADR-006**

**Contexto:** Pablo identificó que el ASQ (5 ítems) era insuficiente. Pidió C-SSRS (Columbia Suicide Severity Rating Scale, 6 ítems screener) por mayor granularidad clínica.

**Decisión:** sustituir ASQ por C-SSRS. Renombrar el `SafetyState` de ADR-006: variantes `asq_*` → `cssrs_*` con granularidad nueva (`low_risk` y `moderate_risk` separados, no agrupados).

**Cortes de banda C-SSRS aprobados:**
- `negative` = todo No.
- `low_risk` = solo ítem 1 (deseo pasivo).
- `moderate_risk` = ítems 1-2 (ideación activa sin plan).
- `high_risk` = hasta ítem 3 o 4 (método o intención).
- `acute_risk` = ítem 5 (plan completo) o ítem 6 (conducta reciente).

**Consecuencias:**
- Pre-lanzamiento permite reemplazo sin migración (datos legacy se borran en T0.1).
- ASQ desaparece del codebase.

---

## ADR-017 — Plan 8: registry de cuestionarios como fuente única

**Fecha:** 2026-05-02 (Plan 8 T0.3)
**Estado:** vigente

**Contexto:** PHQ-9, GAD-7, ASQ se trataban con if/else en 6+ sitios del código (`scoring.ts`, `service.ts`, `card-metadata.ts`, `render.ts`, `inbox.ts`, tools del chat). Añadir nuevos cuestionarios (BDI-II, BAI, STAI, C-SSRS, HAM-D) duplicaría ese hardcoding.

**Decisión:** crear `lib/questionnaires/registry.ts` como fuente única. Cada entry: `{ code, label, durationCopy, scorer, isClinicianRated, ... }`. Todos los consumers derivan del registry.

**Consecuencias:**
- Añadir un cuestionario = añadir una entrada en el registry + un scorer + un seed migration.
- Refactor inicial requiere tocar todos los consumers, pero después escalable.

---

## ADR-018 — Plan 8: Hamilton (HAM-D) como cuestionario clinician-rated

**Fecha:** 2026-05-02 (Plan 8 Fase 7)
**Estado:** vigente

**Contexto:** HAM-D es observacional — el clínico lo puntúa, no el paciente. El sistema actual asume que el paciente rellena cuestionarios desde el chat.

**Decisión:** añadir flag `is_clinician_rated boolean` a `questionnaire_definitions`. Cuando es `true`:
- El paciente NO ve el cuestionario.
- El clínico lo administra desde una pantalla nueva en el panel.
- RLS permite al clínico insertar respuestas sobre el paciente.

**Consecuencias:**
- Mismo schema (`questionnaire_instances`/`questionnaire_results`/`questionnaire_answers`) sirve para ambos tipos.
- UI clínica nueva.
- Coherente con la decisión #2 del flow ("la IA conoce todo lo que sabemos del paciente"): el resultado del HAM-D se inyecta al system prompt aunque el paciente no lo ve.

---

## ADR-019 — Plan 8: separación de capas (lib / api / components / pages)

**Fecha:** 2026-05-02 (Plan 8)
**Estado:** vigente

**Contexto:** el repo tenía una separación implícita pero no formalizada. El usuario pidió explícitamente fijar la frontera entre lógica y UI para Plan 8.

**Decisión:**
- **Lógica de negocio (pura)**: `lib/`. Funciones puras, scorers, builders, validadores. NO importa de `components/` ni `app/`. Testeable en aislamiento.
- **API / orquestación**: `app/api/`, server actions en `app/.../actions.ts`. Recibe request, llama a `lib/`, devuelve respuesta.
- **Componentes visuales**: `components/`. Solo presentación + estado de UI. Importa de `lib/types/` (tipos) y server actions. NO importa lógica de `lib/`.
- **Pages**: `app/app/`, `app/onboarding/`. Compone componentes + llama a server actions.

Reglas duras: ningún componente escribe a BD directo. Ningún módulo `lib/` importa de `components/` ni `app/`. Tipos compartidos viven en `lib/types/`.

**Consecuencias:**
- Refactors más simples. Tests más aislados.
- Cualquier task que mezcle capas, el arquitecto lo bloquea.

---

## ADR-020 — Plan 8: rol de la IA = "asistente psicológica TCC/ACT supervisada"

**Fecha:** 2026-05-02 (Plan 8 + Plan 7 #6)
**Estado:** vigente

**Contexto:** la copy actual decía "tu psicólogo verá esto". Con Plan 8, la IA actúa como psicóloga TCC/ACT — confusión sobre quién es quién.

**Decisión:**
- La IA se presenta como "**asistente psicológica TCC/ACT supervisada**".
- Cuando referencia al humano supervisor: "**el psicólogo que supervisa tu caso**".
- Coherente con la decisión "supervisión humana es contractual" de Plan 7.

**Consecuencias:**
- El paciente sabe desde el primer turno que la IA NO es el psicólogo humano.
- Copy adicional en sesión 1 para introducir el modelo de supervisión.

---

## ADR-021 — Plan 8: deuda de T0.3+T0.4 anotada para revisión en Fases 1-2 y 7

**Fecha:** 2026-05-02 (Plan 8 T0.3+T0.4 architect review)
**Estado:** vigente

**Contexto:** la review del arquitecto de T0.3+T0.4 aprobó el merge con 3 salvedades no-bloqueantes. Documentadas para que no se pierdan al añadir nuevos cuestionarios.

**Decisión:** registrar y revisar antes de cerrar Fases 1, 2 y 7:

1. **`lib/clinician/inbox.ts:287` aún ramifica con literales `'PHQ9'`/`'GAD7'`** en un ternario por código. Funciona hoy (cada código va a un Map distinto) pero al añadir BDI-II / BAI / STAI / C-SSRS crece linealmente. **Acción Fase 1**: refactorizar a `Map<QuestionnaireCode, Map<string, number[]>>` indexado por code antes de añadir los nuevos cuestionarios al inbox.

2. **`qa_insert_own` (migration `20260422000002`) no excluye instancias clinician-rated.** Hoy no es problema porque el flujo de creación nunca crea instancias clinician-rated con `user_id=patient` desde el cliente paciente, pero sería más airtight cambiar la policy a `... and qd.is_clinician_rated = false`. **Acción Fase 7**: revisar y endurecer la policy antes de exponer la UI clínica de Hamilton.

3. **Test gap del filtro clinician-rated.** `tests/questionnaires/registry.test.ts:40-44` solo verifica que hoy los 3 son patient-rated. **Acción Fase 7**: cuando se añada HAM-D con `isClinicianRated=true`, añadir test que valide `listPatientCodes()` lo excluye.

4. **Edge case `z.enum([])`**: si por error futuro todos los cuestionarios quedan clinician-rated, `app/api/chat/route.ts:182-187` rompería en runtime. **Acción Fase 7**: garantizar que siempre exista ≥1 cuestionario patient-rated.

**Consecuencias:**
- Cada Fase tiene un check explícito de deuda heredada que cerrar antes de mergear.
- Si una salvedad sigue abierta tras su Fase, se promueve a su propio ADR como deuda persistente.

---

## ADR-022 — Plan 8 T0.1: wipe legacy + repair via second migration

**Fecha:** 2026-05-02 (Plan 8 T0.1)
**Estado:** vigente
**Lección vinculada:** L-013 (`docs/architecture/lessons.md`)

**Contexto:** el plan T0.1 listaba un `TRUNCATE … CASCADE` masivo de tablas de interacción + `DELETE FROM auth.users WHERE id NOT IN (preservados)`, y un `UPDATE` posterior para resetear los campos clínicos de los `user_profiles` preservados (Miguel + Pablo). Al ejecutar la migration `20260502000004_wipe_legacy_test_data.sql`, el `TRUNCATE` cascadeó a `user_profiles` por FKs **salientes** (`active_care_plan_id` → `care_plans`, `last_reviewed_assessment_id` → `assessments`). Resultado: `user_profiles` quedó vacío y el `UPDATE` corrió sobre 0 rows. Pablo perdería el rol `clinician` al loguearse.

**Decisión:** reparar en una migration separada `20260502000005_restore_preserved_profiles.sql` con `INSERT … ON CONFLICT (user_id) DO NOTHING` para los 2 UIDs preservados, fijando `role` y `onboarding_status='pending'`. Mantener la migration 04 fiel a lo que se aplicó (no editarla); la 05 documenta la corrección.

**Consecuencias:**
- Estado actual de BD prod: `auth.users` = 2, `user_profiles` = 2 (Miguel `patient`, Pablo `clinician`, ambos `onboarding_status='pending'`), todas las tablas de interacción a 0.
- Cuando Pablo o Miguel entren en `/app`, el middleware los redirige a `/onboarding` para completar los 4 campos del intake nuevo (Fase 3). Validación práctica del flow Plan 8 Fase 3 sin necesidad de re-signup.
- **Patrón vinculante** para futuros wipes: antes de un `TRUNCATE … CASCADE` masivo, listar las FKs **entrantes Y salientes** de las tablas implicadas. Si una tabla X tiene FK saliente hacia Y y se trunca Y, X también se vacía. Mejor disociar primero (`UPDATE X SET fk_col = NULL`) o usar `DELETE FROM X WHERE …` con control fino.
- En pre-launch un trigger `on auth.users insert` recrea `user_profiles` automáticamente, pero **no aplica** a usuarios preexistentes — solo on-INSERT. Recrear filas manualmente es la red de seguridad.

---

## ADR-023 — `lib/shared/` vs `lib/server/`: separación interna preparada para multi-app (Expo)

**Fecha:** 2026-05-02
**Estado:** vigente

**Contexto:** a futuro existirá una app móvil con Expo. La lógica clínica (scorers de cuestionarios, schemas zod, registro de fases, heurísticas de seguridad, render del bloque de protocolo, etc.) DEBE poder ejecutarse tanto en el server de Next.js como en un cliente React Native. Hoy todo vive en `lib/` mezclado: archivos puramente puros conviven con archivos que importan `'server-only'` o `next/*` o consumen Supabase como cliente server.

ADR-019 ya fija la separación lógica/UI (lib/ pura). Este ADR refina la separación dentro de `lib/`: dentro de la lógica, qué es portable vs qué es server-side.

**Decisión:** dividir `lib/` en dos subcarpetas:

| Carpeta | Contenido | Restricciones |
|---|---|---|
| `lib/shared/` | Lógica pura: tipos, schemas zod, scorers, registry, renderers hardcoded, heurísticas regex, validators, constantes, design tokens. | NO `import 'server-only'`. NO `import 'next/*'`. NO `import '@supabase/...'` que consume BD (los tipos generados sí, son shape pasivo). |
| `lib/server/` | Lógica server-side: builders que consultan BD vía Supabase, RPC wrappers, server actions internos, workflows Vercel WDK, system prompt assembly. | Permite `server-only`, `next/*`, queries Supabase. Nadie en cliente RN debe poder importar de aquí. |

Cuando arranque la app Expo, `lib/shared/` se promueve a `packages/shared/` con un cambio de path (`@/lib/shared/...` → `@serenia/shared/...`). El monorepo se decide entonces, no antes.

**Consecuencias:**

- **Inmediatas**: refactor de paths en todos los consumers de `lib/`. ~200+ imports a actualizar. Cero cambio funcional.
- **Disciplina nueva**: cualquier archivo nuevo en `lib/shared/` debe ser portable. Si necesita BD o `server-only`, va a `lib/server/`. El arquitecto bloquea PRs que mezclen.
- **Duda futura**: `lib/shared/llm/{models,config}.ts` exporta IDs de modelos LLM. Hoy son constantes puras. Si en el futuro se carga config de env vars, va a `server/`.
- **Test layout**: `tests/` raíz se reordena en `tests/shared/` y `tests/server/` para reflejar la separación; los `__tests__/` colocalizados se mantienen donde están.
- **Beneficio cuando arranque Expo**: el cliente RN importa `lib/shared/...` directamente. Cero código duplicado. Cero risk de meter por error un `server-only` en el bundle del móvil.

**No incluido en este ADR:** la conversión a monorepo formal con pnpm workspaces. Esa decisión se toma cuando arranque mobile y se sepa el calendario.

---

## ADR-024 — Plan 8 Fase 1: desviaciones tras feedback clínico de Pablo (2026-05-03)

**Fecha:** 2026-05-03
**Estado:** vigente
**Documentos vinculados:** `docs/handoff/respuesta de pablo/_utf8/0{1,2,3,4}-*.md`, `docs/agents/questionnaires/{bdi2,bai,stai,cssrs}.md`

**Contexto:** Pablo respondió el material de handoff con (a) 4 PDFs de cuadernillos en español validado, (b) firmas y edits sobre los dos prompts, (c) decisiones sobre las 8 preguntas sueltas. Varias respuestas **divergen** del Plan 8 mergeado y de los borradores v2.0 firmados antes. Este ADR consolida las desviaciones para no perderlas al implementar Fases 1, 2, 4, 6.

**Decisiones clínicas firmadas y desviaciones:**

### 1. HAM-D queda fuera del MVP (cancela Fase 7)

Pablo retiró HAM-D y dejó abierta una posible sustitución por **MINI** ("MINI en síntomas emocionales"). Pendiente de cierre el 2026-05-04. Mientras tanto:
- Fase 7 del Plan 8 (UI clínica Hamilton) **se suspende**.
- ADR-018 (HAM-D clinician-rated) sigue vigente como modelo aplicable a *cualquier* cuestionario clinician-rated futuro, pero el primer consumidor concreto (HAM-D) no se construirá.
- ADR-021 punto #4 (`z.enum([])` si todos clinician-rated) deja de ser problema inmediato: con HAM-D fuera, los 4 cuestionarios nuevos son patient-rated.

**Consecuencia:** las migrations de seed sólo crean BDI-II, BAI, STAI, C-SSRS — **4 cuestionarios nuevos**, no 5. El registry crece de 3 a 7 (no a 8).

### 2. BAI: 3 bandas en vez de 4

Plan original (T1.3): `0-7 mín / 8-15 leve / 16-25 moderado / 26-63 severo`.
Pablo firma: `0-21 normal / 22-35 moderado / 36-63 severo`.

Sin desviación de scoring (sigue siendo suma simple 0-63), pero el mapping a banda cambia. El scorer en `lib/shared/questionnaires/scoring.ts` debe usar las bandas de Pablo, **no** las del plan.

### 3. STAI: bandas distintas por sexo y subescala

Plan original (T1.3): "bandas por subscore (≥45 alto)" — corte único sin distinción de sexo.
Pablo firma: 4 bandas por subescala × 2 sexos = **16 puntos de corte distintos**.

Implicación: el scorer necesita un input `sex` (no `pronouns`, que es independiente). Mapping provisional pendiente de cierre con Pablo:

- `pronouns = 'él'` ⇒ `sex = 'male'` para banda STAI.
- `pronouns = 'ella'` ⇒ `sex = 'female'`.
- `pronouns ∈ {'elle', 'prefiero no decirlo'}` ⇒ usar bandas de **mujeres** como conservador (tienen rangos "sin ansiedad" más amplios) y devolver `band_assignment_uncertain=true` para revisión clínica del psicólogo.

Esto requiere o bien (a) añadir un campo `sex` al schema de `user_profiles` separado de `pronouns`, o (b) extraer el mapping del enum `pronouns` directamente en el scorer. La decisión se cierra al implementar T1.3-bis junto con Pablo.

### 4. C-SSRS: lifetime + override "since last visit"

Plan original (T1.4): 5 bandas firmadas según ítems 1-6.
Pablo añade: usar **sólo lifetime** en sesión 1. En sesiones siguientes el ítem 6 se reformula como *since last visit*. Si **ítem 6 since-last-visit = Sí**, **cortar inmediatamente** y notificar urgente al psicólogo (independiente de la banda calculada).

Implicación: el scorer de C-SSRS recibe `behavior_lifetime: bool` y `behavior_recent_since_last_visit: bool | null`. Si `behavior_recent_since_last_visit === true`, banda = `acute_risk` + `requires_immediate_action=true` que el route handler usa para forzar cierre de sesión. Modelado en `cssrs.md`.

### 5. Toggle "el clínico conoce al usuario"

Plan original: ningún ADR cubre esto.
Pablo firma: el campo es **manual** — Pablo lo marca/desmarca desde la UI del panel clínico (no se infiere automáticamente).

Implicación:
- Migration nueva: `user_profiles.clinician_has_met_user boolean not null default false` (o tabla puente si en el futuro hay >1 clínico).
- UI en panel clínico: toggle por paciente.
- Inyección al system prompt: si `true`, Serenia usa "Pablo" para referirse al supervisor; si `false`, usa "el psicólogo que supervisa tu caso" (default ADR-020).
- **Compatible con ADR-020.** Refinamos: ADR-020 fija el default; este ADR fija el override.

### 6. Edad mínima 18 años (España, legislación)

Plan original: T3.1 schema intake clínico no validaba edad mínima.
Pablo firma: **mayoría de edad legal española = 18 años** es obligatoria.

Implicación:
- `lib/shared/onboarding/schema.ts` añade `birthDate` con validación de edad ≥ 18 al guardar.
- Si menor en signup, bloquear con copy explícito: *"Serenia es para adultos. Si tienes menos de 18 años, busca apoyo en [recursos juveniles]"*. Recursos juveniles a definir con Pablo en próxima ronda.

### 7. Diagnósticos fuera de scope (NUNCA tratar)

Plan original: no contemplaba lista de exclusiones.
Pablo firma: trastornos psicóticos (énfasis especial: "NUNCA JAMÁS SE TRATARÁ NADA QUE IMPLIQUE ALTERACIONES DE LA REALIDAD"), bipolares, alimentarios graves, adicciones activas, TLP.

Implicación:
- Si Serenia detecta indicadores de cualquiera de estos durante una sesión: generar informe `[URGENTE]`, derivar al psicólogo, comunicar al usuario *"esta problemática excede mis competencias; he generado un informe urgente; el psicólogo te contactará lo antes posible"*.
- Detección heurística por palabras clave + verificación humana en revisión del informe. La IA NO diagnostica; sólo indica *"impresiona X"* en el campo nuevo de **orientación diagnóstica** del informe (que sólo ve el clínico — ver punto 9).
- Esta lógica vive en `lib/server/clinical/scope-detection.ts` (nuevo). Se ejecuta en post-procesado del informe, no en el chat (la IA no debe interrumpir la sesión por esto a menos que sea concurrente con C-SSRS aguda).

### 8. Frecuencia entre sesiones: semanal estricta

Plan original: "Frecuencia entre sesiones" no especificada.
Pablo firma: **semanal estricta**, comunicada al usuario en sesión 1. Si se salta una semana → preguntar (sin juzgar) por qué, validar, y **retomar la sesión que tocaba** (no avanzar).

Implicación:
- `protocol_phase` se calcula con `min(closedCount + 1, 8)` — esto **ya** funciona así (ADR-015 y `lib/shared/sessions/service.ts:computeProtocolPhase`). Una semana saltada NO avanza la fase. ✅ Sin cambio de código.
- Sí cambio: copy en el system prompt sesión 1 anuncia la frecuencia. Y bloque condicional: si han pasado >7 días desde la última sesión, validar el lapso y NO juzgar.

### 9. Orientación diagnóstica en el informe

Plan original (T6.1): el informe NO tiene apartado de etiqueta diagnóstica.
Pablo firma: añadir apartado **"orientación diagnóstica"** (formato *"Impresiona X"*) que **sólo ve el clínico**, jamás el usuario. Coexiste con la regla "nunca etiquetas DSM/CIE en el resumen al paciente".

Implicación:
- `AssessmentSchema` (zod en `lib/shared/assessments/...`) añade `diagnostic_impression: string | null` con guardarrail: nunca incluido en el campo `patient_summary`.
- UI clínica muestra el apartado en `assessment-view.tsx` con label explícito "(sólo visible al clínico)".

### 10. Resumen al paciente: SÍ recordar tareas de la semana

Plan original (T6.1): el resumen al paciente NO incluía tareas (lista de prohibiciones era "Referencias a tareas").
Pablo firma: el resumen al paciente **debe recordar** la tarea de la semana.

Implicación: actualizar el prompt `clinical-report.md` en v2.1 para añadir la tarea al cierre del resumen. Sustituye la regla anterior.

### 11. Notificaciones de informe URGENTE: WhatsApp si posible

Plan original: no especificaba canal.
Pablo firma: **WhatsApp si es posible** (requiere integración nueva), si no email inmediato con resumen + link.

Implicación:
- Out-of-scope para Plan 8 inicial. Email inmediato es la opción inmediata.
- Si Plan 8.5 incorpora integración WhatsApp Business API, este ADR se actualiza.

### 12. SLA del clínico: 72h general, mismo día para urgentes

Plan original: no especificaba SLA.
Pablo firma: urgentes mismo día, resto **<72h**. Avisar a Pablo cuando quede 1 día para la cita si no se ha revisado.

Implicación:
- Cron nuevo en `lib/server/cron/...` que busca informes pendientes de revisión cuya cita está a <24h y notifica.
- **La IA NUNCA comunica al usuario el SLA específico de Pablo.** Copy genérico tipo *"el psicólogo lo verá pronto"*.

### 13. Cambios al prompt session-therapist firmados (resumen)

11 cambios a aplicar al `session-therapist.draft-v2.md` para producir v2.1 (detalle en el archivo `02-session-therapist-revision.md` de Pablo). Ver task list de la session.

### 14. Cambios al prompt clinical-report firmados (resumen)

5 cambios a aplicar al `clinical-report.draft-v2.md` para producir v2.1 (detalle en el archivo `03-clinical-report-revision.md` de Pablo). Incluye los puntos 9, 10, y la definición clínica precisa de "indicios indirectos sin confirmación" en consumo (Pablo pidió aclararlo con literatura).

**Consecuencias generales:**

- **Plan 8 Fases 1, 2, 4, 6 desbloqueadas** con desviaciones documentadas. Fase 7 cancelada hasta nueva orden de Pablo.
- Migration nueva pendiente: `clinician_has_met_user` (punto 5).
- Schema cambia: `birthDate` con validación 18+ (punto 6), `diagnostic_impression` en assessment (punto 9).
- Borradores v2.0 → v2.1 con los cambios firmados; Pablo debe firmar v2.1 antes de Fase 4 y 6.
- L-014 (lección): cuando el plan cita "5 cuestionarios" basado en estimación interna, validar con el clínico antes de mergear nada que ramifique por código (`PHQ9 | GAD7 | BDI2 | BAI | STAI | CSSRS | HAMD`). Aquí, HAMD entró en la enum del registry y debe quitarse cuando se cancele formalmente.

