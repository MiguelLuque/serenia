# Serenia: aceptación hospedada en curso —24octubre2026

> Checkpoint histórico sustituido por el [estado25octubre](2026-10-25-mvp-acceptance.md). Las referencias a dos paquetes, Task11/12 pendientes y ausencia del tercer forward describen el instante de este documento, no el estado actual. Se conservan para no reescribir la cronología de fallos y aceptación.

Rama `codex/serenia-robust-mvp`. **La conexión de migraciones funciona y los dos paquetes revisados están aplicados y comprobados en Supabase. La aceptación completa sigue abierta por una corrección de integridad factual del informe, la prueba nativa final, limpieza y revisión independiente.** Este documento actualiza el [estado histórico del23octubre](2026-10-23-mvp-status.md); no sustituye las fuentes ni fechas de pruebas anteriores.

## Supabase aplicado y preservado

Destino único Serenia `brpozobkoatabctjjadc`, organización `jhmhzzaqbzvvppwtwfhz`, Free/eu-west-1. El nombre de la organización no acredita la identidad de la cuenta autenticada.

| Paquete | Aplicación real24octubre | Identidad comprobada |
| --- | --- | --- |
| Canónico | `20261024092459` | SHA256 `6f0037fc74e115455e379795cdcb1c5318e4a9f65660d048f8ca5d7af30069b0`,93.052bytes |
| Forward de bandeja pendiente | `20261024092547` | SHA256 `d9604a9e62468d2ecd3e1ae300fa074a7262ccb711ecd1d257d4865c2b39c7c9`,5.172bytes |

Se aplicaron secuencialmente por MCP oficial, verificando el primer resultado antes del segundo. La historia contiene42entradas: las40versiones/nombres/fingerprints originales no cambiaron; los SHA256 de las sentencias almacenadas de ambos paquetes coinciden con los archivos revisados. El catálogo semántico de cuestionarios conserva5definiciones/65items. Antes de fixtures:2cuentas/2perfiles y ninguna fila clínica. La migración verificó internamente agregados completos de filas bloqueadas con nonce; no exportó valores de cuentas originales. Los conteos posteriores, por sí solos, no equivalen a una comparación de todos sus campos.

El rechazo previo del paquete `724e9a…` fue una precondición incorrecta de nuestro código: esperaba tags sin restricción en un event trigger que realmente tiene tres tags concretos. Se preservaron sus bytes en el archivo histórico; el nuevo paquete mantiene guardas estrictas de identidad, propietario, cuerpo, configuración y binding. Una prueba PostgreSQL17 realista pasó RED→GREEN y cinco variantes de deriva fueron rechazadas con rollback. Revisión independiente: especificación/calidad y aplicación exacta aprobadas. [Registro de aplicación](../../supabase/hosted/application-20261024.json), [operación](../operations/hosted-supabase.md).

## Evidencia real del ciclo hospedado

La aplicación Next/Workflow sigue en loopback local; BD y Auth son los hospedados indicados. Sólo actores generados y proveedor sintético, sin pacientes reales ni llamadas a modelos de pago.

Fuente de aplicación `27f82d8e8d46257dff8517dbca5592e4a4681df9`, build `xhrWTx9JGknr6oTSmk6va`, lock SHA256 `e0f9eb1ffc90023ebb1b4bf2f1b7f85902f751229d2d679733f64f7b75fc1ed4`. Las fases automatizadas Auth/JWT/PostgREST, HTTP, recuperación tras reinicio del mismo run, revisión, cron y preparación de navegador terminaron con exit0 y logs privados completos.

- Matriz real de anónimo, propietario, otro paciente, clínico y servicio; negativas de acceso ajeno, escalada de rol y escritura directa de consentimiento.
- Chat/cuestionario, idempotencia, recuperación de503intencional, cierre y generación de borrador.
- Reinicio del mismo run `wrun_01M5PM20SNNFN77B90097Q4PSA`, PID9493→9673, mismo build/estado:23eventos, un `run_created`, un intento de job y tres pasos ya completados sin duplicar. No se atribuye esta prueba a un run nuevo.
- Revisión atómica, tareas e idempotencia y proyección paciente que excluye datos privados.
- Cron con401sin autenticación, barrido con bearer sobre fixtures y repetición sin segundo efecto. No se ha configurado una ejecución periódica externa.
- Prueba nativa adicional: login, nueva sesión,9respuestas PHQ9/resultado0, cierre, rechazo clínico y regeneración. Un informe superseded conserva el rechazo; un nuevo borrador/run, mismo transcript de3turnos/6mensajes. La lectura clínica sólo se permitió tras comprobar que todas las sesiones pertenecían a los actores ficticios conocidos.

El proveedor sintético registró16llamadas conversacionales/4estructuradas en el prefijo automatizado, incluida una falla intencional y recuperación al arrancar; ninguna llamada rápida ni denegación. Las fases posteriores de UI conservan sus propios deltas y no se suman de forma implícita. No son mediciones de calidad de un modelo real.

