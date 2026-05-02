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
