# Robust MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Corregir los bloqueos demostrados de Serenia, entregar un MVP local verificable y probar la integración en su Supabase hospedado existente, con una selección de IA fundamentada.

**Architecture:** Mantener la arquitectura existente. Autorización y transiciones viven en servidor/SQL; LLM y modelos de decisiones no pueden autorizar efectos. Operaciones clínicas sensibles se consolidan en transacciones e idempotencia, con recuperabilidad tras fallo externo.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase/PostgreSQL, AI SDK, Workflow, Vitest y navegador instalado.

**Spec:** `docs/superpowers/specs/2026-10-10-robust-mvp-design.md`.

## Global Constraints

- Toda shell se prefija con `rtk`; usar herramientas instaladas y lockfile. Leer documentación Next instalada relevante antes de editar código.
- Trabajar en `codex/serenia-robust-mvp`. Tasks1–6 no tocan BD remota; Task7 autoriza sólo el proyecto Serenia `brpozobkoatabctjjadc` con paquete revisado y fixtures ficticios identificados. No desplegar públicamente, enviar mensajes externos, crear costes nuevos ni imprimir secretos. Preservar cuentas y datos existentes; sin reset remoto ni reparación inventada del historial.
- No promover prompts clínicos draft ni cambiar bandas/cortes aprobados. Edad mínima: 18 años.
- Escribir regresiones primero y observar el fallo por la razón esperada. Conservar logs completos de fallos fuera de la salida rutinaria.
- Implementadores no crean otros agentes. Un bloque de implementación a la vez; revisión independiente después de cada bloque. Investigación de modelos puede avanzar en paralelo.
- Las pruebas de PostgreSQL usan un contenedor efímero y actores ficticios. Registrar las diferencias entre ese entorno y Supabase hospedado.

## Review Focus

- Llamadas directas a Supabase con un paciente malicioso, incluso fuera de Next.
- Dos peticiones simultáneas o repetidas de cierre, revisión y envío de respuestas.
- Caída entre commit SQL y enqueue, y una respuesta LLM que no se persiste.
- Crisis explícita durante un cribado pendiente o al agotar el tiempo.
- Navegación/recarga tras error o revisión: estado visual y versión clínica coherentes.

## Task 1: Permisos, relaciones y revisión clínica

**Files:** `supabase/migrations/`, `lib/shared/supabase/types.ts`, `lib/server/supabase/`, `app/app/clinica/sesion/[sessionId]/actions.ts`, `lib/server/workflows/generate-assessment.ts`; nuevas pruebas SQL/harness y regresiones clínicas.

**Interfaces:** Mantener las firmas de acciones exportadas. Mantener `close_session_atomic(p_session_id,p_user_id,p_reason)`, autenticando identidad dentro de SQL. Las nuevas operaciones clínicas pueden usar RPC tipadas con privilegios mínimos. Task 2 adapta las escrituras de chat/cuestionarios a los permisos endurecidos.

- [x] Añadir y ejecutar regresiones que impidan autopromoción, cierre ajeno, referencias cruzadas y estados reviewed fabricados; preparar harness PostgreSQL con pacientes A/B y clínico.
- [x] Añadir migración correctiva con protección de rol, políticas de escritura mínima y pertenencia a entidades padre, cierre autorizado/atómico/idempotente y revisión/tareas transaccionales.
- [x] Corregir la restauración histórica para que el bootstrap no dependa de cuentas reales; mantener los registros existentes sin inventar fixtures de pacientes.
- [x] Adaptar acciones de revisión, confirmar/rechazar/editar, y proteger lecturas service-role del worker con ownership antes de consumir transcript.
- [x] Ejecutar pruebas focalizadas y SQL desde cero. Confirmar una sola closure vigente y tareas idempotentes tras edición/aprobación concurrentes.
- [x] Registrar cambios, RED/GREEN, comandos, resultados y limitaciones en el informe del bloque; revisión independiente y correcciones antes de cerrar el bloque.

## Task 2: Chat, cuestionarios y recuperación operativa

**Files:** `app/api/chat/route.ts`, `app/api/questionnaires/`, `app/api/internal/close-stale-sessions/route.ts`, `proxy.ts`, `lib/server/supabase/middleware.ts`, `lib/server/chat/`, `lib/server/sessions/`, `lib/server/questionnaires/`, `lib/server/workflows/index.ts`, `lib/shared/chat/`, migraciones y tipos necesarios; tests asociados.

