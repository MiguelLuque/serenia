# Auditoría de finalización del perfil progresivo

30octubre2026. Objetivo completo de implementación técnica local: extracción desde mensajes guardados, procedencia/temporalidad, correcciones sin validación clínica automática, aislamiento, contexto pertinente y acotado, y control del usuario sin bloquear la conversación. Fuente comprobada **e14a9b7584fb47296b29be3f4032606d3a665934**. Los commits posteriores de esta entrega sólo documentan resultados. [Índice de evidencia](2026-10-28-progressive-profile-acceptance.md), [Spec](../superpowers/specs/2026-10-28-progressive-profile-design.md), [plan](../superpowers/plans/2026-10-28-progressive-profile.md).

## Requisitos contrastados con el estado observado

| Requisito | Evidencia que lo prueba y su alcance |
| --- | --- |
| Extraer de intervenciones guardadas del usuario | FKs compuestas, rol fuente e inmutabilidad SQL; validación literal TS/SQL; extractor/SDK real con transporte sintético; recorrido HTTP final genera pending desde mensaje admitido. No se usa texto del asistente como evidencia de aceptación |
| Fuente, categoría y temporalidad | DTO, fecha derivada de la fuente y time_scope; citas/fechas/estados visibles en navegador; fuentes exactas en SQL y109observaciones del ensayo. Actual significa en fecha de la cita, no vigente para siempre |
| Opt-in explícito, flag off y sin backfill | Guards de UI/dispatch/contexto probados; Auth real activa por owner; trigger sólo con settings enabled; recorrido final desactiva/reanuda sin crear trabajos del turno desactivado |
| Extracción durable separada del chat | Job transaccional, despacho tras admisión guardada, un step sin fuente en I/O, leases/tokens/epoch/backoff/3claims. NativeSQL verifica conexiones independientes y carreras. HTTP final devuelve conversación y completa jobs sin informe de cierre |
| No elevar hipótesis a hecho clínico | Campos cerrados/cita literal, etiquetas pending/confirmado por ti visibles, prompt excluye hipótesis/terceros/acuerdos no expresados, no campos diagnósticos ni cambios de permisos/score/informe clínico revisado. Esto prueba la separación de autoridad; no precisión semántica del modelo real |
| Corregir, disputar y revisar con versión exacta | SQL de siblings/target rechazado/superseded, mutex y PT409; navegador muestra disputa fuera de página; segunda sesión confirma oldpending y acción UI obsoleta muestra conflicto; recargar lo consume y muestra el estado vigente |
| Todas las citas retenidas alcanzables tras100 | Nueva RPC owner-only por keyset preciso; SQL205filas/203empatadas recorre100/100/5; Auth/API/HTTP107filas recorre100+7; enlace visible del navegador alcanza oldpending y oldconfirmed. Lectura máxima100 y DOM sin acumulación |
| Descartar una cita antigua evita su posterior uso como target | Descarte UI persiste rejected. Antes, Workflow real produjo supersedes_id del target antiguo; después completa otra extracción sin ese target. Filtro real de worker owner+confirmed+anterior+limit20, SQL/worker regressions y prueba final109filas complementan esa evidencia |
| Aislamiento y permisos mínimos | RLS/FKs; auth.uid y filtros explícitos del owner en RPC/lookup; jobs/worker sólo servicio, página sólo authenticated. Pruebas reales anónimo/otro owner/cursores ajenos; fuente y target ajenos denegados; grants y catálogo SQL comprobados |
| Contexto pertinente sin romper conversación | Relevancia léxica,8citas/4000caracteres, etiquetas/fechas, omisión de rechazadas/superseded/disputadas y aislamiento de fallos/budget en tests finales. HTTP conserva original antes, sólo corrección confirmada después y ningún bloque tras opt-out |
| Opt-out y borrado sin resurrección | SQL concurrente y Auth real: tokens/epoch viejos no escriben, re-enable no resucita jobs; cascadas al borrar fuente/Auth y desvinculación de target preservan corrección independiente. No se promete deshacer una petición externa ya iniciada |
| Flujo y navegación de usuario | No hay confirmación obligatoria por mensaje; controles voluntarios de perfil. Mobile390×844 navega al perfil sin overlay; oldpage→recent deja100tarjetas y no conserva aviso de éxito/conflicto anterior. Tests de los cinco destinos compartidos, escritorio y teclado |
| Migraciones locales y tipos | Cuatro migraciones de perfil con fuente exacta registrada; última20261030152754 aplicada con identidad/preflight y preservación de historia/catálogo/datos previos. Lint/advisors/paridad exacta de tipos PASS. Gaps históricos retenidos, sin reset/repair/remoto |
| Siete gates y artefacto inmutable | `npm run verify` e14:1056tests/85archivos y otros seis gates exit0; audit production/full0;20payloads previos/24roundtrips. Build acceptanceon separado, BUILD_ID38NOx7roefCVaukcyxjif y lock cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425 |
| Auth/API/Workflow/browser del mismo producto final | Nueva pasada HTTP completa con cuatro runs; historial con dos runs y acciones UI reales; SDK hidrata4+2runs y4+2steps con IDs/estados/contadores únicamente. No se deduce la prueba de UI de un mock |
| Revisión independiente y resolución material | Revisión global señaló I1/P2; una ola e14 resolvió I1 y M1, una revisión scoped completa sin nuevos Critical/Important. Informes conservados en Git; generador whitespace y TimeoutNaNWarning P3 explícitos |
| Entrega local revisable y revisión clínica separada | Rama dedicada preservada, Spec/Plan/recibos/casos ficticios versionados. Logout observado, pestaña de prueba cerrada, viewport restaurado; sólo runtime propio99765 detenido y salida143 observada. Supabase/datos/evidencias permanecen. Perfil sin publicación ni activación pública |

