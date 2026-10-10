# Serenia — auditoría de producto, UX y cobertura (lectura, 2026-10-10)

## Alcance y límites

Leí AGENTS.md, CLAUDE.md y RTK.md; revisé páginas/components, tests front/e2e, Next 16.2.4 docs instaladas y documentación de alcance/operación. Toda shell se ejecutó con rtk. No edité app/BD/configuración, no leí secretos ni accedí a pacientes reales, no invoqué modelos externos. Root ejecuta checks y navegador anónimo: este informe aporta evidencia estática, no aceptación de flujos autenticados.

## Estado real

Hay un prototipo funcional sustancial: registro/login, intake, sesión de 60 minutos, chat streaming, tarjetas de cuestionarios, cierre/generación asíncrona de informe, revisión/rechazo/regeneración clínica y acuerdos entre sesiones. El núcleo determinista está bastante probado. El flujo completo de paciente y clínico no está protegido por pruebas de navegador ni integración real con BD/RLS. Varias decisiones clínicas firmadas están documentadas pero todavía no aplicadas en UI/schema.

No sería riguroso llamarlo listo para pacientes reales. Tampoco sería correcto decir que falta toda validación clínica: ADR-024 y changelog registran respuestas firmadas de Pablo, mientras v2.1 continúa como borrador y el sign-off Plan6 conservado en repo tiene firmas vacías.

## Hallazgos de corrección

### P1 — El onboarding permite menores y fechas futuras

- `lib/shared/onboarding/schema.ts:25-27`: birthDate solo comprueba regex YYYY-MM-DD.
- `app/onboarding/actions.ts:32-42`: upsert escribe birth_date y marca onboarding complete.
- ADR-024, `docs/architecture/decisions.md:489-496`, exige explícitamente 18+.
- Escenario: registrarse, introducir fecha de hoy o un nacimiento hace 15 años y el resto de campos válidos. Pasa validación y habilita `/app`. La regex también acepta fechas calendáricas inválidas, aunque la BD puede rechazarlas después.
- Acción: comprobar fecha real, no futura y mayoría de edad en frontera servidor; tests cumpleaños exacto, día anterior, futuro, bisiesto y fechas inexistentes.

### P1 — El clínico puede revisar sin ver dos dimensiones del riesgo

- `lib/server/assessments/generator.ts:31-44` incluye heteroaggression y substance_use_acute.
- `components/clinician/assessment-view.tsx:367-395` solo presenta suicidality, self_harm y notes.
- `components/clinician/assessment-editor.tsx:305-363` solo permite editar esas tres dimensiones.
- Escenario: informe con heteroaggression='plan', suicidality='none', self_harm='none', notes vacías. La tarjeta muestra ausencia de ideación/autolesión y omite el plan; el CTA Marcar como revisado valida el informe oculto. `lib/server/clinician/inbox.ts:235-249` deriva riesgo del informe validado solo desde suicidality, por lo que no ofrece una señal redundante del plan.
- Acción: mostrar/editar cada campo generado de riesgo y definir cómo prioriza la bandeja las dimensiones nuevas conforme al protocolo clínico aprobado.

### P1/P2 — C-SSRS ignora ramas de administración y ventana entre visitas

- `components/chat/questionnaire-card.tsx:67-77` únicamente implementa condicional ASQ; para CSSRS muestra todos los items.
- `supabase/migrations/20260517000001_seed_cssrs.sql:8-10` exige omitir 3/4/5 cuando item2=No y omitir 6b cuando item6=No; caller debe completar omitidos como 0 para scorer fijo de 7 elementos.
- `supabase/migrations/20260517000001_seed_cssrs.sql:87-91` siempre usa lifetime y últimos 3 meses; Card recibe prompts de BD, sin fase/contexto de visita.
- ADR-024 §4, `docs/architecture/decisions.md`, prescribe lifetime sesión1 y since-last-visit posteriores.
- Escenario: responder No en ideación y conducta aun así fuerza preguntas sobre método/intención y conducta reciente. En sesiones posteriores se vuelve a preguntar lifetime/3 meses, sin adoptar la ventana firmada entre visitas.
- Acción: modelo explícito de branching y modalidad temporal, UI y normalización servidor coherentes; contrastar la contradicción interna entre ADR y doc/seed con clínico antes de escoger nueva copy.

### P2 — Tras un error de chat el paciente queda sin recuperación

- `components/chat/chat-view.tsx:76-83` solo toma messages, sendMessage y status; no error, onError, clearError ni retry.
- `components/chat/chat-input.tsx:17` deshabilita siempre status !== ready y `:29-30` vacía el texto inmediatamente.
- SDK instalado confirma status='error' en `node_modules/ai/src/ui/chat.ts:757` y recuperación explícita clearError en `:469-475`.
- Escenario: pérdida red, 500 del proveedor o 409 sesión cerrada mientras la UI cree que sigue abierta. Quedan textarea/Enviar deshabilitados, sin explicación ni reintento, hasta recargar la página.
- Acción: estado visible y anunciado, preservar/recuperar texto no enviado, recuperar error según semántica (retry o volver al inicio si cerrada) y probar transporte simulado fallido.

