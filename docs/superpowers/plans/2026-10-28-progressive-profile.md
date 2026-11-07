# Progressive profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development task by task, with task reviews and final whole-branch review. Root owns integration acceptance.

**Goal:** Perfil progresivo con citas trazables, correcciones y recuperación duradera sin bloquear el chat.

**Architecture:** Outbox transaccional por mensaje, extractor separado en Workflow, proyección acotada y controles de memoria del usuario. Sin nuevo modelo/dependencia.

**Tech Stack:** Next16.4.1/React19.3.1,AI6.0.303,Workflow4.8.13,Supabase CLI2.120.0,Zod4.6.6,Vitest4.1.12/Postgres17.6.

**Spec:** docs/superpowers/specs/2026-10-28-progressive-profile-design.md.

## Global Constraints

- Repo /Users/miguelluque/git/serenia, rama codex/progressive-patient-profile, base11ec2c2; todas shell rtk; no modificar secretos ni estado global.
- FEATURE_PROGRESSIVE_PROFILE apagado por defecto, opt-in owner, sin backfill ni publicación/migración remota ni datos reales.
- Los nombres, campos, límites y RPC son exactamente los definidos en Spec; ninguna observación gobierna clínica, permisos, cierre o scores.
- No cambios de dependencias, de modelo configurado ni de las fricciones UX anteriores fuera del perfil.
- Logs completos privados y siete gates nativos más db:verify y prueba Auth/Data API/Workflow/browser local.

## Review Focus

- Desactivar durante generación y reactivar no permite escribir/resucitar con epoch/token viejos.
- Turnos nuevos/replay/fallidos/interrumpidos no duplican perfil ni pierden cola; orden por usuario con leases vencidos y último intento agotado.
- Cita exacta no prueba atribución: tercero/negación/historia/instrucciones no se promueven a hechos clínicos; faltan datos→no inventar.
- Correcciones concurrentes/rechazadas no restituyen superseded ni presentan como confirmed un target disputado.
- Perfil inaccesible/flagoff/budget agotado no rompe chat ni introduce contextos de otro owner; borrado cascada y ausencia de citas en I/O Workflow.

### Task 1: Persistencia y permisos

Files: migration generada mediante wrapper `migration new progressive_profile`; supabase/tests/progressive-profile.sql; scripts/test-database.py; lib/shared/supabase/types.ts generado localmente.

Interfaces: todas tablas/RPC del apartado RPC contract de Spec; DTO JSON como allí; source_created_at obtenido de message.created_at y session_id por FK. JSON observations usa category/quote/time_scope/supersedes_id. Estados/lease2min/claims3/backoff30s exactamente Spec.

- [x] Escribir regresiones SQL y añadirlas a db:test; ejecutar antes de migración para observar RED por tablas/funciones ausentes.
- [x] Implementar schema/RLS/grants/triggers/RPC con fuentes y targets propios, citas exactas, rechazo de escritura parcial y matriz de estado/fencing/consent.
- [x] Verificar db:test GREEN y concurrencia de claim/review; generar migración con CLI (no nombre inventado). Aplicar sólo esa migración a stack local comprobado, sin reset, y registrar versión local sin inventar historial.
- [x] Generar tipos con db:types:generate; ejecutar db:verify GREEN y conservar evidencia. Commit sólo archivos de Task1 y self-review. Revisión independiente del task.

### Task 2: Extracción, cola y contexto

Files nuevos: lib/shared/profile/schema.ts; lib/server/profile/{config,extractor,context,dispatch}.ts; lib/server/workflows/extract-profile.ts; tests/profile/{extractor,context,workflow,dispatch,integration}.test.ts. Modificar app/api/chat/route.ts, lib/server/chat/system-prompt.ts, cronroute, .env.example, scripts/acceptance-provider.mjs y tests/helpers/chat-harness.ts sólo según necesidad de integración.

Interfaces TS: `progressiveProfileEnabled(env=process.env):boolean`; `ProfileMemorySchema`; `ProfileExtractionSchema`; `validateProfileExtraction(output,sourceText,knownTargets)`; `extractProfileObservations(sourceText,knownTargets)`; `renderProfileContext(memory,currentText)`; `loadProfileContext(client,currentText)` con error aislado; `enqueueProfileExtraction(userId?:string,limit=1)`; `dispatchProfileJob(job)`; `extractProfileWorkflow({jobId,token})`. Usar tipos Task1. Modificar systemPrompt con `profileContextBlock?:string` vacío por defecto; no reordenar piezas existentes. Nueva memoria se carga sólo con flag y own authenticatedclient.

