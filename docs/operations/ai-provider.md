# Conexión del proveedor de IA

`resolveTaskPolicy` selecciona modelos y presupuestos por tarea; `lib/server/llm/model-resolver.ts` resuelve la conexión en el servidor. Chat, extracción de perfil e informes (Workflow y legacy) comparten esa frontera. No es necesario cambiar componentes de UI o criterios clínicos para seleccionar la conexión.

## OpenAI directo

1. Crear una API key de proyecto en OpenAI y guardarla como **Secret** `OPENAI_API_KEY` en Vercel, en el entorno que se quiera probar. No ponerla en el chat, Git, logs, variables `NEXT_PUBLIC_*` ni comandos con el valor como argumento. La clave debe tener permisos para Responses y el proyecto de OpenAI debe disponer de saldo/acceso al modelo.
2. Configurar `LLM_TRANSPORT=openai` en ese entorno. Los proveedores de las tareas activas deben ser `openai`; los modelos siguen usando las variables de selección existentes. La configuración de transporte se valida al generar, no durante el build.
3. Revisar `LLM_CONVERSATIONAL_*`, `LLM_PROFILE_EXTRACTION_*` y `LLM_CLOSURE_REPORT_*`. Si los pares de perfil/informe están vacíos, conservan `LLM_STRUCTURED_*`. Sus modelos son nombres sin el prefijo `openai/` (el resolver lo deriva del ID de política).
4. Desplegar sólo cuando se cumplan los gates de `dependency-gates.md` y de base de datos. Verificar con casos ficticios texto, JSON, herramientas/continuación, cierre de sesión, errores y coste, antes de promover modelos nuevos o probar datos reales.

Ejemplo de configuración **sin credenciales** y con la referencia existente (no una promoción de modelos):

```dotenv
LLM_TRANSPORT=openai
LLM_CONVERSATIONAL_PROVIDER=openai
LLM_CONVERSATIONAL_MODEL=gpt-5.4-mini
LLM_STRUCTURED_PROVIDER=openai
LLM_STRUCTURED_MODEL=gpt-5.4-mini
```

El adaptador fijado `@ai-sdk/openai@3.0.135` usa explícitamente `https://api.openai.com/v1/responses`. Ignora `OPENAI_BASE_URL`, no usa la clave ni créditos de AI Gateway y no hace fallback a otro servicio. Transporte inválido, clave vacía o modelo no OpenAI fallan antes de la petición. La clave se lee al resolver, no al importar ni en el build. No se cambian IDs solicitados, límites por tarea ni retries durables por esta elección.

Todas las peticiones directas fuerzan `store: false`, también en continuación de herramientas. Esto evita solicitar almacenamiento de la respuesta para recuperación posterior; **no acredita retención cero**, cumplimiento clínico ni ausencia de registro del proveedor. El estado de sesión y las herramientas siguen bajo los controles existentes de Serenia. Referencias: [autenticación oficial OpenAI](https://developers.openai.com/api/reference/overview), [Responses](https://developers.openai.com/api/docs/guides/migrate-to-responses).

## Gateway y reversión

`LLM_TRANSPORT=gateway`, vacío o ausente conserva la ruta anterior `provider/model` mediante AI Gateway. Utiliza sus credenciales OIDC/API key oficiales; la clave OpenAI no se envía a Gateway. Para revertir, cambiar explícitamente el transporte y volver a desplegar. No hay conmutación automática ante un error, porque cambiaría el servicio y la facturación durante una sesión.

## Coste y aceptación pendiente

OpenAI directo factura al proyecto OpenAI, separadamente de los créditos de Gateway. La autorización anterior de hasta 5 USD de saldo existente de Gateway no autoriza consumir saldo OpenAI ni recargarlo. Las proyecciones de `ai:costs` usan el snapshot de **Gateway**: no presentarlas como una factura o tarifa directa verificada.

Metadatos oficiales de Vercel comprobados el 1 de noviembre de 2026: `OPENAI_API_KEY` y `LLM_TRANSPORT` todavía ausentes. No se cambiaron variables remotas ni se ejecutaron inferencias de pago. El código y las pruebas simuladas no demuestran acceso real, calidad clínica ni funcionamiento del despliegue. La activación queda pendiente de clave, verificación de saldo/permisos y los gates de publicación existentes.
