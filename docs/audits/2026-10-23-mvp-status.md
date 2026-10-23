# Serenia: estado técnico —23octubre2026

Rama `codex/serenia-robust-mvp`. Las mejoras locales están implementadas y revisadas por bloques. **La aceptación hospedada sigue pendiente del conector de migraciones; el objetivo completo no está terminado.**

## Mejoras entregadas

| Área | Resultado |
| --- | --- |
| Permisos/datos | Protección de rol y propietario, relaciones del mismo paciente, cierre/revisión/tareas transaccionales y lectura paciente que excluye notas privadas. |
| Chat/cuestionarios | Historial autorizado en servidor, límites, turnos idempotentes, retry recuperable, puntuación atómica y outbox de informes con recuperación. |
| Paciente/clínico | Mayoría de edad y aceptación vigente registradas por servidor, borradores recuperables, editor completo de riesgos y bandeja paginada con prioridad global. |
| Límite temporal | Prueba real aceptada: borrador conservado al pasar2min→1min→cero, envío urgente explícito, un turno/respuesta estática/cierre y recarga coherente. |
| Bandeja pendiente | `pending_clinician_review` corregido en parser/prioridad y forward SQL separado; despliegue hospedado pendiente. |
| Dependencias | Next/ESLint16.4.1, React/DOM19.3.1 y Vitest4.1.12 fijados; excepción dev eliminada. Auditorías producción/completa: cero en la ejecución23oct. |
| IA | Evaluador offline español,26semillas, adaptadores auxiliares acotados y apagados; coste de caché Decisions corregido con fecha propia. Sin promoción automática de modelos. |
| Herramientas | Skills Supabase oficiales fijadas/hash verificadas, CLI local aislada, tipos/advisors estrictos y SSR comprobado. Investigación actualizada con Knowledge Base/prompts de observabilidad oficiales. |

[Datos](2026-10-10-data-implementation.md), [chat](2026-10-10-chat-implementation.md), [flujos](2026-10-10-patient-implementation.md), [fiabilidad](2026-10-11-ai-implementation.md), [prueba temporal](2026-10-14-visible-deadline-acceptance.md), [dependencias actuales](2026-10-23-dependency-acceptance.md), [modelos actuales](2026-10-23-model-refresh.md).

## Verificación y revisión

Task9: fuente ejecutable `04052b47a43b871a41e6a319ea76ed5d1d1c6ac1`, evidencia `1ea0928`. Siete exits0: test, lint, typecheck, workflow:wire, db:test, audit:dependencies y build:isolated. **713tests/63archivos**; wire20payloads anteriores/24roundtrips actuales; PostgreSQL17.6 aislado. Auditorías completas/producción0, npm0 en ambas. Build `KTqj18xsAQLNY9ZYIkNoN`; lock SHA256 `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`. Revisión independiente: especificación/calidad aprobadas, cero hallazgos nuevos. Fallos anteriores de tipos/Docker/red/build están conservados y separados del éxito final.

Task10: fuente `51b7690df8b895d0c936b7dbfa435ec7aa372c8e`; después sólo se cambia el estimador de investigación no conectado al paciente. RED2fallos→GREEN8pruebas focales, lint/tipos/evaluador offline0. La evidencia de los siete gates anteriores conserva su fuente exacta; no se atribuye al commit posterior. Revisión independiente de especificación/calidad aprobada, sin hallazgos nuevos.

Los cambios Task9 son exclusivamente de desarrollo; Task10 afecta sólo investigación/evaluación offline. Las dependencias y flujos productivos conservan la equivalencia documentada con el runtime aceptado anteriormente. No se ha ejecutado un nuevo smoke de runtime en estas dos tareas. Los temporales de la aceptación real anterior ya no están disponibles; sus informes y revisiones son evidencia histórica fechada, no una nueva comprobación ni un servidor actualmente activo. [Aceptación histórica](2026-10-12-local-acceptance.md), [revisión local](2026-10-13-local-acceptance-review.md), [parche anterior](2026-10-14-security-patch.md). Los comandos reproducibles están en [README](../../README.md).

