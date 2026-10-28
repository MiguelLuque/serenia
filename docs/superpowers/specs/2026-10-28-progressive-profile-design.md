# Perfil progresivo con fuentes y correcciones

28 octubre 2026. Petición explícita: implementar ahora el perfil descrito en la revisión del recorrido, como objetivo actual. Base `11ec2c2`; rama `codex/progressive-patient-profile`, checkout autorizado `/Users/miguelluque/git/serenia`. Se conserva todo el incremento anterior; sin publicación, datos reales, nuevos modelos ni dependencias.

## Decisión de producto

Extraer observaciones relevantes de mensajes del usuario ya guardados, sin interrumpir la conversación. Mostrar qué se recuerda, su origen y cuándo se dijo; permitir confirmar o descartar y procesar correcciones relatadas en el chat. Una observación es una cita de autorreporte, no un diagnóstico ni una conclusión clínica. Confirmarla como usuario tampoco equivale a revisión de Pablo. Los informes revisados siguen en su circuito actual.

Se consideran tres opciones: reutilizar sólo informes de cierre (no conserva hechos en sesiones cortas/interrumpidas), escribir perfil con una tool del conversador (mezcla respuesta/extracción y sus fallos), o cola transaccional y extractor separado. Se elige la tercera por durabilidad y separación de responsabilidades. Se reutiliza el patrón outbox y Workflow instalado; no se añade pgmq ni un proveedor.

Primera versión detrás de `FEATURE_PROGRESSIVE_PROFILE=on`, apagado por defecto, y activación explícita por el propio usuario. No hay backfill automático de conversaciones anteriores. El flag corta UI, dispatch y uso del contexto antes de consultar tablas nuevas. La activación en BD controla qué mensajes nuevos crean trabajos. Activar/desactivar no debe cambiar ni borrar conversaciones, escalas, informes, alertas o permisos.

## Datos y extracción

Tres tablas: `profile_settings`, `profile_extraction_jobs`, `profile_observations`. Settings: user_id,enabled,consent_epoch,updated_at. Jobs: id,user_id,source_message_id,session_id,conversation_id,source_created_at,consent_epoch,status,token,lease_until,attempts,available_at,run_id,error_code,extractor_version,model_id,created_at,updated_at. Observaciones: id,job_id,user_id,source_message_id,source_created_at,category,quote,time_scope,supersedes_id,status,created_at,updated_at.

- Categorías cerradas: `concern`, `goal`, `context`, `functioning`, `resource`, `preference`, `history`, `agreement`.
- time_scope: `current`, `historical`, `unspecified`. Current significa actual en la fecha de la fuente, no vigente para siempre.
- Estados de observación: `pending`, `confirmed`, `rejected`, `superseded`. Fuente siempre mensaje de usuario; no se atribuyen palabras del asistente a la persona. No se almacenan paráfrasis diagnósticas ni puntuaciones inferidas.
- Extractor `profile-v1`: un mensaje guardado de hasta8000 caracteres; hasta20 observaciones propias confirmed como referencias de corrección; máximo5 observaciones por resultado, cita literal de1–400 caracteres, sin repetición category+quote. Cada supersedes_id es nullable y sólo puede apuntar a una observación confirmed propia, anterior y de igual categoría. JSON estricto con campos `category`, `quote`, `time_scope`, `supersedes_id`; wrapper `observations`.
- Validación en TS y SQL de cita exacta y fuente/owner; salida completa inválida falla sin insertar parcialmente. Vacío es válido. Modelo existente `llm.structured()`, `generateText` + `Output.object`, maxOutputTokens1500,maxRetries0,timeout20s. No nuevas tools ni modelos. No imprimir texto, prompts, salidas o errores crudos del proveedor.
- El prompt excluye atribuciones a terceros, citas ajenas, hipótesis, instrucciones, diagnósticos inferidos y acuerdos sólo propuestos por la IA. Estos límites semánticos deben evaluarse también con proveedor real; validación estructural no acredita comprensión perfecta.

## Durabilidad, consentimiento y aislamiento

Trigger de inserción de messages user con sesión crea un job único por source_message_id sólo con settings.enabled. No llama a LLM/Workflow. Owner procede de la sesión/conversación, no del cliente/modelo. FKs compuestas fuente/sesión/conversación/owner y target/owner; RLS owner-only en settings/observaciones; jobs sólo service_role; mutaciones sólo RPC. Borrado del auth user o mensaje fuente elimina dependientes.

La fila settings es mutex de claim/start/finish/review/disable. Sólo un job enqueued/running por usuario mediante índice único parcial. Procesar el trabajo no terminal más antiguo por source_created_at,id; un lease vencido recupera ese mismo job con token nuevo, no adelanta otros. Lease2min, máximo3claims; intento agotado→exhausted permite avanzar. Fallo vuelve pending con30s de backoff o exhausted al tercer claim. Nunca mantener un lock durante LLM.

