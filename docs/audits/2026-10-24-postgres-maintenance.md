# Mantenimiento PostgreSQL hospedado — 24 octubre 2026

**Estado: revisión de mantenimiento de plataforma pendiente; no prueba de una vulnerabilidad concreta de Serenia.** Investigación documental acotada, sin SQL remoto, cambios de plataforma, credenciales, configuración, costes ni recursos nuevos. No reabre los bloques locales Tasks1–10 ni sustituye la aceptación hospedada Task7.

## Destino y límite de evidencia

El controlador principal comunica metadatos oficiales actuales del único destino autorizado: Serenia `brpozobkoatabctjjadc`, organización `jhmhzzaqbzvvppwtwfhz`, `eu-west-1`, Free, PostgreSQL `17.6.1.104` / major17. Esta investigación no repitió esas lecturas. La captura del controlador es la evidencia del destino; las fuentes siguientes acreditan únicamente el comportamiento documentado de la plataforma.

La cadena `17.6.1.104` no acredita por sí sola qué correcciones fueron incorporadas o retroportadas. Las fuentes consultadas no proporcionan un mapping de esa imagen exacta a las 44 CVEs ni un inventario de backports. Por ello, **no se afirma que Serenia tenga 44 vulnerabilidades, que una CVE concreta sea explotable, ni que esté completamente parcheado**. Esa comprobación permanece `UNKNOWN` hasta obtener una correspondencia oficial de imagen/parches o evidencia equivalente del proveedor.

## Aviso verificado y compatibilidad

El aviso oficial del25septiembre anuncia PostgreSQL15.19/17.11 desde15.14/17.6, agrupa cinco ciclos de seguridad y declara44CVEs corregidas. El28septiembre fija disponibilidad para proyectos nuevos y actualización desde Dashboard. Identifica cuatro posibles tareas: índices `ltree`, cifrado PGP legado de `pgcrypto`, índices GiST sobre flotantes/NaN y operadores propios con estimadores de selectividad externos. Existen consultas de detección específicas; no se ejecutaron aquí. La ausencia de resultados en esas detecciones descarta esas tareas de compatibilidad según el aviso; **no acredita que todas las correcciones de seguridad sean innecesarias**. [Aviso oficial, consultado24oct](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

No se propone copiar el detector de `pgcrypto`: crea una función temporal y examina valores almacenados. Cualquier comprobación futura debe respetar el alcance de datos autorizado y comenzar por inventario de extensiones/objetos y uso en fuente. Reindexación, recifrado o reparación de operadores requieren su propio cambio revisado si se demuestra afectación.

## Vía Free, interrupción y recuperación

Supabase documenta que restaurar un proyecto Free pausado lo lleva a la última versión menor. También documenta el botón **Upgrade project** en General Settings, con advertencias de elegibilidad y estimación temporal. El proceso es compartido entre upgrades menores/mayores: pone fuera de servicio BD y servicios asociados, copia los datos a una instancia nueva y ejecuta `pg_upgrade`; si falla, vuelve a poner en línea la base original; tras éxito toma `pg_basebackup`. Recomienda ventana de mantenimiento, respaldo previo y validación de aplicación posterior. Deben revisarse bloqueos por réplicas, tipos `reg*`, slots lógicos y extensiones incompatibles. [Upgrading](https://supabase.com/docs/guides/platform/upgrading).

La documentación ofrece una ruta Free sin exigir cambiar de plan, pero no acredita la versión ofrecida ni elegibilidad de este destino. El controlador ya observó17.6.1.104 después de una reactivación: **no se debe repetir pause/restore como experimento ni dar por aplicada17.11**. La discrepancia entre comportamiento documentado y metadatos observados requiere aclaración del proveedor o Dashboard.

Free no tiene la garantía de backups diarios de Pro/Team/Enterprise. Supabase recomienda exportaciones propias fuera de la plataforma; un backup de BD no incluye los objetos de Storage y los backups diarios omiten contraseñas de roles propios. PITR requiere plan de pago y condiciones adicionales. No se comprobó disponibilidad, cobertura ni recuperación de un respaldo real de Serenia; el snapshot de conteos/fingerprints de Task7 **no es un backup**. [Database Backups](https://supabase.com/docs/guides/platform/backups). El modelo de responsabilidad compartida mantiene en el cliente los datos, accesos, controles y aplicación de recomendaciones del Security Advisor. [Modelo oficial](https://supabase.com/docs/guides/deployment/shared-responsibility-model).

## Herramientas disponibles y siguiente paso

Inventario de metadatos de herramientas disponibles en esta sesión: existen `get_project`, `get_advisors`, `list_extensions`, `pause_project` y `restore_project`; **no hay una herramienta de upgrade de PostgreSQL, lectura de configuración general/Auth ni listado/restauración de backups** en esta superficie MCP. Es una limitación de las herramientas expuestas, no una afirmación sobre toda la Management API. No se invocó ninguna operación de proyecto para esta investigación.

| Gate del destino | Estado / evidencia necesaria |
| --- | --- |
| Mapping de imagen y parches | UNKNOWN: confirmación oficial para17.6.1.104; no inferir backports |
| Upgrade ofrecido en Free | NOT_RUN: General Settings del destino, versión objetivo, advertencias y estimación |
| Compatibilidad | NOT_RUN: inventario/uso acotado antes de detecciones adicionales |
| Respaldo recuperable | NOT_RUN: cobertura, antigüedad, custodia privada y recuperación verificadas |
| Ventana y ejecución | NOT_AUTHORIZED en esta investigación; impacto y cambio concretos por revisar |
| Aceptación tras mantenimiento | NOT_RUN: versión, esquema/historia, preservación y flujos sintéticos del destino |

**Siguiente paso propuesto:** inspección de sólo lectura de General Settings y Backups del proyecto exacto para recoger versión ofrecida, blockers y estimación; preparar una consulta al proveedor sobre imagen17.6.1.104/backports si sigue la discrepancia. Sin credenciales ni envío automático. Sólo después podrá concretarse una actualización con respaldo, ventana y validación propios. El mantenimiento queda como gate de plataforma previo a producción; no invalida retrospectivamente la evidencia local ni autoriza interrumpir la aceptación hospedada en curso.
