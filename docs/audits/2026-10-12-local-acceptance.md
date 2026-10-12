# Task 6: evidencia de aceptación local

La base original de revisión es `84fdf48eb3ea380f48f7f8b749c1e34fbebc07bc`. El harness inicial quedó en `d3aa5a9`; el primer artefacto ejecutado fue `c1423ad`. Ninguno de estos resultados autoriza pacientes reales, despliegue ni llamadas a modelos externos.

## Base de datos y revisión de permisos

`db:lint --fail-on warning` detectó dos advertencias: conversión implícita text→uuid en `gdpr_erase_user` y variable no leída en `close_chat_turn`. `20261012083833_acceptance_strict_function_lint.sql` agrega un cast UUID y sustituye SELECT INTO por PERFORM manteniendo FOUND, firma y grants. Lint posterior: PASS.

Advisors estricto detectó **47 warnings**, sin exclusiones nuevas:

| Hallazgo | Instancias | Resolución |
|---|---:|---|
| auth_rls_initplan | 13 | auth.uid() pasa a subconsulta escalar: SELECT de user_profiles, consents, messages, session_summaries, patient_tasks, questionnaire_answers/results, risk_events, conversations, clinical_sessions, questionnaire_instances; UPDATE de user_profiles e INSERT profile_insert_owner mantienen USING/WITH CHECK |
| multiple_permissive_policies | 33 | Nueve pares SELECT propietario/clínico se consolidan mediante su OR original: user_profiles, conversations, clinical_sessions, questionnaire_instances, messages, questionnaire_answers/results, risk_events y patient_tasks. PUBLIC permanece PUBLIC; en tres pares el brazo propietario conserva la aplicabilidad authenticated con pg_has_role(...,'USAGE') |
| function_search_path_mutable | 1 | set_updated_at fija public,pg_temp |

La primera propuesta de aplicar una consolidación amplia junto con escrituras fue rechazada por revisión automática por riesgo de regresiones de autorización/privacidad. Esa propuesta no se ejecutó. La versión concreta corregida conserva roles, comandos, grants y los predicados efectivos; añade guards del catálogo y fue revisada antes de solicitar por separado el reset sintético local.

`20261012084307_acceptance_strict_rls_advisors.sql` se verificó primero en PostgreSQL17.6 efímero, network=none. El harness compara grants de tabla/columna/rutina y contratos no SELECT, normalizando únicamente el initplan auth.uid(); además compara **rowsets reales de nueve tablas antes/después** para propietario, otro paciente, clínico, anónimo con el mismo uid simulado y rol que hereda authenticated. PASS. Este entorno sigue usando un shim de auth.uid().

El reset local revisado aplicó migraciones y seed pero terminó exit1 por timeout de salud de Storage. Se conserva como FAIL de readiness en `.cache/acceptance/db-reset-reviewed-advisors.log`. El wrapper start reconcilió el mismo stack, exit0; no se omitieron servicios ni se usaron flags de bypass. Finalmente `db:verify` pasó lint, advisors sin findings y comparación exacta de tipos CLI2.120.0. Log privado: `.cache/acceptance/db-verify-green-final.log`.

La generación real `--local --schema public` reemplaza tipos anteriores con graphql_public y retornos editados a mano. Las llamadas opcionales omiten valores ausentes para usar su default SQL null; JSON de informes es objeto no nulo; dispatch rechaza jobs sin token antes de iniciar/liberar; la relación assessment→clinical_sessions usa su FK explícita. Typecheck y regressions focales se registran separados del build final.

GoTrue/JWT/PostgREST reales con cuentas exclusivamente ficticias: onboarding adulto/consentimiento versionado; tres fechas inválidas rechazadas; autopromoción y consentimiento directo denegados; aislamiento de sesión ajena; falsificación de assessment y lectura ajena de reportes denegadas. Matriz posterior: anónimo sin acceso a sesión/instrumentos/is_clinician, propietario lee lo propio, paciente ajeno no lee, clínico lee, cinco instrumentos compartidos visibles autenticado, service lee y paciente/clínico no escriben sesiones directamente. PASS local; no verifica configuración hospedada.

## Runtime y checkpoint

Los probes SDK utilizan POST: los handlers generados exportan POST, por lo que el GET inicial dio405. La fixture PHQ inicial usaba raw Nunca, ajeno a sus opciones reales; falló400 y se corrigió a raw0. Las validaciones de producción se mantuvieron.

En `c1423ad`, build `G0UbbLsh4JeYciPV-2xMz`, se ejecutaron chat/PHQ/retry/cierre mediante HTTP autenticado. Un fallo repetido sintético produjo correctamente requires_manual_review. Se observaron llamadas HTTP a flow/step y synthetic/structured desde el mismo PID real de Next; esto supera el smoke aislado ProviderV3.

