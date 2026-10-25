# Supabase hospedado: aceptación sintética

Target único: Serenia `brpozobkoatabctjjadc`, organización `jhmhzzaqbzvvppwtwfhz`, eu-west-1, Free. Next/Workflow continúa en `http://127.0.0.1:3000`; proveedor AI sintético, sin publicación/coste/pacientes reales.

Estado actual: [aceptación25octubre](../audits/2026-10-25-mvp-acceptance.md). `hosted-baseline.json` contiene los40version/name/fingerprints originales y las diez huellas semánticas de cinco instrumentos. Las seis divergencias históricas del preflight se conservan. Nunca ejecutar reset/push/repair ni replay de seeds o paquetes ya aplicados. El24oct se aplicaron oficialmente y por separado canónico6f0037fc→20261024092459, bandejad9604→20261024092547 e inmutabilidad de hechos86a461→20261024203657. Los tres SHA de sentencias almacenadas coinciden con sus archivos revisados; el mapping real está en `supabase/hosted/application-20261024.json`. Los manifiestos PREPARED son snapshots históricos inmutables y no sustituyen ese registro. Una respuesta ambigua obliga a consultar historial/esquema antes de reintentar.

`scripts/hosted-packet.mjs` concatena bytes exactos y registra offsets/SHA por sección. Antes de DDL, locks y guards rechazan historial/counts/catálogo semántico distintos, requieren cero filas clínicas y platform baseline. Un nonce aleatorio sólo vive en la tabla temporal privada; conteos y hashes agregados de filas Auth/perfiles/catálogo deben coincidir después del DDL o toda la transacción falla. No devuelve nonce, valores ni hashes individuales. PostgreSQL17 aislado demuestra rollback con mutaciones deliberadas y rechazo de drift con iguales conteos. Esto no es backup de datos ni autoriza transformaciones destructivas. Correcciones posteriores serían migraciones forward acotadas y revisadas.

La ACL exige firma/owner/SECURITY DEFINER/search_path/body hash y binding habilitado exactos, incluidos los tags `CREATE TABLE`, `CREATE TABLE AS`, `SELECT INTO` en ese orden observado, retira PUBLIC/anon/authenticated EXECUTE únicamente de los dos triggers y preserva service/platform roles. La rama local puede carecer de `rls_auto_enable`; no se crea como producto. Tests ejecutan signup, recreación del row trigger y DDL con event trigger real. Guards/local wrapper no se relajan.

El launcher separado lee privadamente de `.env.local` sólo URL y nombres modernos/legacy autorizados de clave pública/servidor. Rechaza otro origen, duplicados, interpolación y claves JWT con role/ref distintos. No modifica el archivo ni importa otros valores. `NEXT_PUBLIC_SITE_URL` se fija a loopback; valores/secretos nunca entran en logs/manifiesto/fuente. Child env usa lista positiva, telemetría off, WorkflowLocalWorld, CRON_SECRET aleatorio privado y una frontera de red sólo loopback3000/exactSupabase443.

```sh
rtk proxy node scripts/hosted-packet.mjs
rtk proxy python3 scripts/test-hosted-packet.py
rtk npm test -- tests/tooling/hosted-acceptance.test.ts
rtk proxy node scripts/hosted-build.mjs
rtk proxy node scripts/hosted-start.mjs ABS_BUILD_DIR ABS_PRIVATE_STATE_DIR
rtk proxy node scripts/hosted-run.mjs fixtures ABS_PRIVATE_STATE_DIR
rtk proxy node scripts/hosted-run.mjs http ABS_PRIVATE_STATE_DIR
rtk proxy node scripts/hosted-run.mjs restart-checkpoint ABS_PRIVATE_STATE_DIR
# Reiniciar normalmente el mismo build/state tras control structured=success privado.
rtk proxy node scripts/hosted-run.mjs restart-verify ABS_PRIVATE_STATE_DIR
rtk proxy node scripts/hosted-run.mjs review ABS_PRIVATE_STATE_DIR
rtk proxy node scripts/hosted-run.mjs cron ABS_PRIVATE_STATE_DIR
rtk proxy node scripts/hosted-run.mjs browser-fixtures ABS_PRIVATE_STATE_DIR
# Tras detener sólo el Next PID registrado y completar los jobs:
rtk proxy node scripts/hosted-run.mjs cleanup ABS_PRIVATE_STATE_DIR
```

La limpieza se ejecuta sólo después de guardar pruebas, terminar jobs y comprobar la ausencia real del runtime registrado. La corrección externa `bc3c091` elimina pacientes antes del clínico; así conserva la restricción de informes revisados que exige un reviewer. Para reanudar, verifica por ID Auth exacto la ausencia404/user_not_found de cada actor con cleanedAt antes de borrar otro; no vuelve a iniciar sesión en usuarios ya eliminados. Errores PID distintos de ESRCH, ausencia ambigua, fallo de signout o de borrado detienen el modo sin fabricar una marca de éxito. No se relajan constraints ni se cambia el estado de informes para limpiar datos de prueba. El resultado real de cada manifiesto y los conteos finales se registran aparte.

