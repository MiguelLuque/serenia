# Plan 7 — Decisiones humanas pendientes

**Fecha:** 2026-04-25
**Plan asociado:** [2026-04-25-plan-7-chat-polish.md](../plans/2026-04-25-plan-7-chat-polish.md)
**Estado:** abierto

Este documento recoge las decisiones que **no puede tomar el equipo técnico solo**. Cada una bloquea o condiciona alguna tarea del Plan 7. Sin estas decisiones, el plan se completa con borradores que luego hay que ajustar y firmar.

Owner por defecto: el psicólogo clínico que supervisa Serenia (a definir). Cuando aplique, se cita además abogado/DPO o decisión de producto del fundador.

---

## 1. Definiciones operativas de los enums clínicos (BORRADOR IMPLEMENTADO EN T4 — pendiente firma clínica)

**Estado:** **borrador implementado en T4 con criterios provisionales — pendiente firma clínica para versión final.** Las definiciones operativas vinculantes viven en [docs/agents/prompts/clinical-report.md](../../../docs/agents/prompts/clinical-report.md) sección "Criterios clínicos para los enums (vinculantes)". Si el clínico colegiado ajusta matices tras la revisión, será un commit puntual sobre ese mismo prompt — el borrador es razonablemente alineado con ASQ guidelines y framing fenomenológico DSM-5.

**Contexto:** el Plan 7 propone reescribir [docs/agents/prompts/clinical-report.md](../../../docs/agents/prompts/clinical-report.md) con criterios verbales, exclusiones y ejemplos para cada valor de `risk_assessment.suicidality` (`none|passive|active|acute`) y `risk_assessment.self_harm` (`none|historic|current`). El equipo técnico tiene una propuesta inicial pero los matices clínicos los firma un colegiado.

**Pregunta para el clínico:**
- ¿Las definiciones operativas propuestas son clínicamente válidas, o hay matices que cambiar?
- ¿La regla "ASQ banda `positive` no implica `active`" es correcta?
- ¿Qué evidencia textual debe verse en el transcript para clasificar `active` vs `passive`?
- ¿La diferenciación `active` vs `acute` se basa solo en plan/intención/medios, o hay otros criterios?
- Para `self_harm.current`: ¿"actos en el último mes" es la ventana correcta?

**Owner:** psicólogo colegiado supervisor.
**Output esperado:** documento adjunto al Plan 7 con definiciones firmadas.
**Bloqueo:** T4 mergeado con borrador. Antes de abrir a usuarios reales se requiere firma del clínico — si la firma no introduce cambios sustantivos, se marca esta decisión como cerrada; si introduce cambios, commit puntual sobre el prompt.

---

## 2. Aprobar añadir `heteroaggression` y `substance_use_acute` al schema (BORRADOR IMPLEMENTADO EN T4 — pendiente firma clínica)

**Estado:** **schema con los nuevos enums implementado en T4** ([lib/assessments/generator.ts](../../../lib/assessments/generator.ts)). Pendiente firma clínica de los enums propuestos antes de abrir a usuarios reales. Cualquier cambio post-firma requeriría versión nueva del schema (los rows existentes seguirán parseando vía defaults).

**Contexto:** hoy [AssessmentSchema](../../../lib/assessments/generator.ts) solo tiene `suicidality` y `self_harm`. Heteroagresión (riesgo de daño a otros) y abuso de sustancias agudo se meten en `notes` libres, sin estructura, lo que hace que el LLM los clasifique mal (caso Paciente D). T4 propone añadir:

```ts
heteroaggression: z.enum(['none', 'verbal', 'plan'])
substance_use_acute: z.enum(['none', 'suspected', 'confirmed']).nullable()
```

**Pregunta para el clínico:**
- ¿Los enums propuestos cubren las categorías clínicamente útiles?
- ¿Hay otra categoría que falta (autoagresión no suicida, violencia recibida, ideación de autolesión animales, etc.)?
- ¿`heteroaggression='plan'` requiere protocolo específico de derivación o aviso? (relacionado con punto 5).