Un escenario separado detuvo el PID98717 sólo tras observar un evento persistido step_retrying. Run original `wrun_01M4QMTAFBW61EPSFV8XGYSFA0`, sesión ficticia `a88787a7-1a97-4864-be03-c499f58fad37`. Reinicio normal del mismo artefacto/directorio a PID99387: run seguía running,14eventos, último08:49:08.952Z, sin actividad posterior salvo preload. **FAIL de recuperación automática** conservado en `.cache/acceptance/baseline-restart-red.json` y `/private/tmp/serenia-acceptance-oct12/`.

El fix `instrumentation.ts` usa register Node y getWorld().start?.(), lifecycle público documentado en Workflow4.8 e instrumentation instalado de Next16.4. El preload sólo configura el proveedor global documentado y frontera de red; no inicia Worlds ni registra handlers, modifica eventos, bundles, outbox o reencola runs. Prueba ejecutada en el artefacto `7a5c843`, BUILD_ID `22-fk6FzhlPDF7hah4ArK`: run original `wrun_01M4QNZTYC474SHYG3GV51FE1Z`, PID2175→2218, mismo directorio/namespace y step de generación. Tras step_retrying, startup normal recuperó y completó el run a09:10:24.267Z; tres pasos completados antes del corte conservan un único step_started. PASS de readiness/HTTP y replay. Job Data API conserva run_id y attempts1; revisión clínica posterior deja una versión superseded y una reviewed_modified, una sola vigente. Evidencia privada `.cache/acceptance/same-run-restart-green.json` y `same-run-db-green.json`.

El observer inicial leyó un archivo temporal del SDK durante rename y falló ENOENT antes de detener el servidor; un arranque duplicado falló EADDRINUSE. Se conservan como fallos del harness y se corrigen leyendo sólo .json finalizados y rechazando puerto ocupado antes de sobrescribir runtime.json. El proveedor genérico reveló una brecha real: un nuevo turno normal de alta señal con screening pendiente dependía del modelo para devolver recursos. La revisión rechazó resolverla enseñando cumplimiento al fixture. El servidor ahora detecta alta señal mediante el mismo HIGH_SIGNAL_LABELS ya aprobado y devuelve sus recursos estáticos antes de cargar contexto/invocar modelo. Mantiene la sesión no expirada abierta y el cierre crisis_detected al límite; el proveedor genérico no imita ese cumplimiento. La nueva regresión dio RED por ausencia024 y GREEN15/15 incluyendo retry/replay; la prueba HTTP exige cero llamadas conversacionales y persistencia de riesgo. La aceptación repetida sobre el build que incluye esos fixes sigue pendiente; el PASS anterior no se relabela como otro artefacto.

## Gates externos

La aceptación local no acredita calidad clínica ni latencia/coste de modelos externos. La [investigación actualizada](2026-10-12-model-refresh.md) es documental; no cambia presets ni llama modelos. Antes de producción: revisión clínica y discrepancias de instrumentos; textos legales y tratamiento de datos aprobados; canal operativo de urgencias; migraciones y smoke del destino; World de producción e ingress de cola protegido; benchmark autorizado de modelos.

Local World carece de autenticación de cola y sigue siendo sólo desarrollo, aunque next start use NODE_ENV=production. Toda aceptación se enlaza a127.0.0.1 y emplea estado privado, URL local explícita y cuentas sintéticas. Next upstream14octubre sigue como gate externo; excepción dev GHSA-vfj7-8cjw-p6xm expira18octubre. Audit production0 no equivale a full audit limpio.

## Verificación de fuente

Full verify inicial: test FAIL4/695 (tres mocks antiguos null vs default omitido y un import ESLint que superó5s con builds concurrentes); lint, typecheck, wire, SQL y audit PASS; build FAIL por source tracked dirty cuando llegó a ese gate. Ninguno de los dos fallos se oculta. Focales corregidos53/53 PASS y timeout exacto PASS sin ampliarlo; suite posterior60archivos/695tests PASS. Build local7a5c843 PASS; gates sobre el commit de harness/documentación final y navegador todavía pendientes.

## Artefacto final c345887 ejecutado

Todos los siete gates de verify pasan, incluidos697tests/60archivos, lint, tipos, wire, SQL, audit con excepción dev exacta y build aislado; evidencia `.cache/acceptance/verify-high-signal-final.log`, full `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-8p63hm`. Build de aceptación local separadoPASS, snapshotserenia-build-s3PcS4, BUILD_IDpsXcnnhs7nJegeW8c3tqn; servidor actualPID5051 enlazado127.0.0.1:3000. Prompttrace26NFT con sólo los dos prompts activos ypackage.json,0env/0fuente externa.

