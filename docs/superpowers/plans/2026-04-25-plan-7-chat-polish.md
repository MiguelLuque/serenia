# Plan 7 — Chat polish (calidad clínica, robustez, naturalidad)

**Fecha:** 2026-04-25
**Estado:** propuesta — pendiente de aprobación de scope
**Branch sugerida:** trabajar por tareas en ramas `hotfix/plan-7-tN-*` (no monolítica)
**Documento hermano:** [2026-04-25-plan-7-human-decisions.md](../specs/2026-04-25-plan-7-human-decisions.md)
**Doc del flujo del chat (vivo):** [docs/agents/chat-flow.md](../../agents/chat-flow.md) — siempre debe reflejar lo que está mergeado en `main`.

## Objetivo

El chat con la IA es la **main feature** de Serenia. La meta de este plan es que se sienta **natural y profesional**, lo más parecido posible a una conversación con un psicólogo humano: que recuerde lo que se ha dicho, que no repita preguntas, que clasifique con criterio clínico, que sea robusto técnicamente, y que blinde al paciente en momentos críticos.

Antes de abrir la app a usuarios reales, este plan tiene que estar terminado.

## Contexto

Antes de este plan se mergearon:
- Plan 6 (continuidad cross-sesión)
- Hotfix Plan 4.1 (flujo de cuestionarios)
- Hotfix Plan 4.2 (cierre de sesión con confirmación)

Tres auditorías independientes (arquitecto, experto Next.js + AI SDK v6, PO clínico) han identificado >30 problemas concretos en el chat. El caso testigo fue una sesión real con Paciente D que destapó tres síntomas: clasificación errónea de riesgo, repetición de checks de seguridad, y la IA pidiendo info que el paciente ya había dado. La auditoría posterior reveló que esos tres son la punta del iceberg.

Este plan aborda todos los hallazgos. Las decisiones que requieren input humano (clínico colegiado, abogado/DPO, decisiones de producto) están en el documento hermano y se ejecutan **en paralelo** con las tareas técnicas — algunas tareas tienen un blocker explícito esperando la decisión.

## Decisiones fijadas

- **Naturalidad sobre estructura**: cuando entren en conflicto "siguiendo el protocolo a rajatabla" y "sonar humano y empático", gana lo segundo. La IA no es un script — es un acompañante que la persona quiere volver a usar.
- **Memoria intra-sesión es obligatoria**: la IA no puede pedir información que el paciente ya ha dado en el mismo chat. Si lo hace, es bug.
- **Supervisión humana es contractual**: nada que el LLM genere se le muestra al paciente sin pasar por validación clínica (excepto el aviso de crisis, que es protocolo de seguridad).
- **Persistencia íntegra**: el estado de la conversación (incluidos tool calls) tiene que ser serializable y rehidratable. Sin eso el chat no es robusto a recargas, errores de red, ni continuidad cross-sesión.
- **Crisis es safety-first**: en crisis aguda, todas las decisiones se inclinan a "más conservador, más defensivo, más redundante", no a "menos fricción".
- **Pre-lanzamiento permite elegir**: hoy podemos refactorizar libremente porque no hay usuarios reales. No defendemos retrocompatibilidad gratuita; hacemos lo correcto.
- **No puede haber información del paciente que el agente no conozca o no pueda acceder.** Excepciones explícitas: meta-instrucciones del clínico para sí mismo (`recommended_actions_for_clinician`) y artefactos de QA interno (`rejection_reason`). Esto **revierte la exclusión original** de Plan 6 sobre `mood_affect`, `cognitive_patterns`, `preliminary_impression` y `patient_facing_summary` — entran al contexto del agente.
- **Las notas del clínico (`clinical_notes`) son visibles al agente** en sesiones futuras del paciente. Son parte del marco terapéutico, no privadas del clínico.
- **Histórico de cuestionarios vía tool**, no inyección automática al contexto inicial. La IA invoca `get_questionnaire_history` cuando lo necesita.

## Áreas

1. **Calidad clínica de la IA** — qué dice, cómo lo dice, qué clasifica.
2. **Robustez técnica del stream** — el chat no se rompe ni cuelga.
3. **UX del paciente** — el flujo es seguro, claro, no hostil.
4. **UX del clínico** — ve lo que necesita, en el orden correcto.
5. **Limpieza y documentación** — código zombie fuera, sign-off al día.
6. **Performance** — el chat es rápido, no se cuelga al cierre.

---

## Tareas

Notación: complejidad **S** (≤2h), **M** (≤6h), **L** (≥1 día). Cada T es una rama y un commit set. El orden recomendado va al final.

### T0 — Limpieza preparatoria (S)

**Goal:** eliminar deuda muerta y centralizar constantes antes de tocar nada importante.

