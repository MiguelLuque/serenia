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

La [documentación de controles de datos de OpenAI](https://developers.openai.com/api/docs/guides/your-data) describe una retención estándar de hasta 30 días para los registros de supervisión de abuso de Responses; `store: false` no activa por sí solo Zero Data Retention. La residencia de datos europea tiene requisitos propios de elegibilidad, configuración y contratación, y el resolver actual fija el endpoint global, no `eu.api.openai.com`. No se ha comprobado que esta cuenta tenga controles de retención o residencia activados. Antes de enviar datos de salud reales, hay que verificar con el proveedor y el responsable del proyecto las condiciones aplicables, la región efectiva y los acuerdos necesarios; las pruebas del piloto aquí descritas usan solo casos ficticios.

## Gateway y reversión

`LLM_TRANSPORT=gateway`, vacío o ausente conserva la ruta anterior `provider/model` mediante AI Gateway. Utiliza sus credenciales OIDC/API key oficiales; la clave OpenAI no se envía a Gateway. Para revertir, cambiar explícitamente el transporte y volver a desplegar. No hay conmutación automática ante un error, porque cambiaría el servicio y la facturación durante una sesión.

## Coste y aceptación pendiente

OpenAI directo factura al proyecto OpenAI, separadamente de los créditos de Gateway. La autorización anterior de hasta 5 USD de saldo existente de Gateway no autoriza consumir saldo OpenAI ni recargarlo. Las proyecciones de `ai:costs` usan el snapshot de **Gateway**: no presentarlas como una factura o tarifa directa verificada.

Metadatos oficiales de Vercel comprobados de nuevo el 2 de noviembre de 2026, tras el segundo aviso del usuario: `OPENAI_API_KEY` existe como **Secret en Production y Preview**. No se leyó su valor. Se preparó `LLM_TRANSPORT=openai` sólo para Preview de `codex/pablo-profile-release`; la selección candidata de esa rama es Luna para conversación/perfil y Sol para informe. Un cambio de variables no actualiza despliegues existentes: la lectura de configuración y el siguiente despliegue son comprobaciones separadas. Production no se modificó en esta operación y su versión anterior no se presenta como migrada.

En los archivos de la nueva versión, GPT-5.4 mini se conserva únicamente en fuentes y resultados históricos de comparación, no como selección o fallback. La configuración pública anterior sigue separada de este cambio y no se presenta como migrada. El valor ausente de `LLM_TRANSPORT` sigue significando Gateway por compatibilidad del código; `.env.example` ahora elige OpenAI explícitamente. El código y las pruebas simuladas no demuestran acceso real, calidad clínica ni funcionamiento del despliegue. La activación pública queda pendiente de verificar saldo/permisos, evaluar los modelos y superar los gates de publicación existentes. No se ejecutaron inferencias de pago.
