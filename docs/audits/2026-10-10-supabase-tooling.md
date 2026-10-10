# Supabase: herramientas verificadas y adopción en Serenia

Fecha de revisión: 2026-10-10. Investigación para Task 4 del MVP robusto; no sustituye las tareas de autorización, recuperación ni revisión clínica. Sólo se han consultado documentación pública, metadatos de herramientas y archivos locales de código/configuración. No se ha leído `.env.local`, solicitado claves, listado proyectos, leído filas/logs remotos, aplicado migraciones remotas, desplegado ni creado recursos de pago.

## Estado comprobado

| Capacidad | Evidencia actual | Límite |
| --- | --- | --- |
| Plugin Supabase | Root confirmó instalado y habilitado mediante Plugin Management; dependencia app resuelta | No demuestra acceso a la BD de Serenia ni permisos OAuth efectivos |
| MCP documental | `search_docs` ejecutado con éxito varias veces; devolvió documentación de MCP, plugins, SSR y PAT | Única capacidad remota ejecutada; no requiere acceso a proyectos |
| MCP de proyecto | Descubiertos `get_advisors`, `generate_typescript_types`, SQL, migraciones, proyectos, branches y despliegue | Esquemas conocidos; acceso real no probado ni autorizado en esta revisión |
| CLI local | Ejecutable `node_modules/.bin/supabase --version`: **2.92.1** | No se actualizó ni ejecutó `start`, advisors, types o migraciones |
| SDK local | `@supabase/supabase-js` **2.103.3**; `@supabase/ssr` **0.10.2**, leídos de los paquetes instalados | `package.json` usa rangos caret; conviene fijar versiones exactas |
| Runtime local | Node **24.14.1**, TypeScript **5.9.3** | No prueba el runtime de despliegue |
| Skills instaladas | Plugin Supabase 1.0.0: skill metadata **0.1.2**; Postgres skill metadata **1.1.1** | Frontmatter y versión del bundle upstream no coinciden: ver procedencia abajo |
| Telemetría CLI | `supabase telemetry --help` confirma `status`, `disable`, `enable` | `telemetry status` falla exit 1: `failed to parse telemetry file: Time.UnmarshalJSON: input is not a JSON string`. No se modificó configuración global; estado no verificado |

La CLI 2.92.1 ya ofrece, comprobado mediante `--help`:

- `db advisors --local --type all --level warn --fail-on warn`.
- `db lint --local --schema public --level warning --fail-on warning`.
- `gen types --local --lang typescript --schema public`.
- Flag global `--agent auto|yes|no`; no presupone aprobación para escrituras.

El valor por defecto de `--fail-on` en advisors/lint es `none`: un comando que termina bien sin configurarlo puede contener hallazgos. El gate de CI debe especificarlo.

## Novedades oficiales que sí cambian el trabajo

