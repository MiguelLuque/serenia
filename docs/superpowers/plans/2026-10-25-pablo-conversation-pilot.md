# Pablo conversation pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar variante ejecutable y casos ficticios para revisión de evaluación y conversación por Pablo.

**Architecture:** Dos prompts piloto seleccionados sólo por configuración del servidor; mismo modelo, persistencia, instrumentos y contrato SQL. Corregir coherencia del contexto y fidelidad del informe. El piloto permite contextualizar la señal léxica antes de la respuesta conversacional, conservando trazabilidad/fallback y límites explícitos.

**Tech Stack:** Next16.4.1, AI SDK6.0.303, Zod4.6.6, Vitest4.1.12; dependencias instaladas/fijadas.

**Spec:** `docs/superpowers/specs/2026-10-25-pablo-conversation-pilot-design.md`.

## Global Constraints

Sin SQL, bandas/cortes, nuevas escalas, proveedores, claves, datos reales, publicación o notificaciones. Sólo prueba supervisada ficticia; flag rechazado en production. Preservar auth, ownership, admisión/persistencia/replay, cierre y fallback. No atribuir una respuesta sintética a un modelo real. Gates de dependencia/build del proyecto obligatorios.

## Review Focus

- Corrección que repite una palabra sensible: llega al modelo en piloto con historial y aviso contextual, sin perder registro ni fallback.
- Resultado puntuado durante otro turno: se conserva como hecho disponible, sin inventar que fue devuelto.
- Regreso sin informe y tareas máximas: no falsa primera visita ni pérdida de invariantes.
- Duda/rechazo de cuestionario o cierre: no aceptación implícita ni afirmación falsa de operación completada.
- Campo de riesgo no explorado o acceso fallido: incertidumbre explícita; un error de lectura no produce ausencia.

### Task 1: Procedencia y configuración de variante

**Files:** `lib/server/llm/clinical-pilot.ts`, `lib/server/llm/prompts/{index,loader}.ts`, `docs/agents/prompts/{session-therapist,clinical-report}.pilot.md`, `tests/llm/clinical-pilot.test.ts`, `package.json`, `.env.example`.

**Interfaces:** `clinicalPilotEnabled(env = process.env): boolean`; `getClinicalReportPrompt(): string`; getters seleccionan cuatro assets literales (dos base, dos piloto), sin rutas libres.

- [ ] Escribir prueba que falla: on selecciona piloto fuera de producción; off mantiene base; production+on rechaza; drafts/rutas arbitrarias siguen rechazados.
- [ ] Implementar selección, prompts según spec, script loopback `dev:clinical` y documentación de flag.
- [ ] Verificar `rtk npm test -- tests/llm/clinical-pilot.test.ts tests/llm/prompts.test.ts tests/llm/evaluation.test.ts` y guardar evidencia.

### Task 2: Contexto coherente

**Files:** `lib/server/patient-context/render.ts`, `lib/shared/protocol/render-phase.ts` y sus tests existentes.

**Interfaces:** Conservar firmas públicas. El renderer respeta `isFirstSession`; instrucciones/riesgo se preservan en el límite2500; mantenimiento distingue cierres y trabajo completado.

- [ ] Regresiones RED con cinco tareas de500 y retorno sesión2 sin informe.
- [ ] Corregir presupuesto por secciones, retorno y afirmación de protocolo completado.
- [ ] Ejecutar tests de render/protocolo y tipos; informar límites longitudinales sin nueva persistencia.

### Task 3: Orquestación contextual de prueba

**Files:** `app/api/chat/route.ts`, `lib/shared/chat/pilot-safety-notice.ts`, tests nuevos de piloto y helper harness si necesario.

**Interfaces:** `buildPilotSafetyNotice({crisis,safetyState}): string`; la ruta sólo cambia bypass léxico cuando piloto está habilitado. API/RPC/schema externos intactos.

- [ ] RED: aclaración repetida llega al modelo en piloto; misma señal conserva bypass base; fallback con contexto fallido/expiración conserva respuesta de seguridad; estado agudo no desaparece del prompt.
- [ ] Implementar aviso e integración. Conservar `p_crisis/p_urgent`, precedencias y guard SQL.
- [ ] Ejecutar tests de piloto, seguridad, cierre y boundary; no declarar clasificación clínica validada por mocks.

### Task 4: Devolución y reporte fieles

**Files:** resultado de chat en `app/api/chat/route.ts`, `lib/server/{assessments/generator,workflows/generate-assessment}.ts`, tests correspondientes.

**Interfaces:** Mismo esquema JSON; prompts vía getter central. En piloto hechos canónicos de todas las instancias scored actuales; error de lectura de riesgo se propaga. Evento textual se identifica como observación automática en contexto del informe.

- [ ] RED: resultado no desaparece por mensaje posterior y otro cuestionario no lo oculta; lectura riesgo fallida impide generación.
- [ ] Implementar hechos disponibles y anotación de procedencia; no afirmar que se recibió/devolvió por timestamp.
- [ ] Ejecutar tests de resultados/generador/workflow y tipos.

### Task 5: Material de prueba, revisión y aceptación

**Files:** `docs/handoff/para-pablo-piloto-2026-10-25/README.md`, casos/rúbrica y `docs/audits/2026-10-25-pablo-pilot-acceptance.md`.

- [ ] Conservar notas originales, localizar evidencia, redactar diferencias de esta versión y11 episodios con ramas/criterios no ejecutados.
- [ ] Revisión independiente del diff completo y corregir fallos materiales con regresiones.
- [ ] Commit local de fuentes revisadas y ejecutar `rtk npm run verify` (siete gates, logs privados; no build de cambios sin commit). Declarar fallos/no ejecutados explícitamente.
- [ ] Entregar comando de arranque local, modo base para comparación, guía y resultados técnicos; pruebas de Pablo/calidad de modelo quedan separadas.