**Owner:** psicólogo colegiado.
**Output:** schema firmado.

---

## 3. Email transaccional automático en cierre por crisis (BLOQUEA T10b post-launch)

**Contexto:** hoy el aviso de Línea 024 vive solo en el chat y en el banner del home. Si el paciente cierra la pestaña tras un cierre por `crisis_detected`, no recibe el aviso por ningún otro canal. El Plan 7 (T10b) propone hacer el banner persistente, pero un email/SMS automático con Línea 024 + 112 sería redundancia adicional.

**Implicaciones:**
- **RGPD**: enviar email automatizado con datos de salud sensibles requiere base legal explícita en el consentimiento informado.
- **Responsabilidad civil**: si el email no llega (spam, dirección errónea, mal funcionamiento del proveedor), ¿hay deber de cuidado infringido?
- **Duty of care**: en jurisdicción española no es obligación legal explícita, pero sí ética profesional.

**Pregunta:**
- ¿Se implementa email transaccional automático tras `close_session_crisis`?
- Si sí, ¿qué proveedor (Resend, SendGrid)? ¿Qué SLA?
- ¿El consentimiento informado del onboarding lo cubre, o hay que añadir cláusula?
- ¿Y SMS? Más fiable que email pero más coste.

**Owner:** abogado/DPO + clínico supervisor + fundador.
**Output:** decisión documentada (sí/no), con referencia a base legal.
**Bloqueo:** ninguno hoy (T10b es banner persistente, no email). Pero antes de abrir a usuarios reales hay que decidir.

---

## 4. Política de límite de sesiones por día (no bloquea Plan 7)

**Contexto:** hoy no hay límite. Un paciente puede abrir N sesiones en un día. Riesgo: uso compulsivo del chat como sustituto de relación humana, o como muleta evitativa.

**Pregunta:**
- ¿Hard cap de sesiones/día? Ej: 1 sesión/día.
- ¿Hard cap de minutos totales/día? Ej: 90 min totales.
- ¿Cooldown entre sesiones? Ej: mín 4h.
- ¿Solo telemetría primero (medir uso real) y decisión informada después?

**Owner:** clínico supervisor + fundador.
**Output:** política documentada o "no aplicar todavía, decidir tras N semanas con datos".
**Bloqueo:** ninguno en Plan 7. Es feature futura.

---

## 5. Política de aviso a terceros si se confirma plan de heteroagresión (CONDICIONA T4 + clínica)

**Contexto:** si T4 añade `heteroaggression='plan'` al schema, el clínico revisor verá ese flag al revisar el assessment. ¿Qué obligación tiene de avisar a terceros (víctima potencial, fuerzas de seguridad)?

En España no hay un equivalente directo al "Tarasoff duty" estadounidense, pero sí hay deber de cuidado y obligación de denuncia ante delitos en formación (art. 450 CP). El psicólogo colegiado tiene su propio código deontológico aplicable.

**Pregunta:**
- ¿Cuál es el protocolo de Serenia si el clínico revisor ve `heteroaggression='plan'`? ¿Lo deriva a urgencias? ¿A juez? ¿Requiere consulta supervisión obligatoria?
- ¿Cómo se documenta la decisión del clínico (audit trail)?
- ¿El paciente tiene que estar informado de esta posibilidad en el consentimiento informado?

**Owner:** abogado + psicólogo supervisor + fundador.
**Output:** protocolo documentado y entrenamiento del clínico revisor.

---

## 6. Coherencia del rol "tu psicólogo" en la copy (no bloquea Plan 7)

**Contexto:** la copy de la app y el sign-off Plan 6 dicen reiteradamente "tu psicólogo" como si fuera una relación clínica individual y persistente. Hoy:
- El "psicólogo" puede ser cualquier user con `role='clinician'` que cierre el assessment.
- Si hay rotación de revisores (vacaciones, multi-team), el "tu psicólogo" cambia de persona sin que el paciente lo sepa.
- En el futuro: ¿se asignará un clínico fijo por paciente? ¿Habrá "team de clínicos"?