**Interfaces:** Conservar transporte AI SDK y exports de servicios cuando sea seguro. El modelo recibe historial servidor y el nuevo turno autorizado. Persistencia de resultados/asistente usa operación servidor autorizada, compatible con Task 1. Recuperación usa un estado persistente o sweep de sesiones closed sin informe con idempotencia explícita.

- [x] Regresiones RED: rechazo de system/assistant/tool falsificados, confirmación sin propuesta/aceptación, segundo cuestionario tras scored, respuesta parcial sin escrituras, señal nueva con CSSRS pendiente, crisis al límite, cron sin cookie y enqueue fallido recuperado.
- [x] Implementar frontera de mensajes, límites e idempotencia; validar cierres server-side. Procesar el último turno y señal antes del límite temporal.
- [x] Validar opciones y conjunto de respuestas antes de writes; transacción respuestas/resultado/riesgos/estado. Retrys seguros y prioridad de CSSRS; corregir descripción de tool obsoleta ASQ.
- [x] Unificar cierre manual/lazy/cron; hacer llegar cron a autenticación CRON_SECRET; recuperar closed sin trabajo/informe y limitar la concurrencia/coste del sweep. Conservar cookies de refresh y cabeceras de caché SSR al construir redirects del proxy.
- [x] Ejecutar pruebas focalizadas y ampliar SQL real para atomicidad y concurrencia; informar compatibilidad con contratos de Task 1.
- [x] Informe del bloque y revisión independiente; resolver hallazgos antes de integración siguiente.

## Task 3: Flujos paciente y clínico

**Files:** `components/chat/`, `components/onboarding/`, `components/auth/`, `components/app/`, `components/clinician/`, `app/app/page.tsx`, `app/app/sesiones/page.tsx`, `app/onboarding/`, `app/(auth)/actions.ts`, `lib/shared/onboarding/`, `lib/server/clinician/`, autorización de sesión compartida de Task 2, helpers y tests; migración de consentimientos/proyección privada y gates SQL si precisa.

**Interfaces:** Usar firmas de acciones de Task 1 y transporte de Task 2. Selección de informe vigente centralizada con estados explícitos. Mantener el esquema de riesgo existente completo. La aceptación conserva versión y fecha sin afirmar que un texto todavía no aprobado autoriza el lanzamiento.

- [x] Regresiones RED sobre 18.º cumpleaños, menor/futuro/fecha imposible; errores del chat recuperables; cuestionario nuevo sin estado heredado; riesgos visibles/editables; informe rejected/superseded oculto y nombre disponible.
- [x] Implementar validación adulta, registro de aceptación y gating coherente con usuarios existentes; comprobar datos actuales y versión aceptada al iniciar sesión y en chat, sin confiar únicamente en `onboarding_status` editable por el paciente. No admitir escrituras directas que fabriquen el registro servidor de aceptación. Mensajes precisos sin promesa inventada de revisión actual.
- [x] Implementar recuperación del chat preservando texto, estados accesibles y selección semántica; rehidratar el último turno recuperable mediante la proyección scoped de Task 2 y reintentar el mismo ID/texto sin duplicarlo. Permitir escribir mientras existe cribado pendiente y ofrecer una salida accesible para interrumpir una espera/fallo y enviar una señal urgente nueva con su propio ID. C-SSRS con ramas documentadas y normalización compatible con Task 2. Conservar ventana temporal vigente y registrar discrepancia para acuerdo clínico.
- [x] Mostrar/editar heteroaggression/substance_use_acute y actualizar la prioridad de bandeja conservando reglas aprobadas; resolver revisión antigua oculta por limit prematuro con filtro previo y paginación real, trabajo acotado por petición y prioridad global coherente; no cargar el backlog completo para ordenarlo en memoria.
- [x] Usar la versión autorizada de informes y fallback de nombre informal; aplicar también la frontera de lectura en BD: paciente accede únicamente a la proyección autorizada del resumen, sin `clinical_notes` ni informe interno completo vía Data API. Conservar lecturas del clínico y contexto privado server-side validado. Verificar recarga/navegación/error con fixtures sintéticos de paciente/clínico.
- [x] Informe, tests de componentes y revisión independiente; el navegador integral sigue requerido en Task6.

