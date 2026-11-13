# Conexión directa a OpenAI

Solicitud del usuario: cambiar de AI Gateway al acceso con API key de OpenAI, manteniendo una integración desacoplada. El usuario delegó las decisiones técnicas del producto; se continúa con el resolver central propuesto en la revisión anterior. La elección concreta de Responses y el alcance de implementación son decisiones técnicas de esta entrega.

## Enfoque

Conservar AI SDK 6 y añadir su adaptador OpenAI compatible de versión 3, fijado exactamente tras consultar el registro. Una fábrica sólo de servidor `resolveTaskModel(policy)` devuelve `LanguageModel`: con `LLM_TRANSPORT` ausente, vacío o `gateway`, conserva la cadena actual; con `openai`, exige proveedor `openai` y `OPENAI_API_KEY` no vacía, y construye explícitamente un modelo Responses de OpenAI. Otros valores fallan sin exponer valores o causas. No hay fallback automático a otro servicio ni lectura de claves del Gateway para OpenAI. La URL de OpenAI es la oficial, sin base URL configurable.

Se consideraron: reescribir con el SDK nativo (duplica streaming/herramientas), usar BYOK de Gateway (sigue dependiendo de Gateway y de sus créditos), y el adaptador OpenAI del SDK existente. Se elige el adaptador por el objetivo de cambiar de conexión sin reescribir la experiencia de sesión.

Chat, perfil y ambas rutas de informe pasan por esta fábrica; las políticas por tarea conservan IDs solicitados, presupuestos y reintentos. La fábrica no queda en datos serializables de Workflow; se resuelve dentro de la generación. En directo se configura `store: false` para no crear estado de respuestas persistido por la aplicación en OpenAI; esto no equivale a retención cero ni a autorización para datos reales. No cambiar modelos, herramientas, pasos, criterios clínicos, SQL, flags o credenciales productivas.

## Aceptación

Pruebas con credenciales ficticias y transporte en memoria: destino Responses, Bearer correcto, modelo sin prefijo Gateway, store false, JSON, herramienta y continuación controlada; error 503 sin retries SDK ni fallback. Rechazar transporte inválido, clave ausente/vacía y proveedor distinto de OpenAI en modo directo. Regresiones de políticas, chat, perfil e informes; suite, lint, tipos, wire, SQL y build aislado. Auditoría estricta sigue bloqueando release si detecta advisories.

Documentar `LLM_TRANSPORT=openai`, secreto `OPENAI_API_KEY` y vuelta explícita a `gateway`. Clave ausente en metadatos Vercel comprobados: el usuario la añadirá por el gestor de secretos. No leer `.env.local`, secretos, comprar saldo ni hacer inferencias de pago. La autorización previa de 5 USD era para créditos existentes de Gateway; no se traslada a facturación de OpenAI. Activación y aceptación real quedan pendientes de clave, permisos/saldo y gate de publicación existente.
