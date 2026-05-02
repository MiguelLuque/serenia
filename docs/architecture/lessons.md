# Lessons learned

**Documento vivo.** Cada bug grande detectado en smoke o producción + la lección que dejó. Se rellena retroactivamente con material de Plans pasados y se sigue actualizando.

Formato:

- **Síntoma**: qué se observó.
- **Causa raíz**: el porqué real, no el porqué aparente.
- **Lección**: regla práctica para el equipo (humano y agentes IA).
- **ADR vinculado**: decisión arquitectónica que cierra esto, si aplica.

---

## L-001 — El LLM ignora reglas que no están en sitio prominente del prompt

**Síntoma:** Plan 7 T3 introdujo memoria intra-sesión como recomendación en el prompt. La IA seguía pidiendo info que el paciente ya había dado (Paciente Jaime).

**Causa raíz:** las reglas estaban como bullet point en una sección secundaria. El LLM, bajo la presión del último mensaje del paciente y del `crisisNotice`, las ignoraba.

**Lección:** una regla en el prompt no es vinculante por defecto. Para que el LLM la cumpla:
- Sección dedicada con header destacado (ej. `## Memoria intra-sesión (vinculante)`).
- Lenguaje imperativo ("PROHIBIDO", "siempre", "nunca").
- Ejemplos del comportamiento esperado y del prohibido.
- Si se incumple repetidamente, no basta con reescribir — hay que mover la decisión al server (estado, heurística, override) en lugar de confiar en el LLM.

**ADR vinculado:** ADR-009, ADR-010.

---

## L-002 — Pedir "tests" explícitamente en el brief del implementer

**Síntoma:** Plan 7 T6 (Vercel WDK). El implementer instaló el paquete, configuró el workflow, refactorizó callers — pero NO añadió tests del nuevo workflow. El reporte decía DONE pero la cobertura era 0.

**Causa raíz:** el brief del implementer mencionaba "verifica `pnpm test`" pero no decía explícitamente "añade tests del nuevo flujo". El implementer interpretó "verifica que los existentes pasan" y no añadió nuevos.

**Lección:** en el brief siempre listar qué tests añadir. Sugerencia de patrón:
- "Tests unit para X (mockeando Y)."
- "Tests de integración para Z (con BD mockeada)."
- "Adapta tests existentes que asuman A → B."

Si el implementer reporta DONE_WITH_CONCERNS por gap de tests, abrir un commit aparte de tests **antes de mergear**.

---

## L-003 — Heurística regex sobre texto del assistant pierde tool calls

**Síntoma:** Plan 7 T3a v1 — `hasPriorSafetyCheck` retornaba `false` aunque la IA hubiera disparado el ASQ. El smoke real con Paciente Jaime detectó que la IA repreguntaba por seguridad tras un ASQ negativo.

**Causa raíz:** la regex buscaba patterns en `parts[].text`. El ASQ se persiste como `parts[].type === 'tool-propose_questionnaire'`, no como texto. La heurística no lo veía.

**Lección:**
- Cuando un evento existe en BD (ej. `questionnaire_instances`, `risk_events`), la BD es la fuente de verdad. La heurística textual sobre messages es fallback secundario.
- Cualquier consulta sobre "qué ha pasado en la sesión" debe priorizar consultas SQL primarias antes de texto.
- Si el evento solo deja huella en messages (ej. una pregunta textual del LLM), la regex debe contemplar tanto `text` como `tool` parts.

**ADR vinculado:** ADR-006, ADR-016.

---

## L-004 — Unique index "agresivo" colisiona con versionado

**Síntoma:** Plan 7 T-B intentó añadir `unique index on assessments(session_id) where assessment_type='closure'`. La migration falló: la sesión `afcf87ca` tenía 2 rows `closure` (una `superseded`, otra `reviewed_modified`) — el flujo de versionado del clínico genera múltiples rows por sesión.

**Causa raíz:** el unique no consideraba los estados "muertos" (rows que existen como histórico pero no compiten por unicidad).