Build requiere HEAD committed, archive inmutable, dependencias instaladas/lock verificados y URL/key públicas hospedadas en build. Runtime verifica lock/public-key/build/file fingerprints y no acepta build local54321. El fingerprint excluye sólo datos de `.next/cache` y `.next/server/route-cache`; recorre ambos para rechazar symlinks, mantiene hashes de todo código compilado/fuente y rechaza boundaries que no sean directorios. Un launcher externo corregido se identifica separadamente del sourceCommit del binario original; no reconstruir/rebaselinar el artefacto para ocultar cache drift. Estado0700/archivos0600 sin symlinks. El runtime local Task6 y su prueba se preservan antes de cambiar el listener3000.

El modo fixtures crea actores nuevos admin-confirmados sin enviar email, contraseña criptográfica y manifest privado de IDs. Los modos consumen precondiciones: no repetirlos sobre actores ya usados. Promoción, lecturas privilegiadas, acciones y cleanup filtran IDs conocidos. Clínico navega sólo `/app/clinica/sesion/{fixtureSessionId}`; la landing inevitable/prefetch sólo se permite tras gate fresco que prueba todos los IDs/ownership de sesiones generadas y que el conteo ALL equivale exactamente al subconjunto ficticio, con clínico nuevo conocido y un único escritor. Sin ese gate, la UI clínica queda NOT_RUN; no se exploran perfiles existentes. Cron usa comparación global/scoped análoga, sin devolver filas ajenas. Restart observer exige actor/session/job token/runId exactos antes de detener el PID; sólo startup normal de Next recupera, sin preload World.start ni requeue/event edits. La fase25oct mantuvo los seis actores anteriores y añadió sólo un restart en estado separado: el gate UI unió ambos manifiestos; la limpieza debe cubrirlos separadamente.

Auth SMTP/callback/config y backups se inspeccionan sólo por herramientas oficiales disponibles. No extraer PAT global/role passwords/JWT signing secrets. La ausencia de read-config en MCP deja esos ajustes NOT_RUN. Leaked-password protection sigue desactivada en la captura Free: elegibilidad/configuración actual requieren comprobarse, no se cambió de plan. SECURITY DEFINER authenticated sólo se acepta con [disposición específica de cada contrato](../audits/2026-10-24-hosted-advisor-dispositions.md) y checks de actor. Avisos/performance/tipos/JWT/UI/runtime tienen evidencia separada; un gate ausente no es éxito. El build hospedado fuentef2d69ea y su reinicio/PHQ9/revisión/proyección25oct se registran separados del binario27 anterior. Producción sigue pendiente de World/colas/ingress, operación, clínica/legal y tratamiento de datos.

## Historia preservada:23octubre

Checkpoint 23 octubre 2026: la conexión oficial llegó a PostgreSQL y el paquete anterior `724e9a…` fue rechazado con SQLSTATE P0001, `Unexpected hosted event trigger definition/binding`. El guard exigía tags NULL aunque el inventario previo ya registraba tres tags; no era drift de plataforma. Root confirmó después las40huellas históricas/catálogo y2Auth/2perfiles, sin tablas nuevas/filas clínicas/queries activas. El paquete y manifiesto originales se conservan byte a byte en `supabase/hosted/archive/724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae/`, con resultado separado `SQL_REJECTED_NOT_APPLIED`.

La revisión activa `6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0` (93.052bytes) sólo cambia el sexto guard para exigir el array exacto observado. Manifiesto con `supersedes`; cinco originales de octubre, history/catalog y forward `d9604…` intactos. La fixture ahora reproduce WHEN TAG y la regresión del paquete completo en PG17 rechaza NULL/tags distintos/disabled/otra función, comprobando rollback de DDL/ACL. Estado en ese checkpoint23oct del nuevo paquete y forward: **PREPARED_NOT_APPLIED**, sustituido por las aplicaciones reales24oct indicadas al inicio. Root posee en exclusiva revisión, preflight inmediato y eventual aplicación oficial; esta corrección local no autoriza reintentos paralelos. [Evidencia de la corrección](../audits/2026-10-23-hosted-tag-guard.md); [estado general](../audits/2026-10-23-mvp-status.md).


## Historia preservada:24octubre

24 octubre: root aplicó y verificó canónico6f0037fc→20261024092459 y forwardd9604→20261024092547. El mapping separado `supabase/hosted/application-20261024.json` pertenece a root; los manifiestos preparados y archivos exactos revisados no se alteran. Se conservaron40históricas, catálogo y2Auth/2perfiles antes de fixtures. Build hospedado27f82d8 y modos reales GoTrue/JWT/HTTP/Workflow/restart/review/cron con actores nuevos pasan; no sustituir por Task6. UI/limpieza final siguen pendientes. [Corrección necesaria del guard de caché](../audits/2026-10-24-hosted-runtime-cache-guard.md): helper externo c1d78b4 frente a binario27; pruebas21/lint/types y lectura del artefacto pasan, pero ningún nuevo restart se autoriza por ese dato sin checkpoint de root/review.


La prueba final25oct usa fuente/build nuevos y un estado separado, sin reetiquetar este historial. Consultar el documento actual para sus resultados y el estado final de limpieza/revisión.
