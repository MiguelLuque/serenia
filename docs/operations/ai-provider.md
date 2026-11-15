# Conexión del proveedor de IA

`resolveTaskPolicy` selecciona modelos y presupuestos por tarea; `lib/server/llm/model-resolver.ts` resuelve la conexión en el servidor. Chat, extracción de perfil e informes (Workflow y legacy) comparten esa frontera. No es necesario cambiar componentes de UI o criterios clínicos para seleccionar la conexión.

## OpenAI directo

1. Crear una API key de proyecto en OpenAI y guardarla como **Secret** `OPENAI_API_KEY` en Vercel, en el entorno que se quiera probar. No ponerla en el chat, Git, logs, variables `NEXT_PUBLIC_*` ni comandos con el valor como argumento. La clave debe tener permisos para Responses y el proyecto de OpenAI debe disponer de saldo/acceso al modelo.
2. Configurar `LLM_TRANSPORT=openai` en ese entorno. Los proveedores de las tareas activas deben ser `openai`; los modelos siguen usando las variables de selección existentes. La configuración de transporte se valida al generar, no durante el build.
3. Revisar `LLM_CONVERSATIONAL_*`, `LLM_PROFILE_EXTRACTION_*` y `LLM_CLOSURE_REPORT_*`. Si los pares de perfil/informe están vacíos, conservan `LLM_STRUCTURED_*`. Sus modelos son nombres sin el prefijo `openai/` (el resolver lo deriva del ID de política).
4. Desplegar sólo cuando se cumplan los gates de `dependency-gates.md` y de base de datos. Verificar con casos ficticios texto, JSON, herramientas/continuación, cierre de sesión, errores y coste, antes de promover modelos nuevos o probar datos reales.

Configuración candidata **sin credenciales**, según la instrucción del usuario de retirar GPT-5.4 mini de la nueva versión:

```dotenv
LLM_TRANSPORT=openai
LLM_CONVERSATIONAL_PROVIDER=openai
LLM_CONVERSATIONAL_MODEL=gpt-6-luna
LLM_STRUCTURED_PROVIDER=openai
LLM_STRUCTURED_MODEL=gpt-6.1-sol
LLM_PROFILE_EXTRACTION_PROVIDER=openai
LLM_PROFILE_EXTRACTION_MODEL=gpt-6-luna
LLM_CLOSURE_REPORT_PROVIDER=openai
LLM_CLOSURE_REPORT_MODEL=gpt-6.1-sol
```

El adaptador fijado `@ai-sdk/openai@3.0.135` usa explícitamente `https://api.openai.com/v1/responses`. Ignora `OPENAI_BASE_URL`, no usa la clave ni créditos de AI Gateway y no hace fallback a otro servicio. Transporte inválido, clave vacía o modelo no OpenAI fallan antes de la petición. La clave se lee al resolver, no al importar ni en el build. No se cambian IDs solicitados, límites por tarea ni retries durables por esta elección.

Todas las peticiones directas fuerzan `store: false`, también en continuación de herramientas. Esto evita solicitar almacenamiento de la respuesta para recuperación posterior; **no acredita retención cero**, cumplimiento clínico ni ausencia de registro del proveedor. El estado de sesión y las herramientas siguen bajo los controles existentes de Serenia. Referencias: [autenticación oficial OpenAI](https://developers.openai.com/api/reference/overview), [Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses).

La [documentación de controles de datos de OpenAI](https://developers.openai.com/api/docs/guides/your-data) describe la retención estándar de Responses y sus controles; `store: false` no activa por sí solo Zero Data Retention ni garantiza ausencia de registros de supervisión. Revalidación oficial del 14 de noviembre: GPT-6 Luna y GPT-6.1 Sol son compatibles con procesamiento regional europeo en Standard si el proyecto y la petición cumplen los requisitos; OpenAI indica el endpoint `eu.api.openai.com`. El resolver de Serenia sigue fijado al endpoint global `api.openai.com`, por lo que esta versión **no ofrece procesamiento regional UE**. No se ha comprobado la configuración de región/retención de la cuenta. Antes de enviar datos de salud reales, hay que verificar con el proveedor y el responsable del proyecto las condiciones y acuerdos aplicables; las pruebas del piloto usan solo casos ficticios.

## Gateway y reversión

`LLM_TRANSPORT=gateway`, vacío o ausente conserva la ruta anterior `provider/model` mediante AI Gateway. Utiliza sus credenciales OIDC/API key oficiales; la clave OpenAI no se envía a Gateway. Para revertir, cambiar explícitamente el transporte y volver a desplegar. No hay conmutación automática ante un error, porque cambiaría el servicio y la facturación durante una sesión.

## Coste y aceptación pendiente

OpenAI directo factura al proyecto OpenAI, separadamente de los créditos de Gateway. La autorización anterior de hasta 5 USD de saldo existente de Gateway no autoriza consumir saldo OpenAI ni recargarlo. Las proyecciones de `ai:costs` usan el snapshot de **Gateway**: no presentarlas como una factura o tarifa directa verificada.

Metadatos oficiales de Vercel comprobados el 2 de noviembre de 2026 indicaban que `OPENAI_API_KEY` existía como Secret en Production y Preview; nunca se leyó su valor. La relectura de metadatos del 14 de noviembre devolvió 403 y el fallback de CLI terminó con error sin recuperar metadatos, por lo que el estado actual de esas variables es **desconocido**. Vercel informa un Preview READY para `c4bd0ff` y Production READY en `main` sobre `11ec2c2`; `vercel curl` autenticado obtuvo HTTP 200 y HTML con título `Serenia` en `/registro` del Preview. Esto acredita la página pública, no el login, el runtime con la nueva configuración ni una respuesta de OpenAI. No se cambió Production ni se ejecutó una inferencia real en esta operación.

En los archivos de la nueva versión, GPT-5.4 mini se conserva únicamente en fuentes y resultados históricos de comparación, no como selección o fallback. La configuración pública anterior sigue separada de este cambio y no se presenta como migrada. El valor ausente de `LLM_TRANSPORT` sigue significando Gateway por compatibilidad del código; `.env.example` ahora elige OpenAI explícitamente. El código y las pruebas simuladas no demuestran acceso real, calidad clínica ni funcionamiento del despliegue. La activación pública queda pendiente de verificar saldo/permisos, evaluar los modelos y superar los gates de publicación existentes. No se ejecutaron inferencias de pago.

## Estado comunicado por el usuario — 14 noviembre 2026

El usuario confirmó que `OPENAI_API_KEY` está guardada como Secret en Vercel para Production y Preview. No se leyó su valor. La lectura de metadatos de Vercel sigue devolviendo 403, así que no están confirmados de forma independiente el transporte efectivo, los selectores de modelo ni la región de cada entorno. Vercel aún muestra Production en `main` (`11ec2c2a8e58312318dd300eb6b71c5b7377ee8d`), mientras el resolver directo se encuentra en la rama candidata; no hay inferencia real ejecutada. El proyecto tiene una deployment Production `READY`, aunque el recurso informa `live: false` y SSO desactivado para dominios personalizados. La afirmación del usuario de que solo lo usan ellos no sustituye la verificación de acceso efectivo ni convierte este entorno en Preview.
