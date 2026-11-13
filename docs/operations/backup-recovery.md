# Recuperación en Supabase Free: preparación y ensayo local

**Estado: sin copia ni restauración alojada verificadas.** Las huellas de catálogo o los readbacks de migración no son una copia de los datos. [Supabase indica](https://supabase.com/kb/faqs/platform/free-plan-backups) que el plan Free no dispone de backups automáticos restaurables y recomienda exportaciones manuales. La [guía oficial de backups](https://supabase.com/docs/guides/platform/backups) advierte que los objetos de Storage no se incluyen con los datos de PostgreSQL.

## Ensayo sintético opcional

Desde la raíz del repositorio:

```sh
rtk proxy python3 scripts/backup-restore-synthetic.py
```

Necesita Python 3, Docker accesible mediante un socket Unix y la imagen local `postgres:17.6-bookworm`. Utiliza dos contenedores nuevos con `--pull never`, `--network none`, datos temporales y sin volúmenes del host; no accede al stack Supabase existente ni a `.env.local`. La prueba conserva los dumps ficticios solo en memoria y no imprime filas. El socket Unix se comprueba en el sistema de archivos, pero podría ser un proxy a un daemon remoto; `--network none` no demuestra la ubicación física del daemon. La limpieza usa los IDs y etiquetas verificados del harness, con límites ante SIGKILL, un daemon que falle o una creación tardía.

El script carga los bytes del harness de `tests/tooling/chronology_local_docker.py` mediante ruta relativa al propio checkout y exige el SHA-256 revisado `112d9e08f7aa758c99d676237ee25e4c98bbc6f70bd03d0f9cc6a809eefb776d`. Una modificación deliberada del harness requiere revisar su contenido, actualizar el hash del ensayo y repetirlo. Las comprobaciones de rutas presuponen un checkout local confiable.

El ensayo usa `pg_dumpall` y `pg_dump` de la imagen para roles ficticios, esquema, datos y `supabase_migrations` por separado. Compara contratos, permisos, políticas, conteos y hashes agregados; prueba una política RLS con dos identidades ficticias y comprueba que un trigger ficticio de `auth.users` crea un perfil tras restaurarlo. También demuestra que los metadatos de un objeto de Storage pueden restaurarse mientras el blob externo no está en la copia. El tratamiento del rol `postgres` en este experimento es específico de la fixture; no es una receta para editar dumps reales.

**No demuestra** que exista una copia del proyecto real, ni una restauración de Supabase, GoTrue/JWT, Data API, Vault, claves, Storage real, configuraciones, Edge Functions, timers, roles gestionados o su comportamiento con escrituras concurrentes. No valida exclusión de otros procesos, consistencia de dumps tomados en instantes distintos, recuperación clínica ni protección de datos reales.

## Qué falta antes de una copia real

1. Definir y autorizar el alcance de los datos, destino cifrado, acceso, retención y procedimiento de eliminación. Una exportación completa puede incluir identificadores y credenciales derivadas de las cuentas; no enviar contenido ni claves al chat o a logs. Comprobar el destino y el espacio antes de leer los datos.
2. Preparar una vía remota independiente y revisada. `scripts/supabase-local.mjs` permite solo comandos locales; no debe relajarse para hacer un backup. La documentación de Supabase describe exportaciones de roles, esquema, datos e [historial de migraciones](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) por separado. Una ejecución real requiere acceso adecuado y manejo de credenciales que no las exponga en argumentos ni logs; el ensayo sintético no lo proporciona.
3. Garantizar una captura coherente: las exportaciones separadas pueden observar estados distintos si hay escrituras. Hay que acordar una ventana sin cambios o demostrar un mecanismo de instantánea adecuado para todas las piezas, y comprobar qué configuración y qué blobs externos deben preservarse aparte. Los roles gestionados, Vault, Auth y Storage requieren revisión específica; no suponer que se reconstruyen con un dump genérico.
4. Probar una restauración en un destino aislado y autorizado, con automatismos salientes deshabilitados. Comprobar inventario, permisos, RLS, funciones y triggers, historial y conteos/hash apropiados, además de servicios y objetos externos requeridos. Conservar recibos privados y documentar qué no se ha recuperado. Un restore sintético no demuestra que una copia real sea utilizable.

La entrega de perfil y cronología sigue su propio [HOLD](../audits/2026-11-02-profile-dashboard-delivery.md). Sus preflights y readbacks exigen conteos congelados: crear cuentas, sesiones o un marcador en `audit_log` antes de finalizar ambos recibos puede invalidarlos. La copia de seguridad, cuando exista una vía aprobada, debe coordinarse con esa ventana y no sustituye los controles de migración.

El 5 de noviembre de 2026 el usuario indicó que no hay otros administradores ni automatizaciones externas que puedan modificar el proyecto, aparte de él y este trabajo. Es información aportada por el usuario, no una comprobación de procesos activos ni una ventana ya establecida: antes de cualquier entrega siguen siendo necesarios el control de escritores propios, la verificación de actividad y una recuperación viable.
