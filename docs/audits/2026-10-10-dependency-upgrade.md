# Propuesta de dependencias para Task 4

Investigación realizada el 2026-10-10. Se leyeron instrucciones, package.json/lockfile, usos y auditorías existentes, documentación oficial, registro npm, tarballs en memoria sin ejecutar su código y código público de la CLI. No se instalaron paquetes, modificaron manifests/lockfile/node_modules, ejecutaron suites, llamaron modelos, conectaron proyectos Supabase ni cambiaron Git/configuración global. Las versiones de esta tabla están publicadas en npm; la compatibilidad comprobada aquí es de engines/peers/exports y fuentes, pendiente de integración real.

## Selección concreta

Actualizar dentro de las ramas actuales, fijar versiones exactas y conservar lockfile. Los candidatos preferidos son los últimos compatibles de su rama; los mínimos muestran dónde empieza la reparación del baseline, no una recomendación de congelarse ahí.

| Paquete | Instalado | Candidato exacto | Mínimo/requisito y evidencia |
| --- | --- | --- | --- |
| `next` / `eslint-config-next` | 16.2.4 / 16.2.4 | **16.4.0 / 16.4.0** | Next 16.3.8 es el piso de los advisories directos presentes; 16.4.0 incorpora PostCSS 8.5.23. Node >=20.9, React ^19 y ESLint >=9 aceptan el runtime actual. No activar nuevas opciones experimentales. |
| `react` / `react-dom` | 19.2.4 / 19.2.4 | **19.3.0 / 19.3.0** | Par publicado compatible con Next 16.4 y AI React 3. El baseline no señala React como paquete vulnerable; esta actualización dentro de major necesita regresiones de componentes y navegación. |
| `ai` / `@ai-sdk/react` | 6.0.168 / 3.0.170 | **6.0.303 / 3.0.306** | Pisos 6.0.214 / 3.0.216: provider-utils 4.0.33 repara GHSA-866g-f22w-33x8. Candidatos finales comparten ai 6.0.303 y provider-utils 4.0.57; Node >=18, Zod ^4.1.8, React ^19.2.1 compatibles. |
| `workflow` / `@workflow/next` | 4.2.4 / 4.0.5 | **4.8.13 / 4.1.17** | Par publicado: next 4.1.17 depende de core 4.8.13 y pide Next >13. Mantiene APIs `workflow/next`, `workflow/api` y `FatalError`. Requiere overrides abajo. |
| `@supabase/supabase-js` | 2.103.3 | **2.117.3** | Node >=22; local 24.14.1 cumple. Sigue API 2; revisar Auth/PostgREST/refresh. |
| `@supabase/ssr` | 0.10.2 | **0.12.7** | Peer Supabase JS ^2.114.0: no subir SSR solo con JS 2.103.3. Revisar cookies/PKCE/headers; pre-1.0 no implica compatibilidad por el mero número. |
| `supabase` CLI, dev | 2.92.1 | **2.120.0** | Publicada; CLI ahora combina comportamiento TypeScript y delegación Go. Estado aislado, opt-out y flags probados con la candidata antes de usar stack local. |
| `vitest`, dev | 4.1.4 | **4.1.11** | Piso parcheado de GHSA-82fw-gwwq-j7x9; último 4. Peer Vite ^6 / ^7 / ^8; Node >=24 aceptado. Evita la migración de Vitest 5. |
| `vite`, dev directo | 8.0.8 transitivo | **8.3.4** | Piso 8.0.16 de avisos Windows GHSA-fx2h-pf6j-xcff y GHSA-v6wh-96g9-6wx3. Latest 8 compatible con Node 24.14.1. Pin dev directo controla resolución de Vitest/plugin. |
| `@vitejs/plugin-react`, dev | 6.0.1 | **6.1.2** | Peer Vite ^8; Node ^20.19 / >=22.12. Compatible por metadatos; plugin solo necesario si la configuración de tests lo usa. |
| `tsx`, dev | 4.21.0 | **4.23.15** | Cambia esbuild de ~0.27.0 a ~0.28.0; debe resolver >=0.28.1. Actualizar Workflow solo no elimina el esbuild antiguo de tsx. |
| `@types/node`, dev | 20.19.39 | **24.19.2** | Último 24 publicado; alinea tipos con runtime y satisface Vitest/Vite. No subir a 26 con Node 24. |
| `typescript`, dev | 5.9.3 | **5.9.3** | Conservar rama 5, exact pin. No es necesario un cambio de major para los avisos revisados. |
| `jsdom`, nuevo dev | no instalado | **29.1.1** | Node ^20.19 / ^22.13 / >=24.0; compatible con 24.14.1. Latest 30.1.2 exige Node ^24.15 y queda fuera. Vitest acepta jsdom `*`. |

