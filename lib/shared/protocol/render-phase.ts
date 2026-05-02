/**
 * Plan 8 T5.3 / ADR-015: renderer del bloque [PROTOCOLO Y FASE ACTUAL].
 *
 * Las 8 fases del protocolo TCC/ACT son rígidas y hardcoded (ADR-015).
 * Cualquier cambio al contenido clínico requiere PR.
 *
 * Este módulo es lógica pura (ADR-019): no importa de `components/` ni
 * `app/`. El consumidor (Fase 4) inyectará el bloque en el system prompt
 * a través de `lib/patient-context/builder.ts`.
 *
 * Material clínico: documento del psicólogo Pablo (catálogo de 8
 * sesiones del protocolo).
 */

export type ProtocolPhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * Helper para hacer exhaustivo el switch en `renderProtocolPhaseBlock`.
 * Si TS atrapa un caso no cubierto en compile time, esto solo se llama
 * en runtime si alguien fuerza un cast (ej. `as any`).
 */
function assertNeverPhase(phase: never): never {
  throw new Error(`Unknown protocol phase: ${String(phase)}`)
}

const PHASE_1 = `[PROTOCOLO Y FASE ACTUAL — Sesión 1: Evaluación, alianza y psicoeducación]

Foco: construir alianza terapéutica, recoger motivo de consulta y dar al paciente un mapa inicial de su problema.

Objetivos:
- Acoger, normalizar y validar el malestar.
- Realizar análisis funcional de 1-2 situaciones recientes (antecedente → pensamiento → emoción → conducta → consecuencia).
- Introducir el mapa pensamiento-emoción-conducta como modelo compartido.
- Diferenciar dolor (inevitable) de lucha-con-dolor (modificable).

Técnicas previstas:
- Entrevista clínica abierta y validación.
- Análisis funcional guiado.
- Psicoeducación breve sobre el modelo TCC/ACT.

Tarea esperada para casa:
Autoregistro de 3 columnas (situación / pensamiento / emoción-conducta) durante la semana, 1-2 entradas al día.

Racional clínico:
La sesión 1 establece la alianza y entrega un marco que permite al paciente observar su experiencia con distancia. El autoregistro entrena la atención y aporta material para sesiones posteriores.

---
`

const PHASE_2 = `[PROTOCOLO Y FASE ACTUAL — Sesión 2: Activación conductual]

Foco: romper el ciclo evitación-anhedonia mediante reintroducción gradual de actividades placenteras y de dominio.

Objetivos:
- Monitorizar la relación actividad-ánimo durante la semana.
- Construir jerarquía de actividades (placenteras + de dominio + valiosas).
- Diseñar agenda de activación con compromisos concretos.
- Trabajar con metáforas: el jardín (cuidar lo que se cultiva) y las olas (dejar pasar sin sumergirse).

Técnicas previstas:
- Registro actividad-ánimo.
- Programación de actividades.
- Respiración cuadrática (perfil cognitivo) o relajación muscular progresiva (perfil somático), según necesidad.

Tarea esperada para casa:
2 actividades placenteras agendadas + 1 exposición leve a algo evitado.

Racional clínico:
La activación rompe el círculo retirada-tristeza-más retirada antes de tocar contenido cognitivo profundo. Tener cuerpo y agenda en marcha hace viables las sesiones siguientes.

---
`

const PHASE_3 = `[PROTOCOLO Y FASE ACTUAL — Sesión 3: Pensamientos automáticos]

Foco: identificar pensamientos automáticos y distorsiones, y aprender a relacionarse con ellos sin fusión.

Objetivos:
- Detectar pensamientos automáticos en situaciones-gatillo.
- Reconocer distorsiones cognitivas frecuentes (catastrofización, lectura de mente, debería, etc.).
- Examinar evidencia a favor / en contra y formular alternativas más ajustadas.
- Introducir defusión ACT: ver el pensamiento como un evento mental, no como la realidad.

Técnicas previstas:
- Registro cognitivo de 5 columnas.
- Cuestionamiento socrático.
- Ejercicios de defusión (etiquetar el pensamiento, repetirlo en voz alta, "estoy teniendo el pensamiento de…").

Tarea esperada para casa:
2 registros cognitivos completos durante la semana + práctica diaria breve de defusión.

Racional clínico:
Antes de cambiar el pensamiento conviene tomar distancia. La defusión protege de empujar al paciente hacia "pensar en positivo" cuando el problema es la fusión, no el contenido.

---
`