**Acciones:**
- Borrar `buildClinicalSystemPrompt` y `buildRiskProtocolScript` de [lib/llm/prompts/index.ts](../../../lib/llm/prompts/index.ts) — referencian tools que no existen (`evaluate_risk_signal`, `get_case_snapshot`).
- Borrar `MessagePart` types ricos sin usar en `lib/types/messages.ts` (`questionnaire_render`, `risk_alert`, `tool_invocation`).
- Centralizar la "Línea 024" + "112" en una constante (`lib/clinical/safety-resources.ts` o similar) y usar la constante en los 6+ sitios donde está hardcodeada.

**Acceptance:** `pnpm tsc` y `pnpm test` siguen verde. Grep por `024` solo aparece en la nueva constante y en docs/.

**Deps:** ninguna.

---

### T-1 — Superficie informacional unificada del agente (M)

**Goal:** consolidar qué información llega al agente y por qué vía. Esta tarea es el "contrato" entre código y [docs/agents/chat-flow.md](../../agents/chat-flow.md).

**Acciones:**
- Re-clasificación de campos en `lib/patient-context/render.ts`: añadir `mood_affect`, `cognitive_patterns`, `preliminary_impression`, `patient_facing_summary` al bloque Tier A. Mantener `recommended_actions_for_clinician` y `rejection_reason` excluidos. Actualizar tests de render.
- Añadir `clinical_notes` (campo nuevo de T-B) al bloque Tier A.
- Añadir tendencia compacta de cuestionarios al bloque Tier A: una línea por código con los últimos N puntos ("PHQ-9: 18 → 14 → 12 — últimos 30d").
- Nueva tool **`get_questionnaire_history({ code: 'PHQ9' | 'GAD7' | 'ASQ', limit?: number })`** en [app/api/chat/route.ts](../../../app/api/chat/route.ts):
  - `execute` lee de `questionnaire_results` ordenado descendente por `scored_at`, límite por defecto 10.
  - Devuelve `[{ scored_at, score, severity_band, flags }, ...]`.
  - Sin side-effects.
- Añadir regla en [session-therapist.md](../../../docs/agents/prompts/session-therapist.md) sobre el uso de `preliminary_impression`: "es marco interno; no lo cites textual al paciente; no sugieras hipótesis diagnóstica; úsalo para informar tu enfoque".
- Actualizar tests de Plan 6 (`render.test.ts`, `builder.test.ts`) reflejando la nueva inclusión de campos. Las assertions `expect(block).not.toContain('mood_affect')` etc. cambian.
- Sincronizar [docs/agents/chat-flow.md](../../agents/chat-flow.md) para reflejar exactamente lo implementado.
- Sincronizar el sign-off Plan 6 con la nueva re-clasificación (relacionado con T14).

**Acceptance:**
- En sesión Tier A, el bloque incluye los 4 campos clínicos extra + clinical_notes + tendencia de cuestionarios.
- Tool `get_questionnaire_history` devuelve datos correctos y la IA puede invocarla.
- Tests Plan 6 verdes con la nueva clasificación.
- Doc `chat-flow.md` y sign-off citan los mismos campos.

**Deps:** T-B (para `clinical_notes`). Se puede empezar la parte de re-clasificación y la tool antes de T-B y mergear cuando T-B aporte el campo.

---

### T-A — Onboarding clínico ligero post-signup (M)

**Goal:** capturar info clínica mínima del paciente justo después del signup para que la sesión 1 no arranque "a ciegas".

**Acciones:**
- Pantalla nueva `/registro/perfil` (o equivalente) que se muestra una vez tras signup, antes de poder iniciar sesión.
- 3-4 preguntas estructuradas (borrador):
  - Cómo prefieres ser tratado/a (pronombres / nombre informal).
  - Edad o fecha de nacimiento.
  - ¿Qué te trae a Serenia? (texto libre, breve).
  - ¿Has hablado antes con un psicólogo? Si sí, brevemente. (opcional, texto libre).
- Persistencia: tabla nueva `patient_clinical_intake` o columna `user_profiles.clinical_intake jsonb`. Decidir según futura ampliación.
- Inyección al contexto del agente: bloque `[CONTEXTO INICIAL DEL PACIENTE]` en sesión 1 (cuando `buildPatientContext` no encuentre histórico previo).
- Guardarrail: si el paciente intenta acceder al chat sin haber completado el onboarding, redirect a `/registro/perfil`.
- Actualizar [docs/agents/chat-flow.md](../../agents/chat-flow.md) con las preguntas finales firmadas.

**Acceptance:**
- Tras signup, el primer login lleva al perfil; el chat no es accesible hasta completarlo.
- En sesión 1 con onboarding rellenado, el system prompt incluye los datos como contexto y la IA usa los pronombres correctos en el saludo.
- Test que verifica el redirect si el intake está vacío.

