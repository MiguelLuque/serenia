# Task 6: evidencia de aceptación local

La base original de revisión es `84fdf48eb3ea380f48f7f8b749c1e34fbebc07bc`. El harness inicial quedó en `d3aa5a9`; el primer artefacto ejecutado fue `c1423ad`. Ninguno de estos resultados autoriza pacientes reales, despliegue ni llamadas a modelos externos.

## Artefacto actual y procedencia de la evidencia

Actualización de evidencia: 13 de octubre de 2026. El artefacto final disponible incluye las correcciones de onboarding/nombre/proveedor sintético (`c578f3b`) y acciones de revisión (`424055c`). No se ha reiniciado ni reconstruido el servidor para esta actualización documental.

| Evidencia | Fuente y resultado |
|---|---|
| Runtime actual | `a69651bf9d3877f367aa03355ce294b6b99eaf7e`, BUILD_ID `OOrpDCjjdtiUNgpwuIRTB`, PID15377, `http://127.0.0.1:3000` |
| Snapshot local final | `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-3X4baZ/project`; build de aceptación local PASS |
| Identidad común | Node24.14.1; SHA256 lock `86749cc76613926df395608ea88f243ad40a3e1e26e0ea86c1ff8df0f7c476a4` |
| Siete gates nativos | PASS exit0 en `fc85c644f4f56cf95acd7c272de49d1094c68e9f`: **703 tests,62archivos**, lint, typecheck, Workflow wire, SQL harness, auditoría con excepción exacta y build aislado |
| Equivalencia fuente | El único cambio fc85→a696 es `docs/audits/2026-10-12-hosted-execution-design.md`. Aplicación, proveedor, lock y scripts de checks son idénticos; no se atribuye el build fc85 a otro commit |
| Supabase estricto | PASS lint/advisors/tipos exactos sobre la misma base local, registrado en `db-verify-browser-fixes.log`; es evidencia del12octubre, sin afirmar una nueva ejecución el13 |
| Trazas finales | PASS28NFT: sólo dos prompts activos y package.json como assets de fuente;0env/0fuente externa |
| Replay durable | PASS **sobre c345887**, run original `wrun_01M4QQ3KQ4975P5PRBHDHYR9MD`; corte/checkpoint y recuperación automática del mismo run. Se conserva separado del nuevo artefacto |
| Smoke generado final | PASS **sobre a69651b**, sesión `c3cdf1ea-d69e-45f3-9443-53bf007f821b`, run `wrun_01M4RJ8MWWSEV2WD8H0YJKMQSE`: seis pasos completados, un job/attempt1, un draft, una llamada structured del PID15377,0denegaciones de red/modelo |

Los siete exits0 y el recuento703 se verifican en `serenia-verify-BrYljo/results.json` y `test.log`, bajo el temporal privado del sistema; resumen `.cache/acceptance/verify-reviewed-final.log`. Snapshot/build local: `build-reviewed-local.log`; trazas: `final-reviewed-prompt-trace.json`; smoke: `final-generated-smoke.log` y el JSON privado del mismo nombre. El estado `/private/tmp/serenia-acceptance-c345887` conserva su nombre histórico y sus fixtures, logs, World y pruebas originales; `runtime.json` identifica el artefacto actual, y `runtime-before-final-swap.json` conserva la identidad anterior.

El primer smoke final tenía sólo dos mensajes de usuario y activó correctamente requires_manual_review por el mínimo productivo de tres; se conserva `final-generated-smoke-short-transcript-red.log`. Una nueva conversación ficticia suficiente completó el smoke anterior sin cambiar la aplicación. Este smoke es ejecución nueva de pasos generados; **no es una nueva prueba de corte/restart/replay sobre a696**. El lifecycle, wire y código de Workflow no cambiaron desde la prueba durable c345, y el controlador autorizó esta distinción explícita.

Root completó **B01–B12** con procedencia explícita: matriz original c345887 y rechecks afectados B02/B04/B09/B12 sobre a696. Sus observaciones nativas y las correlaciones reales figuran abajo; ningún caso se marca PASS únicamente por tests de fuente. La revisión independiente de toda la base recibe esta evidencia final mediante el controlador.

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