### P2 — Las páginas de paciente no excluyen informes rechazados; varias versiones se resuelven mal si existen

- `app/app/page.tsx:125-139` consulta todo closure de última sesión con maybeSingle sin filtro status.
- `app/app/sesiones/page.tsx:40-54` carga todos los closure sin orden/filtro y pisa Map por sessionId.
- `app/app/clinica/sesion/[sessionId]/actions.ts:95-123` crea nueva revisión clinician-authored y mantiene fila antigua superseded.
- Escenario principal: rechazar un informe; el paciente continúa recibiendo patient_facing_summary del informe rejected porque no se consulta su status. El borrador IA tampoco lleva indicador pendiente de revisión. Escenario condicionado: si existen varias revisiones legacy o el versionado está habilitado, Home pasa de 1 a 2 closure, maybeSingle devuelve error ignorado y desaparece resumen; el histórico depende del orden sin garantía y puede mostrar el superseded. El agente de datos informa de un índice unique que actualmente bloquea la edición antes de crear la segunda fila (23505), por lo que no presento esa ruta múltiple como reproducida hoy.
- Acción: selector compartido de última revisión vigente/publicable, exclusión rejected/superseded y etiqueta IA pendiente cuando corresponda; probar draft→reviewed, revisión modificada y rechazo/regeneración.

### P2 — El segundo cuestionario puede heredar estado submitted del primero

- `components/chat/chat-view.tsx:199-214` monta QuestionnaireCard sin key por instanceId.
- `components/chat/questionnaire-card.tsx:60-64` mantiene answers/currentIdx/submitted locales; `:114-121` marca submitted, dispara turno sintético y espera 1500ms para refrescar.
- Escenario: tras finalizar un cuestionario, el turno sintético propone otro antes de que el refresco quite la tarjeta anterior. SSR devuelve nueva activeQuestionnaire, pero React reutiliza componente submitted=true. Solo se ve Enviado y ChatInput permanece bloqueado porque la nueva instancia está proposed.
- Acción: key por instancia o reset explícito y cancelar timeout al desmontar. Prueba render con rerender A→B mientras A está submitted.

### P2 — Bandeja pierde pendientes antiguos al alcanzar 100 cierres

- `lib/server/clinician/inbox.ts:82-87` toma 100 sesiones cerradas más recientes de cualquier status de informe.
- `:53-66` ordena después y solo considera pendientes null/draft_ai, no pending_clinician_review/requires_manual_review.
- Escenario: una sesión pendiente/urgente antigua seguida de 100 sesiones recientes revisadas. La primera ya no aparece y no existe paginación/búsqueda visible. Nuevos manual-review ni se priorizan como pendientes.
- Acción: consultar bandeja pendiente antes del cap, incluir todos estados accionables y priorizar riesgo/SLA; separar histórico con paginación.

### P2 — El onboarding recoge un nombre que el dashboard y panel ignoran

- `app/onboarding/actions.ts:36` guarda informal_name; tests/onboarding/submit-profile.test.ts:115 fija que no escribe display_name.
- Trigger de alta `supabase/migrations/20260420000002_user_profile_trigger.sql:8-9` no escribe display_name, nullable.
- `app/app/page.tsx:86,146`, AppLayout/Sidebar y consultas de clínico utilizan exclusivamente display_name.
- Escenario: alta nueva introduce Ana en onboarding. Home muestra Hola, .; sidebar Sin nombre y todas fichas/bandeja Paciente sin nombre, complicando distinguir pacientes.
- Acción: usar fallback al nombre informal para presentación sin perder semántica del nombre completo ni cambiar el contrato de privacidad.

### P2 — Selección del cuestionario y controles clínicos carecen de semántica accesible

- `components/chat/questionnaire-card.tsx:154-170`: opción es botón sin radio/radiogroup/aria-checked/aria-pressed; selected solo cambia color. Error `:174` no tiene alert.
- `components/clinician/assessment-editor.tsx:251-255,281-285,429-435,587-592,683-686` incluye textarea/input sin Label, aria-label ni aria-labelledby; encabezado visual CardTitle no los etiqueta.
- `components/chat/chat-view.tsx:177-186` carece log/live region para mensajes nuevos y `:139-143` fuerza desplazamiento abajo en cada token incluso si paciente relee historia.
- Escenario: lector de pantalla no puede saber respuesta marcada, ni nombre de varios campos del informe, ni recibe aviso fiable del turno nuevo. Persona releyendo chat es arrastrada abajo durante stream.
- Acción: radios semánticos, labels asociados, errores anunciados y región log apropiada sin anunciar cada token; autoscroll condicionado a proximidad al fondo. Prueba teclado/a11y con fixtures.

### P2 — Mensaje de crisis promete revisión actual sin comprobarla