**Deps:** ninguna estructural. **Decisión humana #13 + #16** condicionan la copy y las preguntas exactas — empezar con el borrador, ajustar tras firma clínica.

---

### T-B — Regeneración de informe rechazado con notas (M)

**Goal:** un informe rechazado por el clínico se puede regenerar tomando en cuenta el motivo de rechazo y las notas, sin tener que repetir la sesión.

**Acciones:**
- Nuevo campo `assessments.clinical_notes` (text) — notas privadas del clínico que añade al editar/revisar.
- Botón "Regenerar este informe" en [`assessment-editor.tsx`](../../../components/clinician/assessment-editor.tsx) o `assessment-view.tsx` cuando `status='rejected'`.
- Action `regenerateAssessmentAction(assessmentId)` (server action):
  - Lee el assessment rechazado y captura `rejection_reason` + `clinical_notes`.
  - Marca el rechazado como `superseded` (audit trail).
  - Invoca `generateAssessment(supabase, sessionId, { rejectionContext })` con un nuevo argumento.
  - El generator añade al user prompt una sección "## Indicaciones del revisor para esta nueva versión": rejection_reason + clinical_notes.
  - El nuevo row se inserta como `draft_ai`, supersediendo al anterior.
- Las `clinical_notes` también se inyectan al contexto del agente en sesiones futuras (ver decisión fijada arriba — visibles al agente).

**Acceptance:**
- Smoke: clínico rechaza un informe con motivo "no menciona el conflicto con el padre"; pulsa "Regenerar"; el nuevo draft incluye ese tema.
- Tests: `regenerateAssessment` con rejectionContext pasa los datos al prompt; sin él, sigue funcionando como hoy.
- `clinical_notes` aparece en el bloque `[CONTEXTO DEL PACIENTE]` Tier A en sesión siguiente.

**Deps:** T1 (persistencia íntegra de parts no es bloqueante, pero es prerequisito de cualquier flujo de regeneración robusto). T4 puede ejecutar antes de T-B; los criterios de los enums ya benefician al regenerador.

---

### T1 — Persistencia íntegra de tool parts en `messages` (M)

**Goal:** que `messages.parts` guarde **todos** los parts del assistant (text + tool calls + tool results), no solo el último text. Sin esto, recargar la sesión rompe `detectServerClose`, el rehidrato de cuestionarios, y futuras features.

**Acciones:**
- Modificar `saveAssistantMessage` en [lib/sessions/messages.ts](../../../lib/sessions/messages.ts) para aceptar y persistir `parts: UIMessage['parts']` íntegro.
- Modificar `onFinish` en [app/api/chat/route.ts](../../../app/api/chat/route.ts) para pasar `responseMessage.parts` en vez de extraer solo text.
- En [app/app/sesion/[sessionId]/page.tsx](../../../app/app/sesion/[sessionId]/page.tsx), `rowToUIMessage` valida `parts` con `safeValidateUIMessages` (de AI SDK v6) antes de hidratar.
- Tests: insertar message con tool parts → recuperar → debe rehidratar correctamente.

**Acceptance:**
- Tras una sesión con cuestionario y `tool-propose_close_session`, recargar la página mantiene los tool parts visibles en el historial.
- `detectServerClose` funciona post-recarga.
- 0 regresiones en tests existentes.

**Deps:** ninguna. Habilita T2, T7, T12.

---

### T2 — Cuestionarios con HITL pattern (M-L)

**Goal:** eliminar el race condition `sendMessage(synthetic) + setTimeout(router.refresh, 1500)` y el mensaje sintético "He completado el cuestionario." que contamina el transcript. Migrar a Human-in-the-Loop idiomático de AI SDK v6.

**Acciones:**
- Convertir `propose_questionnaire` en tool **sin `execute`** (declara `inputSchema`, no resuelve server-side).
- Mover la creación de `questionnaire_instance` a un endpoint dedicado o a un POST en el cliente, llamado tras el render del card.
- En el cliente, `addToolOutput({ tool, toolCallId, output })` cuando el paciente envía el formulario, con el resultado real del cuestionario (score, banda, flags, items).
- Activar `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` en el `useChat` para reanudar el stream automáticamente.
- Eliminar `sendMessage({ text: 'He completado el cuestionario.' })` y `setTimeout(router.refresh, 1500)` de [components/chat/questionnaire-card.tsx](../../../components/chat/questionnaire-card.tsx) y [components/chat/chat-view.tsx](../../../components/chat/chat-view.tsx).
- Eliminar el listener de `output-available` que dispara `router.refresh()` para `propose_questionnaire` — ya no aplica.