El observer inicial leyó un archivo temporal del SDK durante rename y falló ENOENT antes de detener el servidor; un arranque duplicado falló EADDRINUSE. Se conservan como fallos del harness y se corrigen leyendo sólo .json finalizados y rechazando puerto ocupado antes de sobrescribir runtime.json. El proveedor genérico reveló una brecha real: un nuevo turno normal de alta señal con screening pendiente dependía del modelo para devolver recursos. La revisión rechazó resolverla enseñando cumplimiento al fixture. El servidor ahora detecta alta señal mediante el mismo HIGH_SIGNAL_LABELS ya aprobado y devuelve sus recursos estáticos antes de cargar contexto/invocar modelo. Mantiene la sesión no expirada abierta y el cierre crisis_detected al límite; el proveedor genérico no imita ese cumplimiento. La nueva regresión dio RED por ausencia024 y GREEN15/15 incluyendo retry/replay; la prueba HTTP exige cero llamadas conversacionales y persistencia de riesgo. La repetición posterior sobre c345 y la matriz de navegador se documentan más abajo; el PASS inicial no se relabela como otro artefacto.

## Gates externos

La aceptación local no acredita calidad clínica ni latencia/coste de modelos externos. La [investigación actualizada](2026-10-12-model-refresh.md) es documental; no cambia presets ni llama modelos. Antes de producción: revisión clínica y discrepancias de instrumentos; textos legales y tratamiento de datos aprobados; canal operativo de urgencias; migraciones y smoke del destino; World de producción e ingress de cola protegido; benchmark autorizado de modelos.

Local World carece de autenticación de cola y sigue siendo sólo desarrollo, aunque next start use NODE_ENV=production. Toda aceptación se enlaza a127.0.0.1 y emplea estado privado, URL local explícita y cuentas sintéticas. Next upstream14octubre sigue como gate externo; excepción dev GHSA-vfj7-8cjw-p6xm expira18octubre. Audit production0 no equivale a full audit limpio.

## Historial de verificación de fuente

Full verify inicial: test FAIL4/695 (tres mocks antiguos null vs default omitido y un import ESLint que superó5s con builds concurrentes); lint, typecheck, wire, SQL y audit PASS; build FAIL por source tracked dirty cuando llegó a ese gate. Ninguno de los dos fallos se oculta. Focales corregidos53/53 PASS y timeout exacto PASS sin ampliarlo; suite posterior60archivos/695tests PASS. Build local7a5c843 PASS. En ese punto los gates finales y navegador estaban pendientes; los resultados posteriores conservan su propia identidad en las secciones de c345 y artefacto actual.

## Artefacto c345887: matriz original y replay durable

En c345887 los siete gates de verify pasaron, incluidos697tests/60archivos, lint, tipos, wire, SQL, audit con excepción dev exacta y build aislado; evidencia `.cache/acceptance/verify-high-signal-final.log`, full `/private/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-8p63hm`. Build de aceptación local separadoPASS, snapshotserenia-build-s3PcS4, BUILD_IDpsXcnnhs7nJegeW8c3tqn; entonces PID5051 enlazado127.0.0.1:3000. Prompttrace26NFT con sólo los dos prompts activos ypackage.json,0env/0fuente externa. Estos son resultados históricos; la identidad actual y703tests están al inicio.

Run originalwrun_01M4QQ3KQ4975P5PRBHDHYR9MD: checkpointdurable tras tres pasos completados; PID4800→5051, mismo build/datadir/namespace/stepgeneración,23eventos/unrun_created, completo09:29:25.547Z. Cada paso completado antes del corte tiene un único step_started; HTTPflow/step y un proveedor structured postreinicio. DB confirmaunjob/run_idoriginal/attempts1 y un draft previo a revisión. RevisiónJWT completa/idempotente/proyección privadaPASS; evidencia c345887-same-run-green.json y c345887-review-green.log.