La matriz se apoya en los archivos y resultados subyacentes enumerados en el índice, no sólo en contadores o manifiestos. La prueba del historial distingue23jobs de preparación manual con fuentes válidas de los dos runs de extracción reales. Los errores del tooling privado y la expiración durante la pausa se conservan; no se presentan como fallos del producto ni se borran del relato.

## Disposición explícita de lo que el revisor no juzgó

1. **Semántica del proveedor real:** atribución a terceros, negación, tiempo, diagnóstico inferido, acuerdos ambiguos y matching de correcciones quedan para los17casos de Pablo. No se atribuye precisión semántica a fixtures deterministas.
2. **Eficacia/precisión diagnóstica/seguridad de prosa/inyección:** no afirmadas. La validación estructural y los guards no equivalen a validar esos resultados.
3. **Consentimiento, retención, aprobación clínica/legal y uso asistencial:** separados del objetivo técnico local con relatos ficticios. Mantener feature off antes de esa evaluación.
4. **Alojamiento, despliegue, precio, latencia, carga y disponibilidad de producción:** el perfil sigue local. La publicación anterior11ec2c2 excluye el perfil; no es evidencia de compatibilidad hospedada de estas migraciones.
5. **Tres gaps históricos:** conservar20261013073246/20261013213559/20261024145433; los checks actuales no prueban su aplicación histórica. No reparar ni reconstruir ficticiamente.
6. **Cron diario y SLA:** no se ejecutó el calendario real ni se promete incorporación inmediata. Sí se prueban guard/dispatch acotado, cola y recuperación por siguiente turno.
7. **Demora inicial del primer nudge:** causa desconocida, recuperada por turno normal. Su coincidencia con el antiguo bucle de conflictos no acredita causalidad.
8. **UX previa de compositor/reintento/cuestionarios/cierre/informes:** fuera del delta de perfil, con auditoría propia pendiente de mejoras. M1 móvil sí se corrigió y comprobó aquí.
9. **Cobertura exhaustiva de browser/a11y/dispositivos/carga:** no afirmada; pruebas locales delimitadas y tests de componentes, sin extrapolación universal.
10. **Retractar llamadas externas iniciadas y retención de terceros:** no prometido. Se prueban fencing, supresión posterior de contexto y cascadas; políticas del proveedor no se evaluaron aquí.

Estas limitaciones no se convierten en aprobaciones por completar el objetivo técnico. Los casos semánticos, la valoración de Pablo y cualquier publicación del perfil siguen siendo trabajos separados y explícitos.

## Repetir la aceptación

Con el checkout/commit y dependencias fijadas, el stack local saludable y las instrucciones de `docs/operations/supabase.md`:

```sh
rtk npm run verify
rtk npm run db:verify
rtk proxy env SERENIA_ACCEPTANCE_PROFILE=on node scripts/build-isolated.mjs --local-acceptance
rtk proxy env SERENIA_ACCEPTANCE_PROFILE=on node scripts/acceptance-start.mjs ABS_BUILD_DIR ABS_PRIVATE_STATE_DIR
```

El selector activa sólo el harness local con proveedor sintético y no habilita producción. No reutilizar modos que crean fixtures sobre un actor ya consumido; los recibos privados identifican cada actor y estado. No imprimir claves del status ni leer `.env.local`. Los informes global/scoped y el recibo están versionados; los logs completos y el archivo del workspace SDD quedan privados bajo `.cache/profile-acceptance/` y `.cache/pablo-pilot/logs/`.

Se retiró sólo el workspace activo de este plan tras mover sus30archivos, verificando SHA256 individual antes/después, a `.cache/profile-acceptance/sdd-archive/2026-10-28-progressive-profile`. Digest del manifiesto ordenado: `b2cddf146a4adb5026574398b9b692a6c304c5428e3b61467c8fe7ace02f01ea`; manifiesto privado hermano con sufijo `-manifest.json`. Ningún workspace de otros planes se modificó. La guía PDF anterior conserva sus bytes; `.gitattributes` la trata como binaria para evitar advertencias textuales sobre espacios necesarios en su formato. El diff completo conserva sólo la excepción conocida del generador de tipos; no se limpiaron esos bytes manualmente.
