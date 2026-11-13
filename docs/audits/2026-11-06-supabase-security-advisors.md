# Serenia: revisión de avisos SECURITY DEFINER

**Revisión:** 6 de noviembre de 2026. Consulta de metadatos de Supabase en el proyecto `brpozobkoatabctjjadc` y contraste con las migraciones locales de la rama `codex/pablo-profile-release`. Sin consultas de filas clínicas ni cambios en el proyecto alojado. Este informe no constituye una prueba de autorización mediante JWT/PostgREST ni una auditoría completa de las dependencias y permisos indirectos.

## Método reproducible

1. Consultar el advisor de seguridad de Supabase para el proyecto. En la fecha indicada informó 11 funciones `SECURITY DEFINER` ejecutables por `authenticated`.
2. Consultar `pg_proc` y `pg_namespace` para esas 11 funciones de `public`, recuperando firma, propietario, `prosecdef`, `proconfig`, `proacl` y `md5(prosrc)`. Para cada OID, consultar `has_function_privilege('anon', oid, 'EXECUTE')` y `has_function_privilege('authenticated', oid, 'EXECUTE')`; `proacl` aislado no refleja toda la herencia de roles. Revisar los cuerpos alojados sin consultar tablas de pacientes.
3. Comparar cada huella de `prosrc` con el cuerpo literal entre `AS $$` y `$$` de las definiciones correspondientes en `supabase/migrations`, ordenadas por nombre de migración. `md5` se usa aquí solo como huella de comparación accidental, no como autenticación criptográfica ni prueba de equivalencia funcional. Confirmar manualmente las firmas y las funciones sobrecargadas antes de interpretar una coincidencia.
4. Consultar `has_column_privilege('authenticated', 'public.user_profiles', 'role', 'INSERT')` y lo mismo para `UPDATE`, `has_schema_privilege('authenticated', 'public', 'CREATE')` y el indicador `relrowsecurity` de `public.user_profiles`. Estos metadatos no sustituyen el análisis de todas las rutas de modificación ni de los roles heredados de cada JWT.

En las 11 funciones alojadas observadas, el propietario era `postgres`, `prosecdef` era verdadero, la configuración incluía `search_path=public, pg_temp`, `authenticated` tenía permiso efectivo de ejecución y `anon` no lo tenía. `authenticated` carecía de los permisos efectivos INSERT y UPDATE sobre la columna `user_profiles.role` y de CREATE en el esquema `public`; RLS estaba activado en `user_profiles`.

## Cuerpos y controles observados

| Función | Control observado en el cuerpo alojado |
| --- | --- |
| `close_session_atomic(uuid,uuid,text)` | Exige identidad coincidente con el usuario, salvo `service_role`, y comprueba que sesión y conversación pertenezcan al usuario indicado. |
| `complete_patient_onboarding(text,text,date,text,text,boolean)` | Exige identidad, perfil de paciente propio y valida aceptación y datos de entrada; escribe sobre ese perfil. |
| `create_session_atomic(uuid)` | Exige que `auth.uid()` coincida con el usuario indicado y comprueba que el onboarding esté completo antes de delegar. |
| `get_chat_turn_recovery(uuid)` | Exige sesión propia y filtra el turno por sesión y usuario. |
| `get_clinician_inbox_page(integer,integer,boolean)` | Exige identidad y `is_clinician()` y limita el tamaño de página. |
| `get_onboarding_ready()` | Exige identidad y consulta el estado del propio usuario, o su rol clínico. |
| `get_patient_session_reports(uuid[])` | Exige identidad, limita el número de sesiones y rechaza identificadores que no pertenezcan al usuario. |
| `is_clinician()` | Comprueba el rol `clinician` del perfil correspondiente a `auth.uid()`. |
| `regenerate_assessment_atomic(uuid,text,boolean)` | Exige identidad y `is_clinician()`; verifica estado de sesión y evaluación. |
| `review_assessment_atomic(uuid,uuid,text,jsonb,text,jsonb,text)` | Exige identidad y `is_clinician()`; verifica que evaluación y sesión estén relacionadas y preserva hechos de cuestionarios. |
| `touch_session_atomic(uuid)` | Exige identidad y actualiza únicamente una sesión abierta propia. |

Los cuerpos alojados de diez funciones coincidieron por huella con la última definición local. El cuerpo alojado de `get_clinician_inbox_page` coincidió con `20261013213559_final_inbox_pending_review.sql`, no con la definición posterior `20261101104931_assessment_observed_chronology.sql`. La migración posterior está preparada pero no aplicada; la coincidencia por cuerpo no verifica todo el historial, ACL futuro ni comportamiento de la aplicación.

## Riesgo y próximos pasos

Las funciones de buzón, revisión y regeneración exigen ser clínico, pero en los cuerpos observados no se encontró una restricción de asignación a un paciente concreto. **Un clínico parece poder operar sobre pacientes de otros clínicos**. Confirmar con los responsables si se pretende un acceso global para el piloto o una relación profesional-paciente; antes de habilitar varios clínicos o pacientes, diseñar y probar la separación si es necesaria. Esta observación se refiere a estas funciones y no afirma que el resto del sistema aplique o deje de aplicar restricciones.

El [plan original del panel clínico](../superpowers/plans/2026-04-22-plan-5-clinician-panel.md) dejó expresamente fuera la asignación y describió acceso global para los clínicos. La tabla `user_clinician_assignments` se creó como reserva de una versión futura, con política de denegación; su existencia no demuestra una asignación activa. La guía del piloto se ha corregido para no afirmar que esa protección existe. Estos antecedentes explican el diseño, pero no constituyen aprobación para usar datos reales con este alcance.

Una comprobación posterior de solo metadatos encontró también en el proyecto alojado nueve políticas SELECT con `is_clinician()` sin condición de asignación, en tablas que abarcan perfiles, conversaciones, sesiones, mensajes, cuestionarios, riesgos y tareas. RLS estaba activo y `authenticated` tenía SELECT efectivo sobre esas tablas; `anon` no lo tenía. La política de asignaciones seguía denegando el acceso. Esto confirma la configuración de permisos observada, no una prueba de llamadas con JWT ni del recorrido completo. Las pruebas existentes cubren separación entre pacientes y revisión por un clínico, no aislamiento entre dos clínicos.

Preparar una matriz de autorizaciones para cada RPC y pruebas aisladas con JWT reales de paciente propio, otro paciente, clínico y anónimo, incluida manipulación de identificadores y cambios de rol. Revisar las funciones delegadas, permisos indirectos, políticas RLS y configuración efectiva de Data API. La decisión sobre mantener `SECURITY DEFINER` y sus grants debe basarse en esas pruebas y el modelo de acceso, no en el aviso por sí solo. No aplicar cambios alojados hasta contar con recuperación y procedimiento de migración revisados.
