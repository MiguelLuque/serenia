---
name: cssrs
code: CSSRS
domain: suicide_risk
version: 1.0
language: es-ES
scoring_strategy: cssrs_levels
source_reference: "Posner K. et al. (2008). Columbia Suicide Severity Rating Scale — Versión exploratoria reciente, facilitada por @psicologo el 2026-05-02. © The Research Foundation for Mental Hygiene"
last_reviewed: 2026-05-03
owner: "@psicologo"
---

# C-SSRS — Columbia Suicide Severity Rating Scale (ES, screener)

Cribado de severidad suicida en 6 ítems Sí/No. **Sustituye al ASQ** que usábamos antes. La pregunta del ítem 6 además distingue entre *en el curso de la vida* (lifetime) y *últimos 3 meses* (recent), lo que dispara un cierre inmediato.

> Copy literal del cuadernillo facilitado por Pablo (`SUICIDIO_CSSRS.pdf`, archivo en `docs/handoff/respuesta de pablo/`). No editar los ítems sin firma clínica.

## Disparo (regla en el system prompt)

A diferencia del resto de cuestionarios, el C-SSRS **no espera al PHQ-9**. Se propone **siempre** ante cualquier verbalización (directa o indirecta) de ideación suicida o autolesión:
- *"a veces pienso que sería mejor no estar"*, *"quiero desaparecer"*, *"no quiero despertar"* y similares.
- Si el paciente verbaliza ideación clara desde el inicio sin C-SSRS hecho, se propone antes de cualquier otra acción.

**Decisión clínica firmada por Pablo (2026-05-03):** sólo se administra la versión **lifetime** ("en el curso de la vida") en sesión 1. En sesiones siguientes, se reformula el ítem 6 como *since last visit* — si **ítem 6 since-last-visit = Sí**, cortar la sesión inmediatamente y avisar al psicólogo referente.

## Instrucciones que ve el paciente

Voy a hacerte 6 preguntas sobre pensamientos o intenciones que has podido tener. Responde **sí o no** a cada una.

## Items

### 1. Deseo de estar muerto
> ¿Ha deseado estar muerto/a o poder dormirse y no despertar?

Respuesta: Sí / No.

### 2. Ideas suicidas no específicas
> ¿Ha tenido realmente la idea de suicidarse?

Respuesta: Sí / No. Si **No**, saltar a ítem 6 (omitir 3, 4, 5).

### 3. Ideación con método sin plan ni intención
> ¿Ha pensado en cómo llevaría esto a cabo?

> *Esto incluye a un participante que diría: "He tenido la idea de tomar una sobredosis, pero nunca hice un plan específico sobre el momento, el lugar o cómo lo haría realmente… y nunca lo haría".*

Respuesta: Sí / No. Sólo se pregunta si ítem 2 = Sí.

### 4. Ideación con cierta intención sin plan
> ¿Ha tenido estas ideas y en cierto grado la intención de llevarlas a cabo?

> *A diferencia de "Tengo los pensamientos, pero definitivamente no haré nada al respecto".*

Respuesta: Sí / No. Sólo se pregunta si ítem 2 = Sí.

### 5. Ideación con plan específico e intención
> ¿Ha comenzado a elaborar o ha elaborado los detalles sobre cómo suicidarse? ¿Tenía intenciones de llevar a cabo este plan?

Respuesta: Sí / No. Sólo se pregunta si ítem 2 = Sí.

### 6. Conducta suicida (lifetime)
> ¿Alguna vez ha hecho algo, ha comenzado a hacer algo o se ha preparado para hacer algo para terminar su vida?

> *Ejemplos: coleccionar pastillas, conseguir un arma, regalar cosas de valor, escribir un testamento o carta de suicidio, sacar pastillas del frasco pero no tragarlas, sostener un arma pero cambiar de opinión o que alguien se la quitara, subir al techo pero no saltar; o realmente haber tomado pastillas, haber tratado de disparar un arma, haberse cortado, haber tratado de colgarse, etc.*

Respuesta: Sí / No.

### 6b. Conducta suicida reciente (últimos 3 meses) — sólo si ítem 6 = Sí
> ¿Fue esto en los últimos 3 meses?

Respuesta: Sí / No. Si **Sí**, marcar `behavior_recent=true` ⇒ cortar inmediatamente la sesión y notificación urgente al psicólogo.

## Bandas (firmadas por Pablo el 2026-05-03)

> El screener oficial define "any yes = positivo". Pablo aprobó esta granularidad de **5 bandas** para que la app reaccione distinto en cada caso (archivo `01-cuestionarios.md`, respuesta "Perfecto").

| Banda            | Cuándo dispararla                                                                  | Qué hace la app                                                                                          |
|------------------|------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `negative`       | Todos los ítems = No                                                               | Sigue la sesión con normalidad                                                                           |
| `low_risk`       | Ítem 1 o 2 = Sí (deseo de morir / pensamientos no específicos)                     | Acknowledge la ideación pasiva. **NO inyecta** protocolo de crisis                                       |
| `moderate_risk`  | Ítem 3 = Sí (pensamientos activos sin método ni intención)                         | Profundiza con el paciente, refuerza red de apoyo                                                        |
| `high_risk`      | Ítem 4 = Sí (intención sin plan)                                                   | Da Línea 024 + marca sesión para revisión clínica el mismo día                                           |
| `acute_risk`     | Ítem 5 o 6 = Sí (intención clara o conducta suicida lifetime)                      | Cierre inmediato con copy de seguridad + Línea 024 + alerta urgente al psicólogo                         |

**Override `behavior_recent` (ítem 6b = Sí):** `acute_risk` + cierre **inmediato** de sesión + notificación urgente al psicólogo. Esta override aplica aunque el resto de ítems den negativo.

**Reglas de prioridad:** la banda asignada es la **más severa** que cualquier ítem dispare. Es decir, si ítem 1 = Sí e ítem 4 = Sí, banda = `high_risk`, no `low_risk`.

## Flag de riesgo

- Banda `acute_risk` o `high_risk` ⇒ crear `risk_event` `suicidal_ideation` severity `high`, `requires_review=true`.
- Banda `moderate_risk` ⇒ severity `medium`, `requires_review=true`.
- Banda `low_risk` ⇒ severity `low`, `requires_review=false` (anotar en informe pero no escalar).
- Banda `negative` ⇒ no se crea risk_event.

## Anti-repregunta tras C-SSRS no agudo

Tras un C-SSRS con banda `negative`, `low_risk` o `moderate_risk`, Serenia **NO repite pregunta textual de seguridad** ante frases difusas tipo *"desbordado"*, *"que se acabe esto"*, *"ganas de desaparecer"*. Sólo dispara un nuevo C-SSRS ante **señal nueva y específica** (verbalización clara de plan, medios o conducta). Detalle en `docs/agents/prompts/session-therapist.md` y en `lib/shared/chat/safety-state.ts`.
