# Task 2 — Chat, cuestionarios y recuperación operativa

Estado: DONE_WITH_CONCERNS. Implementación local y gates de bloque terminados; revisión independiente pendiente del coordinador. Base: `65e1520ec2aa2853b21842a66d30883b0c7e368c`. Commit: `f01ec053ebb41828e42a0c79e1fdf684bffcf3da` (39 archivos de Task2).

Esta continuación recuperó el diff sustancial del implementador anterior, sin reiniciarlo ni reconstruir una historia TDD inexistente. No editó ni incluyó auditorías, aceptación, dependencias o plan del coordinador. No hubo datos remotos, secretos, LLM externo, despliegue, push o configuración global.

## Requisitos y cambios

- Frontera estricta del chat: una entrada de usuario, un texto y requestId coincidente con message.id; rechaza system/assistant/tool, archivos, partes extra e historial de cliente. Body 24.000 bytes, texto 6.000 caracteres, contexto 80.000 caracteres / 160 mensajes, respuesta 100.000 caracteres, salida 2.500 tokens, generación 45 segundos sin reintentos internos. Historial desde mensajes autorizados de sesión y conversación. No elimina silenciosamente el principio del transcript.
- Auth getUser y ownership de sesión/conversación antes de crear el writer service_role para chat, mensajes y cuestionarios. Create/touch/close de sesión son RPC autenticadas que validan ownership; los wrappers comprueban getUser y errores de autenticación. Las operaciones SQL de servicio validan padres bajo lock. Compatible con DML revocado en Task1.
- Turnos privados con lease de dos minutos, token rotatorio y máximo tres intentos; successful replay devuelve chunks AI SDK almacenados sin LLM nuevo. Buffer completo del SDK antes de commit de asistente; fallo de generación/persistencia produce HTTP503 sin asistente fantasma. Reintento fallido mantiene una sola entrada de usuario y riesgo. Herramientas de cuestionario idempotentes por turno/código.
- Propuesta de cierre persistida solo con la respuesta final. Confirmación exige propuesta del turno inmediatamente anterior, mismo motivo y texto de aceptación conservador; la tool no confirma autoridad por sí sola. `close_chat_turn` verifica, `finish_chat_turn` guarda asistente+cierre+conversación+outbox en la misma transacción. Un error posterior al cierre revierte todo. Expiración dura de una hora procesa y registra antes el último texto/riesgo.
- Señal específica nueva conserva prioridad frente a CSSRS pendiente/negativo. Si existe generación/fallo anterior, la señal específica invalida su token, marca `interrupted` y responde determinísticamente con recursos sin otro LLM; el modo urgente queda persistido y sobrevive retries. Señal específica también puede atravesar el cap ordinario de 80 turnos, siempre en modo determinista. No añade un nuevo criterio de cierre: interrupción urgente dentro de presupuesto/tiempo conserva sesión abierta; límites ya autorizados y señal registrada usan los motivos existentes.
- Tras fencing, el token antiguo no puede finalizar/asistente, cerrar, crear cuestionario ni revivir el turno mediante fail. Una propuesta local antigua no se persiste porque finish valida el token. Un cuestionario ya confirmado por SQL antes de la interrupción conserva su estado; no se revierte un efecto que era válido cuando se produjo. El LLM en vuelo no se cancela remotamente, pero queda sin autorización de escritura y tiene timeout45s; el recurso urgente no depende de su finalización.
- Validación de totalidad de respuestas, opciones numéricas/raw, duplicados y ramas CSSRS antes de writes. Scoring usa registry existente; RPC transaccional para respuestas+resultado+riesgo+estado. Retry idéntico no duplica; conflicto se rechaza. Solo proposed/in_progress bloquean; scored permite otro. CSSRS cancela el pendiente de otro código y tiene prioridad. Sin cambio de cortes clínicos.
- Cierre manual/lazy/cron usa misma RPC y outbox persistente. Endpoint exacto del cron pasa proxy sin cookie y valida CRON_SECRET; no se abre ningún prefijo adicional. Sweep cierra un lote acotado, recupera closed sin informe/trabajo y reclama como máximo10, con capacidad global SQL de dos trabajos enqueued/running y dos enqueue concurrentes por proceso. Backoff5min, lease10min al encolar/30min al empezar, máximo5 intentos. Los agotados no generan bucles de gasto.
- Regeneración guarda supersession, motivo y notas con outbox en la misma transacción. La acción deja la solicitud durable cuando falla enqueue; ya no promete una restauración ni elimina recuperación. La RPC de compensación antigua sigue compatible y solo restaura/cancela pending si no hay enqueue/running; usa ese mismo outbox.
- Worker comprueba padres también en retry; tamaño completo de transcript acotado y timeout45s/salida6.000. Camino con jobToken usa `finish_assessment_job`: lock sesión+job, comprueba token/status/lease y guarda draft o manual-review junto a completed. Token antiguo no escribe tras reclaim; retry vigente idempotente. Un resultado no superseded, incluido reviewed/rejected, no se sobrescribe. El flujo normal de dispatch siempre transmite token y contexto persistido.
- Refresh conserva cookies acumuladas y Cache-Control/Expires/Pragma al redirigir. Prompt activo `session-therapist.md` reconciliado con PHQ9/GAD7/BDI2/BAI/CSSRS; no promociona v2.1 draft ni cambia escalas. El único cambio UI es prepareSendMessagesRequest para enviar el último usuario con ID.
- Nuevas tablas tienen RLS, REVOKE y GRANT service explícitos; no SELECT paciente sobre chat_turns/outbox/proposals. El harness revoca default privileges permisivos antes de aplicar esta migración para detectar grants omitidos. RPC de recuperación estrecha authenticated+owner.

