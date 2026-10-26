# Evaluación contextual sustentada en evidencia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Aplicar la investigación al piloto y corregir dos distorsiones verificadas de evidencia sin habilitar diagnóstico autónomo.

**Architecture:** Reutilizar prompts piloto, builder de continuidad y workflow de informe. Extraer la presentación de ítems a un helper puro si ayuda a verificar procedencia. Preservar scoring, datos canónicos y esquema; los resultados clínicos continúan pendientes.

**Tech Stack:** TypeScript, Vitest4.1.12, Next16.4.1 instalado, AI6.0.303, Supabase existente sin cambios SQL.

**Spec:** `docs/superpowers/specs/2026-10-26-evidence-informed-assessment-design.md`.

## Global Constraints

- Shell con prefijo `rtk`; no secretos/datos reales ni modelos de pago.
- Sin dependencias ni migraciones; conservar instrumentos/bandas, guardrails y esquema de salida.
- Baseline `a852e9c`; rama `codex/evidence-informed-assessment`, trabajo en checkout existente por restricción de escritura del worktree gestionado.
- Prompts base sin cambios; piloto 0.2.0-pilot explícitamente pendiente de revisión clínica.

## Review Focus

- C-SSRS2=No con ítems3–5 normalizados: no atribuir respuesta directa ni cambiar puntuación.
- C-SSRS6=No con7 normalizado y filas desordenadas: misma semántica, sin inventar datos ausentes.
- Informe rechazado sin revisión previa: reconocer retorno sin reinyectar interpretación rechazada.
- Informe validado y borrador genuino: conservar prioridad de fuentes y controles existentes.
- Metadatos de prompts piloto: hashes reales con calidad online NOT_RUN; nunca un aprobado clínico por tokens en un prompt.

### Task1 — Memoria sin informes rechazados

**Files:** `lib/server/patient-context/builder.ts`; `lib/server/patient-context/__tests__/builder.test.ts`.

- [x] Añadir regresión que filtre rejected y preserve retorno sin resumen, borrador genuino y revisión válida.
- [x] Ejecutar focal y observar fallo por comportamiento anterior.
- [x] Excluir rejected de la fuente de borrador, sin borrar otras fuentes.
- [x] Ejecutar builder/render/contexto; registrar RED/GREEN y revisión.

### Task2 — Procedencia de saltos C-SSRS en informe

**Files:** `lib/server/workflows/generate-assessment.ts`; helper puro en `lib/server/assessments/`; `tests/workflows/generate-assessment.test.ts` y/o test focal del helper.

- [x] Añadir regresiones de ítems3–5/7 no aplicables por regla, respuestas aplicables y otros instrumentos.
- [x] Observar RED con el formatter previo o el helper inexistente.
- [x] Aplicar anotación conservadora al camino real del workflow. Mantener etiquetas/orden de los ítems aplicables y resultados canónicos.
- [x] Probar integración de prompt y suite focal; no cambiar validación/scoring/BD.

### Task3 — Método, fuentes y casos de revisión

**Files:** `docs/research/2026-10-26-psychological-assessment-evidence.md`; ambos `docs/agents/prompts/*.pilot.md`; `docs/handoff/para-pablo-piloto-2026-10-25/evidencia-casos-2026-10-26.md`; README/changelog pertinentes.

- [x] Sintetizar guías oficiales y estudios primarios con limitaciones; distinguir diagnóstico, cribado, formulación y resultados terapéuticos.
- [x] Aplicar al piloto entrevista contextual proporcionada, alternativas pertinentes sin diagnosticar y decisiones compartidas; mantener límites y seguridad.
- [x] Preparar casos ramificados para Pablo con resultados aún NO EJECUTADOS.
- [x] Revisión independiente de transferencia/evidencia, sin tests que pretendan probar clínica por presencia de frases.

### Task4 — Inventario de piloto y aceptación integral

**Files:** `lib/server/llm/evaluation.ts`; `tests/llm/evaluation.test.ts`; auditoría de aceptación nueva.

- [x] RED→GREEN para incluir hashes/versiones reales de los dos prompts piloto además del inventario base, manteniendo gates online NOT_RUN.
- [x] Ejecutar evaluador offline, suite focal y revisión independiente del delta.
- [x] Commit explícito de archivos revisados; ejecutar `rtk npm run verify` sobre ese commit y conservar todos los logs/exits.
- [x] Documentar estado verificado, límites y siguiente prueba de Pablo. No publicar ni enviar el correo en esta ronda.
