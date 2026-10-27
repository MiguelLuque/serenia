# Continuidad y explicación de herramientas — aceptación técnica

27-10-2026. Rama `codex/conversation-tool-feedback`, base `f7ef556` (incluye piloto0.2). Fuente construida: **`15950a245edbf47607b1cf1d329f55d4a4898527`**. El commit documental posterior no se atribuye a otro build.

## Cambio aplicado

Sólo el piloto puede realizar una segunda generación tras una llamada a herramienta. Recibe el resultado real y dispone únicamente de salida textual; las herramientas quedan desactivadas y sus ejecutores también rechazan operaciones en ese paso. El máximo es dos generaciones y2500tokens de salida solicitada entre ambas, con timeout45s global y límites de contexto/respuesta existentes. La referencia mantiene una generación.

Las operaciones del primer paso se ejecutan en orden. Tras autorizar un cierre no se ejecutan las posteriores del turno. Autorizar no significa cerrar: `finish_chat_turn` sigue siendo quien persiste el mensaje y cierra atómicamente. No se han cambiado SQL, doble confirmación ordinaria ni gate de crisis.

El historial del piloto añade una proyección factual de outputs conocidos y confirmados del servidor, incluidos mensajes anteriores sólo de herramienta. No incorpora argumentos libres, resultados desconocidos/no confirmados ni partes de herramienta de un usuario. Una propuesta de cuestionario no se describe como administración, puntuación ni aceptación clínica.

Una continuación vacía, con llamadas no permitidas o sin contabilización válida de salida produce el error recuperable existente; no se guarda una respuesta satisfactoria vacía. Una instancia creada antes del error puede seguir existiendo: no se afirma que se deshizo. La persistencia de cierre fallida no se presenta como cierre efectuado.

## Evidencia de regresión y revisión

Las pruebas de integración nuevas utilizan **el SDK real instalado** con `MockLanguageModelV3`; sustituyen proveedor y persistencia, no `streamText`. Se complementan con unidades de proyección y guard de ejecutores. Cubren creación y bloqueo de propuesta, prompt del segundo paso, historia tool-only, propuesta/cierre denegado, propuesta y confirmación en mismo turno, operaciones posteriores al cierre, proveedor que desobedece, continuación vacía con/sin texto previo, fallos, replay y presupuesto.

RED observado: dos regresiones reprodujeron una sola generación; después se reprodujeron la operación posterior al cierre, respuesta vacía/inválida y pérdida de resultados en historia. Los logs completos permanecen en `.cache/conversation-tool-feedback/logs/`.

La revisión independiente de contexto fresco ejecutó28/28 pruebas nuevas, sin Critical ni Minor adicionales. Señaló un Important/P2: el límite2500 del SDK era por generación. Se corrigió en una pasada, asignando al segundo paso el remanente de salida reportada; ante datos ausentes, inválidos o presupuesto agotado no se inicia otra llamada. Siete aserciones fallaron antes de corregirlo; después pasaron, junto a dos límites de remanente y las regresiones previas. Focal final:78/78 en seis archivos; lint/tipos exit0.

La contabilización depende de datos de uso del proveedor y del límite que se le solicita; no es una medición independiente de facturación. Otra entrada al modelo puede añadir coste/latencia aunque se mantenga el presupuesto de salida. Ambos siguen sin medirse con un proveedor remoto.

## Siete gates completos

`rtk npm run verify`: exit0, fuente limpia `15950a2`, Node24.14.1, lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`.

| Gate | Resultado |
| --- | --- |
| test | PASS — **895/895**,73 archivos;35 pruebas nuevas respecto a860 |
| lint | PASS |
| typecheck | PASS |
| workflow:wire | PASS |
| db:test | PASS — PostgreSQL efímero |
| audit:dependencies | PASS |
| build:isolated | PASS — archive del SHA exacto, dependencias copiadas, entorno sintético |

Recibo/logs: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-HmP2Ar/results.json`. Snapshot: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-4vvdTZ/project`.

## Límites y continuación

Este incremento cubre el contrato de R3 de la auditoría bajo el flag de piloto. No demuestra que un modelo real explique correctamente los resultados ni que la evaluación sea clínicamente válida. Siguen pendientes las conversaciones con proveedor, revisión de Pablo, pruebas autenticadas de esta versión y validación diagnóstica independiente.

No se ejecutó aceptación alojada ni `db:verify`: no hay cambios de esquema/Auth/RLS y `db:test` no los sustituye. No se consultaron pacientes, copiaron secretos ni usaron proveedores de pago en las pruebas. No se alteraron instrumentos, cortes, modelos, roles, avisos externos o borrador de correo.

Persisten los otros límites del roadmap: no evaluado frente a ausencia, permiso/aplazamiento/cancelación persistidos, semántica durable de señales y memoria de todas las correcciones recientes. R3 no se presenta como solución a esas brechas ni como prueba de precisión diagnóstica.

Trabajo conservado en el worktree actual. Sin merge, push ni despliegue en esta ronda. La ampliación del [paquete de casos para Pablo](../handoff/para-pablo-piloto-2026-10-25/evidencia-casos-2026-10-26.md) distingue estos checks sintéticos de una conversación clínica por ejecutar.