**Acceptance:**
- Tras submit del cuestionario, el assistant continúa el turno sin necesidad de `router.refresh()`.
- 0 mensajes sintéticos en `messages` (verificable con SQL).
- El transcript del clínico no contiene "He completado el cuestionario.".
- La card desaparece tras el último chunk del stream del assistant (no por timer arbitrario).

**Deps:** T1 (parts persistidos para que el tool call con su output sobreviva a recargas).

---

### T3 — Anti-repetición de safety check + IA lee historial (M)

**Goal:** la IA no repite preguntas que ya respondió el paciente; lee el chat antes de pedir info; valida emocionalmente antes de cualquier check.

**Acciones:**

3a — **Server-side: tracking de safety check.** Persistir en `clinical_sessions` (o derivar de `risk_events`) cuándo se hizo el último check de seguridad. Cambiar `crisisNotice` en [route.ts:97](../../../app/api/chat/route.ts) para emitir dos variantes:
- Primer check de la sesión: el bloque actual ("activa el protocolo de crisis AHORA: valida, ofrece Línea 024, etc.").
- Check ya hecho en ventana de 15-20 min con respuesta "no riesgo": bloque `[CONTEXTO DE SEGURIDAD — CHECK YA REALIZADO]` que dice: "ya preguntaste y el paciente respondió que no. No vuelvas a preguntar en este turno; valida lo que cuenta y sigue. Si aparece señal NUEVA y específica de riesgo, sí puedes volver a preguntar".

3b — **Prompt: regla de memoria intra-sesión.** Añadir sección explícita a [docs/agents/prompts/session-therapist.md](../../../docs/agents/prompts/session-therapist.md):
- "Antes de hacer cualquier pregunta, comprueba si el paciente ya respondió en mensajes previos. Si está, **no la repitas**: refleja lo que dijo (cita textual entre comillas si procede) y profundiza."
- "Prohibido pedir datos demográficos o temporales que el paciente ya dio."
- "Cuando parafrasees, usa cita textual breve para que el paciente sienta que escuchaste."

3c — **Prompt: validación emocional siempre antes de check.** "Antes de cualquier pregunta de seguridad, valida emocionalmente lo que el paciente acaba de contar. La validación va primero, la pregunta después."

**Acceptance:**
- Smoke: en una sesión de prueba donde el paciente diga "tengo ganas de desaparecer" y luego responda "no" al check, la IA NO vuelve a preguntar lo mismo en los siguientes 5 turnos a no ser que aparezca señal nueva.
- En una sesión donde el paciente dice "desde niño me siento así" y luego "quiero hablar de mi familia", la IA no le pregunta de nuevo "¿desde cuándo?" — refleja "desde la infancia" y profundiza.

**Deps:** ninguna estructural; la parte 3a requiere migración mínima en `clinical_sessions` (o uso de `risk_events`).

---

### T4 — Criterios clínicos vinculantes en `clinical-report.md` + schema con heteroaggression (M)

**Goal:** que el LLM no improvise al clasificar riesgo. Tabla operativa con criterios, ejemplos y exclusiones para cada enum. Añadir categoría de heteroagresión que hoy se mete erróneamente en `self_harm`.

**Acciones:**

4a — **Definiciones operativas en [clinical-report.md](../../../docs/agents/prompts/clinical-report.md):**
- `suicidality`:
  - `none`: no se mencionó; o el paciente lo negó explícitamente sin ambigüedad.
  - `passive`: deseo de no estar / "preferiría no despertar" sin plan, intención ni medios.
  - `active`: ideación con verbalización clara ("pienso en suicidarme", "he pensado cómo lo haría") con o sin plan.
  - `acute`: intención inmediata + plan + medios disponibles, o ítem 5 ASQ positivo.
- `self_harm`: igual estructura, **explícito** que solo aplica a daño autoinfligido. **Heteroagresión NUNCA va aquí.**
- `severity_band` de cuestionarios: ASQ "positive" significa "needs follow-up", **NO** "active suicidality". Tabla equivalente para PHQ-9/GAD-7 bandas.
- Reglas explícitas: "si el paciente niega 4 de 5 ítems del ASQ y el ítem 5 es No, **no clasifiques `suicidality='active'` ni `'acute'`** salvo que la transcripción lo desmienta de forma explícita y reciente".

4b — **Schema con heteroagresión y otros riesgos** ([lib/assessments/generator.ts:23-53](../../../lib/assessments/generator.ts)):
```ts
risk_assessment: z.object({
  suicidality: z.enum([...]),
  self_harm: z.enum([...]),
  heteroaggression: z.enum(['none', 'verbal', 'plan']),  // NEW
  substance_use_acute: z.enum(['none', 'suspected', 'confirmed']).nullable(),  // NEW
  notes: z.string(),
})
```