const PHASE_4 = `[PROTOCOLO Y FASE ACTUAL — Sesión 4: Regulación emocional y aceptación]

Foco: ampliar el vocabulario emocional y entrenar aceptación de emociones difíciles sin lucha.

Objetivos:
- Etiquetar emociones con precisión usando rueda de emociones.
- Practicar mindfulness breve (respiración consciente, escaneo corporal).
- Trabajar la metáfora del autobús (los pasajeros son los pensamientos/emociones; el paciente conduce hacia sus valores) personalizada al caso.
- Diferenciar suprimir / evitar / aceptar.

Técnicas previstas:
- Etiquetado emocional + rueda.
- Mindfulness breve guiado.
- Metáfora del autobús personalizada.

Tarea esperada para casa:
Práctica diaria de mindfulness (5-10 min) + registro de "dejar estar" (situaciones donde el paciente practicó aceptación en lugar de lucha).

Racional clínico:
La aceptación libera energía atrapada en la lucha contra la emoción. Es prerrequisito para la exposición y la conducta opuesta de la sesión 5.

---
`

const PHASE_5 = `[PROTOCOLO Y FASE ACTUAL — Sesión 5: Exposición y conducta opuesta]

Foco: actuar en dirección a los valores aunque la emoción empuje a evitar; redescubrir identidad más allá del síntoma.

Objetivos:
- Construir jerarquía de exposición (situaciones evitadas, ordenadas por dificultad).
- Aplicar conducta opuesta a la emoción problema (DBT) cuando sea apropiado.
- Redescubrimiento de valores con técnica de rejilla + máscaras O ejercicio yo real–yo ideal.
- Reforzar avances con autoevaluación honesta, no perfeccionista.

Técnicas previstas:
- Exposición graduada in vivo o imaginal.
- Conducta opuesta DBT.
- Rejilla de valores + máscaras o yo real / yo ideal.

Tarea esperada para casa:
2 exposiciones graduadas de la jerarquía O 2 acciones opuestas a la emoción evitativa.

Racional clínico:
La exposición rompe el aprendizaje evitativo y la conducta opuesta crea experiencia correctiva. El trabajo de valores da motivación duradera más allá del alivio.

---
`

const PHASE_6 = `[PROTOCOLO Y FASE ACTUAL — Sesión 6: Rumiación, preocupación y autocrítica]

Foco: cambiar la relación con los procesos repetitivos (rumiar, preocuparse, atacarse) sin pelearse con el contenido.

Objetivos:
- Practicar posponer la preocupación a una "ventana de preocupación" pactada.
- Entrenar atención flexible: salir del bucle hacia el presente.
- Sesión exclusivamente ACT: enraizamiento, desengancharse del pensamiento, contacto con valores, respiración consciente, aquí y ahora.
- Ofrecer respuesta alternativa a la voz autocrítica (autocompasión funcional, no autoindulgencia).

Técnicas previstas:
- Posponer preocupación + ventana.
- Anclaje sensorial (5-4-3-2-1) y respiración.
- Defusión y compromiso con valores (ACT).

Tarea esperada para casa:
Posponer preocupación a la ventana diaria + respuesta alternativa escrita ante la autocrítica cuando aparezca.

Racional clínico:
Rumiación y preocupación son procesos transdiagnósticos. Atacarlos por contenido refuerza el bucle; cambiar la relación con ellos lo desactiva.

---
`

