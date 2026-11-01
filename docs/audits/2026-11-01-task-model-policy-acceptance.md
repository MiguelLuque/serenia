# Políticas de IA por tarea: aceptación técnica y límites

1 de noviembre de2026. Continúa la auditoría y el piloto para Pablo; PRborrador[1](https://github.com/MiguelLuque/serenia/pull/1). Este recibo describe código preparado y sus pruebas; no certifica calidad clínica, acceso al proveedor ni despliegue de producción.

## Comportamiento implementado

- Dispatch de informe distingue arranque y ACK. Un ACK fallido después de start no libera ni reinicia el worker; sólo booleantrue acredita ACK. Los errores de despacho no llevan payloads SDK ni causas crudas.
- resolveTaskPolicy separa conversation, profileExtraction y closureReport. Overrides completos de memoria/informe son independientes; ambos ausentes usan la configuración structured existente. Un par incompleto falla cerrado y fast no se activa implícitamente.
- Conversación45s/2500tokens, perfil20s/1500, informe45s/6000. SDKretries0; informe conserva3retries de Workflow. La regresión con SDKreal y transporte503simulado observó3peticiones antes y1después por ejecución del paso. No es un límite observado de intentos internos del Gateway ni de todos los claims/leases del job.
- Perfil captura una política y registra el modelId solicitado de esa misma generación. Ambos generadores de informe saneen fallos de generación antes de historial/logs/revisión manual; evidencias y claims conservan sus errores propios.
- Contexto se relee por turno; se corrigió un comentario que prometía caché de sesión. Varias consultas independientes no se presentan como snapshot transaccional.

No se han cambiado los modelos de producción: la configuración no secreta verificada17:28UTC conserva openai/gpt-5.4-mini en sus tres roles anteriores. Los modelos nuevos son candidatos de evaluación, no ganadores demostrados.

## Evidencia local

[Dispatch](2026-11-01-dispatch-ack-implementation.md): RED14, focused18 y1127tests con lint/tiposPASS; [revisión](2026-11-01-dispatch-ack-review.md) C0/I0/M0. [Políticas](2026-11-01-task-model-policy-implementation.md): focused265,1140tests/90archivos, lint/tiposPASS; [revisión](2026-11-01-task-model-policy-review.md) C0/I0/M0. Se conservan los fallos previos por permisos de loopback y el aviso no fatal del temporizador de jsdom.

[Proyección](2026-11-01-model-cost-projection-implementation.md): full1146/92antes de la correcciónI1, focused8después, lint/tiposPASS. La revisión detectó validaciones de uso nulo/caché y llamadas0; se corrigieron y la [revisión acotada](2026-11-01-model-cost-projection-fix-review.md) cerró I1. La [revisión global](2026-11-01-task-model-policy-final-review.md) sólo encontró aclaraciónM1 de fases; [fixreview](2026-11-01-task-model-policy-final-fix-review.md) C0/I0/M0. Gates globales del árbol limpio se registrarán por separado al ejecutarse; no inferir su PASS de estas pruebas.

## Selección y costes preparados

El [estudio actual](../research/2026-11-01-model-cost-selection.md) verifica498modelos públicos y selecciona seis para la [calculadora reproducible](../research/2026-11-01-model-cost-projection.json). Ejecutar `rtk npm run ai:costs`: no genera texto ni lee credenciales. Las tarifas son snapshotStandard1nov con tramos por llamada; caché disjunta, razonamiento dentro de salida y todos los intentos sumados. Uso ausente es unknown, no0.

Misma carga sintética de20turnos+20extracciones+1informe:0,37725USD todoGPT5.4mini frente a0,10100USD Luna/Luna/Sol (73,23%menos en ese supuesto). El escenario de4extracciones es distinto, no cambio de cadencia. Ninguna cifra es consumo medido ni evidencia de equivalencia de calidad.

El [manifiesto](../research/2026-11-01-model-evaluation-manifest.md) prepara fase1de74llamadas ficticias sin continuaciones, estimación máxima baseStandard2,4694USD bajo sus caps. Fase2deejecución de herramientas/continuación queda aparte, NOT_PLANNED/NOT_RUN, con nuevos casos/caps/autorización. Ambas conservan revisión clínica pendiente. No hubo inferencias de pago; la aprobación solicitada de hasta5USD de créditos existentes no incluye compras/recargas ni promoción de modelos.

## Decisiones y límites

Se conserva SQL como autoridad y un interlocutor con workers por tarea, evitando una segunda máquina de estado clínica. Coste si faltara una necesidad real de autonomía: migración posterior explícita y evaluada. Se conserva configuración efectiva hasta comparar; coste: ahorro sólo estimado por ahora. Se conserva contexto fresco por turno; coste: entradas repetidas y cambios de contexto dentro de la sesión.

Main y producción continúan retenidos por el gate de dependencias documentado en [el bloqueo](2026-11-01-dependency-fix.md), la aplicación de SQLremoto y el acceso/evaluación del modelo. No se rebajaron gates, crearon claves, cambiaron presupuestos/modelos productivos ni enviaron correos nuevos. Los resultados clínicos y la fluidez real pertenecen a las pruebas posteriores con proveedor y Pablo.