4c — **Reglas tono `patient_facing_summary`** en `clinical-report.md`: prohibido abrirlo con "es totalmente válido"; prohibido tono parental; prohibido "queremos felicitarte"; prohibido "sigue así". Tabla de antipatterns concretos.

4d — **Framework `recommended_actions_for_clinician`**: tres niveles claros con ejemplos.
- "Derivación urgente" (riesgo agudo, deber de cuidado).
- "Consulta supervisión" (caso atípico, dudas clínicas).
- "Seguimiento normal" (caso de cribado positivo sin urgencia).

**Acceptance:**
- En un escenario simulado del Paciente D (4/5 No al ASQ + "ganas de desaparecer y de hacerlos desaparecer"), el LLM clasifica `suicidality='passive'`, `self_harm='none'`, `heteroaggression='verbal'`. NO `active` ni `current`.
- Tests con 6 escenarios firmados clinicamente (recovery, ansiedad, depresión moderada, ideación pasiva, ideación activa, crisis) cubren cada combinación de enums.

**Deps:** **decisión humana en `2026-04-25-plan-7-human-decisions.md` punto 1** — un clínico colegiado debe validar las definiciones operativas. Mientras tanto: redactar borrador, esperar firma para mergear.

---

### T5 — Generador recibe items individuales del cuestionario (S)

**Goal:** el LLM al cerrar sesión ve qué items respondió el paciente "Sí"/"No", no solo el score agregado. Sin esto el fix de T4 es insuficiente — el modelo no puede contradecir su hipótesis textual sin evidencia.

**Acciones:**
- En `generateAssessment` ([lib/assessments/generator.ts:111-130](../../../lib/assessments/generator.ts)), incluir cada item del cuestionario con su respuesta en el bloque `## Resultados de cuestionarios` que va al LLM.
- Formato sugerido:
  ```
  - ASQ (Cribado de riesgo suicida): score 1, banda positive, flags ninguno
    Item 1: ¿Has deseado estar muerto? — No
    Item 2: ¿Familia/amigos estarían mejor sin ti? — Sí
    Item 3: ¿Has pensado en suicidarte? — No
    Item 4: ¿Has intentado suicidarte? — No
    Item 5: ¿Pensando en suicidarte ahora? — No
  ```

**Acceptance:**
- Test con un fixture conocido: el bloque incluye los 5 items del ASQ con respuesta.
- En el escenario simulado del Paciente D, el LLM clasifica correctamente porque ve los "No".

**Deps:** ninguna. Independiente de T4 pero se complementa.

---

### T6 — `closeSession` + assessment robustos (M-L)

**Goal:** que la generación del assessment al cierre no bloquee el request del paciente, no falle silenciosamente, y se ejecute incluso cuando la sesión se cierra por inactividad (timer / cron).

**Acciones:**

6a — **Background job para `generateAssessment`.** Mover la llamada a un Vercel Workflow / Inngest / cola Supabase Queue.
- `closeSession()` deja de llamar `generateAssessment` síncrono. En su lugar, encola un job.
- El job tiene retry exponencial (3 intentos) y, en caso de fallo final, marca el row `assessments` con `status='failed'` + razón. El clínico verá el fallo en bandeja con CTA "regenerar".

6b — **`close_stale_sessions` SQL function también dispara assessment** ([supabase/migrations/20260421000002_close_stale_sessions.sql](../../../supabase/migrations/20260421000002_close_stale_sessions.sql)): añadir un trigger o llamada al mismo background job tras el UPDATE.

6c — **`getOrResolveActiveSession` con UPDATE directo sin assessment** ([lib/sessions/service.ts:43-56](../../../lib/sessions/service.ts)): unificar con `closeSession()` para que también encole el assessment.

6d — **Fallback de generación**: si `generateObject` falla con schema strict, `safeParse` el output y meter un esqueleto mínimo (`status='requires_manual_review'`, `notes='Generación AI falló: ' + error.message`). El clínico ve el row, sabe que hay que reescribirlo.

**Acceptance:**
- POST de `confirm_close_session` responde en <2s (no espera la generación del assessment).
- Sesión inactiva cerrada por cron tiene su assessment generado en <5 min.
- Si el LLM falla, el row se crea con `status='failed'` y el clínico lo ve.
- 0 sesiones cerradas sin assessment row.

**Deps:** ninguna estructural; depende de elegir la cola (Vercel Workflow, Inngest, etc.).

---

### T7 — Validación server-side propose-before-confirm + idempotencia tools (S-M)

**Goal:** que el contrato del two-step close sea imposible de violar aunque el LLM alucine.

**Acciones:**

7a — **Validación en `confirm_close_session.execute`**: verificar que en los últimos N (5?) mensajes assistant existe un `tool-propose_close_session` con mismo `reason`. Si no, no cerrar — devolver error al modelo.