## Task 4: Dependencias y herramientas Supabase

**Files:** `package.json`, lockfile, `next.config.ts`, `eslint.config.mjs`, `hooks/use-mobile.ts`, tests con errores lint, scripts/CI, `.env.example`, seed/configuración Supabase y `docs/operations/`.

**Interfaces:** Conservar contratos de las Tasks 1–3. Usar los candidatos publicados en `docs/audits/2026-10-10-dependency-upgrade.md`, comprobando la instalación efectiva y sus guías. El wrapper Supabase conserva estado local aislado y opt-out en cada comando; nunca opera sobre un proyecto enlazado.

- [x] Fijar dependencias corregidas tras investigar advisories y uso real; retirar herramientas CLI del runtime si corresponde, sin `audit fix --force`. No instalar en el node_modules de otro checkout.
- [x] Resolver errores lint de fuente y pruebas con tipos útiles, raíz Turbopack explícita y scripts de typecheck/verify/DB. Añadir CI con gates fail-closed y reporte de vulnerabilidades. Actualizar SDK/CLI Supabase y el uso de skills oficiales fijadas por commit; documentación y comandos locales de tipos/advisors con límites de entorno explícitos. Revisar todos los adaptadores SSR del proyecto (browser, servidor, proxy y callback) con las guías de la versión instalada; verificar refresh, cookies/cache headers, PKCE y signout sin mutar configuración global.
- [x] Corregir el bootstrap/seed para funcionar desde vacío con las migraciones actuales, sin reincluir ASQ retirado ni depender de metacomandos psql incompatibles. Incluir `NEXT_PUBLIC_SITE_URL` y documentar claves modernas con fallback explícito y sin rotar claves.
- [x] Verificar los reducers y serializer reales de Workflow frente a los payloads previos conservados en `.superpowers/sdd/2026-10-10-robust-mvp/workflow-wire-before/`, además del roundtrip nuevo. Registrar la limitación original de DataView; no presentar un JSON roundtrip como evidencia de wire format. El replay durable del artefacto construido se comprueba en Task 6.
- [x] Implementar el build local aislado del commit mediante snapshot sin `.env.local`, entorno explícito y dependencias instaladas copiadas. Ejecutar tests, lint, tipos, build aislado, SQL y auditoría del lock final; conservar errores completos y advisories residuales. Informe y revisión independiente del bloque.

## Task 5: Evaluación y configuración de IA

**Files:** configuración/adaptadores LLM, scripts de evaluación, fixtures sintéticos, tests asociados y `docs/audits/`.

**Interfaces:** Mantener roles conversational/structured/fast compatibles; no habilitar decisiones en pacientes sin evaluación. Harness de modelos usa entradas sintéticas, versión/modelo registrados, límites de gasto explícitos y no imprime entradas privadas. Si no hay credenciales aprobadas, evaluación offline pasa y comparación online queda no ejecutada.

- [x] Documentar comparativa de modelos con fuentes primarias, precio de entrada/salida, capacidades y límites; evaluar Jev/Decisions como capa auxiliar. Separar ahorro proyectado y rendimiento medido.
- [x] Añadir escenarios y procedimiento de evaluación en español con errores críticos, abstención/calibración, latencia/coste y estabilidad de esquema; bandera de decisiones apagada por defecto.
- [x] Añadir presets tipados para candidatos, un adaptador auxiliar acotado y evaluación reproducible offline. Conservar los modelos actuales del flujo paciente hasta superar el benchmark clínico. No ejecutar llamadas online ni añadir autoridad probabilística sobre permisos, edad, puntuaciones, alertas o cierre. Informe, pruebas focalizadas y revisión independiente.
- [x] Resolver el tracing amplio del cargador de prompts observado en el build de Task4: rutas de archivos acotadas, mismo contenido/versiones clínicas y hashes del cuerpo cargado. Verificar el build y su trazado sin ignorar la advertencia ni incluir archivos de entorno.

## Task 6: Aceptación integral y entrega

**Files:** scripts/fixtures de aceptación fuera de `app/`, tests de integración, README y auditorías consolidadas; integración de inicio de Workflow mediante `instrumentation.ts` si la prueba real demuestra que falta recuperación. Mantener los contratos productivos de Tasks 1–5.

