# Serenia

MVP de conversación y cuestionarios con revisión clínica. Node **24.14.1**, Next16.4, React19, Supabase y Workflow4.8; versiones exactas en el lockfile. La aceptación local usa datos ficticios: no autoriza pacientes reales ni acredita rendimiento clínico de modelos externos. Ver [matriz](docs/audits/2026-10-10-acceptance.md), [Supabase](docs/operations/supabase.md) y [dependencias](docs/operations/dependency-gates.md).

## Instalación y checks

```sh
rtk npm ci
rtk npm test
rtk npm run lint
rtk npm run typecheck
rtk npm run workflow:wire
rtk npm run db:test
rtk npm run audit:dependencies
rtk npm run build:isolated
```

`rtk npm run verify` ejecuta esos gates y conserva todos los logs/exits privados. El build aislado exige cambios tracked registrados en Git, crea un snapshot de HEAD sin archivos de entorno y copia dependencias instaladas. Su modo por defecto usa placeholders: no sirve para aceptación Auth en navegador. `db:test` usa PostgreSQL real con `auth.uid()` simulado; JWT/advisors requieren el stack siguiente.

## Supabase y aceptación local

Docker debe estar disponible. La CLI fijada se ejecuta mediante el wrapper aislado, sin link ni proyectos remotos. El primer arranque descarga las imágenes ausentes. Start/status pueden imprimir claves locales: conservar sus salidas privadas.

```sh
rtk proxy mkdir -p .cache/acceptance
rtk proxy chmod 700 .cache/acceptance
rtk proxy sh -c 'umask 077; node scripts/supabase-local.mjs start > .cache/acceptance/supabase-start.log 2>&1'
rtk proxy sh -c 'umask 077; node scripts/supabase-local.mjs db reset --local > .cache/acceptance/supabase-reset.log 2>&1'
rtk npm run db:verify
rtk proxy node scripts/build-isolated.mjs --local-acceptance
```

Reset borra este stack local: ejecutar antes de los fixtures. No omitir servicios ni rebajar los gates estrictos lint/advisors/tipos. El build de aceptación obtiene el status local sólo en memoria y usa sus claves públicas reales para el bundle del navegador.

El build devuelve un `snapshot`; usar su directorio padre como `SERENIA_BUILD_DIR`. Elegir una ruta absoluta privada nueva y canónica para `SERENIA_ACCEPTANCE_STATE` (macOS: `/private/tmp/...`, no el alias `/tmp/...`):

```sh
SERENIA_BUILD_DIR=/private/tmp/directorio-devuelto-por-build
SERENIA_ACCEPTANCE_STATE=/private/tmp/serenia-acceptance-local
rtk proxy node scripts/acceptance-run.mjs fixtures "$SERENIA_ACCEPTANCE_STATE"
rtk proxy node scripts/acceptance-start.mjs "$SERENIA_BUILD_DIR" "$SERENIA_ACCEPTANCE_STATE"
```

El servidor queda en primer plano en **http://127.0.0.1:3000**. En otra terminal con la misma variable de estado:

```sh
rtk proxy node scripts/acceptance-run.mjs http "$SERENIA_ACCEPTANCE_STATE"
rtk proxy node scripts/acceptance-run.mjs closure "$SERENIA_ACCEPTANCE_STATE"
rtk proxy node scripts/acceptance-run.mjs inspect "$SERENIA_ACCEPTANCE_STATE"
rtk proxy node scripts/acceptance-run.mjs review "$SERENIA_ACCEPTANCE_STATE"
rtk proxy node scripts/acceptance-run.mjs safety "$SERENIA_ACCEPTANCE_STATE"
rtk proxy node scripts/acceptance-run.mjs browser-fixtures "$SERENIA_ACCEPTANCE_STATE"
```

