# Serenia: auditoría de autorización y datos (2026-10-10)

Alcance: lectura estática de migraciones, clientes Supabase, autenticación/proxy, sesiones, cuestionarios, acciones clínicas y worker de informes. No se ha conectado a la BD remota, consultado filas reales ni cambiado la aplicación o el esquema. No hay PostgreSQL/psql/initdb/pg_ctl detectados en PATH, Homebrew ni Postgres.app: las reproducciones SQL deben validarse en una BD aislada con usuarios ficticios. Los privilegios efectivos, default privileges y migraciones aplicadas en remoto siguen sin verificar.

## S01 — P0: paciente puede convertirse en clínico y obtener acceso global

Referencias: `supabase/migrations/20260419000008_rls_owner_only.sql:22-25`; `20260420000001_user_profiles_extend.sql:6`; `20260420000003_rls_clinician_read.sql:9-18`; `20260423000001_rls_clinician_write.sql:26-52,61-73`.

`user_profiles_update_own` solo obliga a conservar `user_id`; no restringe columnas. La migración posterior añade `role` y `is_clinician()` decide permisos leyendo ese campo. No existe otro trigger o REVOKE que lo proteja: el único BEFORE UPDATE del perfil es `set_updated_at` (`20260419000007_updated_at_trigger.sql:3-13`).

Reproducción propuesta en sandbox: autenticar paciente A; emitir PATCH/UPDATE de su perfil conservando user_id y poniendo `role='clinician'`; consultar perfiles, mensajes, sesiones, informes, respuestas, resultados y riesgos de B; actualizar informes de B. Las políticas de clínico permiten estos accesos globales. Depende de los GRANT efectivos de tabla, no comprobados remotamente; son los mismos necesarios para el UPDATE legítimo del onboarding.

Corrección: role en tabla privada o con privilegios de columna/trigger que solo permita cambios administrativos; no confiar en controles de UI. Añadir prueba RLS que paciente no puede mutar role y otro paciente continúa invisible tras intentarlo. Aplicar migración correctiva a la BD de destino y comprobar si hay perfiles promocionados sin autorización.

## S02 — P1: RPC privilegiada cierra sesiones ajenas usando IDs del cliente

Referencia: `supabase/migrations/20260502000006_close_session_rpc.sql:21-41,48-63`.

`close_session_atomic` es SECURITY DEFINER y compara la fila con `p_user_id`, proporcionado por quien llama. Nunca compara con `auth.uid()`. `authenticated` tiene EXECUTE explícito; no se revoca PUBLIC, por lo que con default privileges normales también puede estar accesible a anon.

Reproducción propuesta: como A, llamar RPC con sessionId y userId de B. La función encuentra la fila y actualiza sesión y conversación saltándose RLS. Conocer los UUIDs es precondición; no convierte la llamada en autorizada. La llamada desde el servicio Next que pasa user.id no protege el endpoint RPC de Supabase.

Corrección: derivar identidad dentro de SQL mediante auth.uid(), rechazar NULL, y separar una operación service-role si se necesita; revocar PUBLIC/anon; validar motivo y transición open→closed; bloquear fila y mantener cierre idempotente.

## S03 — P1: relación sesión/conversación puede cruzar pacientes y filtrar transcript vía worker

Referencias: `20260419000003_conversation_tables.sql:15-18`; `20260419000008_rls_owner_only.sql:43-46`; `lib/server/workflows/generate-assessment.ts:123-147,203-209,350-356`.

La FK `clinical_sessions.conversation_id` solo comprueba que existe la conversación. La policy de sesión solo comprueba user_id propio. Un paciente que conoce el UUID de conversación ajena puede crear/reasignar sesión propia apuntándola. El worker service-role lee mensajes por conversation_id sin revalidar el owner y guarda el resumen bajo session.user_id, legible para el atacante. Cerrar esa sesión propia con la acción normal dispara el worker; la RPC no falla si su UPDATE de conversación afecta cero filas.

Reproducción propuesta: preparar B con conversación y ≥3 mensajes; A inserta sesión propia con conversation_id de B; cerrar sesión A por la acción normal; comprobar que el informe de A deriva del transcript B. Requiere worker/LLM operativo; el flujo y ausencia de validación están confirmados estáticamente.

Corrección: FK compuestas que sellen `(conversation_id,user_id)` y relaciones de mensajes/cuestionarios/informes; WITH CHECK de pertenencia a padres; verificar owner de conversación en el worker antes de usar service-role. Las comprobaciones FK no aplican RLS por sí solas.