Opt-out incrementa consent_epoch, cancela pendientes/activos y cambia tokens; finish exige enabled,epoch y token/lease vigentes. Re-enable no resucita jobs antiguos. Retirar activación impide nuevas extracciones/usos; no puede deshacer una petición de modelo que ya comenzó. Las observaciones se conservan para poder revisarlas o descartarlas; no se promete borrado de conversaciones por desactivar memoria.

`finish_profile_job` guarda observaciones y completa job en una transacción; repetición del mismo token completado es replay sin duplicación. Tokens viejos no escriben. Settings off o fuente eliminada impiden persistencia. Claims para usuarios distintos pueden avanzar independientemente.

## Correcciones y lectura

Pending replacement deriva disputa de su target confirmed; no destruye ese registro. En contexto, el dato disputado no se presenta como confirmado y se identifica la corrección pendiente. Confirmar replacement supersede target y confirma nuevo atómicamente; otros pending siblings quedan superseded. Rechazar replacement deja reaparecer target. Conflictos de revisión son explícitos y recargables; no restaurar automáticamente un superseded.

RPC `get_profile_memory()` devuelve una sola proyección consistente del owner: enabled,pending_jobs y hasta100 observaciones recientes con `disputed`,metadata de fuente y estados. No devuelve conversación completa ni notas clínicas. El worker lee hasta20 confirmed propios como referencias de corrección. Contexto añade bloque acotado a4000 caracteres/hasta8 citas, priorizando correcciones y pertinencia léxica simple del mensaje actual, sin vectores ni nuevo LLM. Conservar etiqueta pending/confirmed por usuario, categoría y fecha; citas JSON como datos no instrucciones. La información nueva de la conversación prevalece ante conflicto. No afecta a score, fase, riesgos, permisos, tareas o cierre.

Lectura del perfil falla aislada: si no está disponible, continúa conversación sin este bloque. Una omisión por presupuesto no significa que no conste información. No se cambia el builder clínico existente ni su aprobación.

## Ejecución y experiencia

Next `after` sólo intenta despachar tras admisión guardada, incluso replay; no retrasa la respuesta. Jobs existen aunque ese intento falle. Workflow recibe sólo jobID+token; un único step carga fuente, genera, valida y persiste, devolviendo sólo IDs/contadores para no duplicar citas en historial Workflow. El step usa maxRetries0; reintentos se controlan en outbox. Después de cada ejecución se intenta despachar el siguiente trabajo propio. Cron actual recupera hasta10jobs, máximo2 dispatch concurrentes. Es un respaldo diario, no promesa de latencia. Cada mensaje nuevo vuelve a intentar recuperación propia.

Página `/app/perfil`, autenticada y disponible sólo con flag, con enlace para pacientes: «Lo que recuerda Serenia». Explica activación y límites con claridad. Muestra citas, categoría/fecha, estado extraído/confirmado por ti y disputa; acciones Confirmar/Descartar con versión esperada. Corregir texto se hace en la conversación y queda como nueva fuente; sin cuestionario extra en cada turno. Estado pendiente/fallo comprensible sin exponer leases/tokens. Navegación conserva el flujo normal. No tocar otras fricciones UX en este incremento.

## RPC contract

- `set_profile_enabled(p_enabled boolean) returns void`, authenticated owner/onboarding ready.
- `get_profile_memory() returns jsonb`, authenticated owner. DTO: `{enabled:boolean,pending_jobs:number,observations:[{id,category,quote,time_scope,status,supersedes_id,source_message_id,session_id,source_created_at,updated_at,disputed}]}`.
- `claim_profile_jobs(p_user_id uuid default null,p_limit integer default 1) returns setof profile_extraction_jobs`, service only, limit1–10.
- `start_profile_job(p_job_id uuid,p_token uuid) returns boolean`, service only, false for completed replay, otherwise fenced running transition.
- `update_profile_job(p_job_id uuid,p_token uuid,p_action text,p_run_id text default null) returns void`, service only, actions enqueued/failed, checks state/token/lease; completed enqueue acknowledgement is allowed for same token.
- `finish_profile_job(p_job_id uuid,p_token uuid,p_observations jsonb,p_model_id text) returns void`, service only, atomic/fenced/replay.
- `review_profile_observation(p_observation_id uuid,p_action text,p_expected_updated_at timestamptz) returns void`, owner, actions confirm/reject, conflict on stale version. No direct DML for authenticated clients.

## Acceptance

RED→GREEN units for validation/projection/workflow/actions/UI and source integration; SQL regressions for grants,RLS,foreign source/target,consent epochs,replay,fencing,claim order/expiry/exhaustion,review/disputes/cascades and concurrency. Generated types via local CLI; db:verify against migrated local stack in addition to seven native gates. Real local Auth/Data API + generated Workflow HTTP + synthetic provider and browser: activate, message→pending observation, confirm, correction dispute→confirm/reject, opt-out and cross-owner rejection. No patient data or real-provider quality claims. Keep flag off and no remote migrations/deployment in this goal. Provide Pablo cases for semantic extraction/corrections.