Señal nueva de alta intensidad durante screening y al límite temporal: recursos estáticos y riesgo persistido,0llamadas conversacionales; sesión normal permanece abierta, límite se cierra crisis_detected. Interrupción de fallo previo y replayPASS con0modelcalls,unriesgo/dosturnos. La comparación externa SSE se corrigió de bytes a chunks JSON semánticos porque jsonb reordena claves; se usa marcador de fallo único por actor. Evidencia c345887-safety-green.log (los dosPASS previos al fallo delprobe) y c345887-interruption-green.log. Son correcciones del runner fuera deapp; no se cambia app/provider después del commit construido.

Las fixtures originales incluyeron CSSRS y bandeja con el crítico antiguo previsto primero. Boundary requirió entrar primero en página y caducar únicamente suopened_at local después del aviso del controlador para conservar el cierre lazy legítimo; root observó el envío urgente y su cierre, con correlación única de turno/riesgo y0llamadas. El handoff original comenzó con B01–B12 NOT_RUN; la matriz posterior y los rechecks actuales mantienen identidades separadas. No se reinicia ni se resetea el stack durante la actualización documental del13octubre.

## Correcciones del handoff de navegador

El controlador observó alta de adulto, rechazo de menor y conversación persistida tras recarga en c345887. El rechazo conservaba el mensaje correcto pero React reiniciaba los campos y la casilla: el formulario ahora cancela el reset automático, manteniendo la acción y su redirect de éxito. Regresión RED→GREEN verifica todos los campos, aceptación y segundo envío con fecha corregida. Layout selecciona informal_name y reutiliza patientDisplayName para que la navegación coincida con el saludo; el test verifica fallback y precedencia del display_name existente.

El proveedor sintético confundía la confirmación automática «He completado el cuestionario.» con una petición nueva. Su predicado externo ahora acepta sólo las peticiones deliberadas documentadas; test RED→GREEN para PHQ/CSSRS y respuesta ordinaria tras completar. No se modifica el comportamiento productivo del chat ni se introduce respuesta de crisis del modelo.

Tras pérdida del proceso por reinicio del entorno, se restauró el mismo artefacto/estado a PID10935 con /login HTTP200, sin reset ni nueva prueba de checkpoint. El launcher inicial falló en sandbox con el guard genérico de puerto; lsof no mostró listener y curl devolvió000. La restauración escalada autorizada pasó; evidencia original conservada privadamente. El modo browser-renew-clocks validó las identidades ficticias y propietarios: cinco sesiones aún abiertas renovadas a17:04:11UTC, chat ya cerrado omitido. Sólo relojes y updated_at del trigger cambian; otros campos y filas completas de turnos/cuestionarios/jobs comparados sin cambios. Fallos previos de nombres de columna y trigger se conservan, separados del exit0 final.

Primera corrección de navegador c578f3b: npm test701/701,62archivos; lint0warnings; typecheckPASS. Logs completos privados `.cache/acceptance/browser-fixes-final-{test,lint,typecheck}.log` y regresiones RED/fixtures conservadas. Es un hito anterior a la corrección final de acciones de revisión424055c y su suite703; no se presenta701 como el recuento final. Los tests de fuente no sustituyen la observación de navegador.

El controlador también revisó todos los campos de riesgo y validó el nuevo resumen/acuerdo en el navegador. Correlación real JWT: draft original superseded, una versión reviewed_modified vigente, un acuerdo enlazado a ella; paciente lee cero filas de assessments y sólo la proyección available con el resumen público exacto, sin notas clínicas/riesgo ni impresión preliminar. Normal y límite urgente: un turno/mensaje/respuesta/riesgo enlazado por request_id y cero llamadas conversacionales en la ventana turno→respuesta persistida. El normal permaneció abierto en la observación inicial y luego el controlador lo cerró por user_request; el límite cerró crisis_detected. Logs y JSON completos siguen privados.

Tras refrescar una revisión, la vista aún ofrecía confirmar sin cambios/rechazar y la transacción protegida devolvía Assessment already changed. Corrección de UI424055c: esas dos acciones y el formulario de rechazo sólo aparecen en draft_ai/pending_clinician_review; editar una revisión y regenerar un rechazo conservan sus contratos. Dos regresiones RED→GREEN reproducen la actualización a reviewed_modified/reviewed_confirmed con rechazo previamente abierto. No se modifica el guard SQL ni los permisos. Suite703/703, lint y tipos PASS; el primer run test/lint simultáneo tuvo un timeout de5s del import ESLint existente (702PASS/1FAIL), preservado como `reviewed-fix-full-red.log`; el rerun sin concurrencia pasó sin ampliar el timeout. Los builds rechazados por documentación tracked pendiente se conservan (`verify-reviewed-dirty-red.log`, `build-reviewed-dirty-red.log`); el verify secuencial final y el build local limpio pasaron con sus commits indicados al inicio.

