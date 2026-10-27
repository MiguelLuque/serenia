# Resultado de herramientas comprensible y acotado

27-10-2026. Continúa R3 de la auditoría de fiabilidad desde `f7ef556`; ejecución autorizada por «Continúa». Sólo piloto supervisado. No modifica criterios diagnósticos ni contratos de consentimiento/seguridad.

## Comportamiento

El primer paso mantiene las herramientas existentes. Si obtiene resultados, el SDK puede realizar un segundo paso para explicarlos. Segundo paso: sin herramientas, con guard del servidor que rechaza operaciones incluso si el proveedor ignora esa restricción. Máximo dos generaciones, mismo timeout global y límites de contexto/respuesta. Sin herramientas en el primer paso, no hay segunda llamada. Una continuación vacía o con nuevas llamadas inválidas no se guarda como respuesta satisfactoria: utiliza el error recuperable existente.

El presupuesto de salida solicitado se mantiene en2500tokens por turno: la continuación recibe el remanente tras la salida reportada por el primer paso. Si la contabilización no existe/no es válida o se agotó, se usa el error recuperable y no se inicia otra generación. La respuesta mantiene el límite global existente de100000caracteres serializados. Un turno con herramientas puede añadir otra entrada al modelo y latencia; el coste real sigue sin medirse y no se declara igual al de un único paso.

Las operaciones del turno se ejecutan en orden. Tras una autorización positiva de cierre no se permiten nuevas operaciones; el cierre efectivo sigue dependiendo de `finish_chat_turn`, no de texto o intención del modelo. Se conserva la doble confirmación ordinaria y el gate de crisis.

Los mensajes de historial del servidor pueden añadir una proyección factual de resultados de herramientas conocidas y confirmadas. No se reinyectan instrucciones, argumentos libres, errores sin resultado ni herramientas desconocidas. Un cuestionario propuesto no se presenta como respondido/aceptado. Ninguna parte de herramientas de un mensaje de usuario genera hechos. Los límites de contexto siguen aplicándose después de proyectar.

La referencia conserva el recorrido anterior para comparar. No se cambia Supabase, roles, modelos, dependencias ni despliegue. El fallo de generación/persistencia conserva su contrato de error/reintento; no se fabrica éxito ni cierre ante un fallo.

## Prueba

Usar SDK instalado real con proveedor de lenguaje ficticio y servicio de persistencia sustituido. Probar resultados de creación, already_active, cierre autorizado/denegado; segundo paso con resultado en prompt; ausencia de operaciones extra; replay idéntico; fallo posterior a herramienta sin cierre falso; historial de resultados confirmados y rechazo de payloads arbitrarios. No mide fluidez de un proveedor real ni validez clínica.