**Pregunta:**
- ¿La copy "tu psicólogo" es honesta hoy? Si no, cambiarla a "tu equipo clínico" o "el psicólogo que revise tu sesión".
- A medio plazo: ¿asignación 1-a-1 paciente↔clínico es parte del modelo de producto?

**Owner:** fundador + clínico supervisor.
**Output:** decisión sobre el modelo de asignación + copy ajustada.

---

## 7. Consentimiento informado pre-lanzamiento → producción (BLOQUEA apertura a usuarios reales)

**Contexto:** memory `serenia_prelaunch_env.md` indica pre-lanzamiento sobre BD prod. Cuando se abra a usuarios reales, hace falta consentimiento informado que cubra:
- Que la conversación inicial es con IA, no con humano.
- Que un psicólogo revisa los informes (con el matiz del punto 6).
- Que se almacenan datos sensibles de salud mental.
- Política de retención (¿cuánto tiempo se guarda?).
- Derechos GDPR (acceso, rectificación, borrado).
- Línea 024 / 112 si aparece riesgo (relacionado con punto 3).
- Si se añade el email automático de crisis (punto 3), incluir base legal aquí.
- Que las respuestas del cuestionario se ven por el clínico.

**Pregunta:**
- ¿Quién redacta el consentimiento? Plantilla AEPD + revisión legal.
- ¿Se firma en el flujo de signup como ya hace `consent` flag? ¿Es suficiente un checkbox o se requiere firma electrónica?

**Owner:** abogado/DPO.
**Output:** texto de consentimiento + UI de firma + auditoría de aceptación.
**Bloqueo:** absoluto para abrir a usuarios reales.

---

## 8. Wording y orden del ASQ en formato no-presencial (BLOQUEA T9a parcial)

**Contexto:** el ASQ pregunta cosas duras: "¿alguna vez has intentado suicidarte?", "¿estás pensando en suicidarte ahora mismo?". En administración presencial el clínico modula el contexto. En administración no-presencial vía chat, el cuestionario llega "seco" (incluso con la intro de la IA en T2).

**Pregunta:**
- ¿El wording exacto y el orden de los 5 ítems del ASQ son los recomendados para administración no-presencial?
- ¿Falta una pregunta de "soporte/contención" antes o después?
- ¿La copy de introducción que la IA dirá antes del ASQ debe seguir un guion específico?
- ¿Tras un ASQ con cualquier ítem positivo, debe el sistema mostrar un mensaje "post-cuestionario" con recursos antes de devolver el control a la IA?

**Owner:** psicólogo colegiado.
**Output:** wording y orden firmado, plus copy de intro y post.
**Bloqueo:** T9a (micro-copy del cuestionario) puede usar borrador hasta firma.

---

## 9. Tono y antipatterns en la copy de la IA (no bloquea, pero condiciona T4c y T9c)

**Contexto:** la copy actual de la IA ([session-therapist.md](../../../docs/agents/prompts/session-therapist.md)) tiene reglas generales pero no antipatterns explícitos. Riesgos detectados: tono parental ("queremos felicitarte"), validación inflada ("es totalmente válido"), expresiones LATAM, frases con género femenino implícito ("estés lista").

**Pregunta:**
- ¿Lista de "frases prohibidas" / antipatterns clínicos para la IA?
- ¿Tratamiento por defecto: tú (consenso ya), pero ¿formal "te" + verbo o coloquial con muletillas)?
- ¿Inclusivo `/a` o neutro? Ej: "lista" → "preparado/a" o "todo listo".
- ¿Hay alguna frase ya firmada (sign-off) que se debe preservar literal? Identificarla.

**Owner:** clínico supervisor + redactor de copy (si existe) o fundador.
**Output:** lista de antipatterns + decisión sobre inclusivo/neutro.

---

## 10. Decidir qué hacer con los acuerdos (T10c)

