# Plan 4 — Cuestionarios e informe clínico

**Branch base:** `main` (con Plan 3 ya mergeado).
**Branch de trabajo:** `feat/plan-4-questionnaires-assessment`.

## Objetivo

Al terminar este plan:
- Durante una sesión, la IA puede proponer **PHQ-9**, **GAD-7** o **ASQ** (screening suicidio) cuando sea clínicamente apropiado.
- El paciente ve el cuestionario como una **tarjeta embebida en el chat** y responde con botones.
- Al enviar, se guardan respuestas, se puntúa, se asigna banda de severidad y se crea `risk_event` si hay flag.
- La IA recibe el resultado y lo integra en la conversación (valida, deriva al clínico, NO diagnostica).
- Al cerrar sesión, se genera un **informe clínico preliminar** (`assessments`) con `gpt-5.4` (no mini) con disclaimer explícito: *impresión preliminar, no diagnóstico*.
- El paciente ve al cerrar sesión un estado "Informe preparado — tu psicólogo lo revisará".
- Todo el contenido clínico (textos de items, bandas de severidad, prompt del generador de informes) vive en `docs/agents/` y es editable por el psicólogo.

## Fuera de alcance

- Panel clínico (ver/aprobar informes) — Plan 5.
- Diagnóstico DSM-5 formal. El informe sugiere *áreas de exploración*, no etiquetas diagnósticas.
- Cuestionarios adicionales (PCL-5, AUDIT, etc.) — fuera.
- Recordatorios / repetición periódica — fuera.

---

## Pre-requisitos

- Plan 3 mergeado a `main`.
- Variables LLM en `.env.local` (ya presentes de Plan 3):
  - `LLM_CONVERSATIONAL_PROVIDER=openai` / `LLM_CONVERSATIONAL_MODEL=gpt-5.4-mini`
  - `LLM_STRUCTURED_PROVIDER=openai` / `LLM_STRUCTURED_MODEL=gpt-5.4` (para informe, ver Task 7)

Decisiones clave fijadas:
- Cuestionarios siempre propuestos por la IA (`triggered_by='ai'`), nunca autoservicio del paciente en esta versión.
- Un cuestionario a la vez por sesión. Si hay uno `proposed`/`in_progress`, la IA no propone otro.
- ASQ positivo → `risk_event` `suicidal_ideation` + banner crisis + sugerencia de cierre con `reason='crisis_detected'`.

---

## Task 1: Seed de definiciones (PHQ-9 / GAD-7 / ASQ)

**Files:**
- Create: `supabase/migrations/20260422000001_seed_questionnaires.sql`
- Create: `docs/agents/questionnaires/phq9.md`
- Create: `docs/agents/questionnaires/gad7.md`
- Create: `docs/agents/questionnaires/asq.md`

Los `.md` son la **fuente editable** por el psicólogo (items en ES, copia oficial validada). El seed SQL se escribe a mano pegando el contenido de los `.md` para que quede en DB (KISS — no parseamos markdown en runtime).

### PHQ-9 (9 items, escala 0–3, suma 0–27)
- `code='PHQ9'`, `domain='depression'`, `scoring_strategy='sum'`
- Items: enunciado oficial ES "Durante las últimas 2 semanas, ¿con qué frecuencia te ha molestado…"
  1. Poco interés o placer en hacer cosas.
  2. Se ha sentido decaído/a, deprimido/a o sin esperanzas.
  3. Con problemas para dormir / dormir demasiado.
  4. Cansancio o falta de energía.
  5. Poco apetito o comer en exceso.
  6. Se ha sentido mal consigo mismo/a, como un fracaso.
  7. Dificultad para concentrarse.
  8. Moverse / hablar tan despacio que otros lo notan, o estar tan inquieto/a.
  9. Pensamientos de hacerse daño o estar mejor muerto/a.   ← `risk_flag_rule: {"gte":1}`
- Opciones (todas): `[{value:0,label:"Ningún día"},{value:1,label:"Varios días"},{value:2,label:"Más de la mitad de los días"},{value:3,label:"Casi todos los días"}]`

