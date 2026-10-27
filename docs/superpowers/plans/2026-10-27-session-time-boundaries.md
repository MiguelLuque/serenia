# Session time boundaries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task with RED→GREEN and final independent review.

**Goal:** Temporalidad clara para agente/persona y cierre fiable con conversación y borrador preservados.

**Architecture:** Helpers temporales compartidos; contexto por generación y cierre persistido con data-part del servidor. Server Actions con ownership/fecha para cerrar y sincronizar, UI con reloj orientativo y borrador controlado. Mantener RPCs/outbox y políticas actuales.

**Tech Stack:** Next16.4.1/React19.3.1, AI6.0.303, Vitest4.1.12; dependencias fijadas.

**Spec:** docs/superpowers/specs/2026-10-27-session-time-boundaries-design.md.

## Global Constraints

- Cwd /Users/miguelluque/git/serenia; shell rtk; base ebe41d1 incluye incrementos previos.
- Sin datos reales, secretos, nuevos cortes clínicos, SQL ni despliegue.
- Conservar60min/30min, recuperación por ID, seguridad antes de límite y cierre/outbox atómicos.

## Review Focus

- Mensaje a59:59 que termina después de60; contexto lento y segunda generación que cruzan el límite.
- Reloj navegador adelantado/atrasado, regreso a pestaña y estado guardado.
- Retry/replay vencido, cierre fallido y cierre denegado con turno activo.
- Borrador escrito mientras llega cierre o snapshot closed; no redirección/refresh que lo borre.
- Inactividad y señal nueva; no interpretar un contador como cierre persistido ni prometer cron puntual.

### Task1 — Tiempo del agente y cierre de la respuesta

Files: shared/chat/session-time.ts, server/chat/session-time-notice.ts, api/chat/route.ts y tests/chat/session-time.test.ts.
- [x] RED avisos siempre presentes, entrada vencida, contexto tardío y respuesta que cruza límite.
- [x] Helpers/estado fresco por generación; footer y data-part de cierre guardados juntos; bloquear nuevas propuestas tardías.
- [x] GREEN ruta/SDK/seguridad/replay y resolver de inactividad ordinaria.

### Task2 — Estado y cierre propios del servidor

Files: app/app/chat-recovery-actions.ts, app/app/sesion/[id]/page.tsx y tests de acciones/SSR.
- [x] RED propiedad, fecha, pending, error y SSR vencido con turno en curso.
- [x] Datos de reloj al cliente; acción de cierre explícito sin redirect; SSR conserva recuperación sin cerrar antes.
- [x] GREEN; no inventar cierre/informe ante error.

### Task3 — Contador, borrador y recuperación

Files: components/chat/{chat-view,chat-input}.tsx y pruebas jsdom.
- [x] RED reloj desfasado, cierre sin confirmación, retry vencido y borrador al cerrar.
- [x] Reloj anclado/sincronizable, cierre explícito, reintento permitido, borrador controlado retenido y avisos de estado correctos.
- [x] GREEN regresiones; checklist React/accesibilidad y pruebas de cron existentes.

### Task4 — Revisión y aceptación

- [x] Revisión independiente, corregir hallazgos materiales con RED→GREEN.
- [x] Commit fuente y siete gates completos; registrar SHA/logs y límites del proveedor/prueba clínica.
- [x] Recibo y guía para Pablo; mantener rama sin publicar.

Aceptación: fuente c18d4ea, siete gates PASS,927 tests; ver docs/audits/2026-10-27-session-time-boundaries.md. Rama conservada sin publicar.