- [x] Arrancar Supabase local con Auth/PostgREST y actores ficticios; verificar migraciones/seed, grants/RLS, consentimiento y proyección privada mediante JWT reales. Ejecutar tipos/advisors estrictos de la CLI final.
- [x] Ejecutar el ciclo de paciente, chat, cuestionarios, error/retry/recarga, cierre, informe y revisión clínica sobre `next start` del build final aislado. Usar el proveedor sintético global documentado del SDK, sin endpoints de bypass, credenciales reales ni fallback externo. Comprobar el proveedor también en los pasos generados de Workflow y el replay del mismo run tras reinicio.
- [x] Consolidar auditoría con estado de cada hallazgo y roadmap de gates externos. Actualizar README con configuración, arranque y comandos exactos; los comandos de fixtures/promoción local deben exigir URL loopback y no cargar `.env.local` implícitamente. No alterar permisos ni cuentas remotas durante la verificación.
- [x] Ejecutar `npm test`, `npm run lint`, typecheck, build, SQL/harness y navegador sobre artefacto final; revisión independiente del bloque y corrección de regresiones. La revisión de toda la rama se conserva como gate final de Entrega después de la Task7 añadida por el usuario.

Aceptación integral prevista: Supabase local con Auth/PostgREST y cuentas ficticias más `next start` sobre el build final. Precargar un ProviderV3 sintético mediante la API global documentada de AI SDK para ejecutar chat/cuestionario/cierre/informe/revisión sin llamadas externas ni bypasses de autorización. El launcher debe exigir destinos locales, limpiar credenciales de proveedores y comprobar workers. Ver matriz `docs/audits/2026-10-10-acceptance.md`; las pruebas con auth.uid simulado conservan su límite explícito.

Workflow Local World es sólo para desarrollo: enlazar el servidor a loopback y conservar su directorio privado entre reinicios. Si falta recuperación automática, reproducir el fallo y usar el lifecycle público del SDK en el inicio real de la aplicación, consultando las guías instaladas de Next/Workflow. El preload de pruebas no puede llamar a `world.start()`, registrar handlers directos ni reencolar para fabricar el replay. El despliegue público requiere un World apto para producción y protección del ingress/colas demostrada; queda como gate externo.

## Task 7: Validación en Supabase hospedado

Añadida por la petición del usuario del12oct de usar Supabase para probar el proyecto que nadie más utiliza. Conserva los requisitos y evidencia de Tasks1–6; no sustituye un gate fallido por otro entorno.

**Files:** plan concreto de migraciones pendientes, configuración/harness de staging separados de los guards locales, evidencia de aceptación y operación.

- [x] Identificar proyecto y plan, comprobar estado, historial/esquema y presencia de datos mediante metadata/conteos sin devolver filas clínicas. Serenia `brpozobkoatabctjjadc`, Free, eu-west-1, ACTIVE_HEALTHY. Conteos exactos:2 cuentas/Auth,2 perfiles,0 registros clínicos,5 definiciones/65 items;40 migraciones hospedadas/45 locales y6 diferencias históricas. Preflight/diseño conservados en docs/audits/2026-10-12-hosted-supabase-{preflight,execution-design}.md; actualización no aplicada.
- [x] Preparar y revisar las migraciones realmente pendientes frente al historial hospedado; comprobar drift, cambios de datos/permisos y recuperación. El24oct se corrigió el guard de tags del trigger, con724e rechazado archivado y6f0037fc revisado. Conservar datos existentes y no hacer reset remoto. La ausencia de usuarios activos no prueba una BD vacía.
- [x] Aplicar sólo el paquete revisado que corresponda y verificar advisors/tipos, permisos y transacciones mediante Auth/JWT/Data API hospedados con fixtures identificados. Canónico6f0037fc aplicado como20261024092459 y forwardd9604 como20261024092547; hashes SQL almacenados exactos,40históricas conservadas, catálogo/conteos previos conservados, JWT/advisors/tipos comprobados. Registro separado supabase/hosted/application-20261024.json; cleanup y ciclo final siguen pendientes. Sin recursos de pago, datos reales a modelos ni relajación de guards locales.
- [ ] Probar Next construido contra esa BD/Auth con configuración explícita del proyecto, proveedor sintético y evidencia de ciclo/informe/revisión. Supabase aloja BD/Auth; el servidor Next/Workflow permanece local en esta fase. Registrar límites de SMTP/callback/configuración hospedada y limpieza scoped de fixtures.