`review` exige que el job haya terminado como draft_ai; comprobar con inspect. Estos escenarios consumen sus precondiciones: no repetir indiscriminadamente sobre los mismos actores. `fixtures.json` contiene sólo usuarios/contraseña/sesiones ficticias, sin tokens. `runtime.json` registra fuente, lock, BUILD_ID, PID y log. Los launchers exigen los origins loopback exactos app3000/Supabase54321; no cargan .env.local.

El preload externo usa el hook documentado AI_SDK_DEFAULT_PROVIDER, tres modelos sintéticos y un ledger de PID/intentos. Bloquea destinos de red externos, sin modificar endpoints, auth ni bundles generados. Mensajes de ensayo: “Solicito el cuestionario PHQ9”, “[FALLO_UNICO] texto ficticio” (un fallo), “[ESPERA] texto ficticio” (15 segundos), “Propongo cerrar esta sesión” y en el turno siguiente “Sí, cerramos”. El control privado permite structured=fail/success para ensayar el retry durable. Antes de ese escenario, terminar cualquier otro job y comprobar su estado. Con el servidor activo, escribir structured=fail en control.json y ejecutar `rtk proxy node scripts/acceptance-run.mjs restart-checkpoint "$SERENIA_ACCEPTANCE_STATE"`: crea un actor independiente, observa únicamente eventos JSON finalizados y detiene el PID registrado tras step_retrying. Cambiar el control a structured=success y arrancar exactamente el mismo build/estado. No borrar workflow/. `review` usa ese actor de restart cuando existe; en otro caso usa runtime. El launcher rechaza el puerto ocupado antes de reemplazar runtime.json.

Una señal ficticia explícita con plan hace que el proveedor compruebe la presencia del aviso de seguridad real, devuelva recursos sintéticos y llame a la herramienta productiva close_session_crisis. Eso prueba el camino y los writes autorizados; no mide razonamiento ni rendimiento clínico de un modelo externo.

Detener la app con Ctrl-C. Reiniciarla con el mismo comando, build y directorio de estado; conservar workflow/ y sus eventos. Reencolar desde un harness no prueba recuperación automática. Para detener el stack:

```sh
rtk proxy sh -c 'umask 077; node scripts/supabase-local.mjs stop > .cache/acceptance/supabase-stop.log 2>&1'
```

Conservar logs/estado hasta cerrar revisión. Limpiar sólo los paths creados por esta ejecución. La promoción `scripts/promote-clinician.ts` exige URL loopback54321, clave privilegiada explícita y actor @example.test; no carga dotenv ni administra remoto. Los fixtures ya crean un clínico ficticio.

## Configuración real y gates externos

Los nombres requeridos son NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (fallback NEXT_PUBLIC_SUPABASE_ANON_KEY), SUPABASE_SECRET_KEY (fallback SUPABASE_SERVICE_ROLE_KEY), NEXT_PUBLIC_SITE_URL y los pares LLM_CONVERSATIONAL_PROVIDER/MODEL, LLM_FAST_PROVIDER/MODEL, LLM_STRUCTURED_PROVIDER/MODEL. Nunca hacer pública una clave privilegiada. CRON_SECRET autentica cierre programado. FEATURE_CROSS_SESSION_CONTEXT sigue off hasta aprobación clínica.

Los roles resuelven strings mediante AI Gateway; autenticación, costes y tratamiento de datos se configuran explícitamente antes de conectar proveedores reales. El launcher sintético no hereda esas credenciales. `rtk npm run ai:evaluate:offline` prueba reglas deterministas sin llamadas pagadas; no mide calidad, latencia o coste de modelos. Adaptadores auxiliares siguen desconectados del paciente.

Local World no autentica colas y sólo sirve para desarrollo. La aceptación se enlaza a loopback. Publicar exige World apto para producción, protección de ingress/colas demostrada, migraciones/smoke del destino, tratamiento de datos y textos legales aprobados, resolución de discrepancias clínicas y canal operativo de urgencias.

El parche upstream de Next anunciado para el14octubre sigue pendiente; la excepción dev GHSA-vfj7-8cjw-p6xm caduca el **18octubre2026**. Audit de producción sin findings no convierte el audit completo en limpio.