**Contexto:** "Tus acuerdos recientes" hoy es lectura pura en home. T10c plantea dos opciones:
- **Accionable**: checkbox "Marcar como cumplido" + nota corta editable por el paciente. UX clínicamente útil pero requiere endpoint, validación, y lo más importante: ¿qué ve el clínico cuando el paciente marca "no cumplí"?
- **Honesta**: copy clarificadora "Tu psicólogo verá tu progreso en la próxima sesión" sin checkbox. Más simple, conservador, no transmite expectativa de auto-tracking.

**Pregunta:**
- ¿El paciente puede / debe poder reportar progreso entre sesiones?
- Si sí, ¿cómo se le devuelve al clínico (notificación / agregado en bandeja / tendencia)?
- Si no, ¿cuándo se reactiva esto?

**Owner:** clínico supervisor + fundador.
**Output:** decisión + copy.
**Bloqueo:** T10c puede empezar con la opción conservadora (copy honesta) y dejar la accionable como fast-follow.

---

## 11. Cantidad y profundidad de telemetría aceptable (no bloquea, condiciona T13e)

**Contexto:** T13e propone telemetría de latencia. Más allá de eso, los agentes de auditoría sugirieron telemetría de:
- Tasa de propose-close-session aceptados/rechazados (calibración del modelo).
- Frecuencia de checks de seguridad en sesiones (calibración del prompt).
- Veces que el LLM ignora la regla de "lee historial" (medible con LLM-as-judge offline).

Toda esta telemetría implica almacenar metadata sobre conversaciones de salud mental.

**Pregunta:**
- ¿Hasta dónde llegamos con telemetría? Anonimizada / agregada / individual?
- ¿Se incluye en el consentimiento informado?
- ¿Quién accede a estos dashboards?

**Owner:** DPO + fundador.
**Output:** política de telemetría + ajuste del consentimiento.

---

## 12. Recursos externos: solo España o multi-jurisdicción (no bloquea, define alcance)

**Contexto:** hoy el aviso de crisis menciona "Línea 024" y "112", ambos españoles. El sistema asume jurisdicción española.

**Pregunta:**
- ¿Serenia es solo para residentes en España en el lanzamiento inicial?
- Si abre a otros países (LATAM, otros UE), ¿qué números de emergencia?
- ¿Detección por idioma del navegador / locale / IP / declaración explícita en signup?

**Owner:** fundador + abogado.
**Output:** política de mercados.
**Bloqueo:** ninguno hasta abrir fuera de España.

---

## Cómo se gestiona este documento

- Cada punto se cierra con: decisión documentada en este mismo archivo (sección "Decisiones tomadas") + actualización del Plan 7 si aplica.
- Si una decisión bloquea una tarea T-N del plan, marcar el bloqueo en este doc y en el plan.
- El equipo técnico revisa este documento en cada checkpoint del Plan 7 para verificar qué desbloqueos hay.

## Nuevas decisiones surgidas (post-clarificación de flujo, 2026-04-25)

### #13 — Onboarding clínico ligero post-signup: ¿qué preguntas? (BLOQUEA T-A)

**Contexto:** decisión tomada — habrá un onboarding clínico ligero entre signup y primera sesión. El contenido exacto necesita validación clínica.

**Borrador propuesto** (Plan 7 lo implementa con esto si no hay objeción):
1. Cómo prefieres ser tratado/a (pronombres / nombre informal). [obligatorio]
2. Edad o fecha de nacimiento. [obligatorio]
3. ¿Qué te trae a Serenia? (texto libre, breve). [obligatorio]
4. ¿Has hablado antes con un psicólogo? Si sí, brevemente. [opcional]

**Pregunta para el clínico:**
- ¿Las 4 preguntas son las correctas?
- ¿Falta alguna (medicación actual, antecedentes médicos relevantes, situación vital actual, redes de apoyo)?
- ¿La 3 (motivo de consulta) debería ser libre o tener categorías predefinidas + libre?
- ¿Wording exacto para no asustar al paciente en el primer contacto?

