---
name: crisis-protocol
version: 2.0.0
last_reviewed: 2026-11-15
owner: "@psicologo"
---

# Enrutamiento de señales de seguridad en conversación

Este flujo ayuda a decidir cómo continúa la conversación a partir del texto. No es diagnóstico, cribado clínico validado, puntuación C-SSRS ni determinación automática de gravedad. La clasificación por palabras y contexto solo sirve para el enrutamiento operativo.

## Respuestas de la aplicación

- Una mención contextual (por ejemplo, clase, libro, cita atribuida, referencia histórica o negación clara) sigue por la generación normal. El mensaje completo se conserva en la conversación; no crea por sí solo un evento de riesgo, aviso urgente ni cierre.
- Una señal ambigua recibe una sola pregunta estática y específica sobre pensamientos actuales del dominio correspondiente. La aplicación guarda un marcador tipado de esa pregunta y solo clasifica la respuesta si coincide con el marcador del turno inmediatamente anterior que conserva el servidor.
- «Sí» a esa pregunta crea una señal textual provisional, moderada y vinculada a la pregunta; no es diagnóstico ni una medida de gravedad. La aplicación ofrece recursos de apoyo y no cierra la sesión por esa respuesta.
- «No» se reconoce sin repetir la pregunta. «No lo sé» reconoce que la aplicación no puede determinar el peligro actual, ofrece recursos y detiene la repetición. Un cambio explícito de tema consume la pregunta y permite seguir con la petición nueva.
- Una declaración personal directa y actual de ideación, intención, plan o conducta se guarda como señal textual provisional del tipo correspondiente y recibe una respuesta estática con recursos. No se llama a un modelo para ese turno ni se cierra la sesión por la clasificación. Si se alcanza el límite temporal existente, el cierre es por tiempo y la respuesta explica ese límite además de ofrecer recursos.

La referencia enviada por el cliente solo identifica cuál marcador cree haber mostrado. No aporta categoría ni tipo. El servidor obtiene el tipo y la versión del turno assistant guardado y la transacción de base de datos comprueba el request ID anterior bajo bloqueo. IDs falsos o obsoletos no se reasignan a otra pregunta; los reintentos de un turno admitido conservan su respuesta y referencia originales.

## Recursos en España

- **Línea 024** — teléfono de atención a la conducta suicida: 024.
- **112** — emergencias.
- **016** — violencia de género.
- **Teléfono de la Esperanza** — 717 003 717.

La respuesta presenta recursos sin afirmar que la aplicación haya evaluado clínicamente la situación. No promete una revisión en un plazo concreto, una alerta entregada ni un resultado clínico. La revisión profesional y la aprobación clínica del piloto son controles humanos separados del comportamiento automático.

## Límites de uso

- No conviertas una coincidencia léxica en diagnóstico, score C-SSRS o severidad clínica.
- No trates «no lo sé» o el cambio de tema como una respuesta negativa.
- No ocultes una declaración personal directa por una cita, contexto educativo o mención de otra persona en otra cláusula.
- Mantén los cierres por consentimiento y límite temporal según sus contratos existentes. Una señal conversacional por sí sola no autoriza el cierre.
- Un profesional debe revisar el texto, los umbrales y los casos del piloto antes de cualquier uso clínico.
