# Aceptación local del MVP robusto

Estado: Tasks 1–3 implementadas y revisadas, incluyendo los dos fixes de Task3. Task4 completa y revisada tras corregir tres guards; Tasks5–6 conservan los gates de IA y aceptación integral. Esta matriz define la evidencia requerida; no certifica todavía el ciclo completo.

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
| Bootstrap | Todas las migraciones y seed desde vacío; instrumentos retirados no reaparecen | PostgreSQL Task4: migraciones, seed repetible y ningún ASQ/cuenta pasan; stack Supabase pendiente |
| Permisos paciente | Sin autopromoción, cierre ajeno ni fabricación de informes/resultados/riesgos | SQL real Task 1 aprobado; Auth/Data API pendientes |
| Informe privado | Data API paciente no entrega notas ni orientación diagnóstica; resumen revisado scoped | SQL/proyección Task 3 revisados; JWT/PostgREST pendientes |
| Adultos y aceptación | Fechas reales, cumpleaños 18, consentimiento versionado y puerta servidor coherente | SQL/acciones/API/componentes Task 3 revisados; recorrido real pendiente |
| Chat | Un turno autorizado, historial servidor, retry con mismo ID y error recuperable | Tasks 2–3 revisadas; SDK/DOM pasan; navegador pendiente |
| Seguridad | Señal nueva durante cribado y al límite temporal se procesa antes del cierre | Task 2 revisada; SQL/regresiones pasan; artefacto real pendiente |
| Cuestionarios | Conjunto completo validado antes de writes; ramas CSSRS; retry sin duplicados | Task 2 revisada; ramas/reset/radios DOM Task 3 pasan; navegador pendiente |
| Cierre e informe | Manual/lazy/cron convergen; enqueue fallido se recupera con trabajo acotado | Task 2 revisada; SQL/outbox pasan; Workflow generado y reinicio pendientes |
| Revisión clínica | Editar/confirmar/rechazar conserva una versión vigente y progreso de tareas | SQL Task 1 revisada; editor/view DOM Task 3 pasan; navegador pendiente |
| Bandeja | Pendientes antiguos y todas las dimensiones de riesgo visibles | SQL paginada/prioridad/paridad y DOM Task 3 revisados; navegador pendiente |
| Recarga | Resumen vigente, nombre y estado se mantienen al navegar y recargar | SDK/DOM Task 3 revisados; navegador pendiente |
| Herramientas Supabase | SDK/CLI fijados, SSR refresh preservado, tipos/advisors estrictos | MCP docs, SDK/CLI, transporte SSR y telemetría aislada verificados; guards Task4 revisados; stack/tipos/advisors reales pendientes |
| Gates finales | Tests, lint, tipos, build, SQL, vulnerabilidades y navegador sobre versión final | Pendientes tras integración |

## Evidencia de entrega

Registrar commit construido, comandos, resultado y ruta de logs completos. Conservar los fallos y distinguir `PASS`, `FAIL`, `NOT RUN` y `BLOCKED`; la ausencia de un gate nunca equivale a éxito. Una revisión de código independiente sigue a cada bloque y a toda la rama.

## Fuera de la aceptación local

Aplicación de migraciones y smoke en producción, configuración de proveedores y tratamiento de datos, aprobación de textos legales, discrepancias clínicas pendientes, canal operativo de urgencias y comparación online de modelos. No publicar ni abrir acceso a pacientes reales basándose únicamente en esta matriz local.