## Correlación final de cuestionarios observados en navegador

Sobre a696/BUILD_IDOOrpDCjjdtiUNgpwuIRTB, el paciente ficticio del fixture retry (`fe58df19-b4a6-481a-a0af-b7f2cd955af3`) completó en la sesión `0602ae7d-cc99-4e39-a45e-e91caba51c3d`:

| Cuestionario | Efectos reales persistidos |
|---|---|
| PHQ9 `5fcb0f81-9890-4757-9b93-ffaf375454e1` | scored, puntuación0, nueve respuestas y nueve ítems únicos, un resultado, submission_json de nueve ítems; submitted12oct17:26:10UTC |
| CSSRS `939c3bd4-f4d8-4c30-a0cf-a323da26d853` | scored, puntuación0, siete respuestas y siete ítems únicos, un resultado; tras No2 y No6, ítems3/4/5/7 normalizados No/0 tanto en submission_json aceptado como en las respuestas; submitted12oct17:28:15UTC |

Root observó las opciones nativas y los saltos de C-SSRS. La correlación del13octubre validó la identidad ficticia de Auth y el propietario exacto de la sesión mediante lecturas locales filtradas. Las confirmaciones automáticas `92d8cf0a-e2f0-4fc7-a292-a38c8642b046` y `cc109176-8467-4944-b968-707c0c77bd51`, y el turno ordinario posterior `0d18a9e8-77df-4e34-a827-670397b2dc62`, están completed/attempts1, con un mensaje de usuario y una respuesta persistida por turno; las respuestas de finalización no proponen otro cuestionario. No hay un segundo PHQ producido por el predicado anterior.

La sesión estaba cerrada por inactivity a07:07:15UTC del13octubre, tras opened_at17:25:12UTC del12; ese cierre natural después de la pausa no se reabre ni se usa para fingir una sesión activa.

Root validó el reset de C-SSRS en una nueva sesión del mismo paciente ficticio, `2ec5bd66-f886-4fbd-a109-b96af6153295`. Primer C-SSRS `df8b9086-f39a-4069-9cab-f4599200e3b8`: No1/No2 avanzó directamente a conducta (ítem6,3de4); No6 dejó Enviar (3de3); scored0, siete respuestas únicas con los saltos normalizados y un resultado. Tras la confirmación ordinaria de finalización, otra solicitud explícita en **la misma sesión** creó `7d6fd877-aa7e-4096-9308-73121bee7045`: ID distinto, proposed, cero respuestas/resultados, sin submission_json ni submitted_at. El controlador observó pregunta1de7, Sí/No sin selección, siguiente deshabilitado y el mismo estado nuevo sin selección tras reload. Turno de finalización `cefc46b6-34fc-4021-93be-7719aff34d97` completed/attempts1 con un usuario y una respuesta. La lectura posterior encontró la sesión cerrada por user_request a07:11:32UTC después del signout del controlador; no afirma que siga abierta.

Evidencia completa privada: `/private/tmp/serenia-acceptance-c345887/final-browser-questionnaires-0602ae7d-cc99-4e39-a45e-e91caba51c3d.json` y `final-browser-questionnaires-2ec5bd66-f886-4fbd-a109-b96af6153295.json` en el mismo directorio; resúmenes `.cache/acceptance/final-browser-questionnaires-{0602,2ec5}.log`. Un resultado y una respuesta por ítem acreditan efectos persistidos únicos, no un contador de peticiones HTTP. No se escribieron datos, cambiaron relojes, ejecutaron checks completos o reconstruyeron artefactos para esta correlación.

## Cierre de rechecks afectados y matriz del controlador