## S04 — P1: paciente puede fabricar un informe marcado como validado

Referencias: `20260422000004_assessments_insert_own.sql:1-2`; `lib/server/patient-context/builder.ts:159-167,270-290,417-420`.

La policy de INSERT de assessments propios no limita status/generated_by/reviewed_by/reviewed_at. Un paciente puede insertar `assessment_type='follow_up'` (evita índice único de closure), `status='reviewed_confirmed'`, `generated_by='clinician'`, fecha actual y summary_json conforme al schema. Puede omitir session_id. El builder considera esa fila el último informe clínico validado y alimenta tierA y juicio de riesgo con ella.

Corrección: impedir que el paciente persista resultados clínicos o estados de revisión; producirlos por una operación servidor autorizada; reforzar invariantes de revisión en BD y pruebas RLS contra creación de reviewed_* por paciente. `20260422000003_questionnaire_results_risk_events_insert.sql:1-6` también permite escoger libremente puntuación/banda/flags de resultados propios. `20260421000003_messages_insert_own.sql:7-13` permite falsificar mensajes assistant/system porque solo valida conversación. Estas aperturas necesitan el mismo rediseño de frontera de confianza.

## D01 — P1: editar informe vivo siempre colisiona con índice único

Referencias: `app/app/clinica/sesion/[sessionId]/actions.ts:95-122`; `20260424000004_assessment_requires_manual_review.sql:42-45`.

La acción inserta primero una nueva closure `reviewed_modified`; después marca la anterior superseded. El índice parcial permite solo una closure con status distinto de superseded/rejected. Un draft_ai o reviewed_* existente ocupa ese índice y el INSERT falla 23505 antes de alcanzar el UPDATE.

Reproducción: editar y guardar cualquier draft de cierre normal con todos los datos válidos. Corrección: operación transaccional que bloquee la versión esperada, valide relación paciente/sesión/informe, marque superseded e inserte nueva versión/tareas; conservar el índice único.

## D02 — P2: confirmar revisión duplica tareas; limpieza DELETE no está autorizada

Referencias: `20260424000001_patient_tasks.sql:59-73`; `actions.ts:244-286`.

No existe policy DELETE de patient_tasks (es intencional según comentario). markReviewedAction hace DELETE como cliente autenticado, revisa solo error y después INSERT. Con GRANT DELETE normal, RLS filtra todas las filas: cero borradas sin error. Repetir la confirmación materializa N veces las mismas tareas porque tampoco existe una clave única de idempotencia. Si DELETE no tiene GRANT, la revisión ya está confirmada antes del error, y tampoco hay transacción para restaurarla.

Corrección: decidir sustitución lógica de tareas/historial, resolverlo junto a revisión en RPC transaccional e idempotente, y usar estado esperado/versión para evitar confirmaciones simultáneas. No añadir DELETE indiscriminado solo para silenciar el error.

## D03 — P2: respuestas inválidas dejan cuestionario sin posibilidad de reintento

Referencias: `lib/shared/questionnaires/schema.ts:19-26`; `lib/server/questionnaires/service.ts:176-205,207-232,246-264`; `lib/shared/questionnaires/scoring.ts:21-28`; `app/api/questionnaires/[instanceId]/answers/route.ts:39-40`.

Zod acepta una respuesta PHQ9 aislada y valores 0..10. El servicio inserta respuestas ANTES de exigir exactamente 9 valores 0..3. POST de un solo ítem válido guarda ese ítem y luego falla en scorer. Reintentar los 9 ítems correctos falla por UNIQUE(instance_id,item_id) y no hay flujo de reparación. Un fallo posterior también puede dejar resultado y status=scored sin haber persistido risk_event; el handler bloquea reintento con 409.

Corrección: validar conjunto exacto, opciones y consistencia etiqueta→número antes de escribir; obtener valor numérico desde definición en servidor; persistir respuestas/resultados/estado/riesgo en una operación atómica e idempotente con bloqueo de instancia. Probar fallos inyectados entre cada etapa.

## O01 — P1: proxy bloquea las llamadas normales del cron

Referencias: `proxy.ts:9`; `lib/server/supabase/middleware.ts:25-35`; `app/api/internal/close-stale-sessions/route.ts:21-23,124-133`.

El matcher incluye /api/internal/close-stale-sessions. El proxy pide sesión Supabase por cookies y ese path no es público. Cron Vercel manda CRON_SECRET por Bearer sin cookie de usuario: se redirige a /login antes de entrar en el handler que valida el secreto.