La revisión amplia de la rama y su única ola de correcciones aceptaron I1/I2/M1/M2/M3. I1 tiene además evidencia nativa del temporizador. M4, el texto «Esperando respuesta» al agotarse el tiempo, queda registrado como mejora menor real y no bloqueante. **La aprobación final de rama permanece retenida por Task7**; las aprobaciones locales no la sustituyen. El [registro de decisiones](2026-10-23-decisions-ledger.md) conserva las limitaciones y costes de las decisiones del controlador; los [informes independientes](2026-10-23-independent-review.md) archivan las disposiciones y las fuentes revisadas.

## Supabase hospedado: bloqueo concreto

Proyecto único Serenia `brpozobkoatabctjjadc`, organización `jhmhzzaqbzvvppwtwfhz`, Free/eu-west-1. El23oct estaba INACTIVE; se reactivó con la herramienta oficial y llegó a ACTIVE_HEALTHY/PG17.6.1.104, sin crear recursos ni subir de plan. Preflight17:16:47UTC:40migraciones originales y fingerprints iguales, catálogo semántico igual,2cuentas/2perfiles/5definiciones/65items, cero filas clínicas, tablas nuevas ausentes.

Un nuevo intento oficial del paquete canónico volvió a terminar en **`McpServerError: Invalid or expired requestState`**. El handle terminó; no hay una aplicación pendiente del controlador. Postcomprobación17:53:08UTC:40versiones/nombres/fingerprints originales iguales,2cuentas/2perfiles/5definiciones/65items, tres tablas nuevas ausentes y cero consultas activas del paquete. Las lecturas y la reactivación funcionan; la migración continúa rechazada. La causa interna del conector no está establecida. No se recuperaron valores de perfiles ni registros clínicos; los conteos no prueban identidad de todos los campos de cuentas.

Paquetes preparados y revisados, **no aplicados**:

- [Canónico](../../supabase/hosted/serenia-atomic.sql):92.971bytes, SHA256 `724e9a374d1846e01fee1612bb4e687bf56e5959f9c1c32f512114cb904ec1ae`.
- [Forward de bandeja](../../supabase/hosted/inbox-forward.sql):5.172bytes, SHA256 `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`, sólo después del canónico.

La dependencia externa mínima es recuperar una conexión oficial capaz de ejecutar migraciones (renovar la conexión de Supabase en Codex y resolver el error si persiste), sin compartir claves. Después: preflight fresco, aplicación exacta, tipos/advisors, Auth/JWT/Data API con fixtures, Next/Workflow construido, mismo-run tras reinicio, cron autorizado, limpieza por manifiesto/preservación y revisión independiente de Task7. [Operación](../operations/hosted-supabase.md), [plan](../superpowers/plans/2026-10-10-robust-mvp.md). No se reescribe historia ni se divide el paquete para eludir el error.

## IA y siguiente decisión de producto

Comparar Sol6.1 y Sonnet5.5 con el modelo actual en el harness español; ambos publican tarifa base2/10USD por millón entrada/salida, sin que ello demuestre calidad ni coste final equivalentes. Decisions primero en sombra es una preferencia provisional de integración; Jev sigue siendo candidato de menor tarifa de entrada. La investigación23oct detalla caché, versiones estables/preview y compatibilidad de herramientas. Defaults paciente y bandera auxiliar se conservan; calidad/calibración online y gold clínico no están medidos ni aprobados.

El uso con pacientes reales requiere resolver revisión clínica/protocolo/prompts, textos legales/tratamiento de datos, operación de urgencias y World/ingress/colas aptos para producción. Estas pruebas sintéticas no acreditan esos requisitos. La fase autorizada mantiene Next/Workflow local y BD/Auth en el proyecto identificado; no se ha publicado la aplicación ni ejecutado un benchmark pagado.
