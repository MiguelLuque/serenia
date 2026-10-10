# Robust MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Corregir los bloqueos demostrados de Serenia y entregar un MVP local verificable con una selección de IA fundamentada.

**Architecture:** Mantener la arquitectura existente. Autorización y transiciones viven en servidor/SQL; LLM y modelos de decisiones no pueden autorizar efectos. Operaciones clínicas sensibles se consolidan en transacciones e idempotencia, con recuperabilidad tras fallo externo.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, AI SDK, Workflow, Vitest y navegador instalado.

**Spec:** `docs/superpowers/specs/2026-10-10-robust-mvp-design.md`.

## Global Constraints

- Toda shell se prefija con `rtk`; usar herramientas instaladas y lockfile. Leer documentación Next instalada relevante antes de editar código.
- Trabajar en `codex/serenia-robust-mvp`. No tocar BD remota, desplegar, enviar mensajes externos ni imprimir secretos.
- No promover prompts clínicos draft ni cambiar bandas/cortes aprobados. Edad mínima: 18 años.
- Escribir regresiones primero y observar el fallo por la razón esperada. Conservar logs completos de fallos fuera de la salida rutinaria.
- Implementadores no crean otros agentes. Un bloque de implementación a la vez; revisión independiente después de cada bloque. Investigación de modelos puede avanzar en paralelo.
- Las pruebas de PostgreSQL usan un contenedor efímero y actores ficticios. Registrar las diferencias entre ese entorno y Supabase hospedado.

## Review Focus

- Llamadas directas a Supabase con un paciente malicioso, incluso fuera de Next.
- Dos peticiones simultáneas o repetidas de cierre, revisión y envío de respuestas.
- Caída entre commit SQL y enqueue, y una respuesta LLM que no se persiste.
- Crisis explícita durante un cribado pendiente o al agotar el tiempo.
- Navegación/recarga tras error o revisión: estado visual y versión clínica coherentes.

## Task 1: Permisos, relaciones y revisión clínica

**Files:** `supabase/migrations/`, `lib/shared/supabase/types.ts`, `lib/server/supabase/`, `app/app/clinica/sesion/[sessionId]/actions.ts`, `lib/server/workflows/generate-assessment.ts`; nuevas pruebas SQL/harness y regresiones clínicas.

**Interfaces:** Mantener las firmas de acciones exportadas. Mantener `close_session_atomic(p_session_id,p_user_id,p_reason)`, autenticando identidad dentro de SQL. Las nuevas operaciones clínicas pueden usar RPC tipadas con privilegios mínimos. Task 2 adapta las escrituras de chat/cuestionarios a los permisos endurecidos.

- [ ] Añadir y ejecutar regresiones que impidan autopromoción, cierre ajeno, referencias cruzadas y estados reviewed fabricados; preparar harness PostgreSQL con pacientes A/B y clínico.
- [ ] Añadir migración correctiva con protección de rol, políticas de escritura mínima y pertenencia a entidades padre, cierre autorizado/atómico/idempotente y revisión/tareas transaccionales.
- [ ] Corregir la restauración histórica para que el bootstrap no dependa de cuentas reales; mantener los registros existentes sin inventar fixtures de pacientes.
- [ ] Adaptar acciones de revisión, confirmar/rechazar/editar, y proteger lecturas service-role del worker con ownership antes de consumir transcript.
- [ ] Ejecutar pruebas focalizadas y SQL desde cero. Confirmar una sola closure vigente y tareas idempotentes tras edición/aprobación concurrentes.
- [ ] Registrar cambios, RED/GREEN, comandos, resultados y limitaciones en el informe del bloque; revisión independiente y correcciones antes de cerrar el bloque.

## Task 2: Chat, cuestionarios y recuperación operativa

**Files:** `app/api/chat/route.ts`, `app/api/questionnaires/`, `app/api/internal/close-stale-sessions/route.ts`, `proxy.ts`, `lib/server/supabase/middleware.ts`, `lib/server/chat/`, `lib/server/sessions/`, `lib/server/questionnaires/`, `lib/server/workflows/index.ts`, `lib/shared/chat/`, migraciones y tipos necesarios; tests asociados.

**Interfaces:** Conservar transporte AI SDK y exports de servicios cuando sea seguro. El modelo recibe historial servidor y el nuevo turno autorizado. Persistencia de resultados/asistente usa operación servidor autorizada, compatible con Task 1. Recuperación usa un estado persistente o sweep de sesiones closed sin informe con idempotencia explícita.