**6 de octubre: scoped PAT generalmente disponibles.** Permiten limitar recursos y permisos para CLI, MCP y Management API. El login de navegador de CLI sigue creando un token de cuenta; para CI se debe configurar un token limitado con caducidad. La documentación precisa que SQL se ejecuta en lectura salvo permiso Database read-write. No se creó ningún token. Fuente: [anuncio y detalles](https://supabase.com/changelog/scoped-personal-access-tokens-ga), [mapa de permisos por endpoint/herramienta](https://supabase.com/docs/guides/platform/personal-access-tokens).

**13 de septiembre: Observability Auto-Pilot.** Son prompts y procedimientos para monitores ejecutados por el agente elegido. Para Serenia podría incorporarse después un monitor de seguridad con resultados `finding`, `clear` o `unable to assess`, ventanas UTC y deduplicación. No equivale a cobertura automática habilitada ni autoriza una automatización o lectura de datos clínicos. Fuente: [anuncio](https://supabase.com/changelog/50403-observability-autopilot), [procedimiento de seguridad](https://supabase.com/docs/guides/observability/automate-with-agents/security).

**18 de septiembre: Health Check Advisors.** El producto añade checks de salud de servicios. No se ha verificado que todos se expongan en el `db advisors` local ni en las dos categorías de nuestro conector MCP; el esquema de éste acepta únicamente `security` y `performance`. Fuente: [anuncio](https://supabase.com/changelog/50577-health-check-advisors).

**Cambio anunciado el 28 de abril, aplicado a proyectos existentes el 30 de octubre:** las tablas nuevas en `public` requieren grants explícitos para llegar a la Data API; RLS sigue siendo una capa distinta. Las tablas existentes conservan grants. Serenia usa `supabase-js`, así que sus nuevas migraciones deben incluir privilegios mínimos por rol, RLS y policies juntos. La prueba debe partir de default privileges revocados; un bootstrap que concede todo escondería un grant omitido. No aplicar un `GRANT ALL` general para hacer pasar la prueba. Fuente: [cambio de exposición de tablas](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

Otros cambios revisados en [changelog oficial](https://supabase.com/changelog.md): Node 20 dejó de soportarse el 30 de junio; TypeScript 5 será requisito en enero de 2027. El runtime local observado cumple ambos. `@supabase/server`/`@supabase/middleware` son productos distintos: su lanzamiento/deprecación no obliga a sustituir el SSR de Next.js. pg-delta sigue siendo un flujo experimental/alpha; conservar las migraciones existentes durante el MVP.

## Versiones de actualización candidatas

Comprobadas por GitHub Releases y su API pública, no instaladas en esta revisión:

| Paquete | Instalado | Release estable actual encontrada | Tratamiento |
| --- | --- | --- | --- |
| `supabase` CLI | 2.92.1 | **2.120.0**, 2026-10-06 | Dev dependency exacta; validar comandos/configuración local y telemetría antes de adoptarla |
| `@supabase/supabase-js` | 2.103.3 | **2.117.3**, 2026-10-07 | Exact pin junto con lockfile; revisar cambios del intervalo y ejecutar regresiones |
| `@supabase/ssr` | 0.10.2 | **0.12.7**, 2026-09-08 | Exact pin; probar cookies, PKCE, refresh y redirects |

Fuentes: [CLI 2.120.0](https://github.com/supabase/cli/releases/tag/v2.120.0), [JS 2.117.3](https://github.com/supabase/supabase-js/releases/tag/v2.117.3), [SSR 0.12.7](https://github.com/supabase/ssr/releases/tag/v0.12.7), [changelog SSR completo](https://github.com/supabase/ssr/blob/v0.12.7/CHANGELOG.md). Las releases de GitHub no sustituyen comprobar que la versión está publicada en el registro antes de cambiar el lockfile.

CLI 2.120 incorpora un flujo de stacks, logs persistidos, typegen actualizado y trazas opt-in. Nuestro ejecutable actual no ofrece comandos `stack`; no copiar comandos nuevos hasta instalar y consultar su ayuda. Mantener OTLP apagado. La release también cambia etiquetas de telemetría: resolver su verificación antes de adopción. No actualizar binarios globales para arreglar el proyecto.

## SSR/auth: cambio concreto de alta prioridad

`lib/server/supabase/middleware.ts` usa `setAll(cookiesToSet)` ignorando las cabeceras que SSR puede entregar, y retorna varios `NextResponse.redirect` nuevos. Estos redirects pierden las cookies acumuladas en `response`. La guía oficial exige copiar cookies y `cache-control`, `expires`, `pragma` al devolver otra respuesta. SSR añadió la entrega de cabeceras a `setAll` en 0.10.0, por lo que el ajuste ya aplica a la versión instalada. Fuente: [SSR para Next.js y reglas del proxy](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).

Task 4 debería observar primero una regresión RED de refresh seguido de redirect y de cabeceras anti-caché, corregir el adaptador y repetirla tras actualizar SSR. Leer antes la guía de Proxy de `node_modules/next/dist/docs/`, como exige AGENTS.md. `getUser()` actual valida contra Auth; no es un `getSession()` sin verificar. Evaluar `getClaims()` cuando sólo se necesite identidad, preservando `getUser()` cuando importe el estado remoto actualizado del usuario. No asumir que migrar automáticamente a claims mejora la revocación.

El nombre `NEXT_PUBLIC_SUPABASE_ANON_KEY` puede mantener compatibilidad; para configuración nueva preferir publishable key mediante helper y fallback explícito. No rotar claves ni solicitar secret/service-role por esta tarea. Conservar secretos exclusivamente en servidor.

## Uso práctico recomendado para el proyecto

1. Añadir guía corta local de Supabase y referencia en AGENTS.md, sin instalar otro plugin duplicado. Empezar con MCP documental ya disponible.
2. Fijar las versiones exactas candidatas en `package.json`/lockfile sólo después de revisión del intervalo y comprobación del registro; no `audit fix --force`.
3. Integrar adapters SSR corregidos y gates locales: lint SQL, advisors y tipos generados. No confundir el harness Postgres con Supabase completo.
4. Probar Data API real, GoTrue y cookies con fixtures sintéticos sobre entorno local antes de declarar aceptación completa. El harness `scripts/test-database.py` usa `auth.uid()` simulado y explícitamente no valida JWT/GoTrue/PostgREST.

Comandos cuya sintaxis se comprobó en CLI 2.92.1 (propuestos, no ejecutados contra BD):

```sh
rtk proxy ./node_modules/.bin/supabase db lint --local --schema public --level warning --fail-on warning
rtk proxy ./node_modules/.bin/supabase db advisors --local --type all --level warn --fail-on warn
rtk proxy ./node_modules/.bin/supabase gen types --local --lang typescript --schema public
```

Para `db:types:check`, ejecutar generación con `subprocess`/Node en archivo temporal y comparar contra `lib/shared/supabase/types.ts`; nunca truncar ese archivo antes de saber que typegen terminó con éxito. Separar `db:types:generate`, que sí sustituye tras éxito, del check de CI. Guardar salida completa de advisors/lint sin filas privadas; decidir exenciones documentadas para avisos con objeto, razón y caducidad. Prerequisito: stack local sano con migraciones aplicadas. Si falta, gate no ejecutado/fallido, no éxito.

El inventario `project_checks.py inspect` sólo encuentra actualmente scripts `test`, `lint`, `build`, desarrollo y arranque en package.json. Task 4 debe añadir gates explícitos de typecheck/verificación/BD, manteniendo también el harness SQL y las pruebas de autorización ya en curso.

## MCP y permisos: configuración posterior

El MCP alojado admite `project_ref`, `read_only=true` y grupos `features`. Para investigación remota autorizada usar un único proyecto de desarrollo y sólo `docs,database,debugging,development` si hacen falta; con datos clínicos empezar únicamente por docs y advisors/tipos. Ejemplo de URL para revisar, no conexión aplicada:

```text
https://mcp.supabase.com/mcp?project_ref=<DEV_PROJECT_REF>&read_only=true&features=docs,database,debugging,development
```

OAuth normalmente se completa en navegador; no hace falta crear PAT para el flujo interactivo. `search_docs` no requiere permisos de proyecto. PAT: advisors necesita Advisors Read y generación de tipos Database Read. Otros permisos dependen del endpoint, consultar el mapa oficial. Branching requiere plan de pago; enterprise-managed MCP requiere Team/Enterprise y SSO. No se necesita ninguno para los gates locales. El MCP local documentado vive en `http://localhost:54321/mcp`; conectividad local no comprobada. Fuente: [MCP oficial](https://supabase.com/docs/guides/ai-tools/mcp), [SSO empresarial MCP](https://supabase.com/docs/guides/platform/sso/enterprise-mcp-authentication).

El skill instalado recomienda iteración SQL directa local seguida de `db pull --local`, pero nuestro conector SQL indica `apply_migration` para DDL. Resolver esa diferencia por target y contrato de herramienta: aquí escribir migración versionada local, validar en entorno efímero y preservar historial. No iterar DDL remoto ni inferir autorización de que una herramienta aparece disponible.

## Procedencia reproducible de las skills

Repositorio oficial: [supabase/agent-skills](https://github.com/supabase/agent-skills). Revisión comprobada: [`c9be0e931b7930f7d02126d04774d904c381e7d7`](https://github.com/supabase/agent-skills/commit/c9be0e931b7930f7d02126d04774d904c381e7d7), 2026-10-02. [Licencia MIT, copyright Supabase 2026](https://github.com/supabase/agent-skills/blob/c9be0e931b7930f7d02126d04774d904c381e7d7/LICENSE).

El [manifest de releases](https://github.com/supabase/agent-skills/blob/c9be0e931b7930f7d02126d04774d904c381e7d7/.release-please-manifest.json) indica bundle/core 0.1.9 y Postgres 1.6.0, pero los SKILL.md de ese mismo commit conservan metadata 0.1.2/1.1.1. Registrar commit y hash de los archivos; no llamar a esto una actualización confirmada sólo por el número de frontmatter. El core upstream añade guidance de scoped PAT frente a la copia instalada.

Recomendación inmediata: guía propia pequeña `docs/operations/supabase.md` con este contenido operacional:

> Antes de cambiar Supabase, consultar changelog y MCP search_docs. Leer las skills instaladas pertinentes; sus versiones no sustituyen la documentación actual. Usar CLI del lockfile, descubrir flags con --help. Toda escritura autorizada se prueba localmente con fixtures sintéticos; migraciones versionadas incluyen grants mínimos, RLS y policies. Ejecutar harness SQL, advisors/lint fail-closed y comparación de tipos. No leer .env.local ni conectar a datos clínicos/remoto para verificar localmente. Para modificar la conexión, tokens, costes o BD remota, usar el alcance autorizado específico de la tarea. Mantener telemetría desactivada y demostrar su estado, sin cambiar configuración global incidentalmente.

Si se necesita reproducibilidad para agentes de CI que no tienen plugin, vendorizar únicamente `skills/supabase/` y `skills/supabase-postgres-best-practices/` de ese commit en `.agents/skills/`, incluyendo referencias, LICENSE y archivo de procedencia con commit/hashes. Revisar el diff antes de actualizar; evitar `npx skills update` general. No se ha realizado instalación/vendoring en esta revisión.

## Límites de la conclusión

Documentación MCP operativa y comandos CLI de ayuda/versiones verificados. Advisors, tipos, stack completo, permisos OAuth, configuración/versión remota, entrega de emails, refresh contra Auth real y aceptación de producción siguen sin verificar en esta investigación. El fallo de telemetry status conserva evidencia de fallo y requiere diagnóstico independiente. La propuesta de Task 4 es revisable; no demuestra que Serenia esté lista para pacientes reales.
