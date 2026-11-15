# Desbloquear la publicación sin rebajar los contratos

El usuario pide resolver los bloqueos de dependencias y SQL remoto para desplegar el MVP. La versión candidata usa OpenAI directo, GPT-6 Luna en conversación/perfil y GPT-6.1 Sol en informes; no vuelve a seleccionar GPT-5.4 mini. No se compran créditos, crean credenciales ni cambian permisos globales del agente. Se conserva cuenta/rol/consentimientos de Pablo y el alcance ficticio supervisado.

## Dependencias

El advisory de minimatch afecta a todos los majors antiguos del grafo. El override a una versión oficial corregida elimina los avisos, pero rompe las importaciones callables/default de consumidores legacy. Se prefiere un adaptador explícito de sólo exports, fijado a versión y SHA de los dos archivos originales, frente a reescribir la configuración/plugins de lint. Se conservan los algoritmos upstream corregidos, exports modernos, reglas y configuración de ESLint, Next16.4.1/React19.3.1 y majors del resto de SDK.

Un postinstall propio valida ambos archivos antes de escribir cualquiera, admite sólo bytes originales o exactamente adaptados, es idempotente y rechaza versión, contenido o symlinks inesperados. La auditoría full+producción sigue exigiendo cero avisos de cualquier severidad. Pruebas reales cubren React/a11y, imports CJS/ESM y el límite de expansión corregido; tests de archivos temporales cubren integridad y fallo cerrado. La versión final se decide con el registro oficial y experimentos aislados, no con un número de versión inventado ni filtros de audit.

## SQL

Se conserva el paquete original MCP de perfil, SHA256 `313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a`, sin cambiar las cuatro fuentes o sus guards. Su preflight oficial del 2 de noviembre coincide exactamente con el baseline de 43 versiones, tres cuentas/perfiles y cero filas clínicas. El conector expira su confirmación sin aplicar. No se desactivan elicitaciones, reescribe historia antigua, extraen PAT/passwords ni ejecuta db push sobre un historial divergente.

La alternativa es un artefacto separado de entrega manual por Dashboard, no una afirmación de soporte de replay CLI/Branching: transacción explícita PG17 limitada a50s, payload exacto con hash/bytes comprobados, paquete exacto, inserción de una sola fila nueva de historial, comparación de las43anteriores y total44, COMMIT. Fallos de registro/verificación revierten también el DDL. Antes de cualquier apply se exige una prueba sólo de transacción con ROLLBACK en el editor autenticado y preflight oficial fresco. Ante respuesta perdida se consulta historial/esquema antes de considerar otro intento; nunca se repite a ciegas. La aplicación corresponde sólo a root tras revisión independiente. Después se aplica el forward de cronología revisado con su propio guard y mapping.

## Cierre de aceptación

La prueba pendiente de chat directo ahora une SSE de herramienta, razonamiento cifrado, segundo paso de texto con presupuesto restante, persistencia y replay: sólo HTTP ficticio, sin coste. Los siete gates nativos y db:verify se ejecutan sobre el código final y se distinguen de aceptación alojada, acceso real a modelos y revisión clínica. Main/despliegue sólo después de los gates necesarios; el estado de cada aplicación y modelo se registra con evidencia, sin convertir confirmaciones de claves o builds en validación clínica.
