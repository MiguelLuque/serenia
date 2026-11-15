# Perfil progresivo alojado para Pablo

Autorización30octubre: «ok preparalo todo y despliega entonces para que pablo pueda probar con el correo que mandaste». Continuación del enfoque propuesto de piloto restringido, sin nueva ronda de preguntas: conservar URL/cuenta/contraseña y rol paciente del correo. Base local aceptada93fc4ef/productoe14a9b7; producción11ec2c2. Rama de entrega `codex/pablo-profile-release` en checkout autorizado. No crear un goal distinto por inferencia ni modificar el objetivo técnico ya completado.

## Enfoque y límites

Se elige desplegar en el proyecto existente `serenia`, equipo `team_cQ1syb16Rg80lHZ77BLTXoLJ`, alias `https://serenia-app.vercel.app`, Supabase `brpozobkoatabctjjadc`. Una preview con otra URL no cumple reutilizar el correo; habilitar el flag global sin owner gating tampoco cumple el alcance. Un proyecto/BD nuevos añadirían provisión/coste/cambio de credenciales que no se necesita para este piloto.

La aplicación habilita navegación/página/acciones, contexto, dispatch, worker y recuperación de memoria sólo para UUID Auth de prueba incluidos en `PROFILE_REVIEW_USER_IDS`. En Vercel (`VERCEL=1`), flagon sin lista válida, vacía, duplicada, wildcard, email o más de10UUID falla cerrado, sin romper el chat base ni consultar memoria. Local/test noVercel mantiene comportamiento de opt-in existente. Nunca tomar identidad de body, email ni metadata editable: Auth validado o owner del job cargado por servicio. Worker comprueba identidad antes de start/carga de fuente/modelo; cron sólo reclama owners autorizados, máximo10jobs totales y2dispatch concurrentes.

La lista limita la aplicación y el procesamiento del proveedor. El contrato SQL conserva autorización por owner y consentimiento: no se crea un segundo sistema de roles o de acceso clínico ni una tabla de cohortes. Las RPC owner-only existentes siguen protegiendo la propia información; la lista de despliegue no sustituye RLS ni se presenta como una ACL de esas RPC directas. La activación personal sigue siendo voluntaria, sin backfill. No aceptar onboarding/consentimiento por Pablo ni activar su memoria desde administración.

## Migración alojada

Preflight oficial inicial: proyecto ACTIVE_HEALTHY, PG17,43versiones,3Auth/3perfiles,0sesiones/mensajes/assessments/riesgos/resultados, perfil aún ausente y cuenta ficticia dedicada existente. La primera query de conteo usó por error clinical_assessments (no existe); sólo lectura, se corrigió consultando la migración real assessments. No hubo DDL.

Preparar paquete nuevo que concatena bytes exactos de las cuatro migraciones locales de perfil20261028081958/20261028180058/20261028185351/20261030152754; no replay de historia anterior, reset/push/repair, cambios a seeds/instrumentos ni reescritura de paquetes aplicados. Guards antes y después: target/platform/eventtrigger/RLS/source function dependencies/history/catálogo cuestionarios exactos, ausencia de objetos de perfil, cero filas clínicas y preservación opaca de Auth/perfiles existentes. Capturar baseline sólo con metadatos/agregados; no extraer otros pacientes, secretos Auth, textos clínicos ni claves. Aplicar sólo tras tests SQL de rollback/drift y revisión independiente del paquete/hash. Una respuesta ambigua obliga a consultar historia/esquema antes de reintentar. Registrar mapping de versión remota real, bytes y SHA; no inventar que coinciden timestamps locales.

## Entrega y verificación

Flags de producción `FEATURE_PROGRESSIVE_PROFILE=on` y `PROFILE_REVIEW_USER_IDS` sólo UUID de la cuenta ficticia1ac6fb1d-b393-482d-845c-eaa23e47a447. Se mantienen piloto conversacional, continuidad, modelos y credenciales de servicio. Cuenta paciente, misma URL/password, onboarding pendiente si aún no lo completó. No conceder rol clínico ni cambiar contraseña.

Tests de configuración/identidad/callers y procesamiento, siete gates nativos y checks DB relevantes. Fast-forward main sin force ni eludir protecciones; Vercel Git debe construir SHA exacto, CI success, alias READY, login propio y gating. Aceptación alojada de schema/RPC y límite de onboarding distinguida de conversación real. Para semántica, preparar/ejecutar17casos ficticios por el modelo existente sólo si hay un canal oficial de credenciales que respete las reglas; no inventar calidad ni usar onboarding de Pablo para ensayar. Si una parte sigue noejecutada, declararlo; Pablo puede completar su propio onboarding y opt-in y probar el recorrido real.

El correo ya enviado contiene guía0.2 que describe el perfil como ausente. URL/credenciales siguen válidos; actualizar materiales versionados y preparar una breve nota adicional para el usuario. No reenviar contraseñas ni mandar otro correo automáticamente sin instrucción explícita de envío adicional. No afirmar aprobación clínica o acceso a informes con rol paciente.