La primera navegación creó8archivos legítimos de caché de respuestas de Next; los871archivos originales permanecían idénticos. El guard externo corregido (`c1d78b4`, documentación `3f3f27a`) distingue esos dos directorios de caché exactos, rechaza symlinks y mantiene la comprobación del resto del código. RED2→GREEN21pruebas focales, lint/tipos0 y revisión independiente aprobada. Un arranque normal posterior conservó el mismo build original; el cambio del launcher no se presenta como un nuevo build de aplicación. [Corrección y evidencia](2026-10-24-hosted-runtime-cache-guard.md).

## Hallazgo requerido antes del cierre: autoridad de puntuaciones

**P1 de integridad factual.** La sesión sintética tenía9respuestas y un resultado PHQ9 puntuado a0, pero el informe decía que no había cuestionarios porque el proveedor de prueba devolvió `questionnaires: []`. Esto no mide la calidad de un modelo real: demuestra que el servidor aceptaba omisiones o alteraciones de datos que la especificación reserva al scoring determinista.

Task11 está implementada en fuente `f1ff5b7`, pendiente de aprobación y aceptación del artefacto corregido. Construye esa lista desde instancias/resultados autorizados persistidos y definiciones canónicas, conserva puntuaciones/bandas/flags sin reinterpretarlos y pasa a revisión manual ante lecturas fallidas o datos puntuados incompletos. Un conjunto vacío válido sigue siendo válido. Las regresiones cubren omisión, datos inventados, resultados múltiples y fallos. El proveedor sintético sigue devolviendo una lista vacía para detectar la regresión. La revisión independiente, build hospedado nuevo y correlación real informe→resultado aún no están completados.

El revisor independiente confirmó como Important el segundo acceso a ese contrato: una petición directa de edición clínica podía sustituir la lista aunque el formulario fuera de solo lectura. Está preparado un forward independiente que rechaza cambios/omisiones frente al informe original bloqueado en la RPC y preserva edición narrativa, tareas e idempotencia:8.191bytes, SHA256 `86a461682776f9453a85ae338e38dbcab287ebbbaf97981850906bf809929504`. Metadata oficial24oct14:50:23 confirmó el cuerpo/propietario/configuración/ACL anteriores; aún no se ha aplicado este tercer cambio. Los dos paquetes aplicados conservan sus bytes. No se reescriben informes históricos ni se cambian reglas clínicas, prompts aprobados o modelos por este arreglo.

## Dependencias: nuevo gate fallido24octubre

La ejecución obligatoria sobre `f1ff5b7` terminó: test0(**752pruebas/64archivos**), lint0, tipos0, Workflowwire0(20payloads anteriores/24roundtrips), PostgreSQL0 y buildaislado0; **audit:dependencies1**, conjunto verify1. No son siete gates aprobados. Los JSON/stderr/exits completos se conservan en el directorio privado `serenia-verify-jgKyNw`.

La auditoría de producción registra22entradas High del grafo, derivadas de cinco advisories de Zod, body-parser y Undici; no son22vulnerabilidades independientes. Las páginas primarias reconsultadas24oct20:18UTC publican las versiones corregidas. Task12 está en curso para elegir un cambio mínimo compatible y volver a verificar producción/full sin excepciones. La recomendación automática de degradar Workflow2 no es una solución aceptada. El build de Task11 no se promociona y el runtime antiguo no se presenta como parcheado.

## Gates que quedan abiertos

La inspección de tipos verificó correspondencia de los contratos cubiertos de23tablas (Row/Insert/Update/Relationships),29RPC y17enums. Se documentaron diferencias de representación del generador frente a14columnas JSONB NOTNULL y dos RPC sin argumentos; no es igualdad literal de tipos ni una afirmación de que SQL NOT NULL excluya JSON null. No se sustituyeron tipos a ciegas.

Los avisos anteriores de search_path/ejecución anónima/performanceWARN quedaron resueltos. Los11avisos de RPC autenticadas tienen [disposición concreta de actor y alcance](2026-10-24-hosted-advisor-dispositions.md); las tablas internas sin políticas son denegación intencional al cliente. La protección de contraseñas filtradas sigue desactivada en la captura Free; elegibilidad/configuración requieren comprobación actual y no se cambió de plan. Los INFO de índices requieren medición. La imagen PostgreSQL observada17.6.1.104 no acredita qué backports contiene; versión ofrecida, cobertura de respaldo y recuperación siguen sin verificarse. [Mantenimiento de plataforma](2026-10-24-postgres-maintenance.md).

Antes de declarar este MVP sintético aceptado: cerrar Tasks11/12, prueba nativa de edición/revisión/proyección paciente con su nuevo build, limpieza por manifiesto, comprobación final de historia/catálogo/conteos y revisión técnica independiente del conjunto de evidencia. No se ha publicado el frontend ni abierto el acceso público. El usuario confirmó24oct que UX y comportamiento/diagnóstico previo se abordarán después de ese cierre técnico.

Las recomendaciones actuales de IA están en el [informe del23octubre](2026-10-23-model-refresh.md): comparar el modelo actual con Sol6.1/Sonnet5.5 en el harness español y Decisions/Jev como candidatos auxiliares. Decisions primero en sombra es una preferencia provisional de integración. Los auxiliares siguen apagados; no hay ganador de calidad medido ni benchmark pagado. Clínica, protocolo de urgencias, textos legales, tratamiento de datos, operación y plataforma de producción requieren aceptación propia antes de pacientes reales.
