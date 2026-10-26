# Evaluación contextual piloto0.2 — aceptación técnica y límites

26-10-2026. Rama `codex/evidence-informed-assessment`. Fuente implementada y construida: **`f89a3c32b1fd63b5187cb598d9468498ab2c652b`**. La actualización documental posterior no se atribuye a otro build.

## Entrega aplicada

- [Síntesis científica](../research/2026-10-26-psychological-assessment-evidence.md): guías oficiales y estudios, diferenciando evaluación, cribado, formulación, diagnóstico e intervención.
- Ambos prompts piloto pasan a0.2.0-pilot: entrevista contextual, información desconocida, alternativas pertinentes sin diagnosticar y seguimiento de funcionamiento/experiencia. Prompts base sin cambios.
- `rejected` deja de ser fuente de borrador para la continuidad. Se conservan historia y fuentes independientes; no se borra el informe rechazado.
- El workflow anota ítems C-SSRS no aplicables por regla y diferencia sus ceros normalizados de negaciones directas. Si etiqueta/número o regla/valor discrepan, conserva la evidencia visible y pide revisión. No cambia scoring ni resultados canónicos.
- Evaluador offline inventaría hashes/versiones de los dos prompts piloto además de los base. Declara conversaciones `NOT_RUN` y revisión clínica `PENDING_HUMAN_APPROVAL`.
- [Ocho episodios nuevos para Pablo](../handoff/para-pablo-piloto-2026-10-25/evidencia-casos-2026-10-26.md), todavía NO EJECUTADOS con el modelo ni convertidos en referencia clínica aprobada.

## Regresiones y revisión

Se observaron los fallos antes de corregirlos: rejected como tierB; ítems normalizados presentados como No; inventario piloto ausente. Se conservaron logs RED y GREEN privados en `.cache/pablo-pilot/logs/`; no se atribuye la comprensión del modelo a estas pruebas.

La revisión independiente de contexto fresco confirmó el alcance, la transferencia prudente de fuentes y72/72 pruebas focales. No halló Critical/Important y señaló un caso defensivo: raw/num contradictorios podían ocultar un dato. Se trató como requisito importante de fidelidad, aunque el alta actual lo impida: dos regresiones fallaron antes del arreglo y pasaron después, con104/104 pruebas focales de workflow/validación/scoring. El criterio es conservar ambos valores, no decidir un nivel clínico desde una inconsistencia.

Otras decisiones de implementación: formatter existente en vez de nueva abstracción; sin migración retrospectiva de procedencia perdida; trabajo en rama del checkout permitido después de denegarse la escritura en el worktree gestionado. El worktree sin cambios quedó protegido por el host; no se forzó su borrado. Todos los cambios y verificaciones usan `/Users/miguelluque/git/serenia` explícitamente.

## Siete gates integrales

`rtk npm run verify` terminó con exit0 sobre `f89a3c3`, con árbol fuente limpio. Node24.14.1, lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`.

| Gate | Resultado |
| --- | --- |
| test | PASS — **860/860**,71 archivos;11 regresiones añadidas respecto a849 |
| lint | PASS |
| typecheck | PASS |
| workflow:wire | PASS |
| db:test | PASS — PostgreSQL efímero, sin BD alojada |
| audit:dependencies | PASS |
| build:isolated | PASS — archive del SHA exacto, dependencias copiadas y entorno sintético |

Recibo y logs íntegros: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-UN8PFE/results.json`. Snapshot de build: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-nRlYzZ/project`; metadata del gate en build-isolated.log.

`ai:evaluate:offline` también exit0 sobre el mismo SHA; log `.cache/pablo-pilot/logs/20261026-232806-zypkddau.log`. Identifica base1.1.0 y piloto0.2.0; online quality/calibration y conversaciones del piloto siguen NO EJECUTADAS. El inventario no selecciona ni certifica una configuración alojada.

## Alcance de aceptación

Aceptación técnica del incremento, sin afirmación de eficacia o precisión diagnóstica. No se realizaron conversaciones con el proveedor, revisión de Pablo, prueba autenticada de esta versión ni estudio con pacientes. Tampoco se repitió aceptación hospedada/`db:verify`: no hay cambios de esquema, RLS, Auth ni infraestructura; `db:test` no se presenta como sustituto de esos gates.

La orientación diagnóstica sigue desactivada. Permanecen pendientes: contrato de no evaluado frente a ausencia, decisiones/cancelación persistidas, ciclo de herramientas, contextualización durable de señales y memoria completa de correcciones recientes. El cambio de prompts no cierra esas brechas.

La rama queda conservada para revisión. **No se mergeó ni publicó este incremento**; el despliegue anterior conserva `a852e9c`/piloto0.1. No se enviaron correos ni se modificó el borrador con credenciales. El siguiente ensayo de Pablo debe registrar explícitamente qué versión usa para no mezclar sus resultados.