- [ ] Regresiones RED: rechazo de system/assistant/tool falsificados, confirmación sin propuesta/aceptación, segundo cuestionario tras scored, respuesta parcial sin escrituras, señal nueva con CSSRS pendiente, crisis al límite, cron sin cookie y enqueue fallido recuperado.
- [ ] Implementar frontera de mensajes, límites e idempotencia; validar cierres server-side. Procesar el último turno y señal antes del límite temporal.
- [ ] Validar opciones y conjunto de respuestas antes de writes; transacción respuestas/resultado/riesgos/estado. Retrys seguros y prioridad de CSSRS; corregir descripción de tool obsoleta ASQ.
- [ ] Unificar cierre manual/lazy/cron; hacer llegar cron a autenticación CRON_SECRET; recuperar closed sin trabajo/informe y limitar la concurrencia/coste del sweep.
- [ ] Ejecutar pruebas focalizadas y ampliar SQL real para atomicidad y concurrencia; informar compatibilidad con contratos de Task 1.
- [ ] Informe del bloque y revisión independiente; resolver hallazgos antes de integración siguiente.

## Task 3: Flujos paciente y clínico

**Files:** `components/chat/`, `components/onboarding/`, `components/auth/`, `components/app/`, `components/clinician/`, `app/app/page.tsx`, `app/app/sesiones/page.tsx`, `app/onboarding/`, `app/(auth)/actions.ts`, `lib/shared/onboarding/`, `lib/server/clinician/`, helpers compartidos y tests; migración de consentimientos si precisa.

**Interfaces:** Usar firmas de acciones de Task 1 y transporte de Task 2. Selección de informe vigente centralizada con estados explícitos. Mantener el esquema de riesgo existente completo. La aceptación conserva versión y fecha sin afirmar que un texto todavía no aprobado autoriza el lanzamiento.

- [ ] Regresiones RED sobre 18.º cumpleaños, menor/futuro/fecha imposible; errores del chat recuperables; cuestionario nuevo sin estado heredado; riesgos visibles/editables; informe rejected/superseded oculto y nombre disponible.
- [ ] Implementar validación adulta, registro de aceptación y gating coherente con usuarios existentes; mensajes precisos sin promesa inventada de revisión actual.
- [ ] Implementar recuperación del chat preservando texto, estados accesibles y selección semántica; permitir escribir mientras existe cribado pendiente para no bloquear una señal urgente. C-SSRS con ramas documentadas y normalización compatible con Task 2. Conservar ventana temporal vigente y registrar discrepancia para acuerdo clínico.
- [ ] Mostrar/editar heteroaggression/substance_use_acute y actualizar la prioridad de bandeja conservando reglas aprobadas; resolver revisión antigua oculta por limit prematuro.
- [ ] Usar la versión autorizada de informes y fallback de nombre informal; verificar recarga/navegación/error con fixtures sintéticos de paciente/clínico.
- [ ] Informe, tests de componentes/navegador y revisión independiente.

## Task 4: Dependencias, gates y evaluación de modelos

**Files:** `package.json`, lockfile, `next.config.ts`, `eslint.config.mjs`, `hooks/use-mobile.ts`, tests con errores lint, scripts/CI, `.env.example`, configuración/adaptadores LLM y `docs/audits/`.

**Interfaces:** Mantener roles conversational/structured/fast compatibles; no habilitar decisiones en pacientes sin evaluación. Harness de modelos usa entradas sintéticas, versión/modelo registrados, límites de gasto explícitos y no imprime entradas privadas. Si no hay credenciales aprobadas, evaluación offline pasa y comparación online queda no ejecutada.

- [ ] Fijar dependencias corregidas tras investigar advisories y uso real; retirar herramientas CLI del runtime si corresponde, sin `audit fix --force`. No instalar en el node_modules de otro checkout.
- [ ] Resolver errores lint de fuente y pruebas con tipos útiles, raíz Turbopack explícita y scripts de typecheck/verify/DB. Añadir CI con gates fail-closed y reporte de vulnerabilidades.
- [ ] Documentar comparativa de modelos con fuentes primarias, precio de entrada/salida, capacidades y límites; evaluar Jev/Decisions como capa auxiliar. Separar ahorro proyectado y rendimiento medido.
- [ ] Añadir escenarios y procedimiento de evaluación en español con errores críticos, abstención/calibración, latencia/coste y estabilidad de esquema; bandera de decisiones apagada por defecto.
- [ ] Consolidar auditoría con estado de cada hallazgo y roadmap de gates externos. Actualizar README con configuración, arranque y comandos exactos.
- [ ] Ejecutar `npm test`, `npm run lint`, typecheck, build, SQL/harness y navegador sobre artefacto final; revisar toda la rama con agente independiente y corregir regresiones.

## Entrega

No declarar listo para pacientes reales sin migraciones aplicadas y aceptación de producción, revisión clínica pendiente resuelta y tratamiento de datos aprobado. Entregar rama/diff revisables, reporte de verificación local y próximos pasos concretos. La publicación requiere decisión explícita sobre el resultado construido.