**Lección:** los unique constraints sobre tablas con versionado deben ser **parciales**, excluyendo los estados muertos:

```sql
create unique index ... on tabla(session_id)
  where status not in ('superseded', 'rejected');
```

Antes de añadir un unique constraint, verificar que NO haya filas que lo violen ya — y si las hay, ver si son por diseño (versionado) o por bug.

**ADR vinculado:** ADR-005.

---

## L-005 — `default()` en zod schema saca el campo de `required` (OpenAI strict mode)

**Síntoma:** Plan 7 T-B regeneración fallaba con error "Invalid schema for response_format 'response': In context=('properties', 'proposed_tasks', 'items'), 'required' is required to be supplied and to be an array including every key in properties. Missing 'nota'".

**Causa raíz:** OpenAI structured outputs en strict mode exige que todos los campos del schema aparezcan en `required`. zod traduce `.default(...)` a "campo opcional" y lo saca de `required`. Aplica también a `.optional()`.

**Lección:**
- Los campos del schema usado por `generateObject` (con LLM strict mode) deben ser `nullable()` en lugar de `optional()` o `default()`.
- Mantener separación entre schema de generación (strict) y schema de lectura (con defaults para legacy).
- Patrón:

```ts
// Schema strict para generateObject:
const GenSchema = z.object({
  campo: z.string().nullable(), // permite null pero exige presencia
})

// Schema laxo para lectura (parsea legacy rows):
const ReadSchema = z.object({
  campo: z.string().nullable().default(null),
})
```

**ADR vinculado:** ADR-004.

---

## L-006 — Tras un cambio de prompt, hay que reiniciar `pnpm dev`

**Síntoma:** durante el smoke real con Paciente A tras T3a v2, los cambios de `session-therapist.md` no se aplicaban aunque estuvieran mergeados.

**Causa raíz:** `loadPromptFromMarkdown` (`lib/llm/prompts/loader.ts`) cachea el contenido en memoria del proceso. Hot reload de Next.js no invalida ese cache.

**Lección:**
- Tras editar cualquier archivo en `docs/agents/prompts/`, reiniciar `pnpm dev`.
- En producción (Vercel), no aplica — cada deploy crea un nuevo process.
- Si el cache se vuelve un problema recurrente, considerar invalidación por mtime o reload por env var.

---

## L-007 — Una banda "positive" del cuestionario no implica clasificación clínica activa

**Síntoma:** durante el smoke real con Paciente A, el ASQ se respondió con ítem 2 = Sí (resto No). La banda fue `positive`. La IA siguió preguntando por seguridad.

**Causa raíz:** "positive" en el ASQ significa "necesita seguimiento clínico" (cualquier ítem 1-4 en Sí), NO "ideación suicida activa". La diferenciación entre "moderate" y "active" requiere granularidad que el cuestionario por sí solo no captura.

**Lección:** al diseñar bandas de cuestionarios, distinguir:
- **Severidad clínica** (lo que mide el cuestionario).
- **Acción del sistema** (lo que el código hace).

No todas las bandas "positive" disparan el mismo comportamiento. Para C-SSRS (Plan 8), introducimos granularidad `low_risk`/`moderate_risk`/`high_risk`/`acute_risk` para que cada nivel tenga acciones distintas.

**ADR vinculado:** ADR-016.

---

## L-008 — Implementer reporta DONE pero el smoke real sigue rompiendo

**Síntoma:** tras mergear T3a v2, los tests pasaban (412/412) y el implementer reportó DONE. El smoke real con testA seguía detectando repreguntas de seguridad.

**Causa raíz:** los tests cubrían el path donde `safetyState='asq_negative'`. El smoke usó un caso donde `safetyState='asq_positive_non_acute'` (porque el paciente respondió ítem 2 = Sí). Ambos paths existían pero solo uno se cubrió.

