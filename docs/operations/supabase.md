# Supabase local en Serenia

Consultar changelog/MCP search_docs antes de cambiar Supabase. Usar las skills oficiales del plugin, revisando la revisión fijada [supabase/agent-skills c9be0e931b7930f7d02126d04774d904c381e7d7](https://github.com/supabase/agent-skills/tree/c9be0e931b7930f7d02126d04774d904c381e7d7), MIT copyright Supabase 2026. [Core fijado](https://github.com/supabase/agent-skills/blob/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase/SKILL.md), [Postgres fijado](https://github.com/supabase/agent-skills/blob/c9be0e931b7930f7d02126d04774d904c381e7d7/skills/supabase-postgres-best-practices/SKILL.md): resolver las referencias contra ese mismo commit. Los hashes SHA-256 de ambos entrypoints descargados se conservan en supabase-skills-provenance.json. Metadata de SKILL.md no equivale a versión del bundle; procedencia en [investigación](../audits/2026-10-10-supabase-tooling.md). No instalar/actualizar skills ni plugins globales desde este proyecto.

La CLI2.120.0 del lock sólo se invoca mediante el wrapper local. Permite sólo comandos y opciones revisados mediante lista positiva por comando; rechaza opciones desconocidas/duplicadas, booleanos con valor, profile/support-ticket/health bypass, targets/config alternativos y positional extra. Exige --local en BD/tipos y bloquea link/login/push/targets remotos y configuración alternativa. Cada child usa SUPABASE_HOME absoluto propio en .cache/supabase (gitignored y persistente), SUPABASE_TELEMETRY_DISABLED=1 y DO_NOT_TRACK=1. No hereda tokens ni claves globales, trace/OTLP ni proveedores externos; no lee/copia configuración Supabase global ni modifica HOME. Rechaza symlinks en esa raíz.

```sh
rtk npm run supabase:local -- --version
rtk npm run supabase:local -- telemetry disable
rtk npm run supabase:local -- telemetry status
rtk npm run supabase:local -- start --help
rtk npm run db:test
rtk npm run db:lint
rtk npm run db:advisors
rtk npm run db:types:check
```

Descubrir ayuda de cada comando instalado antes de usarlo. db:test aplica migraciones y seed dos veces desde PostgreSQL17.6 efímero, red none, auth.users vacío y actores ficticios. En CI sin RTK, el harness invoca Docker instalado directamente (subprocess sin shell); localmente usa RTK. auth.uid() es un shim: no prueba JWT, GoTrue, PostgREST, configuración hospedada, emails ni advisors. El seed no inserta datos: las migraciones poseen instrumentos y retiran ASQ. No cambiar bandas/cortes/prompts aprobados.

db:verify requiere stack Supabase local saludable con migraciones aplicadas. Lint/advisors usan fail-on warning/warn y fallan si faltan servicios; typecheck compara tipos generados. db:types:generate sólo sustituye tras generación exitosa; revisar diff antes de commit. Tipos sólo con --local --schema public. Migraciones incluyen grants mínimos/RLS/policies; no grants generales para ocultar fallos Data API.

.env.example incluye NEXT_PUBLIC_SITE_URL y claves modernas: browser/server/proxy prefieren NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, con NEXT_PUBLIC_SUPABASE_ANON_KEY fallback cuando vacía; servidor privilegiado prefiere SUPABASE_SECRET_KEY, con SUPABASE_SERVICE_ROLE_KEY fallback. Secretos nunca públicos. No se rota ninguna clave ni se lee .env.local.

SSR0.12.7 usa getAll/setAll. Proxy conserva cookies y Cache-Control/Expires/Pragma en múltiples writes y redirects; getUser conserva validación con Auth. Server Components toleran sólo el error conocido read-only; proxy refresca allí. Callback construye respuesta antes de exchange PKCE y conserva cookies/cache, rechaza code ausente/fallido hacia login sin mostrar detalles SDK. Acepta sb_flow_id opcional para verifier concurrente; no activa appendPkceFlowIdToRedirects experimental en producción. Signout conserva el alcance global previo. Regresiones del SDK real verifican refresh/PKCE y eliminación de cookies con transporte ficticio. Task6 prueba Auth/JWT/PostgREST/browser/Workflow generado y restart.

No imprimir status con claves; launchers capturan el JSON local únicamente en memoria/archivo privado. No conectar proyectos enlazados ni datos clínicos/remotos. Cambios remotos, conexión, tokens y costes requieren el alcance específico autorizado.
