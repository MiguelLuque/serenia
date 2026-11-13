# Paquete de cronología: revisión local únicamente

**PREPARED_NOT_APPLIED. NO USAR EN HOSTED.** Este paquete es una propuesta reproducible para revisar, no una migración aplicada ni un permiso para ejecutar SQL remoto. Su versión propuesta `20261102122008` y el historial de 45 filas no son un recibo alojado. El paquete de perfil anterior sigue en espera; la cronología depende de él y del readback completo de 44 filas.

Desde la raíz de una copia aislada del proyecto:

```sh
rtk proxy python3 scripts/chronology-dashboard-packet.py
rtk proxy python3 tests/tooling/chronology-generator.test.py
rtk proxy node --test tests/tooling/chronology-hosted-readback.test.mjs
rtk proxy python3 tests/tooling/chronology-docker-lifecycle.test.py
rtk proxy python3 tests/tooling/chronology-integration.test.py
rtk proxy node scripts/chronology-hosted-readback.mjs query
rtk proxy node scripts/chronology-hosted-readback.mjs verify /ruta/privada/resultado.json
```

El generador no conecta con PostgreSQL, no acepta argumentos y fija SHA-256 y rutas de la fuente, los manifiestos, el baseline y el readback revisados. Escribe exclusivamente el SQL propuesto y su manifiesto `PREPARED_NOT_APPLIED`; exige que el readback ya exista y conserve el hash fijado. El verificador comprueba el SHA del wrapper y que su consulta generada coincida byte por byte con el readback incluido, usa las consultas de perfil ya verificadas y rechaza recibos incompletos o alterados. Una actualización deliberada requiere revisar y actualizar los hashes, ambos SQL, el manifiesto y las pruebas; no se deben modificar huellas para forzar una coincidencia.

El wrapper inicia una transacción con `transaction_timeout=50s`, `lock_timeout=5s`, `search_path=public,pg_temp` y bloqueo `SHARE ROW EXCLUSIVE` de la tabla de historial antes de leerla. Comprueba las 43 huellas previas, la fila exacta del perfil, el contenido de la migración y los metadatos de perfil; ejecuta una sola copia verificada de la fuente mediante `DO ... EXECUTE`, registra la nueva fila y repite las guardias antes de commit. Un error revierte la función y el registro juntos en el PostgreSQL sintético. La comparación histórica MD5 identifica la concatenación de sentencias de cada array, no cada elemento individual.

**Límite esencial de concurrencia:** el bloqueo de historial impide INSERT/UPDATE/DELETE concurrentes en esa tabla; no bloquea un DDL directo no coordinado sobre la función. El ensayo reproduce que un `ALTER FUNCTION` entre la comprobación y la sustitución puede ser sobrescrito. Ninguna lectura puntual de actividad prueba por sí sola la ausencia de un escritor futuro. Antes de plantear una entrega haría falta una ventana de mantenimiento efectiva, exclusión de otros despliegues/escritores DDL, actividad comprobada y un procedimiento de respuesta ante desconexión; un advisory lock solo coordina a quienes lo respetan.

El ensayo usa PostgreSQL 17.6 efímero, `--network none`, tmpfs, usuarios ficticios y un registro de perfil ficticio. Antes de crear nada, inspecciona el contexto activo, exige un socket Unix absoluto existente y fija explícitamente ese `--host` en todos los comandos Docker, sin heredar `DOCKER_HOST`, `DOCKER_CONTEXT`, configuración TLS ni tokens. Esto demuestra que el socket está en el sistema de archivos local, pero no que el proceso detrás no sea un proxy remoto. `--network none` aísla la red del contenedor, no certifica dónde se ejecuta el daemon.

El contenedor tiene una etiqueta aleatoria; para ejecutar o eliminar, el harness comprueba esa etiqueta y usa el ID completo inmutable, nunca elimina por nombre. Los comandos y procesos interactivos tienen tiempo máximo. Ante SIGTERM durante el arranque se detiene el cliente y se busca el contenedor etiquetado para limpiarlo; el test mide que la limpieza se inicia sin esperar al timeout cuando la creación ya es visible. El test con un CLI Docker simulado cubre interrupción durante arranque y creación tardía dentro del plazo, timeout tras crear el contenedor, colisión de nombre con etiqueta ajena, ejecución por ID, contexto TCP y socket ausente. Las etiquetas evitan confusiones accidentales; no autentican la propiedad frente a un administrador Docker hostil capaz de leerlas y copiarlas. Si el daemon termina una creación tardía después del plazo acotado, o hay SIGKILL/apagado del host, la limpieza automática no puede garantizarse; el resultado se marca sin confirmar y requiere comprobar el daemon manualmente.

Tras verificar el ID, la limpieza lo usa aunque el contenedor se renombre; no elimina un objeto ajeno que ocupe el nombre original. Comprueba su ausencia después de borrar y falla si no puede confirmarla. Las pruebas simulan renombrado con reemplazo ajeno, borrado no confirmado y SIGTERM durante la limpieza, incluidos casos con error anterior; la cancelación o el error previo no se convierten en éxito.

Se conservan los casos de payload alterado, colisión de historial, fallo posterior a INSERT, repetición, concurrencia en historial y el caso adversario DDL. La prueba SQL→JSON→verificador sustituye exclusivamente diferencias sintéticas que primero comprueba; no equivale a una lectura hosted. El harness rechaza explícitamente Python optimizado porque utiliza `assert`. La función de evento `ensure_rls` es una reproducción de prueba, no una verificación de plataforma alojada.

Si más adelante se realiza una revisión independiente y se decide una entrega, primero se necesita un readback válido de perfil con exactamente 44 filas, un preflight reciente y una ventana de exclusión coordinada. Antes de enviar, comparar bytes y SHA-256 del wrapper completo contra el manifiesto revisado: la transacción puede verificar el payload, pero no puede autenticar cambios en sus propios guards. Ejecutar una sola vez, y ante respuesta ambigua no repetir hasta inspeccionar actividad, historial y estado. Después verificar el recibo específico de 45 filas y sus límites. El proyecto no tiene todavía aceptación de replay normal de Supabase CLI/Branching ni reconciliación final de historia.

Las comprobaciones no demuestran autenticación JWT, Data API, membresía de roles, exclusión de todos los DDL, preservación retrospectiva de filas, aceptación de OpenAI, rendimiento, seguridad clínica ni aprobación de Pablo. La comprobación de rutas presupone checkout local confiable: lstat y lectura son operaciones separadas.
