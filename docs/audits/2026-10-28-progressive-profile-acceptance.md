# Perfil progresivo: aceptación técnica local

Actualizado el 29 de octubre de 2026. Implementación y aceptación funcional local completadas; **revisión global de la rama pendiente**. Este documento no acredita diagnóstico, calidad semántica del modelo ni aprobación clínica.

Rama `codex/progressive-patient-profile`, base `11ec2c2`. Último commit de producto probado: **`896ff37170dfb9520d83fa2238aab12e02d4a819`**. [Spec](../superpowers/specs/2026-10-28-progressive-profile-design.md), [plan](../superpowers/plans/2026-10-28-progressive-profile.md). Sin publicación, migraciones remotas, datos reales, modelos externos ni cambios de dependencias o del modelo configurado. `FEATURE_PROGRESSIVE_PROFILE` continúa apagado por defecto; requiere además activación explícita del usuario.

## Comportamiento entregado

Citas literales de mensajes guardados, categoría, fecha, referencia temporal y procedencia; extracción separada de la respuesta del chat mediante cola duradera. El extractor recibe instrucciones de excluir hipótesis y atribuciones ajenas; su comprensión aún necesita evaluación semántica. SQL sólo admite citas literales de fuentes con rol de usuario y no promueve esas observaciones a conclusiones clínicas. Una observación pendiente o confirmada por la persona conserva esa etiqueta; ninguna equivale a revisión de Pablo.

«Lo que recuerda Serenia» permite activar/desactivar memoria y confirmar/descartar citas. Una corrección pendiente impide presentar el dato disputado como confirmado. Confirmarla sustituye el dato previo; si ya fue descartado, permanece descartado. Desactivar impide nuevas extracciones y contexto, conservando las citas revisables; no borra conversaciones ni puede deshacer una petición de modelo ya iniciada. No incorpora retrospectivamente mensajes antiguos.

## Fallos encontrados y corregidos

1. **Confirmar tras descartar el original.** La revisión independiente detectó una corrección pendiente que no podía confirmarse después de descartar su target. La migración forward `20261028180058` resuelve la transición sin reactivar el original ni versiones sustituidas.
2. **Revisión bloqueada en Guardando.** La prueba real descubrió que nuestros conflictos deterministas usaban SQLSTATE `40001`, que provoca reintentos internos en PostgREST 14.5. La [nota oficial de Supabase](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions) describe el problema. La migración `20261028185351` cambia sólo cuatro raises de las tres RPC nuevas a `PT409`; la acción muestra un conflicto recuperable. Se preservaron API, locks, estado, owner, grants y metadatos. No se cambió React ni el SDK para ocultar el problema.
3. **Aviso retenido tras recargar.** La recarga actualizaba los datos pero conservaba el mensaje de conflicto del cliente. El evento de recuperación ahora consume ese aviso. Regresión con el mismo componente montado y prueba real: recargar actualiza el estado, retira el aviso y no afirma un guardado inexistente.

Las suites SQL con shim de Auth y los mocks de acciones **no detectaron por sí solos el bucle de PostgREST**. Los resultados previos de tests se conservan como evidencia previa, no como aceptación final de esa ruta. Antes del retest se detuvo sólo el servidor sintético propio y se terminaron únicamente backends identificados de las solicitudes ficticias; todas las observaciones se conservaron. No hubo reinicio general ni borrado de cuentas/datos.

## Artefacto y verificación final