### GAD-7 (7 items, 0–3, suma 0–21)
- `code='GAD7'`, `domain='anxiety'`, `scoring_strategy='sum'`
- Items (mismas opciones que PHQ-9):
  1. Sentirse nervioso/a, ansioso/a o con los nervios de punta.
  2. No poder dejar de preocuparse o controlar la preocupación.
  3. Preocuparse demasiado por diferentes cosas.
  4. Dificultad para relajarse.
  5. Estar tan inquieto/a que es difícil quedarse quieto/a.
  6. Molestarse o irritarse fácilmente.
  7. Sentir miedo como si algo terrible fuera a pasar.

### ASQ (4 items binarios + 1 de riesgo agudo condicional)
- `code='ASQ'`, `domain='risk'`, `scoring_strategy='conditional'`
- Items 1–4 con opciones `[{value:0,label:"No"},{value:1,label:"Sí"}]`:
  1. En las últimas semanas, ¿has deseado estar muerto/a?
  2. En las últimas semanas, ¿has sentido que tu familia o amigos estarían mejor si tú no estuvieras?
  3. En la última semana, ¿has pensado en suicidarte?
  4. ¿Alguna vez has intentado suicidarte?
- Item 5 (solo si alguno de 1–4 es `Sí`): ¿Estás pensando en suicidarte ahora mismo? — `risk_flag_rule: {"eq":1}`

### Bandas de severidad
Se almacenan como texto en `questionnaire_results.severity_band` y se calculan en código (Task 2). Definidas en los `.md` editables.

**Commit:**
```bash
npx supabase db push
git add supabase/migrations docs/agents/questionnaires
git commit -m "feat: seed PHQ-9, GAD-7, ASQ questionnaires in ES"
```

---

## Task 2: Servicio de cuestionarios + scoring

**Files:**
- Create: `lib/questionnaires/types.ts`
- Create: `lib/questionnaires/scoring.ts`
- Create: `lib/questionnaires/service.ts`
- Create: `tests/questionnaires/scoring.test.ts`
- Create: `tests/questionnaires/service.test.ts`

### `scoring.ts` — funciones puras, 100% testeable

```ts
export type SeverityBand =
  | 'minimal' | 'mild' | 'moderate' | 'moderately_severe' | 'severe'
  | 'positive' | 'negative'

export interface ScoringResult {
  totalScore: number
  severityBand: SeverityBand
  subscores: Record<string, number>
  flags: Array<{ itemOrder: number; reason: string }>
  requiresReview: boolean
}

export function scorePHQ9(answers: number[]): ScoringResult   // len 9
export function scoreGAD7(answers: number[]): ScoringResult   // len 7
export function scoreASQ(answers: number[]): ScoringResult    // len 4 or 5
```

Bandas:
- **PHQ-9:** 0–4 minimal, 5–9 mild, 10–14 moderate, 15–19 moderately_severe, 20–27 severe
- **GAD-7:** 0–4 minimal, 5–9 mild, 10–14 moderate, 15–21 severe
- **ASQ:** cualquier 1 en items 1–4 ⇒ `positive`. Si además item 5 = 1 ⇒ `flags: [{itemOrder:5, reason:"acute_risk"}]`, `requiresReview=true`.
- PHQ-9 item 9 ≥ 1 ⇒ `flags: [{itemOrder:9, reason:"suicidality"}]`, `requiresReview=true`.

Tests (mínimo 12 casos): todas las bandas de cada escala, flags de riesgo, edge cases (todo ceros, todo máximos, longitud inválida).

### `service.ts`

```ts
// Crear instancia (la IA decide)
createInstance(supabase, {
  userId, sessionId, conversationId, questionnaireCode, triggerReason
}): Promise<QuestionnaireInstance>

// Marcar in_progress cuando el paciente empieza
startInstance(supabase, instanceId): Promise<void>

// Enviar respuestas → scoring → guardar resultado → crear risk_event si flag
submitAnswers(supabase, {
  instanceId, answers: Array<{itemOrder:number, valueNumeric:number, valueRaw:string}>
}): Promise<ScoringResult>

// Conveniencia para chat-view / server
getActiveInstanceForSession(supabase, sessionId): Promise<(Instance & { items, result? }) | null>
```