Reproducción propuesta: GET del endpoint sin cookies con Bearer válido en entorno aislado; esperar respuesta del sweep, observar redirect login. Corrección: dejar llegar únicamente ese endpoint de sistema a su autenticación propia y probar con HTTP sin sesión de usuario.

## O02 — P1: fallo de enqueue tras cerrar deja sesión fuera de cualquier recuperación

Referencias: `lib/server/sessions/service.ts:199-217`; `app/api/internal/close-stale-sessions/route.ts:48-53,70-99,108-121`.

closeSession confirma cierre y captura fallo de enqueue. El comentario promete re-enqueue del cron, pero cron solo selecciona status=open. Tras fallo de envío, la sesión está closed y nunca vuelve a seleccionarse. El mismo problema ocurre si el cron cierra y luego falla su enqueue; devuelve ok:true y solo failed en contadores/logs. Las retries del worker no cubren runs que nunca arrancaron.

Corrección: outbox transaccional/pending job al cerrar, o sweep de closed sin informe/run con reintentos e idempotencia; alerta de backlog. También lazy-close y cron dejan conversations.status='active'/ended_at=NULL porque solo actualizan clinical_sessions, a diferencia de la RPC (`service.ts:42-50`, `route.ts:70-78`): consolidar todas las vías en el mismo contrato de cierre.

## M01 — P1: migración de restauración no es reproducible en BD nueva

Referencia: `supabase/migrations/20260502000005_restore_preserved_profiles.sql:17-21`; FK en `20260419000002_user_tables.sql:5`.

La restauración inserta perfiles para UUIDs históricos fijos mediante VALUES, no SELECT condicionado a existencia. En BD nueva con auth.users vacío, la FK impide aplicar el INSERT y se corta bootstrap/reset. ON CONFLICT no evita violaciones FK. Los datos personales/UUIDs se han omitido del informe.

Corrección: separar intervención histórica de una baseline reproducible; mover fixture operativa a seed/scripting explícito o filtrar por EXISTS donde corresponda. Probar todo el chain de migraciones desde cero en CI antes de cambios clínicos.

## P01 — P1 antes de pacientes reales: aceptación de privacidad no queda registrada

Referencias: `app/(auth)/actions.ts:11-26`; `components/auth/register-form.tsx:40-43`; `app/onboarding/actions.ts:32-42`; `20260419000002_user_tables.sql:11-12,22-28`.

El formulario recoge consentimiento pero registerAction solo usa email/password al crear cuenta. No persiste aceptación, texto, versión ni timestamp en consents o user_profiles. El onboarding tampoco. La casilla menciona política y términos sin enlaces. Un cliente puede usar signup directamente sin ese flag y el gating posterior solo mira onboarding_status. Esto es una carencia de evidencia del producto, no una conclusión de ilegalidad.

Corrección: texto aprobado y versionado; registro de aceptación auditable asociado a identidad; requisito verificado cerca de datos antes de conversación/intake; revisar alcance, proveedores, retención y derechos con responsable jurídico/privacidad. Existe RPC de borrado pero no se encontró flujo de UI/acción que la use. No se ha comprobado residencia efectiva, DPA, configuración de logs/backups ni borrado end-to-end.

## Verificación necesaria

Ejecutar migraciones desde cero y pruebas RLS con anon, paciente A/B y clínicos ficticios. Probar acceso directo Supabase, no solo UI/Server Actions. Probar transiciones concurrentes revisión/cierre/cuestionarios y fallos entre commit/enqueue. No considerar la suite mock de aplicación evidencia de RLS ni de constraints reales.

Documentación primaria contrastada: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [funciones Supabase](https://supabase.com/docs/guides/database/functions), [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html). Se leyó la documentación de autenticación de la versión Next instalada en node_modules y la skill Supabase. Cambios recientes del changelog no alteran los defectos de autorización identificados aquí.

## Hallazgo adicional durante integración (10/10)

La policy owner SELECT de `assessments` (migración `20260419000008_rls_owner_only.sql:89`) permite al paciente consultar la fila completa con sus notas clínicas y `preliminary_impression`, aunque la interfaz sólo muestra `patient_facing_summary`. La interfaz no constituye una frontera de campos privados. Task 3 restringirá la lectura directa y expondrá una proyección explícita del resumen revisado; probará roles en SQL. Este hallazgo es de exposición al propio paciente, distinto del acceso entre pacientes. No se consultó la BD remota.
