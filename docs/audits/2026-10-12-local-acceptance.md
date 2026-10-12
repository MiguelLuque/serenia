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