`submitAnswers` en una transacción lógica (cliente con RLS):
1. Insertar answers
2. Llamar al scorer
3. Insertar `questionnaire_results`
4. `update questionnaire_instances set status='scored', submitted_at=now(), scored_at=now()`
5. Si `flags` contienen `suicidality` o `acute_risk`: insertar `risk_events` `suicidal_ideation` severity `high` (ASQ item 5 ⇒ `critical`).

**Commit:** `feat: questionnaire scoring + service with risk event on flag`

---

## Task 3: Endpoints de cuestionario

**Files:**
- Create: `app/api/questionnaires/[instanceId]/route.ts` (GET — devuelve instance + items)
- Create: `app/api/questionnaires/[instanceId]/answers/route.ts` (POST — body: `{answers:[…]}` → result)

RLS: el usuario solo ve/escribe cuestionarios de sus propias `questionnaire_instances`. Ya hay políticas (`qi_all_own`, `qa_select_own`). Añadir INSERT policy para `questionnaire_answers` en migración:

- Create: `supabase/migrations/20260422000002_questionnaire_answers_insert.sql`
  - `create policy "qa_insert_own" on questionnaire_answers for insert with check (instance_id in (select id from questionnaire_instances where user_id = auth.uid()))`

**Commit:** `feat: questionnaire API routes and answer RLS`

---

## Task 4: UI — tarjeta de cuestionario en el chat

**Files:**
- Create: `components/chat/questionnaire-card.tsx`
- Edit: `components/chat/chat-view.tsx`

Cuando `getActiveInstanceForSession` devuelve algo, `ChatView` renderiza `<QuestionnaireCard instance={…} onSubmitted={() => refresh()}>` **por encima del input** (no como mensaje del chat — es UI transaccional).

La tarjeta muestra:
- Título del cuestionario (p.ej. "PHQ-9 — evaluación del estado de ánimo (últimas 2 semanas)")
- Progreso: "Pregunta 3/9"
- Una pregunta a la vez con botones-radio para las opciones
- Botón "Enviar" solo aparece en la última
- Tras enviar: hace POST al API, muestra "Enviado. Serenia tiene tu resultado." y se desvanece tras 2s.

La tarjeta NO es un mensaje persistido — es efímera, basada en el estado de la instancia en DB.

Refresh: al enviar, se dispara un `router.refresh()` + el server component del chat re-lee la instancia y el siguiente render no muestra la tarjeta. La IA debe hacer follow-up en el siguiente mensaje (manejado en Task 5 por inyección de contexto).

**Commit:** `feat: in-chat questionnaire card`

---

## Task 5: Herramienta IA `propose_questionnaire` + inyección de resultados

**Files:**
- Edit: `app/api/chat/route.ts`
- Edit: `docs/agents/prompts/session-therapist.md`
- Edit: `docs/agents/roles/session-therapist.md`

### Tool nueva

```ts
const proposeQuestionnaire = tool({
  description: 'Propone un cuestionario clínico validado cuando la conversación lo justifica. Usa solo si hay señales claras de síntomas relevantes (ánimo bajo sostenido ⇒ PHQ9, ansiedad sostenida ⇒ GAD7, ideación suicida directa o indirecta ⇒ ASQ).',
  inputSchema: z.object({
    code: z.enum(['PHQ9', 'GAD7', 'ASQ']),
    reason: z.string().min(10).max(300),
  }),
  execute: async ({ code, reason }) => {
    // Si ya hay instancia activa esta sesión: devolver {skipped:true}
    const existing = await getActiveInstanceForSession(supabase, sessionId)
    if (existing) return { skipped: true, reason: 'already_active' }
    const inst = await createInstance(supabase, {
      userId: user.id, sessionId, conversationId: session.conversation_id,
      questionnaireCode: code, triggerReason: reason,
    })
    return { proposed: true, code, instanceId: inst.id }
  },
})
```

### Inyección de resultado al prompt

Antes del `streamText`, comprobar si hay un resultado **reciente** (scored en últimos 2 turnos) y si es así, inyectar:

