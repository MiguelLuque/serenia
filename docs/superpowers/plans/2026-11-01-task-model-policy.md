# Políticas de modelo por tarea Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Separar políticas de IA, cerrar errores de despacho/reintentos y preparar selección actual de modelos con coste y evaluación reproducibles.
**Architecture:** AI SDK/Workflow actuales, SQL autoritativo; roles por tarea con fallback de configuración legado explícito, sin promoción de modelos ni llamadas online. Proyección offline y manifiesto ficticio separado del runtime.
**Tech Stack:** Next16.4.1/AI6.0.303/Workflow4.8.13/Node24.14.1; sin cambios de dependencias.
**Spec:** docs/superpowers/specs/2026-11-01-task-model-policy-design.md

## Global Constraints

- cwd/Users/miguelluque/git/serenia, rutas absolutas en escrituras de agentes, RTK+AGENTS+Next docs instalados.
- Sin .env.local/credenciales/datos reales/cambiosDB/modelosVercel/dependencias/claves/gasto/email/permisos globales.
- Un implementer a la vez, revisión por task y final. Base915c8e2; root ya creó PRborrador1, main no cambia mientras audit no pase.
- Modelos/precios requieren snapshot1nov y fuentes primarias; actual/estimado/NOT_RUN separados. El ahorro calculado no demuestra calidad.

## Review Focus

- ACK fallido después de worker running/completed no puede liberar/resetear el job; Task1 debe probar ambos intercalados y datafalse.
- Config par incompleto no mezcla proveedor/modelo ni activa fast; Task2 prueba fallo y compatibilidad legado.
- Cambio de env durante extracción no puede cambiar modelId registrado; Task2 prueba política capturada y resultado literal intacto.
- Reintentos no se multiplican entre SDK/Workflow; Task2 prueba opciones reales del SDK o transporte sintético, no sólo constants.
- Proyección no mezcla precios cortos/largos, entrada normal/caché ni cadencias; Task3 prueba fronteras y missingusage sin red.

### Task1: Dispatch de informe robusto

Files lib/server/workflows/index.ts, tests/workflows/outbox.test.ts; SQLfixture si añade prueba real necesaria sin schema.

- [ ] RED start success+ACKerror/throw/false con worker running/completed; start failure+release failure conserva error seguro.
- [ ] Separar fases, preservar fences/backoff, errores seguros sin payloads/causas SDK.
- [ ] FocusedGREEN/lint/types/fullsuite, commit sólo rutas asignadas, reporte+review.

### Task2: Políticas por tarea y límites

Files lib/shared/llm/{config,models,task-policy}.ts; profile extractor/worker; ambos generadores informe; chatroute; .env.example y tests pertinentes.

- [ ] RED nuevos pares override/fallback/incompleto y aliases; extracción/modelId capturado; informe SDKretries0 sin cambiar Workflow3.
- [ ] Implementar interfaces/presupuestos exactos Spec; integrar consumidores sin cambiar gates ni esquema.
- [ ] SDKreal con transporte ficticio verifica límite de intentos y options relevantes; focusedGREEN/lint/types/fullsuite y review.

### Task3: Costes y manifiesto de evaluación offline

Files lib/shared/llm/model-costs.ts (o reutilización mínima de candidates), snapshot filtrado versionado, scripts/model-costs.ts, escenarios y plan ficticio en docs/research, tests/llm.

- [ ] RED estimación referencia0,37725USD y Luna/Luna/Sol0,101USD para20chat8k/600+20perfil6k/1k+1informe16k/2.5k; escenario4perfil separado0,23325/0,0834.
- [ ] CLIoffline sin fetch/proveedores/dotenv; IDs+fecha/fuentes/supuestos, tarifas estándar/tiers y desconocidos explícitos.
- [ ] Manifiesto preparado con casos existentes/caps/candidatos/revisión humana/onlineNOT_RUN; no debilitar evaluador offline.
- [ ] FocusedGREEN/fullsuite/lint/types, ejecutarCLI y reviewer.

### Task4(root): Verificación y entrega

- [ ] Revisión global del delta915c8e2→HEAD, consolidar rulings/reportes y fuentes; verificar código nuevo y build limpio según gates.
- [ ] Actualizar PRborrador con alcance final, evidencia, políticas y bloqueos; sin merge ni nuevo correo.
- [ ] Preparar paso online concreto y presupuesto si resulta necesario, conservar pending sin asumir aprobación por tiempo transcurrido.