## Evidencia RED/GREEN conservada y nueva

Evidencia del implementador anterior leída, no reinventada:

- `/private/tmp/serenia-task2-boundary-red.log`: módulos boundary/validation ausentes, no tests ejecutados; GREEN posterior 2ficheros/9tests. Esto prueba contrato ausente, no un RED funcional de cada requisito.
- `/private/tmp/serenia-task2-sql-red.log`: baseline Task1 falla porque chat_turns no existe; GREEN posterior SQL8PASS. Los primeros logs de integración reflejan mocks obsoletos tras cambio a RPC; se adaptaron al contrato, manteniendo tests SQL reales para efectos.
- `/private/tmp/serenia-task2-all-tests.log`: 43/517 a14:56; focused-final6/38. No se presentan como gate final tras los cambios posteriores.

RED/GREEN nuevos de esta recuperación:

- `rtk proxy python3 scripts/test-database.py` → `/private/tmp/serenia-task2-urgent-red.log`: exit1, `Urgent retry lost deterministic mode`. Tras persistir urgent_response, esa regresión pasa. El intento sandbox previo falló antes de Docker; el RED referido es la ejecución escalada real.
- Mismo comando → `/private/tmp/serenia-task2-cap-red.log`: exit1, `turn_limit` en una señal urgente posterior al cap80. Corregido permitiendo solo respuesta urgente determinista.
- `rtk proxy npm test -- tests/sessions/service.test.ts` → `/private/tmp/serenia-task2-auth-red.log`: 2fallos al aceptar error auth con usuario stale en touch/close. GREEN `/private/tmp/serenia-task2-urgent-auth-green.log`:2ficheros/33tests junto a safety.
- `rtk proxy npm test -- tests/workflows/generate-assessment.test.ts` → `/private/tmp/serenia-task2-worker-fence-red.log`:3fallos nuevos (dos resultados stale aceptados; tercero esperaba RPC inexistente). SQL RED `/private/tmp/serenia-task2-worker-fence-sql-red.log`: falta finish_assessment_job. GREEN `/private/tmp/serenia-task2-worker-fence-green.log`:2ficheros/44tests; SQL green8PASS. Una ampliación de fixture revisión falló por `Invalid proposed tasks`; fixture corregido con proposed_tasks vacío y gate final completo.

## Verificación final de este diff

Todas estas ejecuciones terminaron exit0 y se inspeccionó la salida íntegra relevante:

1. `rtk proxy python3 scripts/test-database.py` — `/private/tmp/serenia-task2-final-sql.log`:
   - PASS migrations from empty auth.users
   - PASS authorization, ownership, closure, review, rollback and regeneration
   - PASS elevated cross-parent writes and foreign inherited task rollback
   - PASS review preserves completed/partial tasks and rejects incompatible agreements
   - PASS historical repair preserves accounts, roles, sessions and patient default
   - PASS concurrent confirm/modify and duplicate modify retry
   - PASS atomic questionnaire validation/retry/rollback, CSSRS priority, chat consent/leases and durable recovery
   - PASS concurrent quiz create/score, urgent chat fencing, assessment enqueue/worker claim and atomic completion
