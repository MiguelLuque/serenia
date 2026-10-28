# Perfil progresivo: aceptación técnica local

28 octubre 2026. **En curso; no es un recibo de entrega completa.** Objetivo: memoria voluntaria de información relatada, vinculada a mensajes guardados, con temporalidad y correcciones. No constituye diagnóstico ni revisión clínica.

Rama `codex/progressive-patient-profile`, base `11ec2c2`. Contrato: [Spec](../superpowers/specs/2026-10-28-progressive-profile-design.md), [plan](../superpowers/plans/2026-10-28-progressive-profile.md). Sin publicación, migraciones remotas, datos reales, llamadas a modelos externos ni cambios de dependencias o del modelo configurado.

## Persistencia y revisión

Commits `41ed90e` y `4f04678`: tres tablas, activación del usuario, trabajos duraderos por mensaje, citas literales y revisión con control de versión. La revisión independiente encontró que descartar el dato original impedía confirmar su corrección pendiente; la migración forward corrige esa transición conservando el dato descartado y la procedencia. Revisión posterior aprobada.

Regresiones SQL y conexiones concurrentes: propietarios distintos, permisos, fuente inmutable, lotes inválidos atómicos, orden, lease, agotamiento, retirada del consentimiento, replay y correcciones. GREEN: `.cache/pablo-pilot/logs/20261028-190215-eintyj84.log`. `db:verify` GREEN: `.cache/pablo-pilot/logs/20261028-190308-ad7ldz1q.log`.

Se aplicaron únicamente las nuevas migraciones `20261028081958` y `20261028180058` al stack local identificado `serenia-dev`. Fuentes registradas exactas; ninguna migración histórica pendiente aplicada ni inventada. Tres huecos anteriores del historial local permanecen documentados: `20261013073246`, `20261013213559`, `20261024145433`. Los tipos coinciden con el generador fijado; una línea de whitespace generada se conserva como excepción conocida, sin afirmar un `git diff --check` global limpio.

## Auth y Data API reales

Prueba con cuatro cuentas ficticias nuevas `example.test`, Auth/JWT y PostgREST locales. PASS, exit0: `.cache/pablo-pilot/logs/20261028-191113-n47eyi__.log`; script privado `.cache/profile-acceptance/probe.mjs`, recibos en `/private/tmp/serenia-profile-20261028/checks.jsonl`.

- Anónimo sin RPC de lectura/activación; usuario sin acceso a trabajos ni RPC de worker ni escritura directa de settings.
- Fuente anterior a la activación sin trabajo; fuente nueva genera un trabajo propio y conserva cita/origen.
- Otro usuario no ve settings/observaciones ni puede revisar la observación ajena.
- Repetir finish con el token completado no duplica la observación; revisión con versión obsoleta denegada.
- Desactivar con trabajo running cancela e invalida su token; reactivar no permite finalizarlo ni incorpora fuentes enviadas durante la desactivación.

El resultado usado en esa prueba se insertó mediante RPC de servicio con una cita ficticia explícita para aislar permisos y estados. **No acredita todavía la ejecución del extractor ni el Workflow HTTP.**

## Pendiente de completar en este objetivo

Integración del extractor/Workflow/chat, controles del usuario, recorrido de navegador con proveedor sintético, siete gates nativos sobre la rama completa, revisión whole-branch y recibo final con SHA/BUILD_ID. Mantener el flag apagado por defecto.

## Revisión de Pablo y del modelo

[Casos ficticios de perfil](../handoff/para-pablo-piloto-2026-10-25/perfil-progresivo-casos.md): terceros, negaciones, historia, preferencias, acuerdos ambiguos, citas ajenas y correcciones. Las pruebas técnicas/sintéticas no miden precisión diagnóstica ni comprensión del proveedor real. La evaluación semántica del modelo, la revisión clínica, la aceptación hospedada y los requisitos de publicación siguen siendo gates diferenciados.
