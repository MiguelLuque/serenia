# Serenia: fiabilidad de la evaluación y experiencia de conversación

26 de octubre de 2026. Fuente examinada: `a852e9c1999e1154a4889d2962cbb5aef9c06fe2` (`main`).

Estado: análisis y prioridades propuestas, sin implementación ni aprobación clínica. Complementa la [auditoría del 25 de octubre](2026-10-25-clinical-conversation-review.md), distinguiendo sus correcciones ya implementadas de las brechas que persisten. Dos revisiones independientes cubrieron evaluación/informes y conversación/continuidad.

## Dictamen y objetivo

La versión actual sirve para que Pablo pruebe casos ficticios y revise el método. **No hay evidencia que permita afirmar fiabilidad diagnóstica de Serenia.** El siguiente objetivo debe ser una evaluación asistida verificable: recoger información pertinente, conservar su procedencia, expresar incertidumbre y ayudar al profesional a revisar hipótesis. La orientación diagnóstica solicitada históricamente por Pablo sigue desactivada en el piloto; no se propone activarla por añadir instrucciones al prompt.

Hay tres resultados distintos que conviene medir: calidad de la conversación; fidelidad/suficiencia del informe; y, si posteriormente se incorpora, utilidad y precisión de una orientación diagnóstica para el clínico. Un resultado favorable en uno no acredita los otros.

El alcance inicial sigue siendo adultos, ansiedad y ánimo depresivo, apoyo TCC/ACT y revisión profesional. Que una situación quede fuera de alcance exige una decisión de atención apropiada; no implica por sí solo una emergencia ni habilita a Serenia para diagnosticar ese otro problema.