Run originalwrun_01M4QQ3KQ4975P5PRBHDHYR9MD: checkpointdurable tras tres pasos completados; PID4800→5051, mismo build/datadir/namespace/stepgeneración,23eventos/unrun_created, completo09:29:25.547Z. Cada paso completado antes del corte tiene un único step_started; HTTPflow/step y un proveedor structured postreinicio. DB confirmaunjob/run_idoriginal/attempts1 y un draft previo a revisión. RevisiónJWT completa/idempotente/proyección privadaPASS; evidencia c345887-same-run-green.json y c345887-review-green.log.

Señal nueva de alta intensidad durante screening y al límite temporal: recursos estáticos y riesgo persistido,0llamadas conversacionales; sesión normal permanece abierta, límite se cierra crisis_detected. Interrupción de fallo previo y replayPASS con0modelcalls,unriesgo/dosturnos. La comparación externa SSE se corrigió de bytes a chunks JSON semánticos porque jsonb reordena claves; se usa marcador de fallo único por actor. Evidencia c345887-safety-green.log (los dosPASS previos al fallo delprobe) y c345887-interruption-green.log. Son correcciones del runner fuera deapp; no se cambia app/provider después del commit construido.

Fixtures de navegadorpreparadas, incluyendoCSSRSreal y bandeja cuyo primero es el crítico antiguo previsto. Boundary requiere entrar primero enpágina y caducar únicamente suopened_at local después de aviso del reviewer, para conservar el cierrelazy legítimo. B01–B12 y revisión independiente permanecenNOT_RUN hasta observaciones del controlador. No se repite ni se cierra el stack durante esehandoff.

## Correcciones del handoff de navegador

El controlador observó alta de adulto, rechazo de menor y conversación persistida tras recarga en c345887. El rechazo conservaba el mensaje correcto pero React reiniciaba los campos y la casilla: el formulario ahora cancela el reset automático, manteniendo la acción y su redirect de éxito. Regresión RED→GREEN verifica todos los campos, aceptación y segundo envío con fecha corregida. Layout selecciona informal_name y reutiliza patientDisplayName para que la navegación coincida con el saludo; el test verifica fallback y precedencia del display_name existente.

El proveedor sintético confundía la confirmación automática «He completado el cuestionario.» con una petición nueva. Su predicado externo ahora acepta sólo las peticiones deliberadas documentadas; test RED→GREEN para PHQ/CSSRS y respuesta ordinaria tras completar. No se modifica el comportamiento productivo del chat ni se introduce respuesta de crisis del modelo.

Tras pérdida del proceso por reinicio del entorno, se restauró el mismo artefacto/estado a PID10935 con /login HTTP200, sin reset ni nueva prueba de checkpoint. El launcher inicial falló en sandbox con el guard genérico de puerto; lsof no mostró listener y curl devolvió000. La restauración escalada autorizada pasó; evidencia original conservada privadamente. El modo browser-renew-clocks validó las identidades ficticias y propietarios: cinco sesiones aún abiertas renovadas a17:04:11UTC, chat ya cerrado omitido. Sólo relojes y updated_at del trigger cambian; otros campos y filas completas de turnos/cuestionarios/jobs comparados sin cambios. Fallos previos de nombres de columna y trigger se conservan, separados del exit0 final.

Verificación del código corregido: npm test701/701,62archivos; lint0warnings; typecheckPASS. Logs completos privados `.cache/acceptance/browser-fixes-final-{test,lint,typecheck}.log` y regresiones RED/fixtures conservadas. Nuevo build y checks del artefacto afectado quedan pendientes hasta que el controlador termine la matriz en curso; los tests de fuente no acreditan todavía esa aceptación final. Detalle de coordinación en el informe Task6 local.

El controlador también revisó todos los campos de riesgo y validó el nuevo resumen/acuerdo en el navegador. Correlación real JWT: draft original superseded, una versión reviewed_modified vigente, un acuerdo enlazado a ella; paciente lee cero filas de assessments y sólo la proyección available con el resumen público exacto, sin notas clínicas/riesgo ni impresión preliminar. Normal y límite urgente: un turno/mensaje/respuesta/riesgo enlazado por request_id y cero llamadas conversacionales en la ventana turno→respuesta persistida. El normal permaneció abierto en la observación inicial y luego el controlador lo cerró por user_request; el límite cerró crisis_detected. Logs y JSON completos siguen privados.

Tras refrescar una revisión, la vista aún ofrecía confirmar sin cambios/rechazar y la transacción protegida devolvía Assessment already changed. Corrección de UI: esas dos acciones y el formulario de rechazo sólo aparecen en draft_ai/pending_clinician_review; editar una revisión y regenerar un rechazo conservan sus contratos. Dos regresiones RED→GREEN reproducen la actualización a reviewed_modified/reviewed_confirmed con rechazo previamente abierto. No se modifica el guard SQL ni los permisos. La identidad del nuevo artefacto y sus checks finales se registran en el informe Task6; c578f3b pasa todos los siete gates y strict db:verify pero precede esta última corrección visual.