**Owner:** psicólogo supervisor.
**Output:** preguntas firmadas + copy de cada label.
**Bloqueo:** T-A puede mergear con el borrador y refinar en una iteración posterior.

---

### #14 — Notas del clínico al editar/rechazar informe (RESUELTA: visibles a la IA)

**Decisión tomada (2026-04-25):** las `clinical_notes` que el clínico añade al editar/revisar son **visibles al agente** en sesiones futuras del paciente.

**Razón:** la directiva del fundador es "no puede haber información del paciente que el agente no conozca". Las notas clínicas son parte del marco terapéutico que la IA debe respetar para no contradecir lo que el psicólogo está construyendo.

**Implicaciones implementadas en Plan 7:**
- T-B añade el campo `clinical_notes` y el flujo de regeneración con notas + rejection_reason.
- T-1 inyecta `clinical_notes` al bloque Tier A.
- [docs/agents/chat-flow.md](../../agents/chat-flow.md) refleja esto en la tabla "Información que entra al agente".

**Si el clínico necesitara notas privadas no-visibles** en el futuro: se añadiría un campo separado `clinical_private_notes` con flag explícito de exclusión. Por ahora no es necesario.

---

### #15 — Histórico de cuestionarios al contexto (RESUELTA: tool dinámico)

**Decisión tomada (2026-04-25):** el histórico se accede vía tool `get_questionnaire_history({ code, limit? })`, no se inyecta automáticamente al system prompt.

**Razón:** evitar inflar el contexto inicial con datos que solo son útiles a veces. La IA pide la tool cuando juzga relevante traer la evolución longitudinal a la conversación.

**Excepción:** una **tendencia compacta** ("PHQ-9: 18 → 14 → 12 — últimos 30d") sí se inyecta al bloque Tier A automáticamente, porque cambia el marco emocional del agente desde el primer turno. La tool sirve para profundizar.

**Implementación:** T-1 del Plan 7.

---

### #16 — Tono y framing del onboarding (CONDICIONA T-A)

**Contexto:** T-A introduce un onboarding clínico antes de la primera sesión. El tono importa — es el primer contacto del paciente con Serenia. Si suena clínico/frío, alejará a alguien que ya tiene barrera al primer paso.

**Pregunta para el clínico + copywriter:**
- ¿La pantalla del onboarding debe sentirse como "carta de bienvenida" o como "formulario clínico"?
- ¿Qué frase de apertura?
- ¿Cómo justificar al paciente que pedimos esta info ("para que tu primer rato con Serenia sea más útil" vs explicación funcional)?
- Tipografía y composición coherente con [CLAUDE.md](../../../CLAUDE.md): serif Fraunces para titulares con itálica emocional, sin emojis, copy "como una carta".

**Owner:** clínico supervisor + fundador.
**Output:** copy del onboarding con tono firmado.
**Bloqueo:** T-A puede mergear con copy borrador y refinar.

---

## Decisiones tomadas

| # | Fecha | Decisión | Impacto |
|---|---|---|---|
| #14 | 2026-04-25 | `clinical_notes` del clínico son visibles al agente en sesiones futuras | T-B + T-1 implementan |
| #15 | 2026-04-25 | Histórico cuestionarios vía tool `get_questionnaire_history`, tendencia compacta inyectada | T-1 implementa |
| (general) | 2026-04-25 | Re-clasificación: `mood_affect`, `cognitive_patterns`, `preliminary_impression`, `patient_facing_summary` ENTRAN al contexto del agente. `recommended_actions_for_clinician` y `rejection_reason` siguen FUERA. | T-1 implementa |
| (general) | 2026-04-25 | Ciclo de revisión incluye **regeneración** del informe rechazado con notas del clínico | T-B implementa |
| (general) | 2026-04-25 | Habrá **onboarding clínico ligero** post-signup (preguntas y tono pendientes — #13 + #16) | T-A implementa con borrador |