7b — **Idempotencia `propose_questionnaire`**: añadir UNIQUE constraint parcial en BD `(session_id) WHERE status IN ('proposed','in_progress')`. Si el LLM duplica la llamada, la segunda falla en BD; el `execute` debe detectarlo y devolver el ID existente.

7c — **`close_session_crisis` graceful disconnect**: si el cliente nunca recibe `output-available` (conexión caída), el RSC `app/app/sesion/[sessionId]/page.tsx` ya redirige a `/app` al detectar `status='closed'`. Verificar y documentar.

**Acceptance:**
- Test: LLM llama `confirm_close_session` sin propose previo → ejecutar devuelve error, sesión sigue abierta.
- Test: dos llamadas concurrentes a `propose_questionnaire` → solo una crea el row.

**Deps:** T1 (parts persistidos para que el "buscar propose en últimos N mensajes" funcione tras reload).

---

### T8 — Reentrada al stream resiliente (M)

**Goal:** el chat se recupera de errores de red, desconexiones y race conditions sin dejar al paciente colgado.

**Acciones:**
- `useChat` con `onError` que muestre UI "Reconectando..." y reintente automáticamente.
- Si la conexión cae a media stream, reintentar con `sendMessage` el último mensaje del paciente.
- Manejar el caso "RSC redirect a `/app` mientras stream activo" → cliente detecta y muestra "La sesión ha terminado por inactividad. Vuelve al inicio."
- `BodySchema.messages` con `safeValidateUIMessages` (no `z.array(z.any())`).
- `expiresAt` cruza el RSC boundary como ISO string, no `Date`.

**Acceptance:**
- Smoke: cortar Wi-Fi a media respuesta del assistant → al volver a tener red, el chat se recupera y completa el turno.
- Smoke: si el server cierra la sesión por timeout mientras el paciente teclea, el cliente lo detecta y muestra mensaje claro.

**Deps:** T1.

---

### T9 — UX paciente: cuestionario, header, salida, accesibilidad (M)

**Goal:** que la experiencia del paciente sea profesional, no hostil, accesible.

**Acciones:**

9a — **Cuestionario con micro-copy y consentimiento.** En [components/chat/questionnaire-card.tsx](../../../components/chat/questionnaire-card.tsx), bajo el header existente: *"Tu psicólogo verá las respuestas. Sé sincera/o — no hay respuestas correctas."* (Copy a validar con clínico — punto 8 del doc humano.)

9b — **Header timer condicional**: en [chat-view.tsx:101-105](../../../components/chat/chat-view.tsx), el "X min restantes" se muestra **solo en los últimos 15 min**. Antes, el header solo dice "Sesión activa" o nada. La cuenta atrás permanente es activadora para pacientes con ansiedad.

9c — **Salida abrupta sin ceremonia.** Añadir copy modelo en [session-therapist.md](../../../docs/agents/prompts/session-therapist.md): si el paciente quiere irse sin "cerrar bonito", validar la marcha sin culpabilizar ("Está bien que pares cuando lo necesitas, gracias por venir hoy").

9d — **ARIA y accesibilidad:**
- Wrapper en [chat-view.tsx:124](../../../components/chat/chat-view.tsx) (listRef): `role="log" aria-live="polite"`.
- Cada `MessageBubble`: `role="article" aria-label="Tú"` o `aria-label="Serenia"`.
- `ChatInput` ([chat-input.tsx:36](../../../components/chat/chat-input.tsx)): `aria-label="Mensaje para Serenia"`.
- `ChatInput`: migrar de `useRef + value=""` imperativo a `useState` controlado.
- `QuestionnaireCard` post-submit: focus al chat input o al banner de éxito.

**Acceptance:**
- Test manual con screen reader (VoiceOver): cada nuevo mensaje del assistant se anuncia. Cada bubble tiene label distinguible.
- Test manual: con sesión recién creada, el header no muestra cuenta atrás. Tras 45 min, aparece "15 min restantes".

**Deps:** ninguna.

---

### T10 — UX paciente: home seguro (M)

**Goal:** que la home del paciente nunca le muestre output AI no validado, y que el aviso de crisis sea persistente.

**Acciones:**

10a — **`patient_facing_summary` solo si revisado.** En [app/app/page.tsx:114-140](../../../app/app/page.tsx), filtrar el último assessment por `status IN ('reviewed_confirmed','reviewed_modified')`. Si el último es `draft_ai`, mostrar copy neutra: *"Tu psicólogo está revisando tu última sesión. Te avisaremos cuando esté listo."*

10b — **Banner de crisis persistente.** El bloque "Tu última sesión se cerró por seguridad" ([app/app/page.tsx:172-181](../../../app/app/page.tsx)) hoy desaparece en cuanto el paciente abre una nueva sesión. Hacerlo persistente hasta dismiss explícito (botón "He llamado / Estoy en seguimiento") con persistencia en BD (columna en `user_profiles` o tabla `crisis_notices_dismissed`).

