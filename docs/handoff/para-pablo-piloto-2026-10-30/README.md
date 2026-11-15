# Entrega enviada a Pablo: piloto de evaluación0.2

30-10-2026. El usuario confirmó el destinatario y autorizó enviar acceso e instrucciones. Correo enviado a **preguera@us.es** desde la cuenta de Miguel, asunto **«Serenia: acceso y guía para validar evaluación y conversación (piloto 0.2)»**. Gmail confirmó SENT y se volvió a leer el mensaje para comprobar destinatario y ambos adjuntos. ID de mensaje `1a18d63994488bf5`; no equivale a confirmación de recepción o lectura por Pablo.

## Versión disponible

- Acceso público: https://serenia-app.vercel.app/login.
- Fast-forward de `main`: `a852e9c` → **`11ec2c2a8e58312318dd300eb6b71c5b7377ee8d`**, sin force-push. Conserva los incrementos revisados de evaluación0.2, feedback de herramientas y límites temporales.
- Vercel: `dpl_9KZmpKhZ3sXzZj25KTz1qaXrANh5`, proyecto `serenia`, production, READY; alias público vinculado al SHA exacto. Build52,8s según timestamps de Vercel.
- Modelo configurado y verificado en producción: **OpenAI `gpt-5.4-mini`** para conversación, tareas rápidas e informes mediante AI Gateway. No se cambió el modelo.
- Piloto on y continuidad on; la lista del piloto coincide exactamente con el único Auth UUID ficticio autorizado. No se ampliaron roles ni lista de revisión.
- El perfil progresivo nuevo permanece en `codex/progressive-patient-profile`, **no publicado**: su revisión final conserva un P2 sobre acceso a citas anteriores a100 observaciones. No se incluyeron sus migraciones ni se modificó Supabase hospedado en esta entrega.

## Acceso y material entregado

Se reutiliza la cuenta ficticia de paciente creada el26octubre. La contraseña se conserva exclusivamente en el manifiesto privado y en el correo autorizado; nunca en Git ni en este documento. El identificador `example.test` no es un buzón y no requiere que Pablo se registre otra vez.

Login real de esa cuenta verificado contra GoTrue, rol paciente comprobado leyendo sólo su perfil propio y acceso autenticado al onboarding200. El endpoint `/app` redirigió307 a `/onboarding`, como corresponde a la cuenta aún sin completar. Se cerró sólo la sesión de verificación. No se completó onboarding ni se aceptaron consentimientos por Pablo; no se enviaron turnos ni se llamaron modelos.

Adjuntos enviados:

1. [Guía PDF de cuatro páginas](../../../output/pdf/Serenia-guia-validacion-Pablo-2026-10-30.pdf): URL, versión/modelo, preparación, seis grupos de casos, rúbrica, límites y decisiones clínicas. Renderizadas e inspeccionadas visualmente las cuatro páginas.
2. [Hoja de revisión en texto](hoja-revision.txt): editable y utilizable respondiendo directamente al correo.

El paquete es autocontenido: Pablo no necesita instalación, repositorio, comandos ni enlaces a archivos del equipo de desarrollo. La cuenta sigue siendo paciente; revisión de informes y pruebas con precondiciones clínicas se coordinan aparte y se marcan NE si no son accesibles. No se promueve la cuenta a clínico.

## Orden y propósito de la prueba

Primera pasada orientativa30-45min, sin obligación de cubrir todos los casos: comprensión y corrección de interpretación; rechazo de una técnica; propósito/permiso/aplazamiento de cuestionario; cierre natural. Después, si procede, escala realmente completada, discordancia con el relato y continuidad. Pruebas temporales opcionales, sin exigir esperar60min.

Seguridad contextual al final: sujeto/tiempo/sentido, expresión cotidiana o tercero histórico frente a preocupación actual ficticia. La cuenta conserva historia entre sesiones y algunas señales automáticas heredadas pueden persistir; usar personaje coherente y registrar posible arrastre, sin presentar episodios como independientes.

Por observación se solicita caso, turno/frase exacta, observado, esperado y motivo, gravedad, tipo de problema y decisión aceptar/modificar/rechazar/falta evidencia. Los fallos críticos se revisan individualmente, sin compensarlos con promedios.

Decisiones solicitadas a Pablo: información mínima para formular, datos pendientes, aplazamiento de técnicas, utilidad de otra escala, evidencia para avanzar/retomar fases, representación de no evaluado, significado/actuación de seguridad y alcance de una futura orientación diagnóstica. No se atribuye aprobación a sus notas históricas.

## Evidencia técnica de publicación

- `npm run verify` sobre el SHA11ec2c2: los siete gates exit0; **927tests/77archivos**. Logs completos privados `.cache/pablo-pilot/logs/20261030-160907-ya6ursnu.log` y `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-9dnjyj/`.
- Build aislado fuente11ec2c2: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-CLGGTF/`, exit0, lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`.
- [GitHub Actions Verify41078475215](https://github.com/MiguelLuque/serenia/actions/runs/41078475215): success, incluidos stack Supabase aislado, migraciones/seed, lint, advisors y paridad de tipos. No sustituye una aceptación completa del runtime hospedado ni cambia su historia.
- Configuración y login30oct: recibos privados en `.cache/release-pablo-20261026/config-20261030.json` y `hosted-auth-smoke-20261030.json`. El conector Vercel respondió403 al listado de variables; la alternativa oficial de CLI, con su sesión vigente y destino exacto, permitió verificar sólo flags/modelos, sin extraer claves de servicios.

Las conversaciones con el proveedor y la valoración de Pablo siguen pendientes. No se afirma eficacia o fiabilidad diagnóstica, cobertura humana, notificaciones externas ni autorización para pacientes. Se comunicaron expresamente los límites de etiquetas automáticas de riesgo, no evaluado, cancelación persistida de cuestionarios, acceso clínico y perfil progresivo ausente. Ningún resultado de Pablo se ha contabilizado todavía.