El cambio de entorno autoriza la preparación y validación técnica en el proyecto identificado. Las operaciones destructivas sobre registros existentes o un coste nuevo necesitan aprobación específica; la publicación de la aplicación y el uso con pacientes reales conservan los gates de entrega.

## Task 8: Parche de seguridad publicado el14oct

El gate externo de Task4 se vuelve accionable: la release oficial de Next16.4.1 y los avisos GHSA-673q-mjm6-r5xr, GHSA-2464-fhr4-w9xw y GHSA-p3m5-59mp-jv5r se verificaron el14oct20:59UTC. Este mantenimiento nuevo no reabre la única ola de correcciones de la revisión final ni altera los contratos clínicos.

- [x] Confirmar metadata oficial publicada; fijar el parche compatible de Next/React y dependencias directamente relacionadas con lock revisado, sin actualizaciones generales ni forzar majors.
- [x] Conservar auditoría fail-closed y la caducidad original de cualquier excepción dev. Si cambia su grafo, revisar y justificar exactamente el nuevo grafo o eliminar la excepción al quedar limpio; no ampliar advisories, consumidores ni plazo.
- [x] Ejecutar los siete gates nativos por el cambio de dependencias, build aislado desde commit y smoke del artefacto construido con configuración/proveedor sintéticos; distinguir evidencia anterior y nueva, sin repetir el ciclo completo de Task6 sin motivo concreto.
- [x] Revisión independiente scoped del diff/evidencia por el mismo revisor final y actualización de operación/aceptación. Task8 aprobada15oct por especificación y calidad sobre b67368e..cb02c2d. HostedTask7 continúa pendiente; mantener ambos paquetes SQL exactos e inmutables.

## Task 9: Retirar la excepción vencida y recuperar aceptación vigente

Al retomar el23oct, la excepción dev caducó18oct00UTC. La aprobación histórica de Task8 se conserva; no sirve para afirmar que el gate de dependencias pasa hoy.

- [x] Reproducir el bloqueo actual y obtener auditorías/metadata oficiales con entorno acotado, conservando logs completos. Identificar reparación compatible y revisar cualquier advisory nuevo relevante.
- [x] Aplicar la corrección mínima de dependencias/configuración necesaria, conservando las reglas efectivas de lint y los contratos. Retirar la excepción vencida; no ampliar plazo/allowlist ni ignorar advisories.
- [x] Ejecutar los siete gates sobre fuente comprometida, evidencia del lock/instalación/build y smoke sintético del artefacto afectado cuando cambien dependencias de runtime. No reejecutar Tasks1–8 como implementaciones nuevas.
- [x] Revisión independiente scoped y reporte actual con límites y gate hospedado explícitos. Task9 aprobada23oct, fuente04052b4/evidencia1ea0928;713tests/63archivos, siete exits0 y auditorías producción/completa0. Delta sólo dev, smoke nuevo NOT_RUN. Mantener ambos paquetes SQL exactos e historia intactos.

## Task 10: Actualizar la estimación de caché Decisions

La guía oficial actual23oct cobra lectura/escritura de caché a las tarifas estándar Luna; el preset de investigación11oct todavía las valora en cero.

- [x] Corregir únicamente tarifa/fecha del preset auxiliar, conservando otros snapshots, uso total inclusivo, salida gratuita y primas existentes. No cambiar modelos paciente ni habilitar el auxiliar.
- [x] Regresiones RED/GREEN de facturación con caché y primas; evaluador offline, lint y tipos sobre la corrección. La evidencia nativa de Task9 conserva su fuente exacta; no atribuirle cambios posteriores.
- [x] Revisión independiente scoped y actualización de la comparativa con fuentes primarias; Task10 aprobada en51b7690, ocho pruebas focales y lint/tipos/offline0. Calidad española/calibración online siguen no medidas.

## Task 11: Conservar los hechos del scoring en el informe

Defecto demostrado en la aceptación hospedada24oct: PHQ9 con9respuestas/resultado0 y `summary.questionnaires=[]` aceptado desde la fixture sintética. La fixture no demuestra calidad de un modelo real; el pipeline activo sí permite que el modelo omita o altere hechos que el contrato asigna al scoring. El diseño vigente reserva al modelo juicio/texto; Plan5 exige cuestionarios no editables provenientes del scoring. Es una brecha de integridad dentro del objetivo original, no una ampliación clínica.

