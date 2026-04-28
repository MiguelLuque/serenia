# Flujo del chat de Serenia

**Última actualización:** 2026-04-24
**Status:** documento vivo — cualquier cambio en el flujo del chat se refleja aquí

Este documento describe **el flujo exacto** del chat con Serenia (la IA) y todo lo que la rodea: qué información recibe el agente, qué tools tiene, cómo se cierra una sesión, cómo se revisa el informe y cómo se enlaza con la siguiente sesión.

Cuando alguien tenga una duda sobre "qué hace el chat" o "qué sabe el agente cuando arranca una sesión", la respuesta está aquí. Si el código diverge de este documento, el documento se actualiza primero, después se cambia el código.

---

## Decisiones de diseño fijadas

Estas decisiones gobiernan todo lo demás. Si futuras peticiones las contradicen, hay que renegociarlas explícitamente.

1. **El chat es la main feature**, debe sentirse como una conversación con un psicólogo humano: natural, con memoria intra-sesión, sin repeticiones, con criterio clínico.
2. **No puede haber información del paciente que el agente no conozca o no pueda acceder.** Si existe en BD y es relevante para entender al paciente, llega al agente — directamente al arranque o vía tool.
3. **Hay dos excepciones explícitas** a (2): meta-instrucciones del clínico para sí mismo (`recommended_actions_for_clinician`) y artefactos de QA interno (`rejection_reason`). Esas no se inyectan al agente — son para el humano supervisor.
4. **La IA conduce, el clínico firma.** Todo informe pasa por revisión clínica antes de mostrarse al paciente.
5. **Crisis = safety-first.** En riesgo agudo, el agente prioriza la red de seguridad sobre cualquier otra heurística (cierre directo sin confirmación, redirect a recursos, escalada al clínico).
6. **Pre-lanzamiento permite refactor libre.** No defendemos retrocompatibilidad gratuita.
7. **Anti-repetición de safety check** (Plan 7 T3a). El check de seguridad no se vuelve a disparar dentro de la misma sesión solo porque reaparezcan palabras emocionales. Si el detector léxico matchea pero el asistente ya preguntó por seguridad antes en esta sesión, el `crisisNotice` cambia a la variante `[CONTEXTO DE SEGURIDAD — CHECK YA REALIZADO]` que prohíbe re-preguntar salvo señal nueva y específica (plan, intención, medios). Heurística server-side: regex sobre los `parts` de los últimos 5 mensajes assistant. La regla queda fijada en [`lib/chat/safety-check-history.ts`](../../lib/chat/safety-check-history.ts).
8. **El detector léxico de crisis es señal, no orden** (Plan 7 T3d). El `crisisNotice` "primera vez" es contextual: instruye al LLM a leer el contexto antes de decidir si activar el protocolo. Palabras como "desbordado" o "desaparecer" sin verbalización clara de plan/intención no deben disparar protocolo de suicidio.
9. **Cierre obligatorio vía tool** (Plan 7 T3c). Despedirse conversacionalmente ("lo dejamos aquí", "cuídate", "hasta la próxima") sin haber llamado antes a `propose_close_session` / `confirm_close_session` / `close_session_crisis` deja la sesión `status='open'` en BD. El prompt lo prohíbe expresamente; el `onFinish` de `/api/chat` loguea un `console.warn` cuando lo detecta (audit no-bloqueante).
10. **Memoria intra-sesión y anti-persistencia tras rechazo** (Plan 7 T3b + T3e). El prompt de [`session-therapist.md`](prompts/session-therapist.md) incluye dos secciones vinculantes: (a) "lee el historial antes de preguntar" + cita textual al parafrasear, (b) "tras un rechazo, valida y cede iniciativa — prohibido encadenar 2+ alternativas seguidas".

---

## Las 4 fases del ciclo

```
[Signup + Onboarding clínico] → Sesión 1 → Informe → Revisión clínico → Sesión 2 → Informe → ... → Sesión N
                                              ↘ rechazo → regeneración con notas → revisión ↗
```

