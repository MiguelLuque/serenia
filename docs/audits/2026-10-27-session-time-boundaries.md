# Límite temporal y cierre de sesión — 27 octubre 2026

Rama: `codex/session-time-boundaries`. Base `ebe41d1`; mantiene el incremento anterior de feedback de herramientas. Fuente corregida `c18d4ea` (tras revisión de `65f6cd7`). Aceptación local completa: siete gates PASS sobre ese commit limpio. Sin publicación ni migración.

## Comportamiento

- Máximo60min; inactividad30min. Son límites operativos actuales, no una duración clínicamente validada.
- El agente recibe tiempo restante del servidor en cada generación. En los últimos10min se orienta a avisar con calma, recoger lo importante y acordar un siguiente paso breve, sin insistir en confirmar ni abrir exploraciones largas. La instrucción no acredita que un modelo concreto siempre la siga.
- El backend comprueba el plazo antes de generar, antes de continuar tras herramientas y al guardar. Una respuesta admitida a tiempo puede terminar dentro del timeout45s; si cruza el límite se conserva con aviso final y cierre en la misma transacción existente. No se inicia otra generación después del límite.
- El contador usa una muestra del servidor y tiempo transcurrido monotónico. Es orientativo e incluye latencia de la muestra; al volver a la pestaña consulta el estado guardado. El temporizador de recuperación de turnos usa esa misma referencia, incluso si el navegador tiene una hora de desfase. «Tiempo agotado» y «sesión terminada» son estados distintos.
- Si vence sin turno en curso, hay acción explícita para confirmar el cierre. Si falla, no se muestra éxito. Una respuesta en curso observada impide cerrar desde esa acción; no se añade un lock entre dispositivos a esa lectura.
- Una recarga no cierra antes de recuperar el turno. Si se pierde la respuesta HTTP después de guardar el cierre, la consulta de estado recupera también la respuesta final visible. El mismo ID puede reintentarse/reproducirse tras el plazo; no duplica mensajes.
- El borrador permanece en memoria de la pestaña, incluso cuando llega el cierre confirmado. Se muestra como texto no enviado para copiarlo; salir o recargar puede perderlo. No se escribe automáticamente en almacenamiento persistente.
- La entrada ordinaria nueva comprueba inactividad antes de admitir texto. Una señal de seguridad nueva mantiene prioridad de registro y recursos. Los recursos también se conservan cuando una respuesta contextual termina tras el límite.
- Cierre/outbox existentes siguen atómicos e idempotentes. Encolado no equivale a informe generado; sesiones demasiado cortas pueden no producirlo. Cron diario del plan actual no garantiza cerrar exactamente al minuto30 o60.

## Revisión con Pablo

Usar exclusivamente escenarios ficticios y las cuentas piloto; no introducir datos de pacientes. No es necesario esperar60min para las regresiones automatizadas: se simulan relojes en tests locales sin acortar el límite publicado.

1. Sesión normal: explicar un problema cotidiano, cambiar de tema y pedir terminar. Comprobar que la propuesta conversacional no se confunde con cierre guardado y que el cierre explícito conserva el texto pendiente.
2. Últimos10min de una sesión real prolongada: valorar si el aviso es natural, no repetitivo y deja espacio para una síntesis y siguiente paso. Registrar si propone nuevos cuestionarios o abre temas imposibles de cerrar a tiempo.
3. Última respuesta: enviar justo antes del límite y escribir otro borrador mientras llega. Debe verse la respuesta final, después el cierre y el borrador etiquetado como no enviado. No debe redirigir automáticamente si existe borrador.
4. Recuperación: desconectar antes de recibir respuesta y volver a comprobar/reintentar el mismo turno, también tras vencer. No deben duplicarse texto ni herramientas.
5. Pestaña suspendida/reloj cambiado: volver a la sesión y comprobar el estado guardado. El servidor decide el plazo y el cierre; el contador no debe afirmar un cierre pendiente.
6. Seguridad ficticia: comprobar acceso a los recursos existentes y conservación de borrador; una señal nueva admitida tiene prioridad antes del cierre temporal. Revisar pertinencia de la respuesta y cualquier falso positivo por separado.
7. Inactividad: retomar tras30min sin actividad guardada. La entrada ordinaria debe informar del cierre sin guardar el borrador como si se hubiese enviado. No prometer un cron puntual.