**Lección:**
- "Verde en tests ≠ funciona en producción". Tests cubren paths conocidos; smoke real cubre paths reales.
- Antes de cerrar una tarea, ejecutar smoke con al menos 2 escenarios distintos del caso "happy path".
- En anti-repetición, considerar todas las bandas del cuestionario, no solo la default ("negative").

---

## L-009 — Wipe de BD legacy antes de un rediseño grande es más limpio que migración

**Síntoma:** discusión durante Plan 7 sobre cómo migrar rows legacy de `summary_json` (con o sin `proposed_tasks`, con o sin `heteroaggression`).

**Causa raíz:** el sistema estaba en pre-lanzamiento. Cualquier dato legacy era de smokes internos, no de usuarios reales.

**Lección:**
- Si el producto está en pre-lanzamiento, **borrar todo legacy** antes de un cambio grande es mejor que añadir defaults compatibles.
- Migración solo se justifica con usuarios reales.
- Pre-lanzamiento permite refactor libre. Aprovechar antes del go-live.

**ADR vinculado:** Plan 8 T0.1.

---

## L-010 — Asumir que el LLM va a obedecer la orden imperativa siempre falla

**Síntoma:** múltiples bugs de Plan 7 (Paciente D, Paciente Jaime). El prompt decía "haz X". El LLM hacía "Y" en algunos contextos.

**Causa raíz:** el LLM pondera múltiples instrucciones según contexto. Una instrucción imperativa fuerte ("Activa el protocolo de crisis AHORA") pierde frente a otras señales (transcripción, último mensaje, otros notices).

**Lección:**
- En lugar de imponer al LLM una orden imperativa, modificar el contexto que recibe:
  - Si ya se cribó la seguridad, NO inyectar el `crisisNotice` imperativo. Inyectar uno que diga "ya cribaste".
  - Si el estado de protocolo es "fase 4", inyectar el bloque de fase 4. No "puedes hacer cualquier técnica".
- El LLM obedece lo que le mandas EN EL MOMENTO. La memoria del chat ayuda pero no garantiza coherencia.
- Estado server-side > regla en prompt. Estado tipado + variantes > heurística textual.

**ADR vinculado:** ADR-009, ADR-011, ADR-015.

---

## L-011 — La regla "no coach" requiere lista negra explícita, no descripción genérica

**Síntoma:** durante el smoke con Paciente Jaime, la IA dijo "tienes razón en estar molesto" y "no tienes que hacer nada perfecto ahora". Tono coach que el psicólogo rechazó.

**Causa raíz:** el prompt decía "tono empático, no clínico en exceso" pero no listaba frases prohibidas. El LLM completó con frases tipo coach por entrenamiento previo.

**Lección:**
- Para anti-patrones de copy, dar lista negra explícita + sustitutos.
- Las descripciones genéricas ("evita coach", "valida con tacto") no son suficientes.
- Patrón en el prompt:

```markdown
**PROHIBIDO**:
- "[frase X]" (razón: [por qué])

**SUSTITUTOS**:
- En su lugar: "[frase Y]"
```

Plan 8 T4.1 incluye 8+ frases prohibidas con sustitutos.

---

## L-012 — La reescritura del producto es más limpia que parchear bugs uno a uno

**Síntoma:** Plan 7 fue una sucesión de hotfixes (T3, T3a v1, T3a v2). Cada uno arreglaba un caso pero el siguiente smoke detectaba uno nuevo.

**Causa raíz:** los bugs eran síntomas de una identidad de producto poco definida ("asistente acompañante genérico"). Sin un marco terapéutico claro, cada interacción improvisaba.

**Lección:**
- Cuando los bugs se acumulan en un dominio (clínico, conversacional, etc.), considerar reescritura estructural en lugar de parches.
- Plan 8 ataca la identidad: "Serenia es psicóloga TCC/ACT con protocolo de 8 sesiones". Los bugs caen como subproducto.
- Reescritura ≠ hacer todo de cero — reusar foundational (BD schema, registry, workflow WDK, persistencia íntegra), reescribir lo identitario (prompts, modelo terapéutico).
