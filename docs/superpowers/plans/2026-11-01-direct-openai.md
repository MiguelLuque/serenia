# Direct OpenAI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir conexión directa a OpenAI por configuración, preservando la conexión Gateway y los contratos de sesión.

**Architecture:** Resolver de modelos sólo en servidor, usando el adaptador Responses del AI SDK. Los consumidores mantienen las políticas por tarea; sólo cambia la construcción del modelo.

**Tech Stack:** AI SDK 6.0.303, adaptador OpenAI 3 compatible exacto, Next 16.4.1, Vitest 4.1.12.

**Spec:** docs/superpowers/specs/2026-11-01-direct-openai-design.md

## Global Constraints

- No `.env.local`, secretos reales, llamadas de pago, cambios productivos o SQL.
- Transporte por defecto Gateway; `openai` explícito, sin fallback.
- OpenAI sólo servidor, API oficial Responses y store false.
- Modelos/budgets/retries/autoridad SQL y clínica conservados.
- Dependencias exactas y gate de auditoría estricto, sin waiver.

## Review Focus

- Configuración errónea o falta de clave nunca envía al servicio alternativo.
- Credenciales ficticias deben aparecer sólo en la petición a OpenAI, nunca en mensajes de error.
- JSON y herramientas funcionan con el SDK real y transporte Responses simulado.
- Resolver se utiliza en las cuatro generaciones, incluida la ruta legacy de informes.
- store false no debe romper la continuación de herramientas sin estado remoto.

### Task 1: Resolver, integración y contratos de transporte

**Files:** Create `lib/server/llm/model-resolver.ts`, `tests/llm/model-resolver.test.ts`; modify cuatro consumidores, package/lock, `.env.example`; add `docs/operations/ai-provider.md`.

**Interfaces:** Consumes `TaskPolicy`; produces `resolveTaskModel(policy: TaskPolicy, env?: Record<string,string|undefined>): LanguageModel` and optional direct-specific provider settings through model middleware, not caller flags.

- [x] Escribir primero tests de configuración, clave, proveedor, Responses y límites, usando fetch en memoria y clave ficticia.
- [x] Ejecutar focused: observar RED por resolver inexistente.
- [x] Añadir adaptador compatible exacto, inspeccionar fuente/docs instaladas e implementar resolver y cuatro consumidores.
- [x] Ejecutar focused y regresiones de políticas/perfil/informes/chat: GREEN.
- [x] Documentar activación/reversión y límites; verificar suite y gates completos, preservando fallos (verify exit 1 por audit previo).
- [x] Commit; revisión independiente del incremento desde 6ae9ea2: C0/I0/M1 de cobertura conjunta SSE pendiente, sin fallo observado.
- [ ] Actualizar PR borrador con estado preparado, sin merge/deploy ni afirmar acceso real.
