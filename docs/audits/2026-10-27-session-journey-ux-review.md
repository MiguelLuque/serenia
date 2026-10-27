# Prueba del recorrido de sesión y revisión de experiencia

27 octubre 2026. Rama `codex/session-time-boundaries`. Resultado: mecanismos comprobados; experiencia pendiente de simplificación. No considerar este recorrido como validación clínica ni como evaluación de naturalidad del modelo real.

## Qué se ha probado ahora

Recorrido interactivo del agente principal en navegador, con el artefacto aislado `ef57d2c0527d9c524761bacf5665d6a6faa31254` (código de producto de `c18d4ea`, seguido sólo de documentación). Build local de aceptación PASS. BUILD_ID `TtPor68GVN1P0dJhw7NsC`, lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`.

Se utilizaron Auth/JWT/Data API reales de Supabase local, Next de producción y proveedor sintético del harness existente. El entorno de aceptación mantiene el flag del piloto clínico apagado: esta prueba cubre el recorrido compartido y el cierre; no prueba el diálogo del prompt piloto0.2 ni el proveedor de producción. No se introdujeron datos reales ni se modificó código de producto.

| Caso | Observación del navegador | Correlación persistida |
| --- | --- | --- |
| Inicio y continuación | Acceso con actor ficticio, Inicio y Continuar tu sesión | Usuario y sesión propios; setup comprobó rechazo entre propietarios |
| Conversación lenta | Mensaje visible y respuesta tras demora sintética de15s | Turnos completados, un mensaje de usuario y asistente por turno |
| PHQ-9 | Nueve respuestas ficticias de valor0, envío y retorno al chat | Una instancia scored,9 respuestas,1 resultado |
| Cierre manual | La respuesta anterior y un borrador distinto permanecen visibles; vuelta voluntaria al Inicio | Sesión closed/user_request;1 job de cierre |
| Fallo y reintento | Fallo controlado visible; Reintentar recupera la respuesta | Un único turno, attempts2,1 mensaje de usuario y1 de asistente |
| Respuesta que cruza el plazo | Última respuesta, aviso temporal, cierre confirmado y borrador distinto visibles | Sesión closed/time_limit; marcador de cierre en última respuesta; borrador ausente de BD;1 job |

Los tres jobs observados terminaron en estado completed. Ese estado no acredita revisión humana ni garantiza un informe en una conversación demasiado breve. El Inicio mostró que el resumen requiere revisión clínica. Se contaron9 llamadas al proveedor sintético y0 denegaciones de red del preload; no se utilizó un modelo externo.

La prueba temporal adelantó únicamente el `opened_at` de un actor ficticio local, antes de admitir el mensaje, dejando12s y una respuesta demorada15s. No se esperaron60min reales ni se evaluó el aviso conversacional de los últimos10min. Un primer ensayo modificó la fecha durante una generación ya iniciada: no representa el paso natural del tiempo sobre la fecha leída por esa petición, se conserva en la evidencia y se excluye como prueba del cruce. El segundo ensayo, con el plazo establecido antes de la admisión, sí produjo el resultado indicado.

Evidencia privada: `/private/tmp/serenia-session-journey-20261027/runtime.json`, `checks.jsonl`, `provider.jsonl`, `journey-correlation.json`. Build: `.cache/pablo-pilot/logs/20261027-204845-j3cygcwz.log`. Capturas: `.cache/session-journey/composer-mixed-draft.png`, `retry-stale-draft.png`, `manual-close-draft.png`, `time-close-draft.png`. Los scripts de correlación y preparación del reloj quedan en `.cache/session-journey/`; no imprimen claves ni consultan otras cuentas.

## Fricciones encontradas

Auditoría independiente de sólo lectura `/root/session_journey_ux_review`, contrastada con código y recorrido. Las siguientes son prioridades de experiencia antes de dar por cerrada la entrega para Pablo, no cambios ya implementados.

1. **Compositor y reintento, observado en navegador.** Mientras llega una respuesta, permanece en el cuadro el mensaje que ya se envió. Añadir una idea mezcla ambos textos; al terminar quedan juntos en el siguiente borrador. Después de recuperar un fallo, el texto original sigue en el cuadro con Enviar habilitado. No hubo duplicación en BD durante el reintento probado, pero pulsar otra vez Enviar podría iniciar un turno nuevo con ese contenido. Origen: `components/chat/chat-input.tsx:37` espera a la respuesta completa; `components/chat/chat-view.tsx:224` recupera el turno sin reconciliar el borrador. Prioridad: limpiar al admitir un envío, distinguir texto pendiente de borrador nuevo y restaurar únicamente lo que corresponda ante fallo, sin sobrescribir lo escrito después.
2. **Demasiada gestión del sistema durante una espera normal, observado en navegador.** Con un mensaje cotidiano aparecen Interrumpir espera y enviar una señal urgente y Comprobar estado guardado. El estado normal debería mostrar una espera breve y tranquila. La recuperación técnica debe presentarse cuando haga falta; el acceso a ayuda debe seguir disponible. Origen: `components/chat/chat-view.tsx:396`.
3. **Cuestionario sin corregir/aplazar y respuestas parciales frágiles.** En el navegador se comprobó avance de1a9 y envío; sólo había Siguiente/Enviar, sin volver ni aplazar. En código, `questionnaire-card.tsx:64` conserva respuestas parciales sólo en estado local y `chat-view.tsx:381` desmonta la tarjeta al vencer. La pérdida por vencimiento se identifica por código; no se ejecutó ese caso en navegador. Debe definirse una política explícita para cuestionarios ordinarios, preservando respuestas y aclarando qué está enviado. No alterar puntuaciones, saltos ni prioridad de seguridad.
4. **Final incoherente según la vía elegida.** El botón cierra sin síntesis conversacional (observado); el prompt piloto exige propuesta y turno posterior incluso ante petición directa, y una aceptación natural puede requerir otra aclaración (comprobado por código, no por modelo real en este ensayo). Si vence sin turno, la persona debe confirmar el cierre (código y pruebas automatizadas previas). Propuesta: una intención de terminar clara, una devolución breve y cierre técnico resuelto por el sistema; sin frases mágicas ni trámites para confirmar el tiempo consumido. Requiere concretar la coordinación del servidor antes de sustituir el flujo actual.
5. **Lectura del mensaje final.** El cierre por tiempo probado deja leer y volver voluntariamente. El cierre de crisis aún redirige sin borrador tras1,8s (`chat-view.tsx:285`), y la ruta de una sesión ya cerrada redirige al Inicio (`app/app/sesion/[id]/page.tsx:86`). Estos dos últimos casos se revisaron por código, no se provocaron como crisis en este ensayo. Debe permitirse leer la última orientación y decidir cuándo salir, manteniendo accesibles los recursos de ayuda.

## Recorrido propuesto para revisar

1. **Entrar y situarse.** Iniciar o continuar con una acción principal. Acordar brevemente qué necesita hoy, usando lo conocido sin repetir la entrevista inicial.
2. **Conversar.** Una pregunta principal ligada a lo contado. Incorporar una corrección sin discutirla ni reiniciar la evaluación. Al enviar, el mensaje pertenece a la conversación y queda un cuadro nuevo para otra idea.
3. **Evaluar cuando aporte.** Explicar para qué sirve una escala, pedir permiso y permitir aplazar un instrumento ordinario. Poder corregir antes de enviar; después, explicar el resultado en contexto. Una puntuación no es diagnóstico.
4. **Preparar el final.** Un aviso amable cerca del límite, seguido de recogida de lo importante. No abrir otra exploración larga ni insistir cada turno en terminar. No hace falta una tarea si no resulta pertinente o no se acordó.
5. **Cerrar con continuidad.** Resumir qué se ha entendido, qué queda pendiente y un siguiente paso real. Resolver la misma intención de cierre tanto desde la conversación como desde el botón. El sistema confirma el guardado; la persona no gestiona reintentos o confirmaciones rutinarias.
6. **Poder leer y salir.** Mantener respuesta final y borrador no enviado, sin una cuenta atrás para leer. Una acción clara para volver. Si algo falla, un mensaje sencillo, una acción principal para recuperar y conservación del texto.

## Cómo decidir que funciona

Los927 tests y siete gates de la entrega anterior acreditan su alcance técnico; no son una medición de usabilidad. Esta prueba añade navegador y correlación de datos sobre el artefacto actual, y además encuentra defectos que esos tests no cubrían.

Antes de llamarla fluida, convertir las fricciones anteriores en regresiones y repetir recorridos completos: envío mientras se escribe otra idea, fallo/reintento, corrección y aplazamiento de escala ordinaria, cuestionario al vencer, cierre natural/directo, cierre temporal sin respuesta pendiente y lectura del último mensaje. Comprobar en móvil y escritorio, con latencia, pérdida de conexión y regreso a pestaña. El cierre entre dispositivos conserva la limitación documentada en el recibo temporal.

Por separado, ejecutar casos ficticios con el modelo y prompt realmente habilitados: qué quiere la persona hoy, cambios de tema, rechazo, corrección de malentendido, discordancia entre escala y relato, referencias históricas/terceros y señales nuevas de seguridad. Pablo debe valorar pertinencia, rigor, reparación de malentendidos, ausencia de presión y naturalidad del final. Las etiquetas y criterios clínicos de aceptación deben acordarse con él; no se deduce fiabilidad diagnóstica del porcentaje de tests técnicos que pasa.

La aceptación de experiencia debe exigir que el recorrido normal se complete sin instrucciones externas ni gestión de estados técnicos, sin duplicar texto ni perder respuestas/borradores, y con un siguiente paso comprensible. Esta entrega documenta la propuesta; no declara implementada esa simplificación ni aprobado clínicamente el producto.

## Requisito añadido: perfil progresivo y continuidad

El usuario añade expresamente que debemos ir extrayendo información de la persona para construir un perfil y tenerlo en cuenta durante la evaluación. Se incorpora como una responsabilidad transversal del recorrido, no como otro formulario obligatorio.

Base existente verificada en `lib/server/patient-context/builder.ts`: datos iniciales de `user_profiles`, informe clínico revisado, borrador previo diferenciado, resultados de cuestionarios, eventos de seguridad, sesión anterior y acuerdos abiertos. El contexto se incorpora por `app/api/chat/route.ts` cuando `FEATURE_CROSS_SESSION_CONTEXT` está activo. El workflow de cierre genera un resumen estructurado en estado `draft_ai`, pendiente de revisión. Esto no acredita una extracción continua y trazable de hechos individuales: el contexto actual se reconstruye principalmente a partir de esos registros e informes, y las herramientas del chat inspeccionadas no escriben hechos de perfil por intervención. No se comprobó la configuración publicada del flag en esta revisión.

Propuesta para la siguiente iteración:

- **Recoger sólo lo relevante.** Demanda y objetivos, contexto cotidiano que importe, evolución e interferencia relatadas, recursos/apoyos, preferencias de conversación, prácticas aceptadas o rechazadas y siguientes pasos realmente acordados. Separar información relativamente estable de circunstancias y estados que pueden cambiar.
- **Conservar procedencia.** Cada dato necesita vínculo al mensaje del usuario o registro autorizado que lo respalda, sesión, fecha y periodo al que se refiere. Las palabras del asistente no son evidencia de que la persona las haya dicho. Resultados de instrumentos, relato de la persona, hipótesis de IA y conclusiones revisadas por Pablo deben seguir siendo fuentes distintas.
- **Representar lo desconocido y las correcciones.** Distinguir dato no explorado, negación explícita, información pendiente de aclarar, contradicción y dato sustituido. No convertir silencio en ausencia de síntomas ni una coincidencia de vocabulario en un rasgo o preocupación clínica confirmada. La información anterior no debe prevalecer sobre una corrección actual de la persona; una preocupación de seguridad nueva requiere su propia valoración contextual.
- **Extraer sin interrumpir.** Tras guardar una intervención, proponer actualizaciones estructuradas y contrastarlas con su fuente, sin introducir una nueva pregunta por cada campo. Preguntar sólo cuando un hueco o ambigüedad cambie el siguiente paso. La escritura del perfil no debe bloquear la respuesta ni convertir un fallo de extracción en pérdida del mensaje.
- **Devolver la comprensión en momentos naturales.** Una síntesis breve permite corregir lo entendido; no hace falta aprobar cada detalle. La persona debe comprender qué se conserva y poder corregir hechos. Una hipótesis automática no se convierte en diagnóstico ni en acuerdo aceptado.
- **Usar el perfil para elegir mejor.** Recuperar sólo lo pertinente al objetivo actual, evitar repreguntar lo ya aclarado, respetar rechazos previos y actualizar hechos que puedan haber cambiado. Un tema antiguo no domina la agenda porque esté almacenado; no repetir indefinidamente una formulación por aparecer en la memoria.

Ejemplo ficticio: «Desde que cambié de turno duermo peor» respalda un cambio de sueño relatado y su referencia temporal; no acredita insomnio crónico ni que el cambio de turno sea su causa. Si después dice «ahora duermo bien», el contexto actual debe reflejar esa actualización sin borrar la procedencia del antecedente ni seguir tratándolo como una dificultad vigente.

Criterios de evaluación del perfil: ningún hecho sin fuente; respuestas del asistente no atribuidas al usuario; ausencia de información representada como tal; correcciones que cambian el contexto de los turnos siguientes; hechos antiguos identificados por fecha; hipótesis y borradores sin promoción automática a revisión clínica; rechazo de una técnica respetado en sesiones posteriores; y dos usuarios sin contaminación de contexto. Para la continuidad, probar también una sesión corta o interrumpida sin informe generado: conservar hechos no debe depender únicamente de disponer de un resumen de cierre.

Esta ampliación registra el requisito y la propuesta, sin implementar todavía extractor, persistencia por hecho ni controles nuevos. La fiabilidad de la extracción y sus límites deben evaluarse con casos ficticios antes de incorporarla al piloto real.