2. `rtk proxy npm test` — `/private/tmp/serenia-task2-final-all-tests.log`: **44 ficheros, 527 tests PASS**. Aviso Vite tsconfig plugin conocido, sin tests fallidos; limpieza asignada a Task4.
3. `rtk proxy node_modules/.bin/tsc --noEmit` — `/private/tmp/serenia-task2-final-types.log`: exit0, sin salida.
4. `rtk proxy node_modules/.bin/eslint <todos los TS/TSX modificados o nuevos del bloque>` — `/private/tmp/serenia-task2-final-lint.log`: exit0, sin avisos ni errores. Lista de archivos de commit: `/private/tmp/serenia-task2-commit-paths.txt`; 39 archivos totales.
5. `rtk git diff --check`: exit0.

SQL usa postgres:17.6-bookworm instalado, --network none, tmpfs sin volúmenes, actores ficticios y cleanup finally. Conexiones independientes compiten por creación/scoring, leases ordinarios/urgentes, enqueue/start y finalización. También prueba rollback real después de writes, relaciones privilegiadas, permisos reales, recuperación positiva generating/failed/exhausted y preservación reviewed/rejected frente a callback tardío. auth.uid es shim, no JWT real.

Project-checks inspect localizó npm test/build/lint; ejecución directa conservó logs en /private/tmp por límites de escritura del wrapper. Se leyeron RTK, instrucciones locales, brief/spec/Task1, skills project-checks/Supabase/TDD/verification y documentación Next instalada de route handlers. Referencias técnicas: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database functions](https://supabase.com/docs/guides/database/functions). Changelog.md fue solicitado pero el visor rechazó content-type; el trabajo usa contratos SQL ejercitados localmente, sin asumir cambios de plataforma no verificados.

## Contrato para Task3

POST `/api/chat` recibe `{sessionId, requestId, messages:[{id:requestId,role:'user',parts:[{type:'text',text}]}]}`. Mantener exactamente ID y texto al retry. HTTP409 = lease vivo/conflicto con turno previo; 422 = conflicto ID, exhausted/interrupted o sesión/estado incompatible; 503 = turno no completado, consultar recuperación antes de reenviar. HTTP200 contiene stream SDK ya persistido; retries completed reproducen chunks sin generación.

`supabase.rpc('get_chat_turn_recovery',{p_session_id})` como authenticated devuelve null si no hay unresolved, o `{requestId,text,status:'generating'|'failed',canRetry,leaseUntil}`. Auth y propiedad se validan dentro de la función. canRetry exige intentos<3 y failed o lease vencido. Recuperación positiva se verificó en SQL con rol authenticated. No devuelve tokens ni estado operativo de otras sesiones. El anterior `interrupted` ya no es unresolved: no se reintenta y no aparece en esta proyección; el turno urgente lo sustituye. Un intento explícito de reenviar el ID interrupted devuelve422. No etiquetar interrupted como retryable.

El control de UI para abandonar espera puede enviar un NUEVO mensaje; solo una señal nueva específica de seguridad puede interrumpir un unresolved en SQL. Mensaje ordinario nuevo mientras exista unresolved devuelve409: no presentar la interrupción como cancelación universal. Al agotar3 intentos, mostrar estado no reintentable y salida/recarga adecuada; cron conserva cierre/recuperación. El último mensaje de usuario ya existe en BD, por lo que Task3 debe evitar duplicarlo al rehidratar.

El contexto clínico privado del chat se construye con service_role solo después de requireOwnedSession; Task3 puede restringir SELECT de assessments al paciente. El envío del resultado y la UX de formularios siguen a cargo de Task3; las firmas de create/start/submitQuestionnaire y sesiones se conservan. PrepareSendMessagesRequest ya adaptado, sin otros cambios UI.

## Concerns y límites exactos

- Build final, navegador con transporte sintético y aceptación del artefacto corresponden a consolidación/Task3-4; no ejecutados ni declarados PASS aquí. Falta revisión independiente del coordinador.
- No Supabase remoto, GoTrue/JWT/PostgREST, advisers o ejecución real del scheduler/Workflow durable. Los tests de workflow llaman funciones bajo Vitest; SQL comprueba efecto transaccional y concurrencia real. Aplicar migración solo en integración revisada, junto al resto del cambio; no aplicar aislada sobre una app que mantiene writers anteriores.
- Helpers internos persistAssessmentStep/recordManualReviewStep conservan firma previa y aceptan token opcional: cuando hay token usan el fence atómico; sin token mantienen el camino legacy para compatibilidad de llamadas internas/tests. El dispatch normal actual siempre pasa token. Ejecuciones antiguas sin jobToken no quedan cubiertas por el nuevo fence; se debe revisar/drenar cualquier workflow histórico al desplegar. Sin despliegue en este bloque.
- Lease/fencing evita escrituras obsoletas, no garantiza cancelar una llamada LLM ya iniciada. Los límites acotan nuevas generaciones; el transporte bufferizado retrasa la primera respuesta visible hasta commit. Retries tras fallo antes del commit pueden volver a generar dentro del máximo3; solo completed garantiza replay sin otro LLM.
- Outbox exhausted tras5 intentos y turnos agotados requieren intervención/UX explícita; no se ocultan como éxito ni se reintentan infinitamente. La recuperación periódica requiere CRON_SECRET y cron realmente configurado (fuera de verificación local).
- C-SSRS conserva items, reglas de salto y scoring existentes. Ventanas temporales/copy clínica y disponibilidad real de revisión humana mantienen los gates de aprobación clínica del plan. Sin promoción de borradores ni cortes nuevos.


## Corrección de revisión independiente — ronda 1/5

Fecha: 2026-10-11. Base de implementación `f01ec053ebb41828e42a0c79e1fdf684bffcf3da`; HEAD previo al fix `e7f5176` solo añadió documentación del controlador. Revisión recibida: `.superpowers/sdd/2026-10-10-robust-mvp/task-2-review.md`, ambos veredictos Needs fixes; no Critical. Esta ronda resuelve I1, I2 e I3; requiere scoped re-review independiente del coordinador. Commit de corrección: `dfeea23ec5e0892a9098a06762a86f1392fb2e43` (11 archivos).

### I1 — La segunda comprobación de presupuesto elimina la respuesta de seguridad

El historial, avisos, prompt y contexto privado se preparan dentro de una única frontera de fallo. La segunda comprobación de presupuesto conserva el mismo fallback determinista de seguridad que la primera. Una señal registrada recibe024/112 con200 y cero llamadas LLM si el historial cabe pero el prompt final no, o si falla la lectura/construcción del contexto. Las respuestas urgentes y por límite temporal se producen antes de cualquier lectura de contexto innecesaria. Un fallo del contexto por sí solo conserva la sesión abierta; el presupuesto excesivo conserva el criterio de cierre por crisis ya existente. No se cambian cortes, detector, escalas o motivos clínicos.

Los tests usan ahora un prompt sintético de tamaño significativo y el harness simula límites reales de lectura y errores de historial/safety/prompt. La variante opcional de contexto privado también se verifica: recursos deterministas, sin generación y sin cierre por la mera indisponibilidad del contexto. Se resuelve así también el Minor del fixture reducido. El fallo de persistencia del fallback conserva el contrato de error503; no se muestra un asistente no guardado.

### I2 — El cierre externo no fija el transcript antes de generar el informe

Política elegida: el cierre externo invalida los turnos pendientes bajo el mismo lock de sesión, antes de publicar el outbox. Conserva el texto/riesgo admitido, marca generating/failed como interrupted, rota token y borra propuesta pendiente. El cierre y motivo autorizados que llegan primero se mantienen; no se reemplaza unilateralmente un motivo ya confirmado. El token antiguo no puede escribir respuesta ni reintentar el turno tras cerrar. El worker solo puede reclamar cuando ya es visible el transcript estable.

`finish_chat_turn` exige sesión abierta y valida cierre antes de escribir. Para cierre del propio turno, inserta asistente, marca completed y llama al cierre común dentro de la misma transacción; así su respuesta no se interrumpe a sí misma y no hay ventana entre transcript y outbox. Un trigger de INSERT de messages bloquea la sesión y exige open, cubriendo también los helpers de escritura anteriores con service_role. No añade permisos ni deja un writer tardío mediante ese camino.

Inactivity se revalida contra last_activity_at bajo el lock de sesión y conserva el umbral de30min. Un candidato con actividad renovada se rechaza con23514/`Session activity resumed`, sin cierre ni outbox. Cron ya ignora los candidatos rechazados y continúa. Lazy-close reconoce exclusivamente ese resultado y reconsulta la sesión autorizada actual en lugar de tratarla como cerrada o fallar la página. Firmas de RPC y helpers se conservan. El fixture anterior de Task1 que cerraba por inactivity una sesión recién creada se ajusta para representar31min reales de inactividad; no cambia su objetivo de autorización/regeneración.

La regresión SQL demuestra: begin → cierre externo → claim y lectura de transcript → finish tardío rechazado; compara transcript completo, motivo y riesgo conservados; rechaza también INSERT de un writer legacy y retry del turno interrumpido. Una prueba de fallo sintético del outbox después de insertar el asistente demuestra rollback conjunto de asistente, completed, sesión, conversación y outbox; quitado el fallo, el mismo turno termina correctamente.

La prueba de dos conexiones observa `pg_stat_activity.wait_event=PgSleep` solo después de touch con lock en una transacción. El cierre de un candidato stale se lanza entonces y debe esperar ese lock; tras commit del touch rechaza inactivity y no crea job. La barrera tiene deadline5s: una ejecución que no logra observarla falla, no pasa por inferencia temporal.

### I3 — El límite de lectura puede excluir el nuevo turno sin detectar truncación

El sentinel se verifica sobre filas crudas antes de filtrar partes/roles:161 filas implican contexto incompleto. Además, el userMessageId devuelto por begin_chat_turn debe estar en el resultado leído. Con cualquiera de esas condiciones, el modelo no se ejecuta con un historial silenciosamente recortado: texto ordinario devuelve503 recuperable explícito y señal de seguridad usa el fallback de recursos. La regresión usa162 filas heredadas con dos tool-only en las primeras161; también cubre ausencia del mensaje admitido por debajo del sentinel.

### RED funcional y GREEN de esta ronda

- `rtk proxy npm test -- tests/chat/safety-flow.test.ts tests/api/chat-route.test.ts`: `/private/tmp/serenia-task2-r1-context-red.log`, exit1, **7fallos nuevos/18pass** con código anterior. Fallaban presupuesto final, historial/safety/prompt indisponibles, sentinel con texto ordinario/crisis y ausencia de mensaje admitido. GREEN intermedio `/private/tmp/serenia-task2-r1-context-green.log`,25pass.
- `rtk proxy npm test -- tests/chat/cross-session-context.test.ts`: `/private/tmp/serenia-task2-r1-private-context-red.log`, exit1, **1fallo/13pass** al restaurar temporalmente el catch anterior que ignoraba el fallo privado; faltaba024. Rama corregida restaurada antes de GREEN final.
- `rtk proxy python3 scripts/test-database.py`: `/private/tmp/serenia-task2-r1-close-red.log`, exit1, **REGRESSION: accepted select finish_chat_turn(...Late assistant...)** después de cierre/claim. Tras corregir fencing, `/private/tmp/serenia-task2-r1-inactivity-red.log`, exit1, **REGRESSION: accepted close_session_atomic(...inactivity)** después de touch. Ambos son fallos funcionales contra PostgreSQL real, no ausencia de contratos.
- `rtk proxy npm test -- tests/sessions/service.test.ts`: `/private/tmp/serenia-task2-r1-lazy-red.log`, exit1, **1fallo/24pass**, lazy-close propagaba `Session activity resumed` en lugar de devolver sesión abierta.

Gates finales observados, todos exit0:

1. `rtk proxy npm test -- tests/chat/safety-flow.test.ts tests/api/chat-route.test.ts tests/sessions/service.test.ts tests/chat/close-session-tools.test.ts tests/chat/cross-session-context.test.ts tests/app/close-stale-sessions.test.ts` — `/private/tmp/serenia-task2-r1-focused-final.log`: **6ficheros,77tests PASS**. Aviso Vite tsconfig permanece asignado a Task4.
2. `rtk proxy python3 scripts/test-database.py` — `/private/tmp/serenia-task2-r1-sql-final.log`: **9PASS**, los ocho bloques anteriores más `PASS concurrent touch/inactivity lock revalidation preserves active session without outbox`. Incluye nuevo rollback del outbox después del asistente y las regresiones anteriores de Task1/Task2.
3. `rtk proxy node_modules/.bin/tsc --noEmit` — `/private/tmp/serenia-task2-r1-types.log`: exit0 sin salida.
4. `rtk proxy node_modules/.bin/eslint app/api/chat/route.ts lib/server/sessions/service.ts tests/api/chat-route.test.ts tests/chat/safety-flow.test.ts tests/chat/cross-session-context.test.ts tests/helpers/chat-harness.ts tests/sessions/service.test.ts` — `/private/tmp/serenia-task2-r1-lint.log`: exit0 sin salida.
5. `rtk git diff --check`: exit0.

No se repitió la suite global ni build/navegador en esta ronda acotada. PostgreSQL fue efímero local, sin red/volúmenes ni datos reales. Sin despliegue, llamadas LLM pagadas, cambios globales o modificación de documentos del coordinador. Persisten los límites de Workflow histórico sin token y verificación externa del informe original. Un request en curso que pierde el cierre externo devuelve error recuperable del transporte, pero su turno queda interrupted/no-retry; Task3 debe rehidratar el estado cerrado. La revisión independiente de este fix pertenece al coordinador, no a este implementador.


## Revisión independiente inicial

# Spec Compliance

- ❌ **Issues found.** La protección de seguridad ante presupuesto no cubre el prompt completo; el cierre/outbox no estabiliza el transcript ante turnos ya admitidos; la lectura acotada puede omitir el turno nuevo en una sesión heredada. Referencias y escenarios en I1–I3.
- ⚠️ **Cannot verify from diff:** gating adulto/consentimiento y lectura paciente privada/UI pertenecen a Task3; verificar allí la edad mínima de18años, recuperación con el mismo ID/texto, no duplicación al rehidratar y presentación de cierre/error. El build, transporte SDK en navegador y scheduler/Workflow durable deben pasar en la consolidación; Vitest no ejecuta sus transformaciones durables.
- ⚠️ **Cannot verify from diff:** despliegues históricos sin jobToken. Las funciones conservan el camino sin fence (`lib/server/workflows/generate-assessment.ts:373`, `:418`); la búsqueda focalizada de callers actuales confirma que dispatch pasa token (`lib/server/workflows/index.ts:15`). El coordinador debe comprobar/drenar ejecuciones anteriores antes de desplegar, sin tratar este informe como prueba del scheduler hospedado.
- ⚠️ **Cannot verify from diff:** historia RED completa. El informe distingue honestamente los RED iniciales por módulos/tablas ausentes de las regresiones funcionales posteriores; no permite afirmar que cada escenario del brief falló por su razón funcional antes de implementarse.

# Strengths

- `lib/server/chat/request-boundary.ts:7` y `lib/server/sessions/authorization.ts:6`: frontera estricta de un usuario/un texto/ID coincidente y comprobación de identidad, sesión y conversación antes del writer elevado.
- `supabase/migrations/20261010123627_robust_chat_questionnaires_recovery.sql:137`: validación completa y locks antes de respuestas/resultado/riesgo/estado; replay idéntico, conflicto rechazado y prioridad CSSRS. `supabase/tests/chat-questionnaire-recovery.sql:29` comprueba rollback después de writes reales.
- `supabase/migrations/20261010123627_robust_chat_questionnaires_recovery.sql:188`, `:219`, `:333`: fencing de interrupción urgente y finalización de resultados; propuesta/aceptación persistentes y cierre+asistente+outbox en una transacción para el camino de cierre del propio turno. `scripts/test-database.py:120` añade conexiones concurrentes reales.
- `supabase/migrations/20261010123627_robust_chat_questionnaires_recovery.sql:285` y `lib/server/workflows/index.ts:13`: capacidad global de dos jobs, token/contexto durables, reintentos acotados y backoff. `lib/server/supabase/middleware.ts:8` preserva cookies/caché en redirects; `proxy.ts:5` exime solo el endpoint cron exacto.

# Issues

## Critical

Ninguno identificado.

## Important

**I1 — La segunda comprobación de presupuesto elimina la respuesta de seguridad.** `app/api/chat/route.ts:58`, `:62`, `:93`, `:137`. Si los mensajes ocupan menos de80.000 caracteres, el primer check deja oversized=false; añadir el prompt/safety/contexto puede superar ese límite. Una señal nueva explícita sin turno pendiente ni cap alcanzado no lleva urgent=true (SQL `:188–210`), por lo que llega al segundo check, cae al catch y devuelve503 sin024/112. El riesgo se registra, pero el paciente no recibe la respuesta determinista exigida ante presupuesto. Usar el presupuesto final dentro de la misma decisión de fallback, también cuando falla la construcción/lectura previa de contexto según el contrato de seguridad. Regresión focalizada: historial que cabe solo y excede el límite con prompt, mensaje «Voy a matarme», esperar200 con recursos y cero llamadas LLM. `tests/chat/safety-flow.test.ts:48` solo cubre historial que ya excede el límite antes del prompt.

**I2 — El cierre externo no fija el transcript antes de generar el informe.** `supabase/migrations/20261010123627_robust_chat_questionnaires_recovery.sql:78`, `:87`, `:219–229`. close_session_atomic puede cerrar y crear un job mientras un chat_turn está generating; no espera ni invalida ese turno. finish_chat_turn valida token/lease pero permite insertar un asistente cuando la sesión ya está closed. Escenario: turno admitido → cierre manual desde otra pestaña → worker lee transcript → asistente tardío hace commit. El informe puede quedar generado sin ese mensaje y no se regenera, aunque el transcript clínico ya cambió. La misma falta de sincronización afecta al candidato de cron si recupera actividad después del SELECT. Definir una política transaccional: esperar a resolver turnos admitidos antes de reclamar el informe, o cancelar/fencear y resolver esos turnos al cerrar; revalidar la inactividad bajo el lock para cierres por inactivity. Regresión SQL/orquestación: admitir turno, cerrar por camino externo, reclamar/leer informe y tratar de finalizar el turno; demostrar que no hay informe basado en un transcript que sigue cambiando. Callers actuales comprobados: `app/app/actions.ts:43` y `app/app/sesion/[id]/page.tsx:92`.

**I3 — El límite de lectura puede excluir el nuevo turno sin detectar truncación.** `app/api/chat/route.ts:54–59`. Se leen los primeros161 registros y después se descartan roles/partes sin texto antes de comprobar el límite. Una sesión heredada con más de161 mensajes y al menos dos mensajes tool-only entre los primeros161 puede producir159 mensajes de modelo; con textos cortos pasa también el check posterior con el prompt. El mensaje recién insertado por begin_chat_turn está al final y nunca llega al modelo. La nueva tabla chat_turns empieza vacía para esas sesiones, por lo que el cap80 no evita este caso. Detectar el sentinel sobre los registros leídos antes de filtrar y verificar que el userMessageId admitido está presente; al exceder el presupuesto, fallar explícitamente o responder con recursos según corresponda. Regresión focalizada:162+ registros heredados, dos tool-only en los primeros161 y nuevo texto distintivo; comprobar que se rechaza de forma explícita o se incluye el nuevo turno, nunca generación con historial silenciosamente incompleto.

## Minor

- `tests/helpers/chat-harness.ts:53`: el prompt reducido a «Active prompt» facilita que el fallo I1 pase inadvertido. Añadir fixture de presupuesto que represente el prompt final, sin depender de toda su redacción clínica.
- `/private/tmp/serenia-task2-final-all-tests.log:5`: persiste aviso de vite-tsconfig-paths. El informe lo reconoce y asigna a Task4; conservar esa limpieza como pendiente, no describir la salida de tests como pristine.

# Checks

- Revisión del paquete único `review-65e1520..f01ec05.diff`, por tramos; se recuperaron porciones que la salida de herramienta truncó. No se rederivó el diff mediante Git ni se modificaron código, índice, branch o HEAD.
- Inspecciones fuera del diff exclusivamente focalizadas: callers de writers/worker para evaluar bypass de fencing; callers del cierre para verificar I2; líneas223–229 de generate-assessment para completar el hunk cortado de lectura del transcript. No aparecieron callers productivos actuales sin token fuera de los wrappers internos citados.
- Se leyeron las evidencias ya conservadas: `/private/tmp/serenia-task2-final-all-tests.log` muestra44ficheros/527tests PASS y el aviso indicado; `/private/tmp/serenia-task2-final-sql.log` muestra los ocho PASS reportados. No se repitieron suites ni se consultó BD remota/LLM. Los escenarios I1–I3 son trazas concretas del código; sus regresiones recomendadas no se han ejecutado bajo esta revisión de solo lectura.

# Assessment

**Task quality: Needs fixes.** La frontera de confianza, las transacciones y el outbox mejoran sustancialmente la base, pero las garantías de seguridad ante presupuesto y estabilidad/completitud del transcript aún tienen huecos reproducibles. Resolver I1–I3 y aportar las regresiones focalizadas antes de integrar el siguiente bloque.


## Revisión independiente de la corrección

- **I1 — La segunda comprobación de presupuesto elimina la respuesta de seguridad — ADDRESSED.** `app/api/chat/route.ts:62`, `:90`, `:98`, `:103`: la preparación completa (historial, safety, prompt y contexto) queda dentro del catch que conserva el fallback determinista para crisis. El presupuesto final usa esa misma frontera; urgencia/tiempo la evitan en `:96`. `:52–60` persiste antes de devolver recursos y conserva error si falla el commit. Cobertura: `tests/chat/safety-flow.test.ts:39`, `:48` y `tests/chat/cross-session-context.test.ts:372`; presupuesto que solo excede al añadir prompt, errores de historial/safety/prompt y contexto privado, 024/112 y cero generaciones. El fixture explícito de prompt significativo resuelve también el Minor asociado.
- **I2 — El cierre externo no fija el transcript antes de generar el informe — ADDRESSED.** `supabase/migrations/20261010123627_robust_chat_questionnaires_recovery.sql:78`, `:91`, `:93`: el cierre bloquea la sesión, invalida generating/failed y rota tokens antes de publicar el outbox. `:238–252`: finish usa primero el mismo lock, exige open, inserta el asistente y marca completed antes del cierre del propio turno dentro de la misma transacción. Si finish gana el lock, el cierre posterior incluye su asistente; si close gana, finish encuentra token obsoleto/estado cerrado y no escribe. La repetición completed en `:241` es inocua: retorna sin insertar. El trigger `:100–109` toma ese lock antes del INSERT y exige open; un writer legacy que gana se incorpora antes de cerrar y uno que pierde se rechaza. fail_chat_turn (`:259–260`) solo toca el turno y no puede restaurar el token invalidado ni insertar mensajes. El outbox y el transcript se hacen visibles juntos al commit. Cobertura SQL: `supabase/tests/chat-questionnaire-recovery.sql:224–241` comprueba cierre, claim, rechazo de finish/INSERT/retry tardíos y transcript/riesgo/motivo conservados; `:257–272` verifica rollback conjunto tras fallo del outbox y posterior finalización válida.
- **I2 — Revalidación de inactivity bajo lock — ADDRESSED.** La comprobación con clock_timestamp en `supabase/migrations/20261010123627_robust_chat_questionnaires_recovery.sql:84` ocurre después del lock de sesión, compartido con touch (`:66`) y begin (`:195`, `:228`). Una actividad que gana el lock impide el cierre stale; si cierre gana, el nuevo turno/touch encuentra la sesión cerrada. `scripts/test-database.py:163–182` observa la barrera PgSleep posterior al touch antes de cerrar desde otra conexión y falla si no la observa; comprueba sesión abierta y ausencia de job. `lib/server/sessions/service.ts:42–49` reconoce exclusivamente el rechazo SQL concreto y vuelve a leer la sesión abierta autorizada. Cobertura adicional: `tests/sessions/service.test.ts:108`.
- **I3 — El límite de lectura puede excluir el nuevo turno sin detectar truncación — ADDRESSED.** `app/api/chat/route.ts:63–69` comprueba las 161 filas crudas y presencia de userMessageId antes de filtrar roles/partes. Por tanto, los tool-only heredados no ocultan el sentinel; tampoco se genera si falta el usuario admitido con menos filas. `tests/api/chat-route.test.ts:55`, `:63` cubren 162 filas heredadas, dos tool-only y ausencia del nuevo mensaje: error explícito para entrada ordinaria o fallback de crisis, siempre sin LLM.
- **New Breakage in the Fix Diff: None.** No se identifica nueva rotura Critical, Important ni Minor en esta corrección. Los documentos del controlador incluidos en el paquete no alteran el comportamiento ejecutable.
- **Out-of-Scope Observations: None nuevas.** Se conservan los cannot-verify previos: edad mínima de 18 años, consentimiento, proyección privada y recuperación/UI en Task3; build final, navegador sobre artefacto y scheduler/Workflow durable en Task3/4/consolidación. El contrato interrupted tras cierre externo requiere rehidratar el estado cerrado. La ejecución histórica sin jobToken permanece sin acreditar y debe revisarse antes de despliegue. No se amplía esta ronda con una nueva auditoría de Task2.
- **Checks — alcance:** leído una vez el paquete `review-f01ec05..dfeea23.diff` en tres tramos completos; sin rederivar Git. Lecturas posteriores solo de contexto/líneas relevantes a I1–I3, template de scoped re-review e instrucciones AGENTS/RTK/Supabase. No se han modificado implementación, índice, HEAD ni rama; este informe es la única escritura.
- **Checks — evidencia:** `/private/tmp/serenia-task2-r1-focused-final.log` contiene 6 ficheros/77 tests PASS y el aviso conocido de vite-tsconfig-paths; `/private/tmp/serenia-task2-r1-sql-final.log` contiene los 9 PASS reportados, incluida concurrencia touch/inactivity. Los logs RED conservados corroboran los siete fallos de contexto, el fallo de contexto privado, la aceptación indebida de finish tardío/inactivity y el fallo lazy. Los logs types/lint existen y están vacíos; el exit0 de esos procesos se conserva como declaración del implementador, no se infiere del archivo vacío. No se repitieron suites ni se ejecutaron pruebas nuevas: no apareció una duda concreta que exigiera otra ejecución.
- **Checks — límites del entorno:** evidencia SQL en PostgreSQL 17.6 efímero con actores ficticios y auth.uid simulado; no acredita JWT/GoTrue/PostgREST ni scheduler de Supabase hospedado. Sin BD remota, despliegues, llamadas LLM ni mensajes externos.
- **Fix round: All findings addressed, no new Critical/Important breakage.** I1, I2 e I3 cerrados para el diff `f01ec053ebb41828e42a0c79e1fdf684bffcf3da..dfeea23ec5e0892a9098a06762a86f1392fb2e43`. Los gates de aceptación integral siguen pendientes en sus bloques.