### Fase 1 — Onboarding clínico (una vez, post-signup)

**Cuándo:** la primera vez que el paciente se loguea tras registrarse, antes de poder empezar a chatear.

**Qué se le pide:** 3-4 preguntas estructuradas, breves y sin jerga clínica. Pendiente de validación por clínico (ver doc humano #13 + #16).

**Borrador propuesto** (a confirmar):
- Cómo prefieres ser tratado/a (pronombres / nombre informal).
- Edad o fecha de nacimiento.
- ¿Qué te trae a Serenia? (texto libre, breve).
- ¿Has hablado antes con un psicólogo? Si sí, brevemente. (opcional, texto libre).

**Qué se persiste:** estructura propuesta `user_profiles.clinical_intake` (jsonb) o tabla aparte `patient_intake_responses`. A definir en T-A del Plan 7.

**Qué hace Serenia con ello:** se inyecta como bloque de contexto al system prompt en sesión 1 (ver Fase 2).

---

### Fase 2 — Sesión 1 (la primera; aún sin historia clínica)

**Contexto que recibe el agente al arranque:**

- System prompt principal ([session-therapist.md](prompts/session-therapist.md)).
- Bloque `[CONTEXTO INICIAL DEL PACIENTE]` derivado del onboarding clínico:
  - Pronombres / cómo tratarle.
  - Edad.
  - Motivo de consulta inicial declarado.
  - Antecedente psicológico breve si lo declaró.
- Marco explícito en el prompt: "es la primera sesión del paciente, no inventes historia, conócele".

**Comportamiento esperado del agente:**
- Saludo personalizado usando los pronombres correctos.
- No se asume nada que no esté en el bloque.
- Se permite (y es deseable) hacer preguntas de anamnesis para profundizar lo que el paciente declaró.
- Si surgen señales clínicas claras, puede proponer un cuestionario apropiado (PHQ-9, GAD-7, o ASQ si hay señal de riesgo).

**Tools disponibles:** todas las del catálogo de tools (ver sección "Tools" abajo).

---

### Fase 3 — Cierre de sesión y generación de informe

**Disparadores de cierre:**
1. El paciente pulsa "Terminar sesión" en el header → server action directa.
2. La IA llama `propose_close_session({ reason })` y el paciente acepta → IA llama `confirm_close_session({ reason })`.
3. La IA detecta crisis aguda → llama `close_session_crisis()` directo (sin confirmación).
4. Cron `close_stale_sessions` cierra sesiones inactivas (≥1h sin actividad).
5. Se alcanza el cap absoluto (`SESSION_MAX_DURATION_MS`, 60 min).

**Lo que pasa al cerrar (en orden):**
1. `clinical_sessions.status = 'closed'` con `closed_at` y `closure_reason`.
2. Se encola un job para `generateAssessment()` (background, no bloquea el response del cliente — ver Plan 7 T6).
3. El job lee la transcripción + cuestionarios respondidos (con respuestas item-a-item, no solo score+banda — para que el LLM pueda aplicar las reglas anti-sobreclasificación) + risk_events + (en sesiones N>1) el informe anterior + notas del clínico previo.
4. El generator invoca al LLM con el prompt [clinical-report.md](prompts/clinical-report.md) y devuelve un `summary_json` validado contra `AssessmentSchema`.
5. Se inserta una row en `assessments` con `status='draft_ai'`.
6. Si la generación falla (LLM down, schema validation), se inserta una row con `status='requires_manual_review'` y el clínico la ve marcada como tal.

---

### Fase 4 — Revisión del clínico

**Lo que el clínico puede hacer con un informe `draft_ai`:**

| Acción | Status final | Efecto |
|---|---|---|
| Confirmar sin cambios | `reviewed_confirmed` | Informe queda firme. Sus campos llegan al agente en próximas sesiones. |
| Editar y guardar | `reviewed_modified` | El draft anterior pasa a `superseded`. La versión editada queda firme. |
| Añadir notas (campo separado) | (no cambia status) | Las notas se persisten en `assessments.clinical_notes` (campo nuevo). **Visibles al agente en sesiones futuras** (ver Fase 5). |
| Rechazar con motivo | `rejected` | `rejectAssessmentAction` actualiza `status='rejected'` y persiste `rejection_reason`. La fila queda con `status=rejected` (no se borra) — la unique-index parcial `assessments_session_closure_live_unique` excluye `rejected` y `superseded`, así que no bloquea la regeneración. |
| **Regenerar el informe** | nuevo `draft_ai` | El botón "Regenerar el informe" aparece **tanto en `rejected` como en `requires_manual_review`**. `regenerateAssessmentAction` llama a `prepareRegeneration`: marca el row como `superseded` mediante un UPDATE condicional (`.in('status', ['rejected','requires_manual_review'])`) que es idempotente bajo race —si dos clínicos pulsan a la vez, solo uno gana y el otro recibe "El informe ya fue actualizado. Recarga la página."— y encola `generateAssessmentWorkflow` (Plan 7 T6) con `rejectionContext = { rejectionReason, clinicalNotes }` (vacío en `requires_manual_review`). Si el enqueue falla tras marcar superseded, la action revierte el row a su status original (`rollbackRegeneration`) para que el clínico pueda reintentar. El step `assessmentExistsStep` filtra rows `superseded` / `rejected`, así que la regeneración procede. El step `generateAssessmentStep` añade el `rejectionContext` al user prompt para que el LLM ajuste el nuevo draft. La operación BD↔WDK no es transaccional; la unique-index parcial cubre el race-de-doble-encolar. |

**Acciones específicas del clínico durante revisión:**
- Marcar manualmente como crisis (override de la clasificación de IA) — Plan 7 T11.
- Editar `proposed_tasks` que el LLM propuso → al confirmar, se materializan en `patient_tasks` con `estado='pendiente'`.
- Marcar `patient_tasks` heredadas como `cumplida`/`parcial`/`no_realizada`/`no_abordada`.

---

### Fase 5 — Sesión 2..N (con historia)

**Contexto que recibe el agente al arranque:**

Bloque `[CONTEXTO DEL PACIENTE]` con todo lo siguiente, derivado del último assessment validado (`reviewed_confirmed` o `reviewed_modified`):

**Identidad y marco:**
- Pronombres / cómo tratarle (del onboarding inicial).
- Edad.
- `chief_complaint` (motivo de consulta tal como quedó tras última revisión).
- `presenting_issues` (qué problemas están encima de la mesa).
- `mood_affect` (descripción del clínico).
- `cognitive_patterns` (patrones detectados por el clínico).
- `preliminary_impression` (con regla "úsalo como marco interno, NO lo cites textual al paciente, NO sugieras hipótesis diagnóstica").

**Riesgo y seguridad:**
- `risk_assessment` completo (suicidality, self_harm, heteroaggression, substance_use_acute, notes).
- `riskState` derivado (none/watch/active/acute) y aviso de continuidad si aplica.

**Cuestionarios:**
- Última puntuación de cada cuestionario (PHQ-9, GAD-7, ASQ): código + score + banda + flags + items individuales si los hay relevantes para el contexto.
- Tendencia compacta si hay ≥2 puntos: "PHQ-9: 18 → 14 → 12 últimos 30d".
- (Para detalle más profundo: tool `get_questionnaire_history` — la IA la invoca on-demand.)

**Continuidad terapéutica:**
- `areas_for_exploration` (= "puntos a tocar en próximas sesiones" — el agente debe entender este campo como forward-looking).
- Lista de `patient_tasks` abiertos con su descripción y fecha de acuerdo.
- `patient_facing_summary` de la sesión anterior (lo que el paciente ya leyó — la IA sabe qué se le ha contado).
- `clinical_notes` del clínico (notas privadas que añadió al revisar — visibles al agente, NO al paciente).

**NO se inyecta al agente** (excepción explícita a la decisión #2):
- `recommended_actions_for_clinician` — son instrucciones para el humano supervisor; si las leyera, podría intentar ejecutarlas e invertir la jerarquía.
- `rejection_reason` — QA interno, irrelevante para conducir la conversación.

**Comportamiento esperado del agente:**
- Saludo de continuidad sin recapitular agresivamente. La IA NO menciona las tareas, datos del informe, ni el snapshot en el primer turno (apertura abierta — el paciente puede traer algo distinto). Si tras 3-5 turnos sin contenido propio del paciente hay pausa natural, la IA puede ofrecer UN acuerdo o tema como opción, no como agenda.
- Lee el chat antes de preguntar (regla anti-repetición).
- Si surgen los temas que el clínico apuntó en `areas_for_exploration` o `clinical_notes`, profundiza; si no, no fuerza.

---

## Tools disponibles a la IA

Lista canónica. Cualquier tool nueva o modificada se añade aquí ANTES de implementarse.

### Tools de cierre de sesión

| Tool | Side-effect | Cuándo se usa |
|---|---|---|
| `propose_close_session({ reason })` | Ninguno (solo signal) | Cuando la IA infiere que la sesión podría terminar (`reason: 'user_request'` por señal del paciente o `'time_limit'` con ≥5 min restantes). |
| `confirm_close_session({ reason })` | Cierra sesión + genera informe | Solo tras `propose_close_session` previo y aceptación verbal del paciente. |
| `close_session_crisis()` | Cierra sesión + genera informe + dispara protocolo crisis | Riesgo agudo detectado (ASQ ítem 5 positivo, verbalización clara de plan/intención/medios). Sin confirmación. |

### Tools de cuestionarios

| Tool | Side-effect | Cuándo se usa |
|---|---|---|
| `propose_questionnaire({ code })` | Crea `questionnaire_instance` con status `proposed`. UI renderiza el formulario al paciente. | La IA juzga útil un cribado. **Antes de llamarla, debe emitir 1-2 frases conversacionales** explicando qué es el cuestionario, para qué sirve y duración. |
| `get_questionnaire_history({ code })` *(planned, T-1 Plan 7)* | Ninguno (lectura) | Cuando la IA quiere ver evolución longitudinal de PHQ-9/GAD-7. Devuelve los últimos N scores + bandas + fechas. |

### Tools de gestión clínica

*(planned, no implementadas todavía — se evaluarán en Plan 7+)*

| Tool | Side-effect | Cuándo se usa |
|---|---|---|
| `mark_for_clinician_review({ topic, why })` | Marca un instante de la sesión para revisión clínica explícita | Si la IA detecta algo que merece atención humana sin llegar a crisis. |
| `update_patient_task({ taskId, status, note })` | Actualiza estado de tarea en directo | Si el paciente reporta cumplimiento de una tarea durante la conversación. |

---

## Cuestionarios disponibles

Definición clínica completa en [questionnaires/](questionnaires/). Resumen:

| Código | Nombre | Items | Uso |
|---|---|---|---|
| **PHQ-9** | Patient Health Questionnaire — 9 ítems | 9 | Cribado de depresión. Bandas: ninguno / leve / moderado / moderadamente severo / severo. Flag `acute_risk` si ítem 9 (autolesión) positivo. |
| **GAD-7** | Generalized Anxiety Disorder — 7 ítems | 7 | Cribado de ansiedad. Bandas: ninguno / leve / moderado / severo. |
| **ASQ** | Ask Suicide-Screening Questions | 5 | Cribado breve de riesgo suicida. Banda `positive` si **cualquier** ítem 1-4 es Sí, banda `negative` si todos No. Flag `acute_risk` si ítem 5 (suicidio ahora) positivo. |

**Importante**: ASQ banda `positive` significa "necesita seguimiento clínico", **NO** "ideación suicida activa". El generator de informes y la IA conversacional deben respetar esta distinción.

---

## Información que entra al agente, en una tabla rápida

| Campo de `summary_json` | ¿Entra al contexto del agente? | Notas |
|---|---|---|
| `chief_complaint` | ✅ | Marco del paciente |
| `presenting_issues` | ✅ | |
| `mood_affect` (clínico) | ✅ | Para que la IA continúe el marco emocional |
| `cognitive_patterns` (clínico) | ✅ | |
| `risk_assessment.suicidality` | ✅ | |
| `risk_assessment.self_harm` | ✅ | |
| `risk_assessment.heteroaggression` *(nuevo, T4)* | ✅ | |
| `risk_assessment.substance_use_acute` *(nuevo, T4)* | ✅ | |
| `risk_assessment.notes` | ✅ | |
| `questionnaires` | ✅ | Score + banda + flags + items relevantes |
| `areas_for_exploration` | ✅ | "Puntos a tocar en próximas sesiones" |
| `preliminary_impression` | ✅ con regla | Marco interno; no citar al paciente |
| `patient_facing_summary` | ✅ | La IA sabe qué leyó el paciente |
| `proposed_tasks` (al cerrar) | ✅ vía `patient_tasks` | Solo las que se materializaron tras revisión |
| `clinical_notes` *(nuevo)* | ✅ | Notas privadas del clínico, no visibles al paciente |
| `recommended_actions_for_clinician` | ❌ | Instrucciones para el humano supervisor |
| `rejection_reason` | ❌ | QA interno |

Plan 6 originalmente excluía `mood_affect`, `cognitive_patterns`, `preliminary_impression` y `patient_facing_summary` del contexto. **Esa exclusión queda revertida desde 2026-04-25** según decisión "no puede haber información del paciente que el agente no conozca". Plan 7 implementa la re-clasificación.

---

## Glosario rápido

- **Tier A**: contexto longitudinal con último assessment validado por clínico.
- **Tier B**: contexto longitudinal con último assessment todavía en draft (no validado). Bloque más reducido — explícito que no está revisado.
- **Tier historic**: la última sesión validada es muy antigua (>30 días). Subset de Tier A con marcador temporal.
- **`riskState`**: derivación de los assessments + risk_events recientes; valores `none|watch|active|acute`. Lo computa `derivePatientRiskState`.
- **Cuestionario "scored"**: cuestionario completado y puntuado (status `scored` en `questionnaire_instances`).
- **Notice**: bloque dinámico que se prepende al system prompt en `/api/chat` (crisisNotice, timeNotice, questionnaireNotice, riskOpeningNotice, patientContextBlock). El orden y composición están en [`lib/chat/system-prompt.ts`](../../lib/chat/system-prompt.ts).

---

## Decisiones humanas pendientes que afectan este flujo

Ver [docs/superpowers/specs/2026-04-25-plan-7-human-decisions.md](../superpowers/specs/2026-04-25-plan-7-human-decisions.md). En particular:

- **#1, #2** — Definiciones operativas de los enums clínicos y schema con heteroagresión.
- **#13** — Preguntas exactas del onboarding clínico inicial.
- **#16** — Tono y framing del onboarding ("primera vez con un psicólogo digital, no asustar").
- **#8** — Wording exacto del ASQ en formato no-presencial.

Cuando una decisión humana se cierre, se actualiza este documento con el resultado.

---

## Changelog

- **2026-04-25** — Documento creado a raíz de Plan 7 (chat polish). Refleja el flujo acordado tras 3 auditorías (arquitecto, NextJS/AI SDK, PO clínico) y la directiva del fundador "no puede haber información del paciente que el agente no conozca".
- **2026-04-25** — Decisión: re-clasificación de campos del contexto del agente (entran `mood_affect`, `cognitive_patterns`, `preliminary_impression`, `patient_facing_summary`, `clinical_notes` nuevos; siguen excluidos `recommended_actions_for_clinician`, `rejection_reason`).
- **2026-04-25** — Decisión: histórico de cuestionarios vía tool `get_questionnaire_history` (no inyección automática), para no inflar el contexto inicial.
- **2026-04-25** — Decisión: notas del clínico (`clinical_notes`) son visibles al agente en sesiones futuras.
- **2026-04-25** — Decisión: regenerar informe rechazado tomando en cuenta `rejection_reason` + `clinical_notes`.
- **2026-04-25** — Decisión: onboarding clínico ligero (3-4 preguntas) post-signup, contenido pendiente de validación clínica humana.
- **2026-04-25** — T4 implementado: criterios clínicos vinculantes en [clinical-report.md](prompts/clinical-report.md) (definiciones operativas de los enums + reglas anti-sobreclasificación con ASQ + tono de `patient_facing_summary` + framework `[URGENTE]/[CONSULTA]/[SEGUIMIENTO]` + handling del Contexto de regeneración) y schema con `risk_assessment.heteroaggression` y `risk_assessment.substance_use_acute`. Pendiente firma del clínico colegiado para cerrar decisiones humanas #1 y #2.
- **2026-04-24** — T5 implementado: el `generateAssessmentStep` del workflow ahora inyecta las respuestas item-a-item de cada cuestionario (PHQ-9 / GAD-7 / ASQ) en el bloque `## Resultados de cuestionarios` que recibe el LLM, en formato `Item N: <pregunta> — <respuesta>`. Sin esto, las reglas anti-sobreclasificación de [clinical-report.md](prompts/clinical-report.md) (en particular la regla "ASQ ítem 5 = No → no `active`") no eran verificables porque el LLM solo veía score+banda+flags. La sección "Cómo usar las respuestas item-a-item de los cuestionarios" en el prompt clínico hace explícito el contrato vinculante.
- **2026-04-24** — T3 ampliada implementada (cinco ejes en una sola rama, raíz: el agente no respetaba el contexto cuando el system prompt le daba instrucciones imperativas en cada turno):
  - **3a (anti-repetición safety check)** — server-side: si en los últimos 5 mensajes assistant de la sesión ya hay safety language, el `crisisNotice` cambia a `[CONTEXTO DE SEGURIDAD — CHECK YA REALIZADO]` (helper [`lib/chat/safety-check-history.ts`](../../lib/chat/safety-check-history.ts)). Sin tabla nueva, sin migración.
  - **3b (memoria intra-sesión)** — prompt: nueva sección vinculante "Memoria intra-sesión" en [`session-therapist.md`](prompts/session-therapist.md) que prohíbe pedir datos ya dados, exige cita textual al parafrasear, y obliga a validar emocionalmente antes de cualquier check de seguridad.
  - **3c (cierre obligatorio vía tool)** — prompt: regla dura "Prohibido despedirse sin tool de cierre" en la sección de cierre. Audit server-side: `onFinish` en [`app/api/chat/route.ts`](../../app/api/chat/route.ts) loguea `console.warn('[chat-onfinish] assistant emitió despedida sin tool de cierre')` cuando el helper [`lib/chat/farewell-detector.ts`](../../lib/chat/farewell-detector.ts) detecta texto de despedida sin tool-part de cierre.
  - **3d (degradar imperativo del crisisNotice)** — server-side: el `crisisNotice` "primera vez" pasa de `[AVISO DE SEGURIDAD — ALERTA ACTIVADA]` con orden imperativa ("Activa el protocolo de crisis AHORA") a `[AVISO DE SEGURIDAD — POSIBLE SEÑAL]` contextual ("Lee el contexto antes de decidir...") para evitar que palabras como "desbordado" disparen protocolo de suicidio en contextos de estrés laboral o sobrecarga emocional.
  - **3e (anti-persistencia tras rechazo)** — prompt: nueva sección vinculante "Cuando el paciente rechaza una sugerencia" que valida → cede iniciativa → prohíbe encadenar 2+ alternativas seguidas tras un rechazo.
