# Serenia: versión para que Pablo pruebe evaluación y conversación

25 de octubre de 2026. Variante `0.1.0-pilot`. Preparada para casos ficticios supervisados; pendiente de valoración de Pablo. Esta entrega trabaja el método y la experiencia de conversación.

Actualización en rama26octubre: variante `0.2.0-pilot`, con [síntesis científica](../../research/2026-10-26-psychological-assessment-evidence.md) y [ocho episodios adicionales](evidencia-casos-2026-10-26.md) de evaluación contextual. Se corrigen procedencia de saltos en el informe y reutilización de informes rechazados. La validación clínica sigue pendiente. El despliegue `a852e9c` conserva0.1 hasta publicar expresamente esta actualización; las pruebas de código no son conversaciones ejecutadas con el proveedor.

## Qué hemos recuperado de tus notas

Los cuatro originales están en `docs/handoff/respuesta de pablo/*.md.txt`. Se comprobó que las copias `_utf8/` son textualmente equivalentes, normalizando sólo codificación/BOM/saltos. Son respuestas intercaladas en nuestras plantillas: no atribuimos a Pablo todo el documento ni una aprobación de este ensamblaje nuevo.

| Criterio histórico identificado | Fuente de respuesta | Cómo se recoge en esta versión |
| --- | --- | --- |
| Asistente virtual, prácticas según información y ejemplos adaptados al caso; evitar validar continuamente lo mismo | [02](</Users/miguelluque/git/serenia/docs/handoff/respuesta de pablo/_utf8/02-session-therapist-revision.md:21>) | Preguntas con propósito, comprensión provisional y práctica individualizada |
| Trabajar agencia | [02](</Users/miguelluque/git/serenia/docs/handoff/respuesta de pablo/_utf8/02-session-therapist-revision.md:41>) | Elegir objetivo, corregir interpretaciones, aceptar/aplazar prácticas |
| Psicoeducación breve; abordar problemas espontáneos antes de retomar objetivos | [02](</Users/miguelluque/git/serenia/docs/handoff/respuesta de pablo/_utf8/02-session-therapist-revision.md:75>) | Atención al problema relevante de hoy, sin que el contador imponga el ejercicio |
| Conformidad al mapa TCC/ACT de ocho fases | [02](</Users/miguelluque/git/serenia/docs/handoff/respuesta de pablo/_utf8/02-session-therapist-revision.md:95>) | Se conserva el mapa; cerrar una sesión no se presenta como completar su trabajo clínico |
| No encadenar alternativas y permitir aplazamiento hasta estar preparado | [02](</Users/miguelluque/git/serenia/docs/handoff/respuesta de pablo/_utf8/02-session-therapist-revision.md:154>) | Reconocer rechazo y cambiar de marco sin insistencia disfrazada |
| Anunciar cuestionario y esperar respuesta | [02](</Users/miguelluque/git/serenia/docs/handoff/respuesta de pablo/_utf8/02-session-therapist-revision.md:161>) | Invitación y aceptación en turnos distintos; preguntar qué mide no es aceptar |
| Semanal y retomar lo pendiente después de una ausencia | [04](</Users/miguelluque/git/serenia/docs/handoff/respuesta de pablo/_utf8/04-decisiones-pendientes.md:42>) | No confundir semanas, cierres y progreso; sin inventar agenda automática |

Las notas también piden orientación diagnóstica sólo para el clínico. Ese apartado nuevo no se activa aquí: primero queremos juzgar suficiencia, evidencia e incertidumbre. MINI sólo aparecía como posibilidad; HAM-D se descartó. No añadimos instrumentos. STAI sigue fuera del registro activo.

## Método y contraste

El recorrido propuesto es **objetivo → contexto/funcionamiento → hipótesis funcional corregible → instrumento útil y aceptado → devolución → práctica o siguiente paso acordado**. No hay que preguntar todos los apartados en cada sesión ni convertirlo en un interrogatorio. TCC y ACT se usan según problema, objetivo y disposición, sin dar por supuesto que toda retirada es evitación ni toda preocupación es distorsión.

