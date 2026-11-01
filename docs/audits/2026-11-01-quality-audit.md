# Auditoría de calidad: sesión y continuidad de evaluación

1 de noviembre de2026. Continúa la publicación pendiente de Serenia para Pablo. Auditoría focal con dos revisores independientes; hipótesis sustentadas en código, pendientes de reproducción antes de corregir. Las evidencias finales se añadirán a este recibo.

| ID | Prioridad | Defecto candidato | Criterio de aceptación |
| --- | --- | --- | --- |
| SQ1 | P2 | El reintento deja texto enviado en el compositor | Un envío y su retry comparten identidad; una nueva idea escrita durante la espera se conserva sin arrastrar el texto ya enviado |
| SQ2 | P2 | Recargar una sesión cerrada impide leer la respuesta final | Sesión propia cerrada legible, envío deshabilitado, propiedad verificada |
| SQ3 | P2 | Finalizar entre consultas SSR puede ocultar una respuesta guardada | Reconciliación delimitada de transcript, recovery y cierre; cubrir ambos intercalados |
| AQ1 | P1 | Diez eventos recientes pueden ocultar un crítico abierto | Decisión de riesgo sobre existencia global; detalle del contexto acotado por separado |
| AQ2 | P2 | El contexto pierde las notas de incertidumbre del riesgo | Fundamento y limitaciones conservados con longitud acotada |
| AQ3 | P2 | Confirmar un informe antiguo rejuvenece sus observaciones | Tiempo de observación separado del de revisión; cronología consistente en chat e inbox |
| AQ4 | P2 | Recordatorio PHQ9 contradice banda canónica15–19 | Texto consistente con scoring existente; sin cambios de cortes ni frecuencias |

No se atribuye precisión diagnóstica, eficacia o aceptación clínica a las pruebas de código. La revisión profesional de Pablo y las conversaciones reales siguen siendo gates separados.

## Publicación y servicios

El paquete de perfil revisado se conserva sin cambios:81.456bytes, SHA256 `2133299d405d8ea5a04fdc88b4faeaee0cf78a5f4866050a211992a0c677882f`. Sus siete gates locales y1086tests/87archivos pasaron antes de estas nuevas correcciones; no constituyen aceptación de los cambios posteriores.

Dos intentos oficiales de aplicar el paquete devolvieron confirmación caducada. Tras el primero se verificaron43entradas históricas y ausencia de mapping/tablas de perfil; no se afirma aplicación ni publicación de esta feature. Se debe comprobar nuevamente el estado antes de otro intento. La confirmación del conector debe resolverse sin debilitar los guards.

AI Gateway rechazó `openai/gpt-5.4-mini` por exclusión del nivel gratuito; no hubo generaciones válidas. La credencial oficial y la existencia del modelo se comprobaron por separado. Sin autorización no se han cambiado modelo, proveedor, plan ni créditos. El acceso al chat no se considera validado por un login correcto.

## Aceptación de sesión

SQ1–SQ3 reproducidos en9regresiones RED y corregidos en1c71a0a.52pruebas focales y1095pruebas/88archivos del conjunto pasaron; lint y tipos también. La revisión independiente C0/I0/M0 está en [el informe de sesión](2026-11-01-session-quality-review.md). Se conserva el fallo inicial de4probes de loopback por EPERM y el retry autorizado del conjunto completo. Hay un aviso no fatal de temporizador de jsdom, con trace privado; no se afirma una salida sin avisos.

La lectura de sesión es una reconciliación delimitada, no serialización entre dispositivos. La página de una sesión propia cerrada conserva su transcript y deshabilita el envío. Son pruebas de componentes/servidor con fronteras sintéticas, no conversaciones con el proveedor ni aceptación alojada.

## Prueba alojada de lectura

1noviembre10:56UTC: el buildPatientContext real del árbol3d83bb7 consultó PostgREST con Auth de la única cuenta ficticia autorizada de Pablo; todas las consultas nuevas fueron aceptadas. Login200, /app307a onboarding, onboarding200 y rol paciente. No se aceptó consentimiento, no se crearon sesiones ni hubo llamadas al modelo. Dataset sin informes revisados: esto acredita sintaxis/transporte/propiedad de la lectura, no ordenación con datos reales; ésta tiene fixtures SQL/SDK separados. Recibo privado hosted-read-smoke.json y log20261101-115607-uc5j34md.log.

## Criterios clínicos todavía pendientes

