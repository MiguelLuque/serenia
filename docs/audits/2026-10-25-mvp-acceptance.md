# Serenia: cierre de aceptación técnica —25octubre2026

Rama `codex/serenia-robust-mvp`. La aceptación sintética de BD/Auth hospedados y Next/Workflow local **está aceptada técnicamente** tras la revisión independiente final. UX, comportamiento y diagnóstico previo pertenecen a la siguiente fase que el usuario aplazó expresamente hasta cerrar esta base. Este documento sustituye como estado actual al [checkpoint24oct](2026-10-24-mvp-status.md), conservando sus fuentes y fallos históricos.

## Fuente y verificación

Fuente ejecutable `f2d69ea088403a3f3e641d20112318b54a344577`; los commits posteriores hasta `e6f6c79` sólo incorporan documentación. Lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`. Node24.14.1, Next16.4.1, React/DOM19.3.1, AI6.0.303 y Workflow4.8.13.

- Siete gates nativos24oct exit0: **758tests/65archivos**, lint, tipos, Workflowwire20payloads anteriores/24roundtrips, PostgreSQL17, auditorías y build aislado. Root leyó `serenia-verify-5MXDSq/results.json`; el revisor comprobó los logs/resultados reales. No se reetiquetan las ejecuciones anteriores que fallaron.
- Auditoría estricta refrescada25oct: producción y completa, todos los niveles0, ambos npmexit0. Evidencia privada `serenia-audit-XG209o`; reportes SHA256 `baf87cca589fb484c517ea947ef14149a97a03111356771e7aaf00cd5db92213`. Sin excepción/waiver. El registro consultado no ofrece una garantía universal o futura de ausencia de vulnerabilidades.
- [Corrección de dependencias](2026-10-24-production-dependency-patch.md): Zod4.6.6, Undici6.29.1/7.30.1 y body-parser2.4.0; diez entradas de lock. Cuatro probes reproducían fallos y dos ya pasaban como compatibilidad; seis verdes después. Los cinco advisories no se presentan como veintidós vulnerabilidades ni como cinco exploits reproducidos.
- Build hospedado aislado `7-SFAHJkzrF9ef47Bhjl7`,876archivos, agregado SHA256 `bc0ef03700d0c28d3de31bb188208916ee110dd08315caab71908c03fee6ca9f`; ruta privada `/private/tmp/serenia-hosted-build-w4zDky/project`. El build genérico es otro artefacto. Revisión independiente de fuente y build: especificación/calidad aprobadas24oct.

## Supabase: aplicación real, sin reescribir historia

Destino único Serenia `brpozobkoatabctjjadc`, organización `jhmhzzaqbzvvppwtwfhz`, Free/eu-west-1. El nombre de la organización no identifica la cuenta autenticada. Next/Workflow sólo escucha en loopback; no se publicó el frontend. [Registro de aplicación](../../supabase/hosted/application-20261024.json).

| Paquete revisado | Versión hospedada aplicada24oct | SHA256 de archivo y sentencias almacenadas |
| --- | --- | --- |
| Canónico,93.052bytes | `20261024092459` | `6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0` |
| Bandeja pendiente,5.172bytes | `20261024092547` | `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9` |
| Hechos de cuestionarios no editables,8.191bytes | `20261024203657` | `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504` |

Cada aplicación oficial tuvo preflight y postcheck, en secuencia y por root. Se conservan43entradas, incluidas las40versiones/nombres/fingerprints originales y el catálogo semántico5definiciones/65items. La primera transacción comprobó internamente filas Auth/perfiles/catálogo bloqueadas mediante agregados con nonce; no exportó sus valores. Los conteos después de fixtures no demuestran por sí solos igualdad de todos los campos de las cuentas originales. No hubo reset, push, reparación de historia ni replay de paquetes aplicados. El paquete anterior724e rechazado permanece archivado con su resultado real.

El forward de revisión conserva firma, propietario, `SECURITY DEFINER`, search_path y ACL exactos. Sólo cambia el cuerpo de119e629f… a7f83d3074a279a2740d1bf82a2977ebd para rechazar cuestionarios cambiados/omitidos en la propia RPC transaccional. Los manifiestos de preparación son snapshots históricos inmutables; el registro de aplicación separado acredita lo ejecutado.

## Aceptación del artefacto corregido25oct

Se preservaron los seis actores anteriores y sus proofs fuente27. Tras verificar y detener sólo el listener antiguo11147 se creó un estado nuevo privado con **un** actor restart, sin repetir el modo fixtures. El binario corregido recuperó el mismo run `wrun_01M5RY1CHPA2DXK3F7PKPSV4GY` tras PID31819→31879: un intento de job, un informe,23eventos, un `run_created` y tres pasos completados antes del reinicio sin repetir. El SIGKILL/launcherexit1 del checkpoint es intencional y queda separado de checkpoint0/verify0. No se reencoló ni se editaron eventos. [Proof de reinicio: SHA256](#identidades-de-evidencia).

El proveedor sintético de esa fase produjo5llamadas conversacionales y2estructuradas —un fallo previsto y una recuperación—,0rápidas/denegaciones. La lista vacía de cuestionarios era correcta para ese actor sin cuestionario. Es una prueba de integración/recuperación, no de calidad del modelo.

Root realizó después un flujo nativo nuevo bajo el actor browser original, sesión `5e1226f9-4be7-4cdf-930f-ea35fa9b2fa4`:

1. Login y sesión nueva; conversación ficticia, solicitud PHQ9 y completado: tres turnos/seis mensajes.
2. Nueve respuestas: seis valores2 y tres0, incluido el ítem9. Resultado persistido **PHQ9=12, moderate, flags[]**. Cierre voluntario, job/run completados en un intento.
3. El modelo sintético continuó devolviendo `questionnaires: []`; el informe generado y la vista clínica mostraron los hechos persistidos12/moderate. La generación activa y la alternativa comparten el cargador canónico estricto; lecturas incompletas fallan a revisión manual y la ausencia real de cuestionarios sigue siendo válida. [Arreglo de autoridad factual](2026-10-24-questionnaire-facts.md).
4. Siete llamadas directas con JWT del clínico intentaron omitir, vaciar, anular o alterar score/código/banda/flags: todas23514, sin efectos sobre informes/tareas/job. No se confía sólo en un campo de formulario de solo lectura.
5. Edición nativa de narrativa pública y nota privada; guardado revisado. Original `39c93728-e033-43ab-b6d8-f12550923d89` superseded y sucesor `8ef7bc0f-8c9a-43e2-a8fc-51f9ac725794` reviewed_modified conservan ambos12/moderate/flags[].
6. Logout clínico/login paciente y recarga: resumen público editado y una tarea; no aparecen los tres marcadores privados ni el informe interno. Captura visual privada `.cache/acceptance/hosted-patient-reviewed-final.png`; tabla clínica `.cache/acceptance/hosted-score12-reviewed-facts.png`. Logout final confirmado en `/login`.

Antes del acceso clínico inevitable/prefetch se comprobó frescamente que **todas** las sesiones eran de los siete actores generados de los dos manifiestos:7/7 antes de crear la sesión nueva y8/8 después. Se verificaron IDs únicos, ownership real y rol/fecha del clínico generado. Root fue el único escritor de fixtures/UI. No se exploraron perfiles existentes ni listas globales fuera de ese gate. El alcance clínico global del MVP está documentado, sin afirmar aislamiento por terapeuta.

La fase UI usa prefijo de proveedor24→41:3conversacionales/1estructurada/0rápidas/denegaciones. El ledger del proveedor carece de runID: la correlación usa exclusividad de la fase, timestamps y job/run exactos; ese límite permanece explícito. La evidencia previa fuente27 de Auth/JWT/HTTP/retry/revisión/cron/tipos/advisors y reinicio conserva su fecha e identidad; no se presenta como ejecutada sobref2. Su prefijo ya tiene revisión independiente y se reutiliza sin repetirlo.

## Identidades de evidencia

| Objeto privado inspeccionable localmente | SHA256 |
| --- | --- |
| Reinicio real parcheado `restart-proof.json` | `39d7d8444a01cd9e39aac80f7d1ea70dcaa4388c20bac3c4d2fa4d69081beed8` |
| Captura automática parcheada `patched-runtime-scoped-proof.json` | `e7880d7505d5cb0151024720f61e085e1cfc6ade0b4b9c966efe4b0bdacedd11` |
| Siete negativas RPC `task11-review-facts-negative-proof.json` | `9a875d40b0618b727746adf6260d07866c538fd055b52cccfa0fc90a80cabfc0` |
| Captura UI07:16:21 ya posterior a revisión | `369703bec686a8bd88905e52ef889571abe5d9f422ebde0367b183438220e073` |
| Suplemento de fase sobre ese mismo raw | `b34ba0e06fc7044ba3e354a18a35fc0cf5c6b4ea894be613609485e803c5ec8f` |

La captura07:16:21 conservó un nombre que decía before-clinical y un validador inicial exit1 porque esperaba un único draft. La revisión ya había persistido07:15:55: había dos versiones válidas. Se conservaron raw, fallo y suplemento fechado; no se rebautiza como baseline previo ni se oculta ese fallo de expectativa. Una primera aserción visual usó sólo un diff AX sin cambios y fue corregida leyendo el árbol completo antes/después de recarga; no era una pérdida del resumen en el producto.

## Cierre operativo y revisión

La primera limpieza eliminó tres pacientes y se detuvo al intentar borrar al clínico antes de otro paciente con informe revisado. Logs oficiales identifican23514/reviewed_assessment_has_reviewer, coherente con la FK reviewed_by ONDELETESETNULL. Se conserva ese fallo. La corrección externa del harness `bc3c091` ordena pacientes primero/clínico al final y verifica por ID los actores ya eliminados antes de reanudar. Regresiones del modo real con frontera Auth sintética:8fallos/5PASS antes,19/19 en dos archivos después, lint/tipos/sintaxis0. Este cambio no modifica SQL ni el binario servidor f2; su aprobación y ejecución real se registran separadamente.

Correlación final con JWT real: informe interno HTTP200/filas[], proyección pública exacta y una tarea vinculada al sucesor revisado; SHA256 `b912b8b889f000e7999998973628bfd53bbfcaee09224a622e5911ed58494817`. Root y el revisor comprobaron los datos congelados, no sólo el texto del validador.

El listener31879 se detuvo tras identificar PID/cwd/loopback, enviar SIGTERM y comprobar ESRCH/puerto libre. El handle dejó de estar disponible: el código terminal del lanzador es desconocido, no0. Tras la interrupción se comprobó de nuevo14:52:42UTC que11147/31879 estaban ausentes y no había listener3000, sin enviar más señales.

La corrección externa `bc3c091` recibió SPEC/QUALITY y clearance operacional independientes. Primero se limpió el estado nuevo restart-only14:54:07UTC, exit0; después se reanudó el original14:54:09UTC, exit0. Sus tres IDs ya borrados se verificaron ausentes; se mantuvieron sus timestamps. Se retiraron los cuatro restantes y se hizo signout global antes de cada eliminación. El primer fallo y su exit1 no se sobrescribieron. No hubo deletes SQL, relajación de constraints ni cambios de estado clínico para forzar el borrado.

Postcheck oficial14:54:35–37UTC: **2Auth/2perfiles,0usuarios/perfiles/sesionesAuth de los siete actores generados,0filas en20tablas clínicas/operativas,0jobs activos,43migraciones**. Las40originales, los tres SHA SQL almacenados, catálogo5definiciones/65items y firma/ACL/cuerpo actual7f83 de revisión coinciden. SHA256 del raw `d7d6e02675fcbd2bb7c89ddaa7e2c3a79b9d82f0b871c70d15a3eb549659dcfd`. Se conservaron artefactos y pruebas privadas; estos agregados no son backup ni prueba de igualdad de todos los campos originales después de fixtures. [Recibo técnico](../../supabase/hosted/acceptance-20261025.json).

**Revisión final: especificación y calidad aprobadas para el MVP técnico sintético completo.** El revisor continuó el mapa ya aceptado de fuente/objetos1–15 y comprobó16limpieza,17postcheck y18entrega. Tasks7/11/12 y Entrega están cerradas, sin nuevos hallazgos. [Informe literal y veredicto](2026-10-25-independent-review.md), SHA256 `8e1f4d20aec7347c42e8f5bf232956602f1504ae1a46fcec5cb3feb442b44384`. El HEAD documental revisado es48913a3; esta finalización posterior sólo archiva el veredicto y actualiza estados/checkboxes, sin cambiar producto, SQL, pruebas ni artefacto.

## Límites y siguiente fase

- [Advisors](2026-10-24-hosted-advisor-dispositions.md):11RPC autenticadas con justificación individual y tres tablas internas denegadas al cliente; no significa cero avisos. Protección de contraseñas filtradas sigue abierta, elegibilidad/configuración actual no verificadas.43INFO de FK/22índices sin uso son un inventario, sin medición representativa que justifique cambios en bloque.
- [Plataforma](2026-10-24-postgres-maintenance.md): PostgreSQL observado17.6.1.104; cobertura de backports, actualización ofrecida, backups y recuperación no comprobados. No se atribuyen44CVEs al destino sin mapping verificable.
- Local World sólo sirve a este ensayo loopback; World/colas/ingress y cron periódico productivos, SMTP/callback, tratamiento de datos, textos legales, protocolo operativo de urgencias y validación clínica requieren aceptación antes de pacientes reales.
- [IA/calidad/precio, investigación23oct](2026-10-23-model-refresh.md): evaluar el modelo actual frente a Sol6.1/Sonnet5.5 en el harness español y Decisions/Jev como auxiliares. Decisions primero en sombra es preferencia provisional de integración. Los auxiliares siguen apagados;26semillas offline no son un gold clínico aprobado ni un ganador de calidad/latencia/coste medido. No se ejecutó benchmark pagado ni se cambió el modelo paciente.
- Tras este cierre técnico, la próxima fase podrá trabajar UX de espera/error/reanudación, comportamiento conversacional y propuesta de diagnóstico previo, con criterios de aceptación propios y revisión clínica. M4 —copy de espera al llegar el contador a cero— queda registrado como seguimiento menor; no se afirma que esté corregido. Los otros menores de observador local y stderr de pruebas negativas conservan sus disposiciones.

Las decisiones técnicas y costes de equivocación están en el [registro cronológico](2026-10-24-decisions-ledger.md); las revisiones anteriores en el [archivo independiente24oct](2026-10-24-independent-review.md). No se fusiona, publica ni elimina la rama de trabajo.
