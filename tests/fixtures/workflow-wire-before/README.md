# Baseline wire de Workflow anterior a Task 4

Capturado el 2026-10-11 con Node 24.14.1, `workflow`/`@workflow/core` 4.2.4, `@workflow/serde` 4.1.1, **devalue efectivo 5.6.3**, nanoid efectivo 5.1.6. La candidata core 4.8.13 del estudio fija devalue 5.9.2: no confundir esa versión propuesta con la fuente de estos payloads.

Artifacts: `metadata.json`, veinte `.bin` originales inmutables con SHA-256 y prefijo SDK `devl`, `replay.mjs`, `verification-4.2.4-1791674259848.json` y `verify-current.log`. Marcador de expectativas: `SERENIA_WORKFLOW_SDK_WIRE_BASELINE_V1`. No sobrescribir el directorio al actualizar; el script capture lo rechaza si existe metadata.

| Caso | SDK encode/decode + lectura de payload guardado | Alcance |
| --- | --- | --- |
| Date/Map/Set/undefined, identidad compartida, ciclo del objeto y Error | PASS en cuatro fronteras | Identidad conservada entre map/set/objeto; Error name/message/stack conservados |
| Uint8Array con offset 3, longitud 4, backing de 10 bytes | PASS en cuatro fronteras | Bytes visibles `[11,22,33,44]`; backing revivido de 4 bytes; sin prefix/suffix ajenos |
| Buffer con mismo offset/backing | PASS en cuatro fronteras | Revivido como Uint8Array por el reducer SDK, no conserva marca Buffer |
| Clase sintética con `@workflow/serde` y registro SDK | PASS en cuatro fronteras | Reducer/reviver Instance real y grafo interno, sin reemplazarlo por JSON |
| Input de assessment con rechazo/jobToken + summary sintético | PASS en cuatro fronteras | Forma representativa de la app; no validación clínica/modelo |
| DataView con offset 3, longitud 4 | FAIL en las cuatro fronteras al codificar | `WorkflowRuntimeError`, causa `Cannot stringify arbitrary non-POJOs`; no existe payload previo de DataView |

La captura terminó exit 0 porque produjo todos los resultados y preservó los rechazos: **no** significa que los 24 casos hayan pasado. La lectura estricta posterior terminó **exit 1**, con 20 lecturas previas PASS, 20 roundtrips actuales PASS y 4 fallos DataView. Es un límite real del baseline, no una regresión atribuible al upgrade.

## API y contexto exactos

`replay.mjs` resuelve los exports `@workflow/core/serialization` y `@workflow/core/class-serialization` desde el checkout elegido; no importa ni invoca raw devalue. Llama las parejas reales `dehydrateWorkflowArguments`/`hydrateWorkflowArguments`, `dehydrateWorkflowReturnValue`/`hydrateWorkflowReturnValue`, `dehydrateStepArguments`/`hydrateStepArguments`, `dehydrateStepReturnValue`/`hydrateStepReturnValue`.

Parámetros explícitos: runId sintético constante, key undefined (sin cifrado), globalThis del host Node, ops=[] donde corresponde; comprueba ops.length=0. La clase usa `WORKFLOW_SERIALIZE`/`WORKFLOW_DESERIALIZE` de `@workflow/serde` y `registerSerializationClass`; no necesita World ni contexto de request para estos valores. Fuentes: `node_modules/@workflow/core/dist/serialization.js` líneas 457, 628, 673, 767 y 1237–1468; `dist/class-serialization.js:registerSerializationClass`.

Se ejecutó bajo env mínimo, sin cargar Next/app/.env. El script rechaza lecturas/open de `.env*` y conexiones de red mediante fetch/HTTP(S)/net/tls/DNS antes de importar el SDK. No creó un World, streams, cola, contenedores, servidor ni cambió paquetes/Git/configuración global.

## Comandos exactos

Captura ya ejecutada; repetir únicamente en un directorio **nuevo** antes de cambios, no sobre este baseline:

```sh
rtk proxy env -i PATH="$PATH" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 node /Users/miguelluque/git/serenia/.superpowers/sdd/2026-10-10-robust-mvp/workflow-wire-before/replay.mjs capture /Users/miguelluque/git/serenia /Users/miguelluque/git/serenia/.superpowers/sdd/2026-10-10-robust-mvp/workflow-wire-before
```

Lectura estricta ya ejecutada con SDK antiguo; repetir **la misma orden** tras instalar SDK/overrides finales. El script resuelve entonces esas dependencias finales, lee los bytes antiguos y además codifica/decodifica los casos nuevos. Escribe un JSON nuevo con versiones y resultados; no reescribe los payloads antiguos.

```sh
rtk proxy env -i PATH="$PATH" NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 node /Users/miguelluque/git/serenia/.superpowers/sdd/2026-10-10-robust-mvp/workflow-wire-before/replay.mjs verify /Users/miguelluque/git/serenia /Users/miguelluque/git/serenia/.superpowers/sdd/2026-10-10-robust-mvp/workflow-wire-before
```

Después del upgrade, las veinte lecturas de payload antiguo son el gate de compatibilidad; cualquier fallo nuevo ahí requiere investigación. DataView debe probarse con el encode final aunque no tenga payload previo. Si continúa rechazado, documentar el límite y decidir ese gate explícitamente; no omitirlo ni llamarlo pérdida de compatibilidad de bytes inexistentes. Si finalmente se admite, el verificador exige que no exponga backing fuera de la vista.

## Límites

Esto acredita wire/reducers del SDK en contexto host Node. No acredita transformación SWC/esbuild, ejecución en VM distinta, transporte HTTP/world-local, cifrado, streams, suspensión/retry/replay tras reinicio, ni compatibilidad de runs reales ya persistidos. Nanoid efectivo queda inventariado pero este payload no depende de IDs aleatorios ni prueba su generación. Esas pruebas de integración siguen en el handoff de aceptación.