```
[RESULTADO DE CUESTIONARIO — PHQ9]
Puntuación: 12 (moderate).
Flags: ninguno.
El paciente ha completado el cuestionario. Acknowledge con tacto, valida el esfuerzo, explícale qué significa la puntuación en términos no clínicos, y continúa la sesión. NO diagnostiques. Menciona que tu psicólogo revisará el informe.
```

Para ASQ con flag crítico:
```
[RESULTADO DE CUESTIONARIO — ASQ — RIESGO AGUDO]
Item 5 positivo. Activa protocolo de crisis AHORA (validación, Línea 024, marcar para revisión clínica inmediata, considerar close_session con reason='crisis_detected').
```

Mecanismo: tabla auxiliar NO — usar un heurístico simple: leer `questionnaire_results` con `created_at > session.opened_at` y cuyo `instance.session_id = sessionId`, y que no haya aún un assistant message posterior a `scored_at`. Si lo hay, ya se ha acknowledged.

### Actualizar `prompts/session-therapist.md`
Añadir sección "Cuándo proponer cuestionarios":
- Tras 3–4 turnos explorando síntomas, si el patrón es consistente con depresión/ansiedad/riesgo.
- Nunca en los primeros 2 minutos.
- Explícale brevemente al paciente por qué: "Me ayudaría mirar esto con un cuestionario corto, ¿vale?"
- Nunca más de uno por sesión.
- Si detectas ideación suicida (directa o indirecta) ⇒ ASQ, no otro.

**Commit:** `feat: propose_questionnaire tool and result injection`

---

## Task 6: Generador de informe clínico

**Files:**
- Create: `lib/assessments/generator.ts`
- Create: `docs/agents/prompts/clinical-report.md`
- Create: `lib/llm/models.ts` (edit) — añadir `llm.structured()` si no existe
- Create: `tests/assessments/generator.test.ts`

### Prompt de informe (`clinical-report.md`)

Frontmatter: `model: openai/gpt-5.4` (informe merece modelo grande).

Body: un prompt que dice "Eres un asistente que redacta **impresiones clínicas preliminares** para un psicólogo colegiado. NO diagnosticas. Estructura tu salida en JSON con estos campos:"

```json
{
  "chief_complaint": "string — lo que trae al paciente, en su voz",
  "presenting_issues": ["string", "..."],
  "mood_affect": "string",
  "cognitive_patterns": ["string", "..."],
  "risk_assessment": {
    "suicidality": "none|passive|active|acute",
    "self_harm": "none|historic|current",
    "notes": "string"
  },
  "questionnaires": [
    { "code": "PHQ9", "score": 12, "band": "moderate", "flags": [...] }
  ],
  "areas_for_exploration": [
    "string — sugerencias de qué profundizar en próxima sesión, SIN nombrar trastornos"
  ],
  "preliminary_impression": "string — una observación CLÍNICA cuidadosa, sin etiqueta DSM. Ej: 'Síntomas consistentes con sintomatología depresiva de intensidad moderada con componente ansioso. Requiere evaluación por psicólogo para formular.'",
  "recommended_actions_for_clinician": ["string", "..."],
  "patient_facing_summary": "string — 2-3 frases cálidas en segunda persona que el paciente verá. NO incluye impresión clínica ni puntuaciones crudas."
}
```

### `generator.ts`

```ts
export async function generateAssessment(supabase, sessionId: string): Promise<Assessment> {
  // 1. Fetch session, conversation, messages, questionnaire results, risk events
  // 2. Build user prompt with transcript (límite ~60 mensajes) + cuestionarios + eventos
  // 3. generateObject({ model: llm.structured(), schema, system: loadPromptFromMarkdown('docs/agents/prompts/clinical-report.md') })
  // 4. Insert into assessments con status='draft_ai', assessment_type='closure', generated_by='ai'
  // 5. Return created row
}
```

Usa `generateObject` (no `streamText`) con schema Zod equivalente al JSON. Logging de tokens vía `result.usage` al `console.info` (Plan 5 añadirá tabla de usage si hace falta).

Test: mockea el cliente supabase y el LLM; verifica que el insert tiene los campos correctos y que falla limpiamente si no hay mensajes.

**Commit:** `feat: clinical report generator with structured output`

---

