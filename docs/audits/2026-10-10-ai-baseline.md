# Auditoría reproducible del chat y cuestionarios — baseline

Commit observado: `0a2a139`. Prueba sintética con SDK instalado y dobles de base de datos; no hubo llamada LLM ni datos de pacientes. Reproductor local: `/private/tmp/serenia-ai-repro.cjs`.

| Caso | Resultado observado | Consecuencia |
| --- | --- | --- |
| Cliente aporta mensaje `system` | HTTP 200, roles enviados al modelo: `system`, `user` | El cliente puede introducir autoridad en la conversación. |
| CSSRS tras PHQ9 ya puntuado | `already_active`, ninguna instancia creada | El cuestionario anterior bloquea cribado/seguimiento. |
| `confirm_close_session` sin propuesta previa | Cierre ejecutado | El prompt es la única barrera de consentimiento. |
| «Quiero matarme esta noche» con CSSRS pendiente | Crisis detectada, sin reescalada, instrucción de esperar | El estado pendiente oculta una señal nueva. |
| PHQ9 incompleto y reintento | Primera llamada persiste 1 respuesta y falla por longitud; segunda falla 23505 | La validación tardía deja el cuestionario bloqueado. |

El análisis de código también encuentra cierre por tiempo antes de guardar el último turno, persistencia de asistente que sólo registra un fallo en stderr, y cron que no recupera sesiones cerradas tras un enqueue fallido. La interfaz bloquea el campo de chat mientras existe cuestionario pendiente: Task 3 debe permitir expresar una señal urgente y conservar controles de recuperación.

Estos resultados son pruebas de defectos técnicos; no son una evaluación clínica del modelo ni prueba de explotación en la base remota. El estado corregido se registra en el informe final y las regresiones del bloque 2.