El marco tiene apoyo a nivel de familias de intervención: [OMS/mhGAP 2023, ansiedad](https://www.who.int/teams/mental-health-and-substance-use/treatment-care/mental-health-gap-action-programme/evidence-centre/anxiety/brief-structured-psychological-interventions) recomienda intervenciones breves estructuradas basadas en TCC; [OMS/mhGAP 2023, depresión](https://www.who.int/teams/mental-health-and-substance-use/treatment-care/mental-health-gap-action-programme/evidence-centre/depression/brief-structured-psychological-treatment) incluye varias intervenciones estructuradas, entre ellas TCC, activación y tercera ola. Eso no demuestra eficacia de este chatbot o de su combinación concreta. [NICE NG222](https://www.nice.org.uk/guidance/ng222/chapter/Recommendations) apoya evaluación contextual, ajuste a necesidades/preferencias y supervisión; usamos esos principios como contraste, no certificación de Serenia. Fuentes consultadas el 25-10-2026.

## Diferencias que queremos que Pablo valore

1. La pertinencia y el acuerdo prevalecen sobre aplicar una técnica obligatoriamente en cada sesión. Puede quedar trabajo pendiente; no se interpreta rechazo de una técnica como estar fuera de competencias.
2. La hipótesis se comprueba y se corrige antes de intervenir sobre ella. El informe debe dejar curso, impacto, contexto, recursos e información ausente recuperables en sus campos existentes.
3. Las ocho fases orientan, pero no acreditan progreso por contador. No hay nueva decisión clínica automática de alta/reinicio.
4. La propuesta de secundarios tras un primario moderado se somete además a propósito e información adicional útil. No se presenta la segunda escala como confirmación diagnóstica.
5. En la variante, una coincidencia léxica ordinaria llega con historial y estado al modelo; puede reconocer una aclaración y seguir el tema. Interrupción urgente del servidor, expiración y fallo con señal conservan respuesta fija. No hay un nuevo clasificador ni una regla «negación = seguro».

Estas prioridades son propuestas explícitas de la versión, no nuevas decisiones atribuidas a Pablo. Hay tensiones en las notas históricas —técnica obligatoria y aplazamiento; redirección y problema espontáneo— que esta prueba permite resolver con ejemplos.

## Arrancar y comparar

Desde `/Users/miguelluque/git/serenia`, con las dependencias instaladas y la configuración local de Supabase/proveedor que ya usa el proyecto:

```sh
rtk npm run dev:clinical
```

Abre [Serenia local](http://127.0.0.1:3217). El comando activa el piloto y continuidad, escucha sólo en loopback y utiliza el modelo configurado; no añade ni cambia credenciales. Para conversar realmente necesita acceso válido al proveedor. Las respuestas reales consumen su cuota habitual; la verificación técnica de esta entrega no demuestra calidad del modelo. Si hay error de acceso al proveedor, registrarlo como problema de configuración, no como fallo clínico del método.

Usar cuentas y relatos de prueba, sin datos de pacientes. Si falta una cuenta de prueba, crearla con el flujo normal y verificar el acceso clínico habitual antes de ensayar revisión de informes; este paquete no crea ni promueve cuentas automáticamente. El paciente sólo ve lo que su rol permite. El panel clínico requiere el rol y asignación existentes.

Para comparar, parar el proceso con Ctrl+C y arrancar la referencia sin flag piloto:

```sh
rtk proxy env FEATURE_CLINICAL_CONVERSATION_PILOT=off FEATURE_CROSS_SESSION_CONTEXT=on NEXT_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 npm run dev -- --hostname 127.0.0.1 --port 3217
```

Usar el mismo caso, mismo modelo y una sesión nueva. No comparar variantes cambiando simultáneamente modelo o historia. Esperar a que se genere el informe antes de parar/cambiar modo; los trabajos usan la configuración del proceso que los ejecuta. El piloto no es una opción del navegador.

Actualización para publicación26octubre: puede habilitarse en Vercel sólo para UUID de cuentas de prueba expresamente incluidas en una lista del servidor. Sin lista válida no se activa en producción; los demás usuarios conservan la referencia. El [procedimiento de revisión alojada](/Users/miguelluque/git/serenia/docs/operations/pablo-hosted-review.md) recoge identidad, destino y límites. La URL y el acceso se comunican tras comprobar el despliegue; la dirección local anterior sólo funciona en el equipo de desarrollo.

## Prueba propuesta, 30–45 minutos

1. Elegir primero E01, E04, E06 y E08 en [casos](casos.md). Preparar su contexto ficticio y seguir las ramas sin intentar ayudar al asistente a acertar.
2. Guardar la conversación completa y el informe resultante, con versión/commit, modelo y modo usados. Si no se cumple una precondición, marcar «no ejecutado».
3. Completar la [hoja de revisión](revision.md) citando turnos. Distinguir comprensión, decisión clínica, redacción y operación del sistema.
4. Revisar después continuidad y resultados con E07/E09/E11 y cierre con E10. No es necesario recorrer los once casos para dar feedback útil; no se contarán como pasados los que no se ejecuten.

## Límites visibles de esta ronda

- **Persistencia de señales:** las coincidencias textuales todavía crean `suicidal_ideation/high/open` por el contrato SQL anterior. El informe las identifica como observaciones automáticas; no son ideación confirmada. Este piloto mejora cómo se contextualizan en conversación, pero esa semántica persistida exige una revisión separada antes de pacientes reales.
- **Incertidumbre del esquema:** algunos enums de riesgo carecen de «no evaluado». La variante debe explicitarlo en notas; `none` no demuestra que se exploró ni certifica ausencia. Pablo debe valorar si esa representación sirve y qué contrato reemplazaría el legado.
- **Cuestionario pendiente:** no existe tool de cancelación/aplazamiento persistido; la IA no debe fingir que canceló una tarjeta. Su rechazo debe respetarse en conversación, y el límite de otra propuesta se explica sólo si afecta al avance.
- **Cierre:** sigue el gate SQL conservador. Si una aceptación larga no pasa, debe pedir una confirmación clara sin fingir cierre ni repetir despedidas.
- **Seguimiento humano:** no se han añadido WhatsApp/email ni cobertura/SLA. Las notas discrepan sobre 48/72 horas; esta versión no promete plazo, contacto ni alerta externa realizados.
- **Fases:** el contador de la BD sigue existiendo; se evita presentarlo como trabajo clínico completado. Persistir qué fase se trabajó y criterios de cambio requiere otra decisión de contrato.

Conservar estos límites en la valoración: no se consideran resueltos por cambiar un prompt. El objetivo es una prueba profesional del comportamiento con casos ficticios, no uso autónomo con pacientes.

Material técnico: [diseño](/Users/miguelluque/git/serenia/docs/superpowers/specs/2026-10-25-pablo-conversation-pilot-design.md), [plan](/Users/miguelluque/git/serenia/docs/superpowers/plans/2026-10-25-pablo-conversation-pilot.md), [auditoría base](/Users/miguelluque/git/serenia/docs/audits/2026-10-25-clinical-conversation-review.md). Resultado de verificación de esta versión: [aceptación](/Users/miguelluque/git/serenia/docs/audits/2026-10-25-pablo-pilot-acceptance.md).
