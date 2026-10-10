# Task 1 — Permisos, relaciones y revisión clínica

Estado de revisión final del bloque: aprobado tras corrección `0354e9c`. Revisión independiente completa y segunda revisión focalizada confirman que editar notas conserva el progreso de tareas y no introduce nuevos problemas importantes. Las limitaciones de integración Task 2/3 siguen pendientes.

Fecha: 2026-10-10. Rama: `codex/serenia-robust-mvp`. Base: `6f0a65e`.
Commit local: `44c0c4c09cae9a59160b7c5f1132474337191f12` (15 ficheros de Task 1).

## Resultado del bloque

Implementación local terminada y verificada. La revisión independiente se
realiza por el coordinador antes de consolidar el MVP. No representa entrega
completa de la aplicación: Task 2 debe adaptar los writers a los permisos
endurecidos, y los gates globales de build/navegador pertenecen a la consolidación.

Se retomaron los cambios locales existentes del agente anterior sin reiniciar
la implementación. Esta continuación revisó código/SQL, corrigió una carrera
de arranque del harness y añadió regresiones SQL de relaciones, tareas heredadas
y reparación histórica. No se usaron datos remotos, secretos o llamadas LLM.
No se desplegó ni hizo push.

## Cambios y contratos

- Migración `20261010075359_robust_authorization_review.sql`: revoca escrituras
  autenticadas de datos operativos/derivados; conserva lecturas autorizadas y
  columnas de onboarding editables. `role`, perfiles de riesgo y datos derivados
  del perfil no son editables por el paciente. El servidor service-role escribe
  después de autenticar y comprobar ownership.
- Foreign keys compuestas preservan propietario y relación de sesión/conversación
  para mensajes, cuestionarios, resúmenes, informes, riesgos y tareas. Un trigger
  rechaza respuestas cuyo ítem no pertenece a la definición de la instancia,
  incluso bajo service-role. Datos existentes incoherentes hacen fallar la nueva
  migración, requiriendo reparación revisada antes de aplicarla.
- `close_session_atomic(p_session_id,p_user_id,p_reason)` conserva su firma.
  Bajo authenticated exige `auth.uid() = p_user_id`; service-role puede cerrar
  para el propietario explícito. Bloquea sesión y conversación, valida transición
  open/active y motivo, actualiza ambas con el mismo timestamp y preserva el primer
  cierre al repetir. `close_stale_sessions` deja de ser API ejecutable: Task 2
  debe usar la RPC autorizada en todas las vías de cierre.
- `review_assessment_atomic` solo admite un clínico autenticado; verifica sesión
  closed, informe closure y pertenencia antes de confirmar/modificar/rechazar.
  Revisión, supersession, sustitución lógica y materialización de tareas ocurren
  en una transacción. Reintentos idénticos devuelven la misma revisión. Se
  conserva el índice único de closure vigente y el historial de tareas.
- `regenerate_assessment_atomic` reclama el estado observado mediante locks y
  compare-and-set; guarda estado previo para compensación condicional. Pacientes
  y service-role no ejecutan esta API de revisión clínica.
- Acciones públicas mantienen firmas; delegan revisión y regeneración a las RPC.
  `saveAssessmentAction.userId` se conserva por compatibilidad, pero SQL obtiene
  el propietario de la sesión y no confía en ese valor del cliente.
- Worker revalida sesión/conversación y propietario antes de leer transcript con
  service-role, también en cada reintento durable; filtra instancias/riesgos por
  usuario. No se altera el prompt clínico.
- La migración histórica de wipe pasa a no-op, sin UUID reales ni borrado de
  auth.users. La reparación de perfiles inserta solo usuarios auth existentes,
  con default paciente y `ON CONFLICT DO NOTHING`; preserva perfiles/roles previos.

## Evidencia RED/GREEN

No se reconstruye una historia TDD para cambios ya hechos por otro agente.
Las evidencias locales conservadas y leídas son:

- `/private/tmp/serenia-task1-worker-red.log`: regresión worker previa al guard
  fallaba porque llegaba a generación en vez de rechazar ownership antes de leer
  mensajes. La regresión pertenece ahora a la suite GREEN actual.