- `app/app/page.tsx:173-179` afirma Tu psicólogo la está revisando hoy solo por closureReason.
- `app/app/sesiones/page.tsx:96-99` afirma la está revisando sin consultar estado.
- ADR-024 §12 requiere no comunicar SLA específico al paciente; usa wording genérico. Decisión humana #6 conserva explícitamente pendiente el modelo de relación/asignación clínica.
- Escenario: usuario vuelve días/semanas después, informe aún sin revisar o ya revisado. Se le comunica revisión actual, sin proceso que la confirme.
- Acción: copy ajustada al estado verificable y protocolo aprobado; test existente fija literalmente la promesa por búsqueda de strings y habría que reemplazarlo por prueba de comportamiento.

## Cobertura real

- package.json define test=vitest run, lint=eslint, build=next build. Root confirma 518 tests pasados y 26 errores de lint; build sigue en comprobación. No volví a ejecutar los checks.
- vitest.config.ts:15 usa environment=node e incluye solo .test.ts; no DOM environment ni tests .tsx.
- tests/e2e/questionnaire-flow.test.ts importa createInstance/submitAnswers y simula .from() Supabase; son 2 pruebas de servicios (PHQ9, CSSRS), no browser+HTTP+persistencia+RLS.
- Búsqueda de testing-library/render/userEvent/playwright/axe únicamente encuentra un comentario en tests/app/home-crisis-notice.test.ts:20: no renderiza la app, busca literales en archivos fuente.
- Hay buena cobertura de scores, schemas, contexto, protocolo, safety-state, servicios/actions con mocks. No prueba real de componentes/teclado, streaming/error recovery, ciclo de dos cuestionarios, selección de informe vigente, permisos reales de BD ni consentimiento/borrado reales. No medí % coverage; no está configurado provider/report/threshold.

## Documentación y operación

- README sigue siendo create-next-app genérico. Falta punto de entrada que diga estado actual, instalación/pinned manager, entorno sintético, migración/seed seguro, roles, verificación y rollback.
- Feature-flags contiene solo continuidad; declara estado prelaunch fechado abril y entorno local usando BD de producción. No prueba estado actual; exige reconciliar antes de ensayos persistentes.
- sign-off Plan6 conserva firmas vacías (líneas 271-289); smoke checklist conserva firma vacía (266-273). No equivale a demostrar que nadie lo haya firmado fuera del repo: evidencia verificable no está incorporada.
- Documentos de handoff originales siguen con respuestas huecas aunque ADR-024/changelog registran feedback firmado posterior: seleccionar fuente de verdad, trazar decisión→commit→test→aprobación activa.
- Prompts v2.1 se mantienen draft, loader usa prompt vivo v1. El sistema no es aún el protocolo firmado completo descrito por ADR-024. README de agentes aún enlaza roles/session-therapist.md y protocols/session-flow.md, eliminados según changelog.
- Spec MVP exige right-to-erasure y consentimientos versionados; en UI/API revisadas no hay borrado/privacidad ni texto de términos enlazable. Deuda de alcance y gate interno de lanzamiento, sin concluir incumplimiento jurídico.
- No .github/CI encontrado y no suite navegador. Operación requiere responsable, canal de urgencias, recuperación de workflows y separación de BD sintética antes de validación integral.

## Mejoras separadas de bugs

Atrás/corregir respuesta, rechazar/posponer cuestionario y reanudar progreso; detalle navegable de sesiones cerradas; feedback de streaming/tiempo; recuperación password; paciente informa progreso de acuerdos. Son backlog de experiencia a priorizar tras corregir gates, no defectos todos demostrados por requisitos vigentes. No abrir pagos/mobile ni expandir instrumentos ahora.

## Próximo bloque sensato

1. Congelar alcance de piloto adulto en España y reconciliar ADR-024/prompts aprobados/estado de lanzamiento con responsables; mantener pendiente lo que precise decisión clínica.
2. Corregir los P1 de edad, administración de C-SSRS y riesgo visible; junto con lectura correcta de informes y recuperación del chat, son flujo básico seguro.
3. Construir entorno reproducible con pacientes sintéticos/BD aislada y proveedor LLM controlado (mocks para pruebas automáticas); probar UI paciente↔clínico + RLS/scoring/persistencia reales. No hacer onboarding o envíos que toquen BD externa sin autorización.
4. Gates automáticos lint/types/unit/build más browser de registro/intake, questionnaire conditional y reload, chat failed/retry, cierre→revisión→nuevo turno y selección de revisión vigente; estados urgentes/fallo visibles en bandeja.
5. Revisión clínica y de consentimiento/borrado/retención/versionado, canal real de urgencias y runbook. Registrar firmas y smoke contra build concreta antes de abrir a usuarios reales.

Aceptación del bloque: paciente sintético adulto completa ciclo, clínico ve y corrige todos los campos relevantes, datos vigentes vuelven al paciente, fallos temporales tienen salida y cada gate queda fechado con evidencia. Un conjunto grande de unit tests no sustituye esta aceptación.