Fuentes de publicación/peers: registro oficial [Next](https://registry.npmjs.org/next/16.4.0), [eslint-config-next](https://registry.npmjs.org/eslint-config-next/16.4.0), [React](https://registry.npmjs.org/react/19.3.0), [React DOM](https://registry.npmjs.org/react-dom/19.3.0), [AI](https://registry.npmjs.org/ai/6.0.303), [AI React](https://registry.npmjs.org/@ai-sdk%2freact/3.0.306), [Workflow](https://registry.npmjs.org/workflow/4.8.13), [Workflow Next](https://registry.npmjs.org/@workflow%2fnext/4.1.17), [Supabase JS](https://registry.npmjs.org/@supabase%2fsupabase-js/2.117.3), [SSR](https://registry.npmjs.org/@supabase%2fssr/0.12.7), [CLI](https://registry.npmjs.org/supabase/2.120.0), [Vitest](https://registry.npmjs.org/vitest/4.1.11), [Vite](https://registry.npmjs.org/vite/8.3.4), [plugin React](https://registry.npmjs.org/@vitejs%2fplugin-react/6.1.2), [tsx](https://registry.npmjs.org/tsx/4.23.15), [Node types](https://registry.npmjs.org/@types%2fnode/24.19.2), [jsdom](https://registry.npmjs.org/jsdom/29.1.1).

## Qué significa la auditoría existente

Los JSON completos permanecen en `/private/tmp/serenia-audit-2026-10-10/logs/`:

- `20261010-092735-qsmehmr3.log`: 59 entradas de paquetes afectados, 5 critical / 34 high / 9 moderate / 11 low; 158 URL GHSA distintas al deduplicar objetos `via`.
- `20261010-092954-qsia4r6t.log`: 52 entradas, 4 critical / 31 high / 6 moderate / 11 low; 149 URL GHSA distintas. En éste ya no aparece Vitest, coherente con omitir dev; ambos conservan la misma metadata de inventario.

Una entrada puede heredar avisos de sus hijos; una GHSA puede describir varios rangos, no tener CVE o solaparse con otro aviso. Estos números no son un recuento de CVE únicos ni demuestran explotación en Serenia. La severidad máxima de `next` incluye rutas/plataformas condicionales (Windows, AVIF, next/og, etc.). App Router, Proxy y Server Actions sí se usan, por lo que merecen actualización y prueba aunque no se haya demostrado un exploit aquí.

Ejemplos de avisos y pisos: [Proxy prefetch](https://github.com/advisories/GHSA-26hh-7cqf-hhc6) 16.2.6, [Turbopack Proxy](https://github.com/advisories/GHSA-6gpp-xcg3-4w24) 16.2.11, [next/og](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) 16.3.6, [SSG/ISR](https://github.com/advisories/GHSA-4jqv-mc3x-m676) 16.3.8, [AI provider-utils](https://github.com/advisories/GHSA-866g-f22w-33x8) 4.0.33, [Vitest mocker](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) 4.1.11.

**Riesgo externo pendiente:** el [anuncio oficial del 8 de octubre](https://nextjs.org/blog/upcoming-nextjs-security-update-october-2026), enlazado también desde el [índice oficial](https://nextjs.org/blog?trk=public_profile__reactions-text), prevé un parche el 14 de octubre para dos avisos críticos y uno alto upstream. No inventar CVE ni versión reparada antes de publicarlos. Aunque el nuevo audit sea limpio, registrar este gate pendiente antes de producción.

## Workflow: reparación mínima con compatibilidad condicionada

Workflow 4.8.13 aún fija en core `devalue: 5.9.2` y `nanoid: 5.1.6`; Workflow 5.2.0 fija los mismos, así que una migración mayor no resuelve estos avisos. En cambio, builders 4.1.18 pasa a esbuild ^0.28.1 y world-local/world-vercel pasan a Undici 7.30.0. La sugerencia de audit `workflow@2.0.6` es un downgrade de major; descartarla.

Override propuesto, limitado al padre que fija las versiones:

```json
"overrides": {
  "@workflow/core": {
    "devalue": "5.9.4",
    "nanoid": "5.1.16"
  }
}
```

Ambos publicados. devalue 5.9.3 corrige los nueve avisos de devalue del JSON que terminan en <=5.9.2; 5.9.4 añade anotaciones de pureza. [Release 5.9.3](https://github.com/sveltejs/devalue/releases/tag/v5.9.3), [5.9.4](https://github.com/sveltejs/devalue/releases/tag/v5.9.4), [aviso de claves](https://github.com/advisories/GHSA-4q55-j62x-fr9h). Nanoid 5.1.16 repara el rango >=4 <5.1.16; [release](https://github.com/ai/nanoid/releases/tag/5.1.16). La rama 3 independiente usada por PostCSS debe resolver >=3.3.18; no forzar Nanoid 5 sobre todos los padres.

El tarball público core 4.8.13 usa `parse`, `unflatten`, `stringify`, `DevalueError` y reducers/revivers personalizados; esos exports permanecen en 5.9.4. Esto comprueba superficie de API, **no** replay ni wire format. Antes de aceptar override, el implementador debe probar: roundtrip de argumentos/resultados reales del assessment con datos ficticios; lectura de payload creado antes de actualizar; Date/Map/Set/undefined, referencias compartidas/cíclicas y Error; vistas Buffer/Uint8Array/DataView con offsets sin revelar bytes ajenos; reducers/revivers de Workflow; suspensión/retry/replay de un workflow local tras reinicio. Un test de `JSON.stringify` no cubre esa ruta. Si falla, registrar cada advisory residual del lock final y mantener el gate cerrado en lugar de omitir audit.

No migrar a Workflow 5 incidentalmente: las [releases oficiales](https://github.com/vercel/workflow/releases) documentan cambios de engine, streams y datos locales; world-local 5.1.0 elimina datos de versiones anteriores al actualizar, y ciertos cambios de IDs pueden exigir reiniciar runs en curso.

## Supabase: intervalo y estado local

JS 2.103.3 → 2.117.3 abandona Node 20; la versión npm pide >=22 y TypeScript 5 sigue válido. [Changelog JS](https://github.com/supabase/supabase-js/blob/v2.117.3/CHANGELOG.md). SSR 0.10.2 → 0.12.7 cruza cambios de cookies y añade helpers de scopes/encode; usar `getAll`/`setAll`, preservar cookies y headers en redirects y probar sesión existente, refresh, PKCE/callback/signout antes/después. No adoptar cookies.encode ni cambiar scopes automáticamente. [Changelog SSR](https://github.com/supabase/ssr/blob/v0.12.7/CHANGELOG.md). El peer ^2.114 es un requisito concreto del candidato.

CLI 2.120 incorpora nuevas raíces/stack IDs, logs persistidos y typegen con `ComputedFields`; no trasplantar outputs de tipos antiguos ni inferir paridad del harness PostgreSQL con Auth/PostgREST. [Release](https://github.com/supabase/cli/releases/tag/v2.120.0), [layout del tag](https://github.com/supabase/cli/blob/v2.120.0/apps/cli/docs/supabase-home.md).

Código del tag confirma `SUPABASE_HOME`, `SUPABASE_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1` y compatibilidad de fechas RFC3339/millis entre Go y TypeScript cuando hay `consent: granted|denied`. [Go state](https://github.com/supabase/cli/blob/v2.120.0/apps/cli-go/internal/telemetry/state.go), [TS state](https://github.com/supabase/cli/blob/v2.120.0/apps/cli/src/telemetry/telemetry-state.layer.ts), [consent](https://github.com/supabase/cli/blob/v2.120.0/apps/cli/src/shared/telemetry/consent.ts). No se leyó el archivo global que causó `Time.UnmarshalJSON` en 2.92.1; coexistencia de formatos es una explicación compatible, no un diagnóstico confirmado del fichero.

Las variables suprimen envío, pero el loader puede escribir estado fresco `enabled:true` y regenerarlo tras corrupción. `telemetry status` muestra ese flag persistido. Un wrapper local debe fijar ambas variables **en cada comando**, usar una raíz absoluta propia gitignored dentro del repo, ejecutar `telemetry disable` sólo allí y comprobar `status`. No alterar HOME/CODEX_HOME ni leer/copiar tokens globales. El wrapper debe quitar `SUPABASE_TRACE_FILE`, `SUPABASE_OTLP_ENDPOINT`, `SUPABASE_OTLP_HEADERS` del child env; [tracing](https://github.com/supabase/cli/blob/v2.120.0/apps/cli/docs/tracing-monitoring.md) los define opt-in. Persistir la raíz local entre comandos evita perder el estado del stack.

Comandos propuestos después de instalar candidata (no ejecutados aquí):

```sh
rtk proxy env -u SUPABASE_TRACE_FILE -u SUPABASE_OTLP_ENDPOINT -u SUPABASE_OTLP_HEADERS SUPABASE_HOME="$PWD/.cache/supabase" SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 ./node_modules/.bin/supabase --version
rtk proxy env -u SUPABASE_TRACE_FILE -u SUPABASE_OTLP_ENDPOINT -u SUPABASE_OTLP_HEADERS SUPABASE_HOME="$PWD/.cache/supabase" SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 ./node_modules/.bin/supabase telemetry disable
rtk proxy env -u SUPABASE_TRACE_FILE -u SUPABASE_OTLP_ENDPOINT -u SUPABASE_OTLP_HEADERS SUPABASE_HOME="$PWD/.cache/supabase" SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 ./node_modules/.bin/supabase telemetry status
```

Antes de stack, usar el mismo wrapper con `start --help`, `db lint --help`, `db advisors --help`, `gen types --help` y revisar config. Luego validar Auth/PostgREST local con actores sintéticos, grants/RLS y regenerar tipos temporalmente para comparar. No declarar esos checks ejecutados basándose en ayuda o PostgreSQL puro.

## jsdom para Task 3

29.1.1 es el último candidato que acepta el Node local. El 2026-10-10 se resolvieron recursivamente sus rangos publicados usando semver instalado: 39 nombres, engines compatibles con 24.14.1 y Undici 7.30.0. Consulta npm bulk advisory API respondió HTTP 200 y `{}`; API GitHub `affects=jsdom@29.1.1` también devolvió `[]`. Esto cubre esa resolución de metadatos; aún no el lockfile instalado ni dependencias opcionales como canvas. Usar `environment: 'jsdom'` por fichero/proyecto de componentes manteniendo node en pruebas servidor. No hace falta @types/jsdom si no se importa JSDOM directamente. [Metadata](https://registry.npmjs.org/jsdom/29.1.1), [releases](https://github.com/jsdom/jsdom/releases), [API advisories](https://api.github.com/advisories?ecosystem=npm&affects=jsdom%4029.1.1).

## shadcn y reparación del resto del lock

`app/globals.css:3` importa `shadcn/tailwind.css`; no retirar el paquete sin reemplazar esa hoja. Su único uso funcional localizado es CSS (keyframes, variants data-* y no-scrollbar). Último shadcn 4.21.4 sigue con fast-glob ^3.3.3/ts-morph ^26 y cadena micromatch/braces vulnerable; no aceptar downgrade audit a 1.0.0 ni forzar braces de otro major sin revisar consumidores.

Recomendación: copiar esa pequeña hoja del paquete instalado a un archivo local, conservar procedencia y licencia MIT y cambiar el import; verificar generación CSS y componentes antes de `npm uninstall shadcn`. Si se necesita la CLI en desarrollo, mantenerla dev exacta y documentar el residual; moverla a dev reduce exposición runtime pero no limpia audit completo. [Registro de shadcn](https://registry.npmjs.org/shadcn/4.21.4).

Tras actualizar padres, los avisos de transitivas con rangos abiertos necesitan re-resolución. Revisar especialmente PostCSS >=8.5.23, Sharp >=0.35.5, Nanoid 3 >=3.3.18 / 5 >=5.1.16, source-map-js >=1.2.2, fast-uri >=3.1.8, js-yaml >=4.3.2, Hono >=4.13.7, MCP SDK >=1.31.0, ws >=8.21.0, qs >=6.16.0 y los extractores/piscina/proxy-addr. Son pisos deducidos del JSON, no promesa de que todos los padres permitan alcanzarlos. No añadir overrides globales a ciegas; cada residual conserva padre, versión, GHSA, uso y decisión.

## Comandos del implementador y aceptación

Ejecutar sólo cuando Task 4 sea dueño del checkout/node_modules, conservando cambios de los otros bloques. Comandos propuestos, no ejecutados:

```sh
rtk proxy npm install --save-exact next@16.4.0 react@19.3.0 react-dom@19.3.0 ai@6.0.303 @ai-sdk/react@3.0.306 workflow@4.8.13 @workflow/next@4.1.17 @supabase/supabase-js@2.117.3 @supabase/ssr@0.12.7
rtk proxy npm install --save-dev --save-exact eslint-config-next@16.4.0 supabase@2.120.0 vitest@4.1.11 vite@8.3.4 @vitejs/plugin-react@6.1.2 tsx@4.23.15 @types/node@24.19.2 typescript@5.9.3 jsdom@29.1.1
```

Añadir overrides focalizados antes de resolver el lock; no `audit fix --force`. Retirar shadcn sólo tras resolver su CSS. Para transitivas con rangos abiertos, `npm update <nombres>` focalizado con diff de lock/manifest; no borrar lockfile ni actualizar todas las majors por `latest`.

Conservar salida completa/exit status de `npm audit --json` y `npm audit --omit=dev --json`, inventario `npm ls --all` y resolución de las transitivas fijadas. No transformar JSON fallido en gate verde; deduplicar por GHSA para informe, preservando las entradas de paquete originales. El gate debe fallar con high/critical residuales salvo exención explícita y revisable, y registrar avisos menores.

Después: pruebas de serialización/replay, tests de Task 1–3 con DOM real, lint, typecheck, build y aceptación navegador; Auth/PostgREST/SQL local y comparación de tipos. Leer guías correspondientes de `node_modules/next/dist/docs/` tras actualizar antes de editar Proxy/Turbopack; fijar raíz Turbopack sin habilitar Cache Components ni otras features incidentalmente. El [anuncio 16.4](https://nextjs.org/blog/next-16-4) cambia compilación y bundles, no exige migrar automáticamente la app a nuevas APIs. El [changelog AI 6](https://github.com/vercel/ai/blob/ai%406.0.303/packages/ai/CHANGELOG.md) contiene fixes de stream cleanup/resume: probar cancelación, reconexión y persistencia aun manteniendo major.

Publicación, actualización global de Node, remoto Supabase y ejecución LLM quedan fuera de esta propuesta. Auditoría limpia y build correcto tampoco resuelven el parche upstream anunciado ni la revisión clínica pendiente.