- `/private/tmp/serenia-task1-regenerate-red.log`: SQL rechazó por ausencia de RPC
  `regenerate_assessment_atomic`; es evidencia de contrato ausente, no de fallo
  clínico ni de todas las transacciones. La RPC actual pasa sus regresiones.
- RED fresco: `rtk proxy python3 scripts/test-database.py --baseline-security`,
  salida completa `/private/tmp/serenia-task1-current-sql-red.log`, exit 1 con
  `SECURITY REGRESSION: accepted update user_profiles set role='clinician' ...`.
  El modo baseline excluye endurecimiento y los dos antiguos scripts de datos
  dependientes de identidades históricas, y mantiene el resto del esquema previo.
- El primer intento del harness actual falló antes del bootstrap: `pg_isready`
  por socket aceptaba el servidor temporal del entrypoint y este reiniciaba antes
  de `psql`. Se confirmó en el entrypoint del Docker cacheado; la espera ahora
  comprueba TCP localhost, que el servidor temporal no escucha, y tiene timeout
  explícito. No es un fallo del SQL de la aplicación.

GREEN final SQL de esta versión:

```text
rtk proxy python3 scripts/test-database.py
PASS migrations from empty auth.users
PASS authorization, ownership, closure, review, rollback and regeneration
PASS elevated cross-parent writes and foreign inherited task rollback
PASS historical repair preserves accounts, roles, sessions and patient default
PASS concurrent confirm/modify and duplicate modify retry
```

Exit 0; log `/private/tmp/serenia-task1-current-sql-green.log`. Se ejecutan todas
las migraciones con cada fichero en su propia transacción, sin cuentas previas.
Las pruebas usan pacientes A/B y un clínico ficticios, verifican permisos reales,
referencias cruzadas también con service-role, rollback por fallo de tarea tras
supersession/insert, cierre idempotente, reemplazo sin borrado, tareas terminales
y parciales heredadas, retry de esa revisión, resumen sin tareas y reparación
histórica repetida. Dos conexiones compiten en confirm/modify y otros dos callers
repiten la misma edición; al final hay una única closure vigente y tarea activa
en la sesión concurrente y ambos retries devuelven el mismo ID.

Verificación TypeScript actual:

- `rtk proxy npm test -- tests/assessments/regenerate.test.ts tests/clinician/review-actions.test.ts tests/clinician/save-assessment.test.ts tests/workflows/generate-assessment.test.ts`: 4 ficheros, 41 tests, exit 0; log `/private/tmp/serenia-task1-current-tests.log`.
- `rtk proxy npm test`: 40 ficheros, 511 tests, exit 0; log `/private/tmp/serenia-task1-current-all-tests.log`.
- `rtk proxy node_modules/.bin/tsc --noEmit`: exit 0; log `/private/tmp/serenia-task1-current-types.log`.
- ESLint sobre los 8 ficheros TS modificados de Task 1: exit 0; log `/private/tmp/serenia-task1-current-lint.log`.
- `rtk git diff --check`: exit 0.

Los mocks antiguos centrados en UPDATE/DELETE encadenados se adaptaron al nuevo
contrato RPC. La semántica de contexto de regeneración, errores, autenticación,
validación, tareas propuestas y tareas heredadas se mantiene verificada mediante
tests TypeScript y SQL real; los efectos transaccionales se comprueban en SQL.

El wrapper project-checks localizó los comandos; sus ejecuciones sin escalación
no podían crear logs en ai-workbench fuera de los writable roots. Los checks
anteriores se ejecutaron directamente con logs privados en `/private/tmp`.

## Límites y entrega a Task 2

1. El harness usa imagen local cacheada `postgres:17.6-bookworm`
   (`sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3`),
   `--network none`, tmpfs sin volúmenes, nombre único y cleanup `finally`.
   `auth.uid()` es shim; no prueba GoTrue/JWT/PostgREST ni advisers de Supabase.
   No se modifica ni actualiza la base de datos remota.
2. Task 2 debe mover todas las escrituras de chat/cuestionarios/sesiones a
   operaciones de servidor service-role tras autenticación y ownership, o a RPC
   específicas autorizadas. Los writers actuales pueden fallar con esta migración
   hasta integrar esa tarea; no aplicar aisladamente en producción.
