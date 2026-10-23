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

## Auditoría estricta sin excepciones

El gate exige reportes npm v2 completos, contadores coherentes y exit npm congruente. Producción y full deben tener cero advisories de cualquier nivel; cualquier hallazgo, reporte incompleto, error de red o discrepancia de exit falla. Conserva JSON full+production, stderr y exit npm real en directorio privado. npm usa entorno de lista positiva, HOME/cache privados y archivos user/global de configuración vacíos; no hereda credenciales ni proxy del usuario.

La excepción GHSA-vfj7-8cjw-p6xm venció el18octubre y se eliminó, sin extensión ni waiver. GitHub retiró ese advisory el23octubre; braces3.0.3 sigue siendo la versión publicada y el audit actual ya no lo informa. El bloqueo vigente de Vitest4.1.11 se corrige con el backport oficial4.1.12; ver [aceptación23octubre](../audits/2026-10-23-dependency-acceptance.md). No se cambia Next16.4.1, React/DOM19.3.1 ni la configuración/reglas efectivas de ESLint. Tests negativos cubren todos los niveles, la antigua cadena exenta incluso antes de caducar, reportes malformados/inconsistentes, scope desconocido, producción no limpia y discrepancia report/exit. Los audits reflejan el registro consultado en ese momento; no acreditan ausencia universal de vulnerabilidades.

CI conserva la evidencia fuente y un upload final always con build/wire acotados (2MiB por archivo, hasta16 archivos/10 directorios). Los logs start/reset/verify/stop locales permanecen privados en RUNNER_TEMP; el artefacto sólo publica exit numérico, tamaños y hashes de lectura acotada, nunca texto libre del stack ni claves. Evidencia ausente se marca MISSING_OR_NOT_RUN; no equivale a PASS.