| Comprobación | Resultado y evidencia privada |
| --- | --- |
| Siete gates `npm run verify` sobre 896ff37 | PASS,1.032 pruebas en 85 archivos; lint,tipos,wire,SQL,audit y build. `.cache/pablo-pilot/logs/20261029-222511-a3qg3vm_.log`; directorio completo `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-6RHL7z` |
| Auditoría de dependencias | Producción y grafo completo:0 advisories de todos los niveles, en la consulta de ese gate |
| Workflow wire |20 payloads anteriores y24 roundtrips actuales;0 fallos |
| Supabase real `db:verify` | PASS lint/advisors/comparación exacta de tipos, log `20261029-222009-3r5ri6cy.log`. Ejecutado tras la última migración; el cambio posterior sólo afecta al botón y su test |
| Build de aceptación local | PASS sobre 896ff37, log `20261029-222422-56z0qm3r.log`; BUILD_ID `vvSSkWGn9PpKGbeaxisPA` |
| Lock y runtime | SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`; Node 24.14.1, Next 16.4.1, React 19.3.1, AI 6.0.303, Workflow 4.8.13 |
| Conflictos PostgREST reales | Revisión obsoleta, start duplicado y fallo tras completar: HTTP 409 / PT409 en 6/3/4 ms; límite de 4 s no alcanzado. Log `20261029-221513-p5tp7iy3.log` |
| Backend tras conflictos |0 revisiones no-idle en bucle, comprobado tras el recorrido final |

Se mantiene el `TimeoutNaNWarning` conocido de la suite sintética; no se describe su salida como libre de warnings ni se afirma corregido. La CLI fijada 2.120.0 avisa de 2.122.0 disponible; no se cambió durante este objetivo.

## Auth, API, Workflow y navegador

Auth/JWT y PostgREST reales del stack local identificado `serenia-dev`, Next de producción aislado y proveedor sintético del harness. Credenciales de estado local sólo en memoria; sin `.env.local` ni proveedores externos. Pruebas propias con actores nuevos `example.test`, nunca cuentas reales. Scripts/recibos privados en `.cache/profile-acceptance/` y `/private/tmp/serenia-profile-20261028/`.

- **Permisos/consentimiento:** anónimo sin RPC; usuario sin jobs/workerRPC/escritura directa; otro owner sin citas ni revisión ajenas; cita literal y fuente propias; replay sin duplicados; desactivar invalida tokens de trabajo running; reactivar no recupera trabajos ni mensajes anteriores. Log inicial `20261028-191113-n47eyi__.log`; la ruta de conflicto lento detectada después se sustituyó y se volvió a probar con PT409.
- **Recorrido de navegador incremental:** activación; mensaje→cita pendiente→confirmación; corrección con cita anterior y disputa visible; descartar corrección conserva el original confirmado; confirmar después de descartar el original; nueva cita y cambio desde otro dispositivo; conflicto explícito→recarga sin aviso residual; desactivar→descartar una cita conservada; siguiente turno sin contexto/trabajo. Primeras acciones en e2ef15a, corrección/contexto en 67aa0af, recuperación y retirada finales en 896ff37. No se atribuye todo el recorrido a un único artefacto anterior al fix.
- **Correlación final de ese actor:**7 turnos completados,1 intento por turno,6 jobs completados y4 observaciones con fuentes literales propias. Las cuatro terminaron descartadas por decisiones deliberadas del ensayo, después de comprobar la confirmación/contexto corregido.0 jobs de cierre y sesión abierta: la memoria no depende de disponer de informe. Log `20261029-222724-3mpouc8z.log`; contexto corregido previo `20261029-221946-d3rinu2n.log`.
- **Pasada integral limpia en el artefacto final 896ff37:** actor nuevo, Auth/API y endpoints Workflow generados; extracción→confirmar→corrección→confirmar→contexto actualizado→replay sin duplicados→desactivar→contexto ausente→reactivar sin backfill.4 jobs completados y0 jobs de cierre. Log `20261029-223011-o4mdrnw7.log`. Esta pasada usa RPC de revisión reales; las acciones de interfaz se comprobaron además en el recorrido de navegador.
- **I/O durable real:** SDK instalado hidrata inputs/outputs ligados al job/token.6 runs + 6 steps del navegador y4 runs + 4 steps de la pasada limpia contienen sólo IDs,token,estados y contadores; no fuentes ni citas. Logs `20261029-222723-8nvuuayt.log` y `20261029-223022-17eipjr6.log`.

Los indicadores del preload comprueban presencia/ausencia de la cita ficticia original/corregida sin registrar prompts.0 denegaciones de red en la evidencia hasta la correlación de navegador; la prueba limpia conserva el mismo límite de red/proveedor. No se midió naturalidad de las respuestas del modelo real.

Un trabajo quedó inicialmente sin despachar y el siguiente turno lo recuperó; no se forzó manualmente su terminación. No se identifica la causa con certeza; coincidió con las solicitudes de conflicto bloqueadas. Se mantiene el respaldo de cola/cron y no se promete latencia inmediata. El cron diario de respaldo no se ejecutó como parte de esta aceptación; sus guards y despacho acotado tienen tests.

## Migraciones y procedencia

Aplicadas sólo al stack local las tres versiones nuevas `20261028081958`, `20261028180058`, `20261028185351`, registrando sus fuentes exactas. Las dos primeras permanecen byte-idénticas tras la tercera. Última SHA256 `9fbff95d4afaa1c4076fca09674a0c601db86af9b69b4ff3e35a7acfdf342827`; aplicación/proveniencia `20261028-195745-d41y75e8.log`. Regresiones incluyen 18 casos de drift de las tres rutinas, rollback y preservación completa de metadatos. Tipos idénticos al generador fijado; una línea de whitespace generado permanece como excepción explícita.

Los huecos previos del historial local `20261013073246`, `20261013213559`, `20261024145433` no se repararon ni se afirma que esas versiones se aplicaran desde sus archivos. El lint/advisors/tipos actual pasa; eso no reconstruye el historial. No hubo reset, reparación inventada ni aplicación hospedada.

## Límites y siguiente revisión

[Casos ficticios para Pablo](../handoff/para-pablo-piloto-2026-10-25/perfil-progresivo-casos.md): terceros, negaciones, historia, preferencias, acuerdos ambiguos, citas ajenas y correcciones. Falta ejecutar y valorar esos casos con el modelo real y Pablo; confirmar por la persona no valida clínicamente la información. No hay medición de precisión diagnóstica ni de atribución semántica.

Las fricciones anteriores de compositor/reintento, cuestionarios, cierre y lectura final siguen en [la revisión del recorrido](2026-10-27-session-journey-ux-review.md); este incremento no las resuelve. Se observó también que el drawer móvil conserva su apertura al navegar al perfil; Escape lo cierra. La revisión global debe decidir su prioridad. Publicación, aceptación hospedada y aprobación clínica/legal siguen fuera de esta aceptación local.

## Decisiones tomadas durante la implementación

1. Rama local separada en el checkout autorizado, conservando el trabajo anterior. Coste: habría que coordinar ediciones humanas simultáneas sobre ese mismo checkout.
2. Contador de trabajos agotados por el consentimiento vigente, además de pendientes, para explicar fallos sin exponer errores. Coste: consumidores del DTO deben respetar ese contrato.
3. Fuentes inmutables y desvinculación de una referencia antigua borrada, conservando la fuente correctora independiente. Coste: una futura edición de mensajes debe crear una nueva intervención trazable.
4. Permitir confirmar la corrección tras descartar el original, manteniéndolo descartado y resolviendo siblings. Coste si la asociación fuera incorrecta: el usuario podría confirmar un vínculo erróneo; se muestra la cita anterior y se mantienen los guards/versiones.
5. Conservar el whitespace del generador oficial de tipos. Coste: un warning de diff conocido, a cambio de paridad exacta comprobada.
6. Usar migraciones forward protegidas sin reescribir fuentes ya aplicadas ni inventar historial. Coste: más pasos de migración que deberán verificarse antes de publicar.
7. Mostrar la cita anterior con una consulta adicional propia y acotada cuando falta en la proyección. Coste: si no está disponible se informa de la limitación; nunca se inventa.
8. Conflictos de negocio `PT409` en las tres RPC nuevas. Coste: consumidores deben interpretar HTTP409/PT409; los cambios conservan firmas, permisos y transiciones. El inventario de migraciones no encontró otros custom40001 anteriores del proyecto.
