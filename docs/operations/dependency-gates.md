# Dependencias y verificación

Node24.14.1, dependencias directas exactas y lockfile versionado. Usar rtk npm ci; no borrar lock/audit fix --force ni actualizar Node global. Hoja shadcn vendorizada sin cambios en app/vendor con licencia MIT y hash; CLI retirada del runtime/graph.

```sh
rtk npm test
rtk npm run lint
rtk npm run typecheck
rtk npm run workflow:wire
rtk npm run db:test
rtk npm run audit:dependencies
rtk npm run build:isolated
rtk npm run verify
```

verify ejecuta estos gates secuencialmente y conserva todos los exits/logs completos privados. db:verify además requiere stack Supabase real con lint/advisors fail-closed y tipos comparados. CI ejecuta ambos; SQL shim no es aceptación JWT/Data API.

build:isolated exige tracked changes committed, crea git archive HEAD en temporal nuevo, rechaza env tracked salvo .env.example y symlinks externos. Copia node_modules instalado dentro del snapshot (clone APFS o copia completa), verifica versiones contra lock y ejecuta Next instalado con cwd snapshot. Child env es lista positiva con public placeholders ficticios/loopback y telemetría apagada, sin API/OIDC/BD/proxy/tracing/NODE_OPTIONS heredados ni .env.local. Registra commit construido, SHA lock, Node/versions, logs y exit. Puede descargar recursos estáticos Google fonts necesarios en build; no demuestra aislamiento universal de red ni runtime. Task6 posee Auth/JWT/PostgREST/browser/Workflow HTTP/reinicio del mismo artefacto.

workflow:wire conserva veinte payloads originales SDK4.2.4 en tests/fixtures/workflow-wire-before: bytes, hashes, metadata y script original inmutables. Usa serializers/reducers reales del SDK final para lecturas previas y roundtrips: graph/cycles/Error/clases serde/assessment/vistas con offsets sin backing ajeno. DataView fue rechazado en cuatro fronteras del baseline; sólo ese rechazo exacto sería excepción, nunca un error arbitrario. SDK4.8.13+devalue5.9.4 admite DataView: 24 roundtrips. No acredita VM, cifrado/streams, world/HTTP ni replay durable.

## Excepción temporal dev

El gate exige reportes npm v2 completos con contadores coherentes, producción sin advisory de ningún nivel y full sin advisory salvo la excepción exacta. Falla con cualquier advisory no exento o reporte incompleto y conserva JSON full+production y exit npm real. Única excepción provisional revisable, expira **2026-10-18T00:00:00Z**: **GHSA-vfj7-8cjw-p6xm**, braces<=3.0.3, agotamiento de pila con patrones profundamente anidados. Cinco entradas high heredan ese único advisory; no son cinco CVE y full audit no es limpio.

Cadena exacta dev-only: eslint-config-next16.4.1 → @next/eslint-plugin-next16.4.1 (edge16.4.1) → fast-glob3.3.1 (edge3.3.1) → micromatch4.0.8 (edge^4.0.4) → braces3.0.3 (edge^3.0.3). No hay parche compatible3 en el intervalo investigado; no se fuerza major de braces ni downgradeNext14.

Fuente instalada @next/eslint-plugin-next/dist/utils/get-root-dirs.js sólo invoca fast-glob cuando settings.next.rootDir es string/array; con nuestra config usa context.cwd sin glob externo. Checker exige hash exacto de eslint.config.mjs, ausencia rootDir en config evaluado, nodes/versions/rangos/edges/devOnly exactos, consumidores únicos en dependencies/devDependencies/optionalDependencies/peerDependencies (incluida raíz), directness/effects del audit exactos y production audit sin entradas de ningún nivel. Toda nueva rama/consumer/advisory/config o caducidad falla; reloj real sin override CI. Tests negativos: prodnode, otro parent mismo GHSA, otro advisory, rootDir, config cambiado, production advisory y expiry.

Riesgo dev sólo sobre fuente/config revisada, ausente de instalación producción; no acredita imposibilidad de explotación ni autoriza patrones externos. Eliminar excepción al publicarse reparación compatible; revisión independiente decide aceptación. Investigación base: docs/audits/2026-10-10-dependency-upgrade.md. El parche publicado el14octubre está fijado en Next16.4.1, eslint-config-next16.4.1 y React/DOM19.3.1; la aceptación del artefacto se registra en [el audit de mantenimiento](../audits/2026-10-14-security-patch.md). La excepción dev conserva su caducidad y no convierte full audit en limpio.

CI conserva la evidencia fuente y un upload final always con build/wire acotados (2MiB por archivo, hasta16 archivos/10 directorios). Los logs start/reset/verify/stop locales permanecen privados en RUNNER_TEMP; el artefacto sólo publica exit numérico, tamaños y hashes de lectura acotada, nunca texto libre del stack ni claves. Evidencia ausente se marca MISSING_OR_NOT_RUN; no equivale a PASS.