- [x] RED validación: arrays>5,cita ausente/alterada,fuente>8000,citas>400,duplicados/target extraño; empty válido; schema no admite campos diagnósticos. Cubrir unicode/tercero/histórico como corpus semántico, sin etiquetar mocks como calidad de proveedor.
- [x] Implementar extractSchema/strictOutput+prompt, modelo structured existente, límites1500/20s/0retries; devolver citas originales exclusivamente. Guardar source ownership desde job, nunca modelo.
- [x] RED Workflow/outbox: argumentos sóloIDs, replay, fallo de start/model/finish/consent, enqueued ack tardío, cola recuperada. Un step procesa y persiste completo, return sólo IDs/contadores; maxRetries0.
- [x] Implementar dispatch y nudge siguiente propio, after no bloqueante tras claim/replay y cron flagguardado10/2. Salida malformada→failed backoff, no ghost observations.
- [x] RED contexto: confirmed/pending/fechas/disputa,corrección,reject/superseded omitidos, budget4000/8,relevancia simple, escapeJSON y fallos/flagoff sin query/rotura del chat. Implementar proyección/lectura aislada y fresh context cada turno.
- [x] Ampliar preload sintético sólo para marker de extracción (sin bypass Auth/RPC); correr tests de perfil/chat/cron/workflow y typecheck/lint GREEN. Commit archivos propios y revisión del task.

### Task 3: Control del usuario

Files: app/app/perfil/{page.tsx,actions.ts}; components/profile/profile-memory.tsx; components/app/app-sidebar.tsx; app/app/layout.tsx; tests/profile/{actions,view,page}.test.ts(x).

Interfaces: página lee get_profile_memory; acciones auth getUser+onboarding ready+flag y RPC owner-only set_profile_enabled/review_profile_observation con expected_updated_at. No service-role en acciones UI. Datos citados y estado no son validación clínica. Enlace patient only y sólo si flag.

- [x] RED ownership,auth,flagoff,consentdisable,stale review,error guardado; no confirmar éxito antes de RPC. RED UI activación,datos vacíos,cita/fecha/estado,disputa,Confirmar/Descartar,errores y explicación de corrección vía chat.
- [x] Implementar ruta,acciones,UI simple y navegación condicional sin interrumpir chat; copy humano explica qué se recuerda, cómo corregirlo y qué hace desactivar. No prometer borrar conversaciones ni aprobación de Pablo.
- [x] Ejecutar tests, React checklist, lint/typecheck GREEN; commit y revisión del task.

### Task 4: Aceptación de integración y entrega

Root ejecuta verificación; cambios de aceptación en scripts temporales o tooling acotado, no nuevas features.

- [x] Real Auth/JWT/Data API local: activar por usuario, crear mensaje y job, negar otro owner, desactivar mientras pending y comprobar fencing/epoch, no backfill al reactivar.
- [x] Construir snapshot local aceptado con flag sólo de prueba y proveedor sintético. Workflow HTTP generado procesa job, sin quotes en run/step I/O; nueva fuente→pending→confirm→corrección disputada→confirm/reject con UI visible, contexto corregido y sin duplicados.
- [x] Revisión wholebranch con foco Spec, resolver hallazgos materiales en un pase RED→GREEN; no usar la suite en lugar de revisión de permisos/concurrencia.
- [x] Ola final única: I1/P2 paginación owner-only de todas las citas retenidas con cursores estables y acciones de versión exacta; cubrir más de100, empate de fechas, pendientes antiguos, otro owner y descarte que elimina referencias posteriores del extractor. Incluir M1/P3 cierre del drawer al navegar. Un implementer y una revisión scoped de esa ola; mantener excepciones previas explícitas.
- [x] Commit fuente limpio; ejecutar npm run verify (siete) y db:verify; recibo con SHA/logs/limitaciones y casos Pablo. Mantener sin publicar y flagoff por defecto. Fuente técnica aceptada e14a9b7; documentación final posterior sin cambios de producto. [Aceptación](../../audits/2026-10-28-progressive-profile-acceptance.md).
