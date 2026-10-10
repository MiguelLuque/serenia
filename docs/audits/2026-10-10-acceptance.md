# Aceptación local del MVP robusto

Estado: pendiente de completar Tasks 2–4. Esta matriz define la evidencia requerida; no certifica que los flujos ya funcionen.

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
| Bootstrap | Todas las migraciones y seed desde vacío; instrumentos retirados no reaparecen | Migraciones PostgreSQL Task 1 pasan; seed/stack Supabase pendientes |
| Permisos paciente | Sin autopromoción, cierre ajeno ni fabricación de informes/resultados/riesgos | SQL real Task 1 aprobado; Auth/Data API pendientes |
| Informe privado | Data API paciente no entrega notas ni orientación diagnóstica; resumen revisado scoped | Task 3 pendiente |
| Adultos y aceptación | Fechas reales, cumpleaños 18, consentimiento versionado y puerta servidor coherente | Task 3 pendiente |
| Chat | Un turno autorizado, historial servidor, retry con mismo ID y error recuperable | Task 2 en ejecución; UI Task 3 pendiente |
| Seguridad | Señal nueva durante cribado y al límite temporal se procesa antes del cierre | Task 2 en ejecución |
| Cuestionarios | Conjunto completo validado antes de writes; ramas CSSRS; retry sin duplicados | Task 2 en ejecución; UI Task 3 pendiente |
| Cierre e informe | Manual/lazy/cron convergen; enqueue fallido se recupera con trabajo acotado | Task 2 en ejecución |
| Revisión clínica | Editar/confirmar/rechazar conserva una versión vigente y progreso de tareas | SQL Task 1 y revisión independiente aprobados; UI pendiente |
| Bandeja | Pendientes antiguos y todas las dimensiones de riesgo visibles | Task 3 pendiente |
| Recarga | Resumen vigente, nombre y estado se mantienen al navegar y recargar | Task 3 pendiente |
| Herramientas Supabase | SDK/CLI fijados, SSR refresh preservado, tipos/advisors estrictos | MCP docs ejecutado; implementación Tasks 2/4 pendiente |
| Gates finales | Tests, lint, tipos, build, SQL, vulnerabilidades y navegador sobre versión final | Pendientes tras integración |

## Evidencia de entrega

Registrar commit construido, comandos, resultado y ruta de logs completos. Conservar los fallos y distinguir `PASS`, `FAIL`, `NOT RUN` y `BLOCKED`; la ausencia de un gate nunca equivale a éxito. Una revisión de código independiente sigue a cada bloque y a toda la rama.

## Fuera de la aceptación local

Aplicación de migraciones y smoke en producción, configuración de proveedores y tratamiento de datos, aprobación de textos legales, discrepancias clínicas pendientes, canal operativo de urgencias y comparación online de modelos. No publicar ni abrir acceso a pacientes reales basándose únicamente en esta matriz local.