10c — **Acuerdos accionables o copy honesta.** "Tus acuerdos recientes" hoy es lectura pura. Decisión: o bien añadir checkbox "Marcar como cumplido" + nota corta editable por el paciente (mejor UX clínica, requiere endpoint), o bien copy honesta "Tu psicólogo verá tu progreso en la próxima sesión." (más simple, conservador). **Recomendación: copy honesta primero, checkbox como fast-follow tras lanzamiento.**

**Acceptance:**
- Smoke: tras cerrar sesión, antes de revisar, abrir home como paciente → ve "Tu psicólogo está revisando..." (NO el `patient_facing_summary`).
- Smoke: tras cierre por crisis, abrir nueva sesión → el banner Línea 024 sigue visible en home.

**Deps:** ninguna.

---

### T11 — UX clínico: bandeja por riesgo + marcar como crisis manual (M)

**Goal:** que el clínico vea lo más urgente primero y pueda corregir clasificaciones erróneas de la IA.

**Acciones:**

11a — **Bandeja ordenada por riesgo.** En [components/clinician/inbox-list.tsx](../../../components/clinician/inbox-list.tsx) y la query de [lib/clinician/inbox.ts](../../../lib/clinician/inbox.ts): ordenar por `riskState` (acute > active > watch > none), dentro de cada banda por `closedAt asc` (más antiguo primero). Mostrar visualmente la banda con color/badge.

11b — **"Marcar manualmente como crisis"** en el editor. En [components/clinician/assessment-editor.tsx](../../../components/clinician/assessment-editor.tsx): un botón "Marcar esta sesión como crisis (anula clasificación de IA)". Al activarlo: setea `risk_assessment.suicidality='acute'` (o un flag separado `clinician_marked_crisis: bool`), y dispara los efectos posteriores (banner persistente en home del paciente, riskState 'acute' en Plan 6).

**Acceptance:**
- Bandeja con un caso `acute`, dos `watch`, cinco `none`: el `acute` aparece primero, luego los `watch`, luego los `none` por antigüedad.
- Clínico abre un assessment que la IA clasificó `none` y le marca como crisis manualmente: tras guardar, el paciente al recargar home ve el banner crisis.

**Deps:** ninguna.

---

### T12 — Robustez framework: validación, hidratación, SSR boundary (S-M)

**Goal:** que la frontera RSC/Client sea estricta, las props sean serializables, y los errores tengan UX clara.

**Acciones:**

12a — **`safeValidateUIMessages` en `BodySchema`** ([route.ts:27](../../../app/api/chat/route.ts)): cambiar `messages: z.array(z.any())` por validación real.

12b — **`expiresAt` ISO string** en lugar de `Date` cruzando el boundary RSC→Client.

12c — **`initialMessages` validados** en [page.tsx](../../../app/app/sesion/[sessionId]/page.tsx) con `safeValidateUIMessages` antes de pasar al cliente.

12d — **`loading.tsx` y `error.tsx`** en `app/app/sesion/[sessionId]/`. Mientras el RSC corre las 4 queries, mostrar skeleton. Si falla, error UI con CTA "Volver al inicio".

12e — **`endSessionAction` con `revalidatePath`** apropiado tras cerrar.

**Acceptance:**
- Body inválido en POST `/api/chat` devuelve 400 claro, no 500 críptico.
- Recarga del page muestra skeleton, no pantalla en blanco.
- Error de BD en RSC muestra error UI, no crash.

**Deps:** T1 (validación de parts depende de la persistencia íntegra).

---

### T13 — Performance / cold start (S-M)

**Goal:** reducir latencia del primer turno y del cierre.

**Acciones:**

13a — **Promise.all en preludio del stream** ([route.ts:60-150](../../../app/api/chat/route.ts) approx): paralelizar las queries que no dependen entre sí (`touchSession`, `saveUserMessage`, `buildQuestionnaireResultNotice`, `buildPatientContext`).

13b — **Prompts inline en build via Turbopack** (`?raw` import o equivalente): elimina IO en cold start.

13c — **`detectServerClose` memoizado** con `useMemo` o derivado de `messageMetadata`.

13d — **`closeSession` async** ya cubierto por T6.

13e — **Telemetría de latencia**: añadir métricas a `patient_context_injections` (o tabla aparte) con `streamFirstChunkMs`, `streamFullMs`. Sin observabilidad no podemos optimizar sobre datos.

**Acceptance:**
- Primer turno en cold start <3s (TTFB del streaming).
- POST de `confirm_close_session` <1s (delegando assessment a job).

**Deps:** T6 para 13d.

---

### T14 — Documentación y firma (S)

