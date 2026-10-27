# Conversation tool feedback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Que el piloto reciba resultados de herramientas y los pueda explicar sin ciclos de nuevas acciones.

**Architecture:** Continuación de dos pasos del SDK instalado, con paso final de sólo texto y ejecución serial protegida. Proyección mínima de resultados confirmados del historial a contexto textual, sin restaurar argumentos arbitrarios.

**Tech Stack:** Next16.4.1, AI6.0.303, Vitest4.1.12 instalados; sin cambios de dependencias.

**Spec:** `docs/superpowers/specs/2026-10-27-conversation-tool-feedback-design.md`.

## Global Constraints

- Cwd del worktree actual, rama `codex/conversation-tool-feedback`, base `f7ef556`; shell `rtk`.
- Piloto solamente; referencia y gates SQL intactos. Sin datos reales ni proveedor remoto.
- Timeout45s global, dos pasos como máximo, presupuestos actuales de contexto y respuesta.
- Cierre sólo tras persistencia confirmada; preservar recuperación/replay y fallback de seguridad.

## Review Focus

- Proveedor que intenta llamar a herramientas en la continuación pese a toolChoice:none.
- Dos herramientas concurrentes donde la primera autoriza cierre: ninguna operación después.
- Tool-only history, resultado propuesto frente a completado y salida desconocida/no confirmada.
- Generación fallida después de crear una instancia o autorizar cierre: no fabricar persistencia final.
- Turnos sin tool, referencia sin flag y replay: sin llamadas extra ni efectos repetidos.
- Presupuesto de salida compartido entre pasos; contabilización ausente/inválida no habilita una nueva generación.

### Task1 — Ciclo SDK y guard de acciones

**Files:** `tests/helpers/chat-harness.ts`; nuevo `tests/chat/tool-feedback.test.ts`; `app/api/chat/route.ts`.

- [x] Añadir modo de harness con SDK real y proveedor ficticio; regresión RED de resultado→segunda generación.
- [x] Añadir continuación acotada y ejecución serial/guard del servidor. Tools existentes y autorización sin cambios.
- [x] Verificar creación/bloqueo, cierres, proveedor desobediente, concurrencia, error/replay y referencia; GREEN focal.

### Task2 — Contexto factual de operaciones anteriores

**Files:** `lib/server/chat/tool-feedback.ts`; `tests/chat/tool-feedback-history.test.ts`; `app/api/chat/route.ts`.

- [x] RED para recuperar resultados confirmados, sin confundir propuesta con administración ni usar herramientas del usuario.
- [x] Proyectar sólo shapes conocidos, sin argumentos libres ni instrucciones; mantener presupuestos del historial.
- [x] Verificar integración en el prompt del siguiente turno y regresiones de frontera/contexto; GREEN focal.

### Task3 — Revisión y aceptación

- [x] Revisión independiente de sólo lectura del delta; corregir hallazgos materiales con RED→GREEN.
- [x] Commit fuente y siete gates nativos; conservar todos los logs/exits y SHA construido.
- [x] Recibo técnico con límites; mantener sin publicar y sin declarar conversaciones/modelo/diagnóstico validados.