- [ ] Reproducir con regresiones del pipeline activo: lista omitida y puntuación/banda/flags inventados, frente a resultados persistidos conocidos. Documentar cadena activa y lecturas que actualmente se ignoran.
- [ ] Construir la sección `questionnaires` desde instancias puntuadas/resultados/definiciones autorizados, conservando puntuaciones, bandas y flags ya guardados. Mantener del modelo el resto del informe. Lecturas fallidas o resultados ausentes de instancias `scored` llevan a revisión manual; un conjunto realmente vacío sigue siendo válido. No modificar escalas, prompts aprobados, catálogos, roles o modelos predeterminados.
- [ ] Impedir en la RPC transaccional de revisión que el cliente cambie u omita los cuestionarios del informe bloqueado; mantener edición narrativa, estados/tareas y retry idempotente. Migración forward independiente con guard de cuerpo/identidad/ACL, revisión y pruebas PostgreSQL/JWT, sin alterar paquetes ya aplicados ni reescribir informes históricos. El control sólo en UI/action no protege la RPC autenticada directa.
- [ ] Verificar las rutas productivas y cualquier generador alternativo que comparta el mismo contrato; regresiones de fallos, salida del modelo y ausencia válida. Ejecutar los siete gates nativos y build hospedado aislado comprometido, conservando identidades/logs y compatibilidad Workflow; revisión independiente scoped del cambio antes de aplicar el forward y cambiar runtime.
- [ ] Probar el artefacto corregido contra el mismo destino hospedado con resultados ficticios ya puntuados: modelo sintético omite/contradice el array, informe persistido y vista clínica muestran los hechos canónicos; revisión/proyección paciente y cleanup scoped completan Task7. No reescribir informes históricos ni repetir DDL/fixtures para simular éxito. Evidencia anterior conserva su fuente27f82d8; fuente/build nuevos se identifican por separado.

## Task 12: Cerrar los nuevos avisos de dependencias de producción

La ejecución obligatoria de Task11 sobre `f1ff5b7` obtuvo test/lint/tipos/wire/PG/build0 pero audit1:22entradas del grafo causadas por cinco advisories de Zod, body-parser y Undici. Las páginas primarias actuales confirman las correcciones; la aprobación de23oct es histórica, no una excepción para estos hallazgos.

- [ ] Verificar releases/constraints y elegir el cambio mínimo compatible: Zod4.6.6, body-parser2.4.0 y Undici6.29.1/7.30.1 son los mínimos corregidos publicados para las ramas afectadas. Preferir versiones padre compatibles; justificar cualquier override exacto si el upstream mantiene un pin/rango vulnerable. No degradar Workflow2 ni actualizar paquetes ajenos por inercia.
- [ ] Conservar el gate estricto de cero advisories en producción/full y todos los fallos reales; dependencia/lock/install fijados sin waiver ni audit fix--force. Mantener identidad de los tres paquetes SQL y contratos clínicos.
- [ ] Comprobar integración de esquemas/AI/Workflow/transporte afectada por el grafo final, ejecutar los siete gates nativos y construir un nuevo artefacto hospedado aislado desde fuente comprometida. Revisión independiente scoped de Task11/12 antes de aplicar el nuevo forward o cambiar runtime; el antiguo build27 y las pruebas anteriores no son evidencia del parche.
- [ ] Completar aceptación hospedada del nuevo artefacto, hechos puntuados→informe, edición/proyección paciente, limpieza y postcheck; si cambia la implementación durable, verificar recuperación sobre el mismo run según impacto demostrado.

La petición24oct deja UX y comportamiento/diagnóstico previo para una fase posterior al cierre técnico de este MVP. Esta tarea corrige bloqueos de seguridad, sin comenzar esa siguiente fase de producto.

## Entrega

- [ ] Revisión independiente de toda la rama con el modelo más capaz disponible después de Task7; una ola de correcciones y revisión scoped, con evidencia final de los gates afectados. Este gate conserva el requisito original de Task6 y no lo sustituye la aprobación local del bloque.

No declarar listo para pacientes reales sin migraciones aplicadas y aceptación de producción, revisión clínica pendiente resuelta y tratamiento de datos aprobado. Entregar rama/diff revisables, reporte de verificación local y próximos pasos concretos. La publicación requiere decisión explícita sobre el resultado construido.
