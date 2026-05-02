# 04 — Decisiones clínicas sueltas

Estas son las preguntas que quedaron pendientes en el plan general y que necesitamos cerrar antes de seguir desarrollando. Son cosas que NO encajan en los archivos anteriores pero son importantes.

Responde directamente debajo de cada pregunta. Texto corto está bien.

---

## 1. ¿Qué pasa después de la sesión 8?

El protocolo es cerrado: 8 sesiones. Cuando un paciente llega a la 8 y cierra, ¿qué hace la app?

Opciones que se nos ocurren (no son excluyentes):

- **A — Alta automática**: la app marca al paciente como "alta" y le da las gracias. No hay sesiones nuevas posibles. Si quiere volver, tiene que contactarte fuera de la app.
- **B — Mantenimiento**: el paciente puede seguir abriendo sesiones puntuales pero la IA cambia de modo: ya no sigue el protocolo, hace conversación libre con técnicas TCC/ACT a demanda. Si detecta recaída marcada, te avisa.
- **C — Reinicio si recae**: si tras la sesión 8 el paciente vuelve y la IA detecta empeoramiento, se le ofrece reabrir un nuevo ciclo de 8 sesiones.
- **D — Tu criterio caso a caso**: la app no decide; te muestra la sesión 8 cerrada y tú decides en el panel si das alta, mantenimiento o reinicio.

Hoy hemos dejado la app preparada con un placeholder genérico ("Mantenimiento — si recaída marcada, sugiere alta o nueva intake — el clínico decide").

> 🟡 PARA PABLO: **¿qué prefieres?** ¿Una de las 4? ¿Una mezcla? ¿Algo distinto?

(tu respuesta aquí)

---

## 2. Frecuencia de las 8 sesiones

¿Cada cuánto deberían espaciarse las 8 sesiones del protocolo?

Opciones:

- **Semanal estricta** (8 semanas seguidas).
- **Quincenal**.
- **Flexible**: el paciente abre sesión cuando quiere, sin restricción de fechas.
- **Marcada por ti**: tú dictas cuándo le toca al paciente la siguiente.

> 🟡 PARA PABLO: ¿cuál es el espaciado clínicamente correcto para que el protocolo funcione?

(tu respuesta aquí)

---

## 3. Cuándo el paciente quiere salirse del protocolo

Caso típico: el paciente llega en sesión 3 (pensamientos automáticos) y dice "no quiero hacer registros cognitivos, prefiero hablar de mi infancia". ¿Qué hace Serenia?

Opciones:

- **A — Mantiene el protocolo a rajatabla**: redirige al paciente al foco de la fase, no concede flexibilidad.
- **B — Concede flexibilidad limitada**: explora el tema 5-10 min, después vuelve al foco.
- **C — Adapta al paciente**: si el paciente persiste, abandona el foco y trabaja lo que él propone, anotándotelo en el informe.
- **D — Te pregunta a ti**: marca un `[CONSULTA]` en el informe para que tú decidas si el paciente puede saltarse fase.

> 🟡 PARA PABLO: ¿cuál es la respuesta clínicamente adecuada?

(tu respuesta aquí)

---

## 4. Cómo se refiere Serenia a ti delante del paciente

Hoy estamos poniendo *"el psicólogo que supervisa tu caso"*. Razones:

- Es genérico (si rotas o cambia el psicólogo asignado, no hay que reescribir el prompt).
- Es respetuoso (no informal).

Alternativas posibles:

- **A — "el psicólogo que supervisa tu caso"** (lo que tenemos ahora).
- **B — "tu psicólogo"** (más cercano pero implica que es siempre el mismo).
- **C — "Pablo"** (tu nombre directo) — si todos los pacientes saben quién eres y el producto va a tener un único supervisor.
- **D — "el equipo clínico"** (si pensáis que en el futuro habrá más psicólogos en Serenia).

> 🟡 PARA PABLO: ¿cuál prefieres? Ten en cuenta que esto afecta a cómo el paciente te percibe y a la responsabilidad clínica visible.

(tu respuesta aquí)

---

## 5. Notificaciones a ti cuando hay un `[URGENTE]`

Cuando Serenia detecta un caso urgente (suicidalidad aguda, plan heteroagresivo, autolesión activa), genera el informe y lo marca con `[URGENTE]`. La pregunta es **cómo te avisa**:

Opciones:

- **A — Email inmediato** con resumen + link al informe.
- **B — Push notification** en el navegador (si tienes el panel abierto).
- **C — WhatsApp** (requeriría integración adicional).
- **D — Solo en el panel** — entras al panel y los `[URGENTE]` están arriba del todo destacados.

> 🟡 PARA PABLO: ¿cómo te llega un `[URGENTE]` que pasa a las 23:00 un sábado? Tu respuesta marca el SLA clínico de la app.

(tu respuesta aquí)

---

## 6. Periodicidad de tu revisión esperada

¿En cuánto tiempo revisas tú típicamente un informe de sesión?

- Mismo día.
- 24 horas.
- 48 horas.
- Una vez por semana en bloque.
- Depende — los `[URGENTE]` el mismo día, el resto cuando puedo.

> 🟡 PARA PABLO: tu respuesta determina lo que la IA dice al paciente al final de cada sesión: *"tu psicólogo verá esto en X tiempo"*.

(tu respuesta aquí)

---

## 7. Edad mínima del paciente

Serenia es para adultos. ¿Edad mínima?

- 16 años.
- 18 años (lo más común clínicamente).
- 21 años.

Y como caso especial: ¿qué hacemos si en el onboarding alguien declara <18 años? Bloqueamos signup, derivamos a recursos juveniles, te avisamos para revisar...

> 🟡 PARA PABLO: ¿edad mínima? ¿Cómo gestionamos al paciente que llega siendo menor?

(tu respuesta aquí)

---

## 8. Casos fuera de scope clínico

Hay situaciones donde un terapeuta humano derivaría inmediatamente a especialidad o no aceptaría como paciente. ¿Cuáles te incomodan más para que Serenia los gestione sola?

Lista para considerar:

- [ ] Trastornos psicóticos (esquizofrenia, paranoide, etc.).
- [ ] Trastornos bipolares.
- [ ] Trastornos alimentarios graves.
- [ ] Adicciones activas (alcohol, drogas).
- [ ] Trastornos de personalidad límites.
- [ ] Duelo agudo (<3 meses tras pérdida).
- [ ] Trauma reciente sin estabilización.
- [ ] Pacientes con tratamiento psiquiátrico en curso.
- [ ] Embarazo / postparto.
- [ ] Otros: ___

> 🟡 PARA PABLO: ¿en cuáles de estos Serenia debe **no aceptar como paciente** o **escalarte de inmediato**? Esto nos permite añadir filtros al onboarding o a la primera sesión.

(tu respuesta aquí)

---

## Eso es todo

Cuando tengas todas estas respuestas (a tu ritmo), Miguel las recoge y las integra en el código + en los prompts. A partir de ahí podemos arrancar la integración real de los cuestionarios y empezar a probar el flujo completo con un paciente sintético, antes de abrir a usuarios reales.

Gracias.