## Task 7: Disparar informe al cerrar sesión

**Files:**
- Edit: `lib/sessions/service.ts` — extender `closeSession` para disparar informe
- Edit: `app/api/chat/route.ts` — llamar generador tras `closeSession` del tool

Decisión: generar informe **solo si la sesión tuvo ≥ 3 mensajes del usuario** (evita informes basura de sesiones abortadas). Si < 3 turnos, `closure_reason='user_request'` sin informe; marcar `closure_reason='session_too_short'` si se descarta.

Llamada async; el usuario recibe inmediatamente el redirect a `/app` y el informe se genera en background. Como Next.js 16 termina la función al responder, la llamada debe ser `await` dentro del POST (no detach). Con `maxDuration=60` en `/api/chat`, sobra tiempo (gpt-5.4 tarda ~5–15s). Para `endSessionAction` del server action: también `await`.

Si la generación falla (LLM error, validación JSON), **NO bloquear el cierre**. Log el error, deja la sesión cerrada sin assessment. El clínico verá la ausencia desde el panel (Plan 5).

**Commit:** `feat: generate clinical report on session close`

---

## Task 8: Vista post-sesión para el paciente

**Files:**
- Edit: `app/app/page.tsx`

Si el usuario no tiene sesión activa pero su última sesión cerrada tiene assessment con `patient_facing_summary`, mostrar ese resumen en una Card: "Resumen de tu última sesión" (solo el `patient_facing_summary`, nunca puntuaciones crudas ni impresión clínica). Botón "Iniciar nueva sesión" debajo.

Si el cierre fue `crisis_detected`, reemplazar el resumen por un mensaje fijo: "Tu última sesión se cerró por seguridad. Tu psicólogo la está revisando hoy. Si necesitas ayuda ahora, llama a la Línea 024." No incluir resumen generado por IA.

**Commit:** `feat: show last-session summary on app home`

---

## Task 9: Tests e2e + smoke test

**Files:**
- Create: `tests/e2e/questionnaire-flow.test.ts` (vitest, mocks como en Plan 3)

Escenario:
1. Crear sesión
2. Usuario manda 4 mensajes "estoy triste…"
3. IA llama `propose_questionnaire({code:'PHQ9', reason:…})`
4. UI renderiza tarjeta
5. Simular 9 respuestas con suma=12
6. POST answers → verificar `questionnaire_results` con `severity_band='moderate'`
7. Próximo mensaje del usuario → IA recibe el contexto del resultado
8. Cerrar sesión → assessment generado con `questionnaires[0].score=12`
9. `/app` muestra `patient_facing_summary`

Los steps que involucran LLM mockean el modelo (AI SDK `MockLanguageModelV2`).

Smoke test manual:
```
- npm run dev
- login paciente, abrir chat
- Conversación con keywords depresivas → verificar que IA propone PHQ-9
- Responder → tarjeta desaparece, IA acknowledges en siguiente turno
- Hablar sobre ansiedad → IA propone GAD-7 (debería saltar con {skipped:true} porque ya hay uno) → verificar que IA no insiste
- Cerrar sesión → volver a /app → ver resumen
- Verificar en DB: assessments.summary_json tiene estructura esperada
```

**Commit:** `test: questionnaire and assessment flow`

---

## Task 10: Verificación final

- `npx tsc --noEmit` clean
- `npx vitest run` verde
- `npx next build` verde
- Smoke test completo
- Empty commit: `feat: Plan 4 questionnaires and clinical report complete`

---

## Notas de diseño

- **No mostrar puntuaciones al paciente.** El paciente ve que completó un cuestionario y un acknowledgment cálido. Las puntuaciones son para el clínico.
- **Disclaimer en cada impresión clínica.** El prompt del generador lo fuerza. El panel del clínico (Plan 5) también lo renderizará como banner.
- **Un cuestionario por sesión** — evita sobrecarga y permite que la conversación siga fluida.
- **ASQ es especial.** Si sale positivo agudo, el protocolo de crisis toma prioridad absoluta — la conversación cambia de tono inmediatamente.
- **Sesiones muy cortas no generan informe.** Regla de ≥3 mensajes de usuario evita ruido.