**Goal:** que la documentación firmable refleje el código real.

**Acciones:**

14a — **Regenerar sign-off Plan 6** ([docs/superpowers/specs/2026-04-23-plan-6-cross-session-continuity-signoff.md](../specs/2026-04-23-plan-6-cross-session-continuity-signoff.md)): cambiar todas las referencias a `close_session(reason='...')` por los nombres actuales (`propose_close_session` / `confirm_close_session` / `close_session_crisis`). El sign-off no debe firmarse hasta que cite tools que existen.

14b — **`risk_opening_notice` rama acute** ([lib/patient-context/render.ts](../../../lib/patient-context/render.ts) + sign-off): cita `close_session(reason='crisis_detected')` que ya no existe. Cambiar a `close_session_crisis`.

14c — **Audit de copy** en `docs/agents/`, `components/chat/`, `components/clinician/`, `app/app/`: detectar inconsistencias tú/inclusive (`/a`/género), localismos LATAM, tono. Output: una lista priorizada con cambios sugeridos.

14d — **Smoke checklist Plan 6** ([docs/superpowers/specs/2026-04-23-plan-6-smoke-checklist.md](../specs/2026-04-23-plan-6-smoke-checklist.md)): actualizar para reflejar los nuevos comportamientos (HITL cuestionarios, anti-repetición, etc.).

**Acceptance:**
- `grep -rn "close_session(reason" docs/` no devuelve nada.
- Smoke checklist re-firmado o marcado "pendiente de re-validación tras Plan 7".

**Deps:** las tareas que cambien comportamiento clínico (T2, T3, T4) deben estar mergeadas antes de firmar.

---

## Orden de ejecución recomendado

```
Fase A (foundational, sin deps):    T0 → T1 → T6 (en paralelo)
Fase B (clínica + onboarding):      T-A → T-B → T3 → T4 → T5 → T-1
                                    (T4 y T-A esperan decisiones humanas; arrancar con borradores)
Fase C (técnica, deps Fase A):      T2 → T7 → T8 → T12 → T13
Fase D (UX):                        T9 → T10 → T11
Fase E (cierre):                    T14 (al final, depende de B+C+D)
```

Críticos:
- **T4 tiene blocker humano** (definiciones operativas de enums). Borrador primero, firma después, merge al final de Fase B.
- **T-A tiene blocker humano** (preguntas exactas del onboarding). Borrador primero, mergeable con copy provisional, refinar tras firma.
- **T-1 depende de T-B** para inyectar `clinical_notes` al contexto. Se puede empezar T-1 sin esperar T-B, pero el merge final espera al campo.

## Definición de "done" del plan

- Todas las tareas T0-T14 mergeadas a `main` con review de arquitecto.
- `pnpm tsc`, `pnpm test`, `pnpm lint` clean.
- Smoke completo Plan 6 (revalidado tras T2/T3) ejecutado y firmado por técnico.
- Sign-off Plan 6 actualizado y firmado por revisor primario + revisor independiente.
- 5 escenarios simulados (recovery / ansiedad / depresión / ideación pasiva / crisis) producen assessments correctamente clasificados.

## Riesgos

- **Bloqueante T4 sin validación clínica**: si el clínico tarda en validar las definiciones operativas, todo el path Plan 6 + Tier A queda con clasificación posiblemente errónea. Mitigar: empezar T4 con borrador y validación parcial.
- **Migración HITL (T2) puede romper UX existente**: el patrón cambia el flujo del cuestionario. Riesgo de regresión. Mitigar: smoke completo del cuestionario en cada paso.
- **Background job para assessment (T6)**: si Vercel Workflow / Inngest no encaja, fallback a "retry inline con timeout reducido". Decidir herramienta antes de empezar T6.

## Out of scope (deferred)

- Multi-clínico (Plan 6 asume single-clinic). Tie-break entre revisores múltiples → futuro plan.
- Email transaccional en crisis. Pendiente RGPD/legal — punto 3 del doc humano.
- Notificaciones push.
- Notas privadas del clínico (no visibles al paciente, no inyectadas a la IA).
- Hard cap de sesiones por día.
- Trends longitudinales avanzados en bandeja (más allá del PHQ-9/GAD-7 actual).
- Internacionalización LATAM.
- Onboarding card "qué es Serenia" pre-primera-sesión.
- Reescritura de `lib/types/messages.ts` con sistema de parts ricos (hoy no se usa).

## Métricas de éxito post-merge

- 0 sesiones cerradas sin assessment row.
- 0 mensajes sintéticos persistidos.
- Tasa de "false positive active suicidality" <5% en escenarios de validación.
- Tiempo medio del primer chunk del stream <2s en warm start.
- Bandeja del clínico ordenada correctamente: 100% de los casos con `riskState='acute'` aparecen en la primera página.