Anotar frase, momento aproximado, estado mostrado, resultado esperado/observado y si se conservó el borrador. Las pruebas sintéticas verifican mecanismos; la naturalidad y adecuación clínica necesitan revisión de Pablo y evaluación del proveedor/modelo real.

## Revisión independiente y regresiones

Revisor independiente `/root/session_deadline_review`, modelo `gpt-6-astra`, rango `ebe41d1..65f6cd7`. Tres hallazgos P2, ninguno crítico ni menor pendiente:

- Recuperar respuesta final de sesión cerrada tras perder HTTP, conservando borrador.
- Comprobar vencimiento también al responder con fallback de seguridad por fallo de contexto/modelo.
- Calcular espera de recuperación con reloj servidor/monotónico, sin depender de Date.now local.

Los cuatro casos de revisión fallaron antes del fix y pasaron después: RED `.cache/pablo-pilot/logs/20261027-202958-y8asqqeo.log` (tres) y `20261027-203047-rzmiq01r.log` (reloj); GREEN grupo112/112 `.cache/pablo-pilot/logs/20261027-203210-81hmkuv_.log`. Se corrigió además una prueba antigua de frontera1ms que usaba dos lecturas distintas del reloj; ahora fija el mismo instante, sin cambiar el límite de producto.

Decisión de alcance: conservar las garantías actuales del cierre manual entre dispositivos. La acción explícita comprueba el turno observado, pero otro dispositivo puede iniciar uno tras esa lectura y el cierre manual puede interrumpirlo. La BD conserva fencing y cierre/outbox atómicos; esta entrega no crea un nuevo bloqueo distribuido ni declara resuelto ese caso.

## Aceptación local

Fuente construida: `c18d4ea9a348db21cfd8b091b363d5cf55597574`. Node `v24.14.1`; lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`. El commit posterior de este recibo y checklist sólo añade documentación; no cambia el código aceptado.

Comando: `rtk npm run verify`. Exit0, siete controles PASS:

| Gate | Resultado |
| --- | --- |
| test | 927/927, 77 archivos |
| lint | PASS, cero warnings |
| typecheck | PASS |
| workflow:wire | PASS |
| db:test | PASS |
| audit:dependencies | PASS |
| build:isolated | PASS, snapshot HEAD limpio, exit0 |

Evidencia completa privada: `.cache/pablo-pilot/logs/20261027-203243-6_6am48m.log`. Resultados y logs separados: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-I475F4`. Metadata, build y resultado: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-AyIEuM`.

La primera ejecución se conserva como fallo: seis gates pasaron, pero build rechazó cambios tracked que añadí mientras corría (`20261027-202706-4ycg0okh.log`); no se contabiliza como build aceptado. Se repitió tras el commit limpio de correcciones.

Las regresiones usan relojes/BD/proveedor sintéticos y el SDK instalado real. `db:test` y build no acreditan Auth/JWT/PostgREST hospedados ni ejecución Workflow tras reinicio. No se aplicaron migraciones ni se usaron pacientes/modelos externos. No se publicaron estos cambios; el aviso conversacional y su adecuación deben revisarse con Pablo en el modelo real antes de dar esa validación por realizada.

Para repetir los casos específicos: `rtk npm test -- tests/chat/session-time.test.ts tests/chat/session-close-action.test.ts tests/chat/session-page-time.test.ts tests/chat/time-close-view.test.tsx tests/chat/recovery-view.test.tsx tests/chat/tool-feedback.test.ts tests/chat/safety-flow.test.ts tests/sessions/service.test.ts`.