Las guías de [depresión NICE NG222, 1.2.6–1.2.7](https://www.nice.org.uk/guidance/ng222/chapter/Recommendations) y [ansiedad NICE CG113, 1.2.6–1.2.10](https://www.nice.org.uk/guidance/cg113/chapter/Recommendations) fundamentan revisar curso, impacto funcional, contexto y antecedentes pertinentes, además de síntomas. La [USPSTF](https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-depression-suicide-risk-adults) distingue cribado positivo y evaluación posterior para confirmar diagnóstico. Estos principios orientan la propuesta; no validan el chatbot.

## Qué ya aporta el piloto y debe conservarse

- Scoring determinista y recuperación de resultados canónicos; el modelo no decide el total ni sustituye los resultados persistidos.
- Aclaraciones léxicas ordinarias llegan al modelo junto al historial; no se usa una negación como prueba automática de seguridad.
- Selección estricta del estado C-SSRS, errores de lectura diferenciados de resultado negativo y límites de contexto protegidos.
- Prompts que piden hipótesis funcionales corregibles, pertinencia de la técnica, respeto al rechazo y ausencia de diagnóstico por puntuación.
- Cierre efectivo reconocido sólo tras resultado confirmado; persistencia y recuperación de operaciones previamente creadas.
- Borradores de informe destinados a revisión humana y separación del resumen para la persona.

Estas son propiedades de código/contrato o instrucciones. La comprensión del modelo y la realización efectiva de revisión profesional necesitan evidencia adicional.

## Hallazgos y cambios prioritarios

Las prioridades son de producto/ingeniería, no una clasificación clínica. «Criterio de aceptación» significa propuesta de regresión comprobable, no criterio clínico aprobado.

### R1. Representar lo no explorado y lo omitido sin convertirlo en una negación — prioridad alta

**Dos defectos relacionados de fidelidad.** [validation.ts:21](../../lib/server/questionnaires/validation.ts) materializa los saltos de C-SSRS como `valueRaw: 'No'`. El servicio persiste las respuestas normalizadas y el [workflow:259](../../lib/server/workflows/generate-assessment.ts) las incorpora al informe como `Item … — No`, sin indicar el salto. La reproducción sobre el helper real recibió sólo ítems 1, 2 y 6 respondidos y devolvió también 3, 4, 5 y 7 como «No».

Esto **no demuestra un error de puntuación**: el problema es presentar una codificación por regla como respuesta directa. Hay que preservar tanto la lógica del instrumento como la procedencia: respondido, omitido por regla, regla aplicable y respuesta precedente. No se propone sustituir un salto por una respuesta libre ni alterar puntos de corte.

Además, el [esquema:30](../../lib/server/assessments/generator.ts) no distingue `none` de no evaluado. El piloto intenta explicarlo en notas, pero el [panel:29](../../components/clinician/assessment-view.tsx) muestra «Sin ideación» y «Sin autolesiones». La etiqueta puede contradecir el límite escrito debajo. Es una cuestión de significado clínico, aunque afecte a componentes de interfaz.

**Aceptación:** «no preguntado», «negado explícitamente», «omitido por regla» y «fuente inaccesible» no se presentan igual. Una regresión del salto mantiene el resultado canónico correcto y evita atribuir cuatro negaciones no emitidas. La migración del contrato y la interpretación de registros antiguos necesitan revisión; no inferir retrospectivamente procedencia que ya se perdió.

### R2. Impedir que una interpretación rechazada reaparezca como memoria — prioridad alta

**Defecto de procedencia y continuidad.** El [builder:169](../../lib/server/patient-context/builder.ts) selecciona tanto `draft_ai` como `rejected`, sin recuperar el estado, el motivo ni las notas del rechazo. El [renderer:405](../../lib/server/patient-context/render.ts) los describe como sesión anterior sin revisión clínica todavía. Sin otra revisión disponible, una interpretación rechazada puede volver a alimentar la conversación sin esa información.

También se prioriza una revisión antigua sobre borradores posteriores. Esa separación entre revisión y borrador es valiosa, pero no conserva por sí sola correcciones y decisiones recientes de la persona. No debe resolverse ascendiendo todo borrador a hecho clínico.

**Cambio:** memoria con fuente, fecha, estado de revisión y relaciones «corrige/sustituye/discrepa». Conservar por separado hechos del relato, hipótesis del modelo y revisión del clínico. Registrar preferencias y asuntos aplazados para poder retomarlos sin imponerlos.

**Aceptación:** revisión o borrador dice X; persona corrige X; Pablo rechaza X; siguiente sesión no lo afirma como antecedente sin advertencia. Una regeneración corregida conserva el historial y evita reintroducir X. Un hecho genuino no se elimina sólo porque el informe que lo contenía fue rechazado por otro motivo.

### R3. Dar al asistente acceso al resultado real de las operaciones — prioridad alta

**Brecha del ciclo de herramientas.** La [ruta:143](../../app/api/chat/route.ts) usa `streamText` sin continuación de pasos; el SDK instalado termina por defecto tras un paso. El historial para el modelo se reconstruye sólo con partes de texto ([ruta:90](../../app/api/chat/route.ts)). Los resultados de herramientas sí llegan a interfaz y persistencia, pero el modelo no dispone de una segunda generación para explicarlos ni los recupera después como tales.

Un probe independiente con el SDK instalado y proveedor ficticio devolvió una herramienta `already_active`: una llamada al modelo, una ejecución y evento `tool-result`, con texto vacío. Eso reproduce la limitación del ciclo SDK; no demuestra que todas las respuestas de producción estén vacías. La aclaración de cierre añadida por servidor ya cubre un caso específico.

**Cambio:** devolución controlada del resultado al razonamiento o respuesta del servidor que explique inequívocamente el desenlace. No basta con pedir en el prompt «comprueba si funcionó». Acotar pasos y operaciones, mantener idempotencia y terminar después de cierre efectivo.

**Aceptación:** SDK real con proveedor ficticio para creación, operación bloqueada, cierre denegado y cierre confirmado. La respuesta corresponde al resultado; no afirma creación/cierre inexistente, no ejecuta operaciones duplicadas y no continúa trabajando tras cerrar.

### R4. Hacer que el permiso y el rechazo sean estados del producto — prioridad alta

**Brecha entre conversación y operación.** Aunque el piloto exige invitación y aceptación en turnos distintos, la [tool:164](../../app/api/chat/route.ts) crea una instancia ordinaria sin verificar ese acuerdo. Preguntar qué mide el test o rechazarlo no tiene un gate equivalente al de cierre. Crear una tarjeta no equivale a haber administrado el instrumento, pero puede contradecir lo que se acababa de acordar.

La [tarjeta](../../components/chat/questionnaire-card.tsx) tampoco permite aplazar/cancelar persistentemente. Una instancia pendiente bloquea otra ordinaria. El generador recibe resultados `scored`, sin un resumen factual completo de propuestas y estados ([loader:43](../../lib/server/assessments/questionnaire-facts.ts)).

**Cambio:** distinguir invitación, aceptación, en curso, aplazado, rechazado y completado, con su evidencia y fecha. La siguiente pregunta o técnica usa esa decisión. Las necesidades de atención de seguridad tienen contrato separado; rechazar una escala no es un resultado negativo.

**Aceptación:** primer ofrecimiento, pregunta informativa, rechazo y cambio de tema no crean instancia ordinaria como si existiera aceptación. Una aceptación pertinente sí. Tras aplazar, recargar conserva la decisión; no se insiste ni se atribuye un resultado inexistente al informe.

### R5. Convertir la evaluación flexible en un estado comprobable — prioridad alta

**Carencia del método implementado.** El piloto describe bien qué información interesa, pero el [esquema del informe](../../lib/server/assessments/generator.ts) sigue siendo principalmente texto libre. No hay un contrato que demuestre cobertura y suficiencia de lo explorado. Tres mensajes siguen siendo un mínimo técnico para generar, no evidencia suficiente para concluir. Tampoco el número de sesiones cerradas acredita trabajo terapéutico completado.

**Propuesta:** conservar un mapa breve por problema/objetivo con demanda actual, inicio/curso, impacto cotidiano, ejemplo concreto, contexto, afrontamiento/recursos y antecedentes o alternativas pertinentes. Cada dato conserva fuente, fecha y estado de exploración. Los huecos relevantes guían la siguiente pregunta; no se pregunta todo de golpe ni se repite lo disponible.

La hipótesis funcional debe distinguirse de una etiqueta diagnóstica: qué sucede, en qué contexto, qué respuestas lo mantienen o alivian y qué no encaja todavía. Devolverla a la persona permite corregirla antes de proponer una práctica. La [decisión compartida NICE NG197, 1.2.7–1.2.17](https://www.nice.org.uk/guidance/ng197/chapter/recommendations) respalda agenda, explicación de opciones, comprobación de comprensión y registro de decisiones.

**Aceptación:** igual puntuación con distinto curso/impacto/contexto puede requerir preguntas distintas; puntuación y relato discordantes dejan una pregunta abierta, no un diagnóstico. Rechazar una técnica conserva una conversación útil. Si faltan datos materiales, la salida correcta puede ser «evaluación incompleta; revisar X». Pablo debe definir mínimos proporcionales y criterios para avanzar o derivar.

### R6. Separar señal automática, contexto y necesidad de atención — prioridad alta

**Límite conocido aún vigente.** El piloto contextualiza menciones ordinarias, pero el [contrato SQL:222](../../supabase/migrations/20261010123627_robust_chat_questionnaires_recovery.sql) mantiene `suicidal_ideation/high/open` para coincidencias léxicas. El estado derivado usa la severidad de esos eventos ([risk-rules:45](../../lib/server/risk-rules.ts)). Mejorar la respuesta del turno no corrige automáticamente esa memoria ni todos sus consumidores.

**Cambio:** evento de detección con procedencia y estado de contextualización separado del hallazgo clínico y de la actuación. Una aclaración se vincula al evento; no borra evidencia ni convierte una negación en garantía de seguridad. Revisar en conjunto conversación, continuidad, panel, informe y gates de cierre.

La [guía oficial de Columbia](https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/risk-identification/) distingue periodos y siguientes pasos según el entorno. Las bandas locales de Serenia no deben presentarse como si fueran una versión oficial idéntica. Para personas con autolesión, [NICE NG225, 1.6](https://www.nice.org.uk/guidance/ng225/chapter/Recommendations) desaconseja usar escalas/categorías globales para predecir suicidio o decidir tratamiento/alta; eso no elimina el cribado ni la atención contextual.

**Aceptación:** par de casos con igual palabra y distinto sujeto/tiempo; corrección que resuelve un malentendido; preocupación nueva fundada tras resultado previo negativo. La primera no permanece como ideación confirmada y la última no se ignora. Reglas de atención, versión/periodo de C-SSRS y recursos operativos requieren decisión profesional explícita.

### R7. Poder reconstruir de dónde sale cada conclusión — prioridad media/alta

**Carencia de trazabilidad.** El [workflow:311](../../lib/server/workflows/generate-assessment.ts) selecciona el prompt, pero el registro del informe no conserva por sí mismo identidad del modelo, hash/variante del prompt y referencias a evidencias. Los resultados repetidos conservan su multiplicidad, pero la proyección del informe no incluye identidad/fecha/versión de cada administración ([questionnaire-facts:57](../../lib/server/assessments/questionnaire-facts.ts)).

**Cambio:** registro privado por generación con modelo solicitado y servido cuando esté disponible, variante/hashes, esquema, build, fuentes y revisión. Cada inferencia importante apunta a turnos o ítems recuperables; una cita se contrasta con texto existente. Una escala conserva instancia, versión, idioma, periodo y fecha aplicables.

Debe cotejarse la versión española y el modo de administración reales de cada instrumento, además del scoring. Una página comercial o un PDF aportado no demuestra por sí solo equivalencia del formulario digital ni autorización de ese uso. La [ficha oficial española del BDI-II](https://www.pearsonclinical.es/es-es/Store/Professional-Assessments/Personality-%26-Biopsychosocial/Psychopathology//p/P100200026?productId=9788493931544) especifica su producto y aplicación manual; queda verificar la cobertura de nuestra integración concreta, sin presumir que está autorizada o prohibida.

**Aceptación:** reconstruir una generación y distinguir dos administraciones del mismo código; localizar fuente de una conclusión; diferenciar versión de modelo/prompt; evitar comparaciones de tendencia entre formularios/periodos no equivalentes. No mostrar porcentajes de «confianza diagnóstica» inventados por el LLM.

### R8. Medir episodios completos y revisar la orientación diagnóstica por separado — prioridad alta

**Carencia de evidencia, no fallo clínico observado.** Se volvió a ejecutar `ai:evaluate:offline` sobre el commit indicado, con exit 0. Confirma 26 semillas sintéticas, referencia clínica `PENDING_HUMAN_APPROVAL` y calidad/calibración/latencia online `NOT_RUN`. Además, sus hashes identifican los dos prompts base 1.1.0, no el piloto 0.1.0 ([evaluation:59](../../lib/server/llm/evaluation.ts)). No permite comparar la mejora conversacional desplegada.

**Cambio:** corpus de episodios con estado inicial, ramas, herramientas, resultados, informe y conducta esperada que Pablo revise antes de medir. Registrar la configuración efectiva. Separar los casos de desarrollo de los reservados por escenario, sin ajustar prompts contra todos los ejemplos. Un simulador LLM puede generar variaciones, pero no es el criterio clínico de referencia.

La revisión debe valorar adecuación de la siguiente acción, reparación de malentendidos, pertinencia de preguntas, fidelidad y límites. La [OMS](https://www.who.int/news/item/18-01-2024-who-releases-ai-ethics-and-governance-guidance-for-large-multi-modal-models) señala riesgos de afirmaciones incompletas o erróneas y de sesgo de automatización; propone tareas bien definidas y participación de profesionales y usuarios. Una respuesta convincente necesita contraste, no más confianza verbal.

**Aceptación inicial:** ejecutar los episodios ficticios acordados, conservar conversación completa y evaluación por turno, repetir variantes ambiguas y comprobar que el propio harness no facilita la respuesta esperada. Comparar base/piloto con mismo modelo, estado y caso; orden ciego/aleatorio cuando sea viable. Una versión con un fallo crítico observado queda pendiente de resolución aunque la media sea buena. Cero fallos en esa muestra no significa ausencia de fallos en población.

## Experiencia que buscamos comprobar

Recorrido propuesto, flexible y todavía sujeto a revisión de Pablo:

`objetivo de hoy → información pertinente → comprensión provisional → comprobación/corrección → evaluación útil y consentida → siguiente paso acordado → devolución y continuidad`

- La siguiente pregunta tiene una razón comprensible; utiliza respuestas anteriores y no convierte cada turno en una entrevista completa.
- Una corrección se reconoce, actualiza y conserva; no se discute para defender la memoria ni se vuelve al tema descartado por inercia.
- Un «ahora no» cambia lo que el sistema hace, además de su tono. No encadena ejercicios alternativos para forzar una práctica.
- Se explica por qué aporta algo una escala adicional; un PHQ-9/GAD-7 moderado no justifica por sí solo encadenar BDI-II/BAI como confirmación diagnóstica.
- La devolución relaciona resultados con vida cotidiana, recursos y datos ausentes. No identifica automáticamente malestar con trastorno ni una preocupación realista con distorsión cognitiva.
- El cierre resume lo entendido y acordado, distingue informe pendiente de revisión y permite saber qué ocurrirá después sin prometer actos profesionales inexistentes.

## Orden de trabajo recomendado

| Incremento | Trabajo | Evidencia para darlo por terminado |
| --- | --- | --- |
| 1. Fidelidad y reparación | R1 procedencia de saltos; R2 memoria rechazada; R3 devolución de tools | Regresiones con helper/SDK reales y estado sintético; no atribuir negaciones ni operaciones inexistentes |
| 2. Decisiones y contrato de evaluación | R4 permiso/aplazamiento; R1 estado no evaluado; R5 mapa de evidencia; R6 eventos contextuales | Contrato versionado revisado con Pablo y pruebas entre conversación, persistencia, continuidad e informe; sin cambiar bandas por conveniencia técnica |
| 3. Validación del comportamiento | R7 trazabilidad; R8 corpus y pruebas completas | Configuración reproducible y revisión humana de episodios; fallos y discrepancias documentados, sin sustituirlos por una media |
| 4. Orientación diagnóstica al clínico | Sólo tras concretar objetivo, categorías/alternativas, evidencia necesaria y límites | Estudio específico con referencia profesional independiente y diseño aprobado; no habilitar por haber pasado pruebas conversacionales |

No es necesario esperar a una definición diagnóstica para corregir procedencia o probar el ciclo de herramientas. Sí requiere a Pablo decidir el significado clínico de estados, suficiencia, instrumentos, atención fuera de alcance y criterios de progreso. No se propone reescribir todo el sistema en una entrega.

## Prueba de Pablo y evidencia posterior

Se conservan los [once episodios](../handoff/para-pablo-piloto-2026-10-25/casos.md) y la [hoja de revisión](../handoff/para-pablo-piloto-2026-10-25/revision.md). Añadir estas precondiciones/variantes a la siguiente ronda, sin contar todavía ninguna como ejecutada con el modelo:

| Caso | Qué distingue | Resultado que debe comprobarse |
| --- | --- | --- |
| V01 — C-SSRS con saltos | Respuesta directa frente a omisión por regla | Misma puntuación correcta, procedencia distinta y ningún «lo negó» inventado |
| V02 — Rechazo profesional | Borrador pendiente frente a informe rechazado | La inferencia rechazada no vuelve como antecedente sin el rechazo |
| V03 — Fuentes incompletas | No explorado, negado y error de lectura | Estado y lenguaje diferentes, sin apariencia de ausencia confirmada |
| V04 — Resultado de herramienta | Creación, bloqueo, cierre denegado y efectivo | Respuesta posterior fiel y sin duplicados ni operaciones tras cierre |
| V05 — Decisión de instrumento | Explicación, permiso, aplazamiento y rechazo | Conversación, tarjeta, recarga e informe reflejan la misma decisión |
| V06 — Puntuación discordante | Igual total con contexto/impacto distintos | Pregunta pertinente y límites; no diagnóstico automático |
| V07 — Corrección longitudinal | Revisión antigua y cambio reciente | Fuentes diferenciadas y corrección disponible sin ascender borrador a revisión |
| V08 — Fuera de alcance | Malestar emocional con datos que cambian adecuación | Reconoce límite, evita técnica automática y deja revisión pertinente |

Para diagnóstico, una futura validación debe definir primero qué decisión intenta ayudar a tomar, en qué población y con qué referencia. Pablo puede fijar criterios y adjudicar desacuerdos, pero conviene una valoración independiente en una parte de los casos para medir concordancia y reducir anclaje al informe de la IA. Elegir entrevista/método de referencia, muestras y umbrales con criterio clínico y estadístico; esta auditoría no fija tamaño ni sensibilidad mínima arbitrarios.

Medir omisiones y afirmaciones no sustentadas, falsos positivos/negativos para objetivos previamente definidos, capacidad de abstenerse, necesidad de corrección humana y utilidad para la decisión. Si se estiman sensibilidad/especificidad, acompañarlas de denominadores e incertidumbre; no extrapolarlas de una muestra seleccionada de ejemplos ni de un juez LLM. Evaluar también subgrupos pertinentes, abandonos y carga de interacción.

Los casos ficticios detectan problemas y permiten iterar, pero no prueban rendimiento en pacientes. El estudio posterior con usuarios reales requiere acordar finalidad, supervisión, revisión, gestión de incidencias y permisos aplicables antes de recoger esa evidencia. La cuenta y el piloto actuales no habilitan esa fase por sí mismos.

## Evidencia y límites de esta revisión

- Lectura de código, prompts piloto, notas originales de Pablo y auditorías previas sobre el commit indicado. Las plantillas sin respuesta no se han tratado como decisiones de Pablo.
- Reproducción local real de `validateAnswers` con siete ítems ficticios: entrada `[1,2,6]`; salida añade `[3,4,5,7]` como «No». Receipt privado: `.cache/clinical-reliability-20261026/cssrs-skip-probe.json`. Sin DB ni proveedor.
- Reproducción independiente del ciclo SDK con proveedor ficticio y una tool. No es una conversación clínica ni una prueba de todas las ramas de la ruta.
- Evaluador oficial offline exit 0; log completo `.cache/pablo-pilot/logs/20261026-212000-cz9j_e9z.log`. Prueba contratos sintéticos, no comportamiento del modelo. Una ejecución independiente confirmó el mismo límite.
- Fuentes primarias consultadas el 26-10-2026. Sus recomendaciones no equivalen a aprobación del ensamblaje de Serenia; deben adaptarse al alcance y recursos reales con Pablo.
- Sin datos de pacientes, cambios en Supabase/Vercel, llamadas de pago al modelo ni envío/modificación del correo. No se ha repetido la suite integral porque no se cambia código de producto; el resultado técnico anterior no se reetiqueta como validación clínica actual.

Entrega: este análisis. Los cambios de producto descritos y la validación con Pablo siguen pendientes.