const PHASE_7 = `[PROTOCOLO Y FASE ACTUAL — Sesión 7: Valores, identidad y plan de vida breve]

Foco: traducir valores en acciones concretas y sostenibles en las áreas que importan al paciente.

Objetivos:
- Clarificar valores por áreas de vida (relaciones, trabajo, salud, ocio, crecimiento).
- Diferenciar valor (dirección continua) vs objetivo (meta puntual).
- Definir metas SMART alineadas con valores.
- Aplicar resolución de problemas a obstáculos previsibles.

Técnicas previstas:
- Clarificación de valores por áreas.
- Distinción valor vs objetivo.
- Metas SMART.
- Resolución de problemas estructurada.

Tarea esperada para casa:
3 acciones valiosas concretas a realizar antes de la próxima sesión, alineadas con los valores priorizados.

Racional clínico:
Los valores dan sentido y dirección que sobreviven al alivio sintomático. Convertirlos en acciones SMART previene la deriva tras el final del protocolo.

---
`

const PHASE_8 = `[PROTOCOLO Y FASE ACTUAL — Sesión 8: Prevención de recaídas y cierre]

Foco: consolidar lo aprendido, anticipar señales tempranas y dejar al paciente con un plan escrito de continuidad.

Objetivos:
- Repasar la formulación inicial del caso y los cambios observados.
- Identificar señales tempranas de recaída específicas del paciente.
- Redactar plan escrito "si vuelve X haré Y" como protocolo de respuesta personal.
- Construir caja de herramientas (técnicas que mejor le funcionaron) y plan de continuidad (frecuencia de práctica, recursos, criterios para volver a consulta).

Técnicas previstas:
- Repaso de formulación.
- Mapa de señales tempranas.
- Plan escrito si-entonces.
- Caja de herramientas personal + plan de continuidad.

Tarea esperada para casa:
El plan escrito y la caja de herramientas se entregan al paciente como recurso permanente, no como "deberes". Compromiso con práctica autónoma de las técnicas elegidas.

Racional clínico:
La prevención de recaídas sostiene los avances. Tener un plan concreto antes del cierre evita que el paciente quede sin red ante la primera dificultad.

---
`

/**
 * Renderiza el bloque [PROTOCOLO Y FASE ACTUAL] que se inyecta al system
 * prompt. Cada fase ~600-1000 chars con foco, técnicas, tarea esperada y
 * racional.
 *
 * Plan 8 ADR-015: el protocolo es hardcoded. Cualquier cambio requiere PR.
 */
export function renderProtocolPhaseBlock(phase: ProtocolPhase): string {
  switch (phase) {
    case 1: return PHASE_1
    case 2: return PHASE_2
    case 3: return PHASE_3
    case 4: return PHASE_4
    case 5: return PHASE_5
    case 6: return PHASE_6
    case 7: return PHASE_7
    case 8: return PHASE_8
    default: return assertNeverPhase(phase)
  }
}

/**
 * Bloque para sesiones tras la 8 (mantenimiento).
 *
 * Plan 8 T5.4 cubre la copy clínica firmada por Pablo en una iteración
 * futura. Por ahora devolvemos un placeholder con las reglas mínimas
 * (no reiniciar protocolo, conversación libre TCC/ACT, derivar al
 * supervisor ante recaída marcada).
 */
export function renderProtocolMaintenanceBlock(): string {
  return `[PROTOCOLO COMPLETADO — MANTENIMIENTO]
El paciente completó las 8 sesiones del protocolo TCC/ACT. Esta es una sesión de mantenimiento.

Reglas:
- NO reinicies el protocolo de 8 sesiones a no ser que el clínico lo haya marcado como recaída.
- Conversación libre con técnicas TCC/ACT según demanda del paciente.
- Si detectas recaída marcada (síntomas de retorno con intensidad significativa), sugiere al paciente hablarlo con el psicólogo supervisor.

(Copy de mantenimiento pendiente de firma clínica — Plan 8 T5.4.)

---
`
}