La antigüedad de referencia tiene políticas heredadas distintas: chat excluye informes observados hace más de90días de su riesgo actual; inbox no incorpora esa ventana. Esta corrección separa observación y revisión y preserva esas políticas; Pablo debe valorar su criterio y consistencia clínica. El enum none aún puede coexistir con notas de no evaluación; se conserva y muestra esa incertidumbre, pero eso no crea un nuevo estado clínico ni valida la regla de resolución. No presentar estos límites como resueltos por los tests.

## Evaluación y SQL local

AQ1–AQ4 y el orden de borradores relacionado se reprodujeron y corrigieron en3d83bb7:1113pruebas/89archivos,177focales, lint/tipos y harnessSQL con8drifts rechazados atómicamente. [Revisión independiente](2026-11-01-assessment-quality-review.md): specPASS/C0I0M0. Forward7215bytes SHA2565ef4d9fcef5191dbe0959689ecf1a32358a77d17c327801cc1e3aaf7f833499b.

El stack local tenía3predecesores canónicos pendientes ya documentados. Se aplicaron éstos y el nuevo forward en una transacción, sin reset y comprobando igualdad opaca de todas las filas públicas/Auth.53versiones y nuevo inboxbody9a5b7e54043035a657de3500907dcc84. db:verifyPASS (lint/advisors/tipos). Se conserva el primer fallo de comillas del launcher privado, revertido antes del DDL. La aplicación remota sigue pendiente.

## Gate de dependencias actualizado

El gate vivo del1noviembre falló por un único [aviso de minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249), propagado a22entradas moderadas del grafo de producción. No son22avisos distintos. Se abrió corrección mínima compatible, sin waiver ni rebajar el gate. Los primeros cinco gates pasaron; audit y build no constituyen PASS: el build aislado requiere guardar previamente los cambios tracked de documentación. Resultados y logs completos conservados en serenia-verify-ulJbyy/ y20261101-115622-sxd1s0vw.log.

## Paquete preparado revisado

La captura de funciones de eventtriggers se hizo independiente de search_path. Paquete anterior rechazado y revertido; nuevo paquetePREPARED_NOT_APPLIED d454797,81693bytes, SHA256313b31b1c06bbe461313a81af9ff0f18fe0cd0a1882ee66ac8013c2ffc05e04a. Cuatro fuentesDDL intactas y baseline30oct retenido; nuevo baseline oficial1nov. Contextos default ypacket idénticos;39probes drift/rollback, generador3,1114tests/89archivos, lint/tiposGREEN. Revisión y aplicación oficiales pendientes en este punto del recibo.

## Decisiones de implementación

Ruling: usar el proyecto existente y allowlist de aplicación/worker, conservando el contrato SQL owner-only — cumple mismo enlace y evita nuevos costes/roles — la lista de Vercel no es ACL de RPCdirectas y debe cubrir todos los entrypoints del proveedor, probado explícitamente.
Ruling: use session observation time separately from review time in both chat and inbox — administrative late confirmation must not rejuvenate historical evidence — may conservatively retain warnings until a current professional assessment is available.
Ruling: permit minimal pinned dependency remediation required by strict existing zero-advisory gate — live registry identifies a new minimatch advisory blocking release — transitive API compatibility must be verified; avoid global major override or auditfixforce and preserve priorwirepayloads.
Ruling: revise only prepared-never-applied packet to compare schema-qualified eventfunction identity — actual official guardfailure proved regprocedure text depends onsearch_path, sixextensionfunctions only — sourceDDL and all preservationguards remain exact, with context-invariance+realdriftregressions before apply.

## Revisión final y estado de publicación

[Revisión final](2026-11-01-quality-final-review.md): C0/I0/M0 para la rama preparada; publicaciónBLOQUEADA por el gate estricto de dependencias. No se ha aplicado remediación de paquetes incompatible ni waiver. El paquete SQL corregido tiene preflight oficial exacto, pero la confirmación de su apply volvió a caducar; consulta posterior43versiones/mappingfalse/perfilausente. No se han cambiado main, flags ni despliegue. Los informes antiguos describen hitos previos; este estado prevalece.

## Verificación del árbol limpio y borrador

HEAD915c8e2 construido y verificado en serenia-verify-lsp47v:6/7gatesPASS (1114tests, lint, tipos, wire,SQL y buildaislado). Sólo auditstrictFAIL; no se presenta verifyglobalcomoPASS. LockSHA256cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425. db:verify local53versionesPASS mantiene evidencia separada.

Rama subida y PRborrador[1](https://github.com/MiguelLuque/serenia/pull/1), sin merge/main/producción. Usuario amplió revisión a arquitectura/modelos; plan task-model-policy implementa despacho seguro, separación de tareas y proyecciónoffline. Se preservan los bloqueos de publicación y evaluación clínica.
