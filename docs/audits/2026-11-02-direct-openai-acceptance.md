# OpenAI directo: implementación y aceptación pendiente

2 de noviembre de 2026. Incremento desde `6ae9ea2` hasta `127e99218c8607dedc87a9b72e55044aabfb6679`. La conexión directa está implementada y compilada; **no está activada en producción ni validada contra la API real**.

## Comportamiento

La fábrica de servidor `resolveTaskModel` separa conexión de selección de modelos. `LLM_TRANSPORT=openai` construye Responses con `@ai-sdk/openai@3.0.135`, clave de servidor y URL oficial fijada. `gateway`, vacío o ausente conserva el comportamiento anterior. Una configuración inválida, proveedor incompatible o clave ausente falla sin conmutación de servicio ni exposición de valores. Se fuerza `store: false` también si un consumidor intenta sobreescribirlo.

Las cuatro generaciones (chat, perfil y dos rutas de informe) usan la fábrica. Presupuestos, modelos solicitados, límites/retries de SDK y Workflow, autoridad SQL y criterios clínicos se conservan. No se migró la API legacy `generateObject` de informes ni se reescribió el SDK de chat: son cambios distintos del transporte solicitado.

## Pruebas observadas

- RED inicial: resolver inexistente, log privado `20261101-233616-tbyx_wh_.log`.
- Regresión del chat: al retirar temporalmente la integración del resolver, el caso directo devuelve 503 en lugar de 200 (RED, `233825-bpmjo8w1`); al restaurarla, la respuesta simulada se guarda y entrega correctamente (GREEN, conjunto de 120 tests en `233833-3_nzlaur`).
- SDK real con HTTP en memoria: destino oficial y Bearer ficticio, modelo sin prefijo Gateway, JSON validado por esquema, herramienta ejecutada una vez y continuación con razonamiento cifrado ficticio, `store: false` en ambos pasos y un solo intento ante 503 sin fallback. Resolver: 15 tests PASS, `233908-jffe9ewl`.
- Verificación global del commit `127e992`: **1.164 tests / 93 archivos PASS**; lint, tipos, Workflow wire, SQL shim y build aislado PASS. `verify` termina **exit 1** porque la auditoría estricta de dependencias falla; no se presenta como aceptación global.

Evidencia privada: `20261101-233945-6vs8052y.log` y `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-Y3VIO7/results.json`. Build de `127e99218c8607dedc87a9b72e55044aabfb6679`, lock SHA-256 `1d9272ddd8f4b76668c7b31a1b5d2bff5b22d2f12e4491d62fdaec7b068a66fe`, snapshot privado `serenia-build-MbhYTa`. No acredita navegador, Auth alojada, API real, reinicio de Workflow ni validación clínica. Se conserva el aviso no fatal del temporizador de jsdom de la suite previa.

## Configuración y bloqueos

La consulta de metadatos del conector Vercel devolvió 403; la CLI oficial con proyecto/equipo explícitos permitió la misma lectura de metadatos. El usuario añadió `OPENAI_API_KEY`: se confirmó como **Secret en Production**, sin leerla; no aparece en Preview. `LLM_TRANSPORT` sigue ausente, por lo que se conserva Gateway. Se solicitó al usuario una clave para Preview y se documentó la [activación/reversión](../operations/ai-provider.md).

La autorización de 5 USD correspondía a saldo existente de Gateway: no se consumió ni se trasladó a OpenAI. No hubo compras, llamadas al modelo real, cambios de configuración remota por el agente, merge, despliegue de producción ni correos nuevos. El gate de dependencias y SQL alojado pendientes permanecen separados de la integración del transporte. Las proyecciones previas de tarifas Gateway no se presentan como costes directos verificados de OpenAI.

Revisión independiente del incremento: **0 críticos / 0 importantes / 1 menor**. El primer revisor asignado agotó la cuota antes de realizar la revisión; el revisor alternativo completó la lectura sin repetir la petición al modelo bloqueado.

Menor pendiente: el chat prueba SSE de texto y persistencia; el test de herramienta con continuación y razonamiento cifrado usa `generateText` sin streaming. Falta unir ambas cosas en una prueba del chat directo con herramienta SSE, segundo paso y persistencia final. No se observó un fallo: la fuente instalada aplica el middleware tanto a `doGenerate` como a `doStream`, pero esta cobertura conjunta no se da por demostrada.

El revisor dejó fuera la configuración real de secretos y permisos, comportamiento de modelos de pago, aceptación clínica/BD/runtime alojado, el bloqueo previo de audit y cambios anteriores a este incremento. Resolución del responsable: los secretos se acreditan únicamente por metadatos; acceso, inferencia real y calidad permanecen pendientes; los gates de publicación se mantienen, y el incremento no reabre el código anterior ya revisado. Coste si esos límites se interpretan como aceptación: promover una conexión o modelo todavía no probado; por eso se conserva el estado preparado y no desplegado.