**B02 final PASS a696.** Actor nuevo exclusivamente ficticio `serenia-browser-final-1791875521605@example.test`, usuario `0fc7fb06-ee0c-4ddc-9b6d-cde01dfae945`. Root rellenó nombre «Perfil final ficticio», pronombres «Prefiero no decirlo», motivo ficticio, aceptación marcada y DOB2010-10-13: vio el error del servidor sobre18años y todos los campos/casilla conservados. Cambió sólo DOB1990-10-13 y completó el perfil; saludo y sidebar mostraron el nombre preferido.

Correlación de lectura con JWT real: auth.getUser coincide, un perfil complete con informal_name/pronouns=`prefer_not_say`/birth_date1990-10-13/motivo exactos, get_onboarding_ready=true. Una sola aceptación `24335c63-461f-40af-a809-ed0300fbbcf4`, technical-draft-2026-10-11, server_recorded=true, accepted_at07:14:07.329962UTC del13octubre; versión y timestamp del perfil coinciden. No se reenvió la fecha inválida ni se reescribió el perfil desde el probe. Evidencia privada `final-browser-profile.json` en el estado y `.cache/acceptance/final-browser-profile.log`. Captura nativa del controlador `.cache/acceptance/browser-profile-final.jpg`, SHA256 verificado `1ec341ec6f1a1bf70dda2aeaa40ab75ece769948cebe828e6dc511b0545c8ff5`. La fecha de calendario imposible queda acreditada separadamente por el RPC real400/code22008 para2026-02-30 con perfil/consentimiento intactos (`browser-invalid-date-correlation.json/log` del12octubre).

**B09 final PASS a696.** Root abrió como clínico la sesión revisada `ac1ca976-5eb6-41a0-acba-02622e355a43`: estado Revisado y todos los riesgos/notas privadas/resumen público/acuerdo guardados persistían. Conteos del DOM nativo: Editar1, Marcar como revisado sin cambios0, Rechazar informe0. No realizó mutación para esta comprobación. La evidencia JWT anterior mantiene dos versiones/una vigente, un acuerdo único y proyección paciente sin campos privados; la UI final demuestra la ausencia de las acciones inválidas.

| Caso del controlador | Resultado y artefacto |
|---|---|
| B01 Adulto/aceptación | PASS c345; además el nuevo perfil adulto final completa en a696 |
| B02 Edad/fecha/conservación | PASS a696 de rechazo visible, preservación y corrección; fecha imposible por GoTrue/PostgREST real, evidencia separada |
| B03 Conversación/recarga | PASS c345, mensajes persistidos |
| B04 PHQ y siguiente turno | PASS a696,9respuestas únicas/1resultado0 y conversación ordinaria tras finalización |
| B05 Error/retry | PASS c345, mismo request_id/texto, attempts2, un usuario/asistente y siguiente envío ordinario |
| B06 Recarga pendiente | PASS c345, estado autorizado, attempts1, un usuario/asistente/llamada |
| B07 Señal urgente normal/límite | PASS c345, recursos estáticos, riesgo único,0llamadas; límite crisis_detected |
| B08 Cierre/job/informe | PASS c345, cierre visible, job completo attempts1 y draft único |
| B09 Revisión clínica/acciones | Revisión y efectos PASS c345; ausencia de acciones inválidas tras revisión PASS a696 |
| B10 Proyección paciente/recarga | PASS c345, UI pública y JWT rawassessments[], proyección sin notas/riesgo/impression privados |
| B11 Bandeja global | PASS c345, crítico antiguo enero primero ante casos nuevos |
| B12 C-SSRS saltos/reset | PASS a696, primera instancia válida con normalización y segunda distinta sin selección/respuestas/resultados, también tras reload |

Estado de la entrega local: **DONE_WITH_CONCERNS**. Los concerns son los gates externos ya descritos, la excepción dev temporal y los límites declarados de la evidencia; no se declara listo para pacientes reales. El replay durable sobre c345 y el smoke generado fresco sobre a696 se conservan separados; instrumentation/lifecycle, código de Workflow y wire no cambiaron entre ambos. Esta conclusión documental no requiere rebuild: el runtime permanece PID15377/a696 y disponible para el controlador. La aprobación de publicación/producción y la resolución de revisión independiente pertenecen a sus gates respectivos.