3. El encolado sigue siendo externo a SQL. Compensación de regeneración es
   best-effort; un crash entre claim y enqueue requiere recuperación persistente.
   El copy existente de error puede afirmar restauración aun si falla esa
   compensación: revisar junto a outbox/sweep de Task 2.
4. La migración rechaza relaciones históricas inconsistentes y estados revisados
   sin reviewer/timestamp. Evaluar datos antes de aplicarla; no inventar ni borrar
   pacientes para forzar su éxito. Cambiar scripts históricos no restaura datos
   que una instalación ya hubiera eliminado, ni vuelve a aplicar migraciones.
5. Task 3 conserva la responsabilidad de exposición de versión autorizada al
   paciente, cobertura visual de riesgos y UX. Build/navegador/gates externos
   no ejecutados por este bloque no se declaran como éxito.
6. Revisión independiente pendiente del coordinador. Fuente Next instalada
   consultada: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md`.
   Guías consultadas: Supabase RLS y changelog, project-checks,
   systematic-debugging y verification-before-completion.

El informe permanece en `.superpowers/sdd/`, directorio de evidencias locales
ignorado por el repositorio; el commit incluye únicamente implementación y tests
de Task 1, excluyendo auditorías y plan del coordinador.

## Corrección de revisión independiente — ronda 1

Commit de corrección: `0354e9c86e580c2ca0bd75cd1a6893c6a52dc85a` (3 ficheros).

Hallazgo Important verificado: al editar notas de un informe A, la RPC volvía
a materializar sus propuestas, duplicando una tarea completada en B o cerrando
una tarea parcial y recreándola como pendiente.

Corrección sobre base `33c66a3`: una revisión cuyo `proposed_tasks` es igual al
del informe ya revisado mantiene los IDs, estado, notas, timestamps, relaciones
de origen y cierre de todas sus tareas. Se crea la revisión del informe, pero
no se actualiza ni rematerializa ningún acuerdo sin cambios.

Cuando los acuerdos sí cambian, SQL bloquea las tareas de la sesión de origen
antes de comprobar progreso. Si alguna conserva progreso registrado, rechaza
la edición con `Task agreements have later progress; keep the original agreements
and record changes in a later session`. El error es transaccional y accionable:
conservar acuerdos originales y registrar cambios en una sesión posterior.
Tareas `no_abordada` que fueron cerradas por una revisión de la propia sesión
son historia de sustitución interna y no bloquean futuras revisiones válidas.

Regresión nueva `supabase/tests/review-task-progress.sql`, con fixtures aislados
en BEGIN/ROLLBACK, ejecutada por el harness SQL existente:

- RED antes del cambio: exit 1, `PROGRESS REGRESSION: cumplida task duplicated on
  note-only edit`; log `/private/tmp/serenia-task1-progress-red.log`.
- GREEN después del cambio: `rtk proxy python3 scripts/test-database.py`, exit 0,
  seis PASS; log `/private/tmp/serenia-task1-progress-green.log`. Verifica A
  confirmado → B completa o avanza parcialmente → nota-only de A, comparando
  la fila completa de T, sin nuevas pendientes ni duplicados. Comprueba retry
  con el mismo ID de revisión, segunda edición de notas, rollback de cambio
  incompatible de acuerdos tras progreso y dos sustituciones internas válidas
  sin bloquearse por sus tareas históricas cerradas.
- `rtk proxy npm test -- tests/clinician/review-actions.test.ts tests/clinician/save-assessment.test.ts`:
  2 ficheros, 14 tests, exit 0; log `/private/tmp/serenia-task1-progress-unit.log`.
- `rtk proxy git diff --check -- scripts/test-database.py supabase/migrations/20261010075359_robust_authorization_review.sql supabase/tests/review-task-progress.sql`: exit 0.

Esta ronda cambia solo SQL/harness; no cambian TypeScript ni firmas públicas.
No se repitió la suite global de 511 tests, tipos ni lint: sus resultados previos
siguen siendo evidencia del bloque anterior, no nuevas ejecuciones de esta ronda.
Revisión independiente de esta corrección pendiente del coordinador.
