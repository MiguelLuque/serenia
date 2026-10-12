# Aceptación local del MVP robusto

Estado: Tasks 1–3 implementadas y revisadas, incluyendo los dos fixes de Task3. Tasks4–5 completas y revisadas, incluyendo guards y entorno del evaluador. Task6 conserva la aceptación integral; las mediciones de modelos externos no se han ejecutado. Evidencia local Task6 y límites actuales en [aceptación integral](2026-10-12-local-acceptance.md); el navegador y la revisión final siguen separados.

## Entornos y límites

- PostgreSQL 17 efímero: migraciones, roles y transacciones reales; `auth.uid()` simulado. No prueba JWT, GoTrue ni PostgREST.
- Supabase local sintético: Auth y Data API reales, con cuentas ficticias creadas para la prueba. No usar `.env.local` ni enlazar un proyecto hospedado.
- Artefacto Next construido: navegador contra `next start` con configuración local explícita. Las pruebas de componentes o fixtures aislados complementan esta evidencia.
- Proveedor IA controlado: SDK y reglas servidor se prueban con modelos sintéticos. No afirmar calidad clínica, latencia ni coste medidos de proveedores externos sin una ejecución aprobada y registrada.

Vía prevista para el proveedor sintético del artefacto: precarga Node de un `ProviderV3` mediante `globalThis.AI_SDK_DEFAULT_PROVIDER`, API documentada de [configuración global AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/provider-management#global-provider-configuration) y confirmada en el SDK 6 instalado (`src/global.ts`, `src/model/resolve-model.ts`). El script de aceptación vive fuera de `app/`, no cambia permisos ni crea un endpoint de prueba en producción. Exigir URL Supabase loopback y limpiar credenciales/telemetría de proveedores del entorno hijo. Verificar también que los workers usan el proveedor sintético; si no, cerrar el gate y no permitir fallback a red externa.

Experimento de preparación ejecutado: Node con `generateText`, ID `anthropic/claude-sonnet-4.6` y `MockLanguageModelV3` a través de la variable global documentada devolvió el texto sintético esperado con exactamente una llamada al mock, sin red. Resultado `PASS SDK6 global provider resolves configured model string to synthetic model; calls=1; no network`. Confirma el mecanismo en el proceso Node; no acredita todavía streaming, preload Next ni aislamiento del worker.

## Matriz

| Flujo | Resultado requerido | Evidencia actual |
|---|---|---|
| Bootstrap | Todas las migraciones y seed desde vacío; instrumentos retirados no reaparecen | PostgreSQL Task4: migraciones, seed repetible y ningún ASQ/cuenta pasan; Supabase local: migraciones/seed aplicados; reset timeout readiness conservado, start posterior PASS |
| Permisos paciente | Sin autopromoción, cierre ajeno ni fabricación de informes/resultados/riesgos | SQL real Task 1 aprobado; Auth/JWT/PostgREST local PASS; ver matriz de roles Task6 |
| Informe privado | Data API paciente no entrega notas ni orientación diagnóstica; resumen revisado scoped | SQL/proyección Task 3 revisados; JWT/PostgREST y revisión/proyección privada local PASS |
| Adultos y aceptación | Fechas reales, cumpleaños 18, consentimiento versionado y puerta servidor coherente | SQL/acciones/API/componentes Task 3 revisados; recorrido real pendiente |
| Chat | Un turno autorizado, historial servidor, retry con mismo ID y error recuperable | Tasks 2–3 revisadas; SDK/DOM pasan; navegador pendiente |
| Seguridad | Señal nueva durante cribado y al límite temporal se procesa antes del cierre | Task 2 revisada; SQL/regresiones y HTTP estático0modelcalls PASSc345887; navegador pendiente |
| Cuestionarios | Conjunto completo validado antes de writes; ramas CSSRS; retry sin duplicados | Task 2 revisada; ramas/reset/radios DOM Task 3 pasan; navegador pendiente |
| Cierre e informe | Manual/lazy/cron convergen; enqueue fallido se recupera con trabajo acotado | Task 2 revisada; SQL/outbox pasan; Workflow generado/provider HTTP y mismo run tras reinicio PASSc345887; navegador pendiente |
| Revisión clínica | Editar/confirmar/rechazar conserva una versión vigente y progreso de tareas | SQL Task 1 revisada; editor/view DOM Task 3 pasan; navegador pendiente |
| Bandeja | Pendientes antiguos y todas las dimensiones de riesgo visibles | SQL paginada/prioridad/paridad y DOM Task 3 revisados; navegador pendiente |
| Recarga | Resumen vigente, nombre y estado se mantienen al navegar y recargar | SDK/DOM Task 3 revisados; navegador pendiente |
| Herramientas Supabase | SDK/CLI fijados, SSR refresh preservado, tipos/advisors estrictos | MCP docs, SDK/CLI, transporte SSR y telemetría aislada verificados; guards Task4 revisados; lint/advisors estrictos sin findings y tipos generados exactos PASS local |
| Gates finales | Tests, lint, tipos, build, SQL, vulnerabilidades y navegador sobre versión final | c345887 todos los siete gates de verify PASS,697tests; navegador/revisión pendientes |

## IA y preparación Workflow

Task5 revisada: 26 seeds sintéticos y checks deterministas offline; adaptadores nativos Jev/Decisions con transporte ficticio, desconectados del paciente y apagados. Sin comparación online de calidad, latencia, calibración ni coste facturado. Build9d63871:27NFT, sólo2prompts activos y package.json como assets de fuente,0env/0fuente ajena/0avisos. Fix4e14be8:38focales, lint/tipos y frontera de entorno del hijo antes de imports; build anterior no se relabela como nuevo. Evidencia en `2026-10-11-ai-implementation.md`.

Preparación instalada Workflow4.8, no runtime PASS: `2026-10-11-workflow-runtime-preparation.md`. Local World es sólo desarrollo/sin autenticación de cola; aceptación enlazada a loopback. Task6 ejecutó herencia real del provider y recuperación del mismo run en c345887; navegador y revisión independiente mantienen su gate propio. Despliegue público requiere protección de ingress/colas o World de producción demostrado.

## Evidencia de entrega

Registrar commit construido, comandos, resultado y ruta de logs completos. Conservar los fallos y distinguir `PASS`, `FAIL`, `NOT RUN` y `BLOCKED`; la ausencia de un gate nunca equivale a éxito. Una revisión de código independiente sigue a cada bloque y a toda la rama.

## Fuera de la aceptación local

Aplicación de migraciones y smoke en producción, configuración de proveedores y tratamiento de datos, aprobación de textos legales, discrepancias clínicas pendientes, canal operativo de urgencias y comparación online de modelos. No publicar ni abrir acceso a pacientes reales basándose únicamente en esta matriz local.
