# 03 — Instrucciones del informe clínico (revisión)

Después de cada sesión, Serenia te genera un **informe clínico preliminar** que tú revisas en el panel del clínico. Este documento describe **cómo lo redacta** y qué reglas sigue.

Tu papel: revisar criterios de clasificación (suicidalidad, autolesión, heteroagresión), formato, y coherencia con cómo tú escribes informes en consulta.

---

## Reglas duras que ya están

- **Nunca usa etiquetas DSM-5 / CIE-11**. No dice "trastorno depresivo mayor", "TAG", "TEPT". Describe fenomenológicamente: *"sintomatología consistente con ánimo bajo moderado", "preocupación generalizada sostenida"*.
- **Nunca prescribe tratamiento, medicación ni derivación a especialidad concreta**.
- **Nunca afirma certezas que la sesión no evidencia**. Usa hipótesis: *"los datos sugieren", "parece consistente con", "conviene explorar"*.
- **Nunca introduce técnicas ajenas a TCC/ACT**. Si la transcripción contiene una referencia ajena (paciente menciona psicoanálisis, EMDR, etc.), la describe como "el paciente ha mencionado X" sin endosarla.
- Cita al paciente **textualmente** cuando ayuda.
- Si hay flags de riesgo, los describe en el campo correspondiente y los prioriza en las acciones recomendadas.
- El **resumen para el paciente** es la única parte que él ve. Es cálido, corto, en segunda persona, sin puntuaciones, sin impresión clínica.

> 🟡 PARA PABLO: ¿añadirías más reglas duras? Especialmente cosas que un informe clínico tuyo NUNCA contendría.

---

## Cómo clasifica el riesgo

### Suicidalidad (basado en C-SSRS)

| Nivel | Cuándo | Ejemplo de verbalización |
|---|---|---|
| `none` | El paciente no menciona ideación O la niega y C-SSRS es negativo | (silencio sobre el tema) |
| `passive` | Deseo de no estar / desaparecer / "no despertar" SIN plan, intención ni medios | *"preferiría no haber nacido"*, *"a veces tengo ganas de desaparecer"* |
| `active` | Verbalización **explícita y específica** de querer suicidarse, con o sin plan | *"pienso en suicidarme"*, *"he pensado cómo lo haría"* |
| `acute` | Intención inmediata + plan + medios disponibles, conducta reciente, banda C-SSRS aguda | *"voy a hacerlo esta noche"*, *"tengo las pastillas guardadas"* |

**Reglas anti-sobreclasificación**:

- Si C-SSRS dio negativo o bajo y solo aparecen frases difusas (*"desbordado"*, *"que se acabe esto"*), **NO clasifica como activo ni agudo**.
- "Ganas de desaparecer" sin plan/intención específica de suicidio = pasivo, no activo.
- Si mantiene una clasificación alta, debe incluir **cita textual del paciente** que la sustente.

> 🟡 PARA PABLO: ¿te parecen correctas las 4 categorías y los criterios? ¿Cambiarías la formulación clínica de alguna? ¿Hay casos límite que se nos escapan?

### Autolesión

| Nivel | Cuándo |
|---|---|
| `none` | No se menciona y no hay evidencia indirecta |
| `historic` | Autolesión pasada (>1 mes) sin actos recientes |
| `current` | Actos en el último mes O verbalización clara de planes inminentes |

**Regla crítica**: aplica solo a **daño autoinfligido**. NUNCA usa este campo para:
- Heteroagresión (deseo o plan de dañar a otros) → va en otro campo.
- Ideación suicida → va en suicidalidad.
- Conductas autolesivas indirectas (consumo, alimentación) → no aplica este campo.

> 🟡 PARA PABLO: ¿te parece bien la separación estricta entre autolesión y suicidalidad? Algunos modelos las agrupan.

### Heteroagresión

| Nivel | Cuándo |
|---|---|
| `none` | No hay verbalización de daño a otros |
| `verbal` | Expresiones de rabia o deseo difuso (*"ojalá no estuvieran"*) sin plan ni objetivo identificado |
| `plan` | Verbalización específica de daño a una persona identificable, con o sin medios. **Caso de deber de cuidado clínico** |

> 🟡 PARA PABLO: la categoría `plan` activa una alerta tipo `[URGENTE]` para ti. ¿Te parece correcto el umbral o lo subirías/bajaríamos?

### Consumo de sustancias agudo

| Nivel | Cuándo |
|---|---|
| `null` | No es relevante en esta sesión |
| `none` | No hay evidencia de consumo problemático |
| `suspected` | Indicios indirectos sin confirmación |
| `confirmed` | El paciente confirma consumo activo problemático en el momento |

> 🟡 PARA PABLO: ¿añadirías más granularidad o lo dejamos así? ¿Tipo de sustancia importa o no para nuestro caso?

---

## Bandas de cuestionarios

La banda viene calculada automáticamente. La IA no la decide, pero respeta su semántica al redactar:

- **PHQ-9**: ninguno (0-4), leve (5-9), moderado (10-14), moderadamente severo (15-19), severo (20-27). Flag de riesgo si ítem 9 ≥1.
- **GAD-7**: ninguno (0-4), leve (5-9), moderado (10-14), severo (15-21).
- **BDI-II**: mínimo (0-13), leve (14-19), moderado (20-28), severo (29-63). Flag de suicidalidad si ítem 9 ≥1.
- **BAI**: mínimo (0-7), leve (8-15), moderado (16-25), severo (26-63).
- **STAI**: subscores de estado y rasgo por separado. Banda alta si ≥45 en cualquier subscore.
- **C-SSRS**: negative / low_risk / moderate_risk / high_risk / acute_risk.
- **HAM-D**: normal (0-7), leve (8-13), moderado (14-18), severo (19-22), muy severo (≥23).

> 🟡 PARA PABLO: estos rangos son los estándar de la literatura, pero confírmalos según las traducciones que tú uses. Si en el documento del cuestionario que nos pases (archivo 01) los rangos son distintos, ahí los ajustamos.

---

## Cómo usa los ítems individuales del cuestionario

Cuando recibe ítems desglosados (no solo la puntuación total), los **prioriza sobre su interpretación textual de la transcripción**. La pregunta directa al paciente, respondida por él, es evidencia más fuerte que cualquier inferencia de frases difusas.

Ejemplos:

- C-SSRS ítems 5-6 = `No` y la transcripción contiene *"ganas de desaparecer"* → clasifica suicidalidad como pasiva, no activa.
- PHQ-9 ítem 9 = `0` → autolesión = `none`, salvo verbalización citable contraria.
- BDI-II ítem 9 (suicidio) ≥1 sin C-SSRS administrado → deja suicidalidad como pasiva y añade nota para que tú consideres administrar C-SSRS en próxima sesión.

> 🟡 PARA PABLO: ¿estás de acuerdo con la regla "respuesta directa al ítem prevalece sobre lectura textual"? Es la regla que evita el bug "la IA infla la severidad por una palabra que entendió mal".

---

## Fase del protocolo en el informe

El informe incluye **en qué fase estaba la sesión** (1-8) y **cómo de bien la cubrió**:

| Estado | Cuándo |
|---|---|
| `on_track` | Trabajó el foco esperado, aplicó al menos una técnica de la fase, dejó tarea coherente |
| `partial` | Trabajó parte del foco pero algo quedó fuera (no hubo técnica concreta, tarea ambigua) |
| `off_track` | No cubrió la fase. Razones típicas: crisis aguda que suspendió la fase (legítimo), paciente desregulado, IA improvisó |

Si la fase fue suspendida por crisis, es `off_track` y se acompaña de `[URGENTE]` en las acciones recomendadas.

> 🟡 PARA PABLO: ¿añadirías más estados? ¿"Sesión en transición a fase siguiente" cuando el paciente avanza más rápido del esperado, por ejemplo?

---

## Técnicas aplicadas

El informe lista las técnicas TCC/ACT que la IA **realmente aplicó** (no las que mencionó). Vocabulario controlado:

**TCC**: análisis funcional, mapa pensamiento-emoción-conducta, registro 3 columnas, registro cognitivo, reestructuración cognitiva, activación conductual, monitorización actividad-ánimo, jerarquía de actividades, exposición graduada, conducta opuesta, retirada de conductas seguridad, posponer preocupación, autoinstrucciones compasivas, resolución de problemas, prevención de recaída, psicoeducación.

**ACT**: dolor vs lucha, defusión cognitiva, metáfora del jardín, metáfora de las olas, metáfora del autobús, enraizamiento, desengancharse, clarificación de valores, valor vs objetivo, mindfulness breve, aceptación, dejar estar.

**Somáticas**: respiración cuadrática, relajación muscular progresiva, escaneo corporal.

> 🟡 PARA PABLO: ¿añadirías más técnicas a la lista? ¿Quitarías alguna que no usas en consulta? Esta lista determina lo que la IA va a etiquetar como "técnica aplicada", así que cuanto más alineada con tu vocabulario clínico, mejor.

---

## Resumen para el paciente (lo único que ve él)

Es lo único de todo el informe que llega al paciente entre sesiones. 2-3 frases en segunda persona.

**Prohibido**:
- Abrir con *"Es totalmente válido…"* o *"Tiene sentido que sientas X"* — ambas son fórmulas IA típicas.
- *"Queremos felicitarte por…"*, *"Sigue así"*.
- Tono parental (*"estoy orgullosa de ti"*).
- Infantilizar (*"muy bien por compartir esto"*).
- Cifras (puntuaciones, frecuencias, porcentajes).
- Etiquetas DSM/CIE.
- Promesas (*"vas a estar mejor"*).
- Referencias a tareas (*"recuerda hacer X"*).
- Mencionar la fase del protocolo (*"vas por la sesión 4 de 8"*).

**Sí**:
- Validar el esfuerzo de venir, sin minimizar lo que cuenta.
- Reconocer el momento sin endulzarlo.
- Cerrar con apertura: *"Tu psicólogo verá esto"* o *"Cuando vuelvas seguimos"*.
- Usar el nombre informal del paciente solo si está claramente establecido.

> 🟡 PARA PABLO: este es otro bloque clave para revisar. ¿Cambiarías algo de los prohibidos? ¿Qué otras frases típicas IA habría que prohibir? ¿Algún sustituto que tú dirías mejor?

---

## Acciones recomendadas para el clínico (qué te marca)

Cada acción que Serenia te recomienda al final del informe lleva un prefijo de prioridad:

- `[URGENTE]` — derivación inmediata, riesgo agudo, deber de cuidado. Requiere atención clínica antes de la próxima cita.
- `[CONSULTA]` — caso atípico, dudas clínicas, propuesta de cambio de enfoque, sugerencia de administrar Hamilton, fase off_track por razón no aguda.
- `[SEGUIMIENTO]` — acciones normales para próxima sesión.

> 🟡 PARA PABLO: ¿te valen los 3 niveles? ¿Necesitarías un cuarto (tipo `[URGENTE-INMEDIATO]` para casos donde es esta misma noche)?

---

## Lo que ves en pantalla cuando llega un informe

(Esto es para que tengas en mente lo que recibes.)

Cada informe que Serenia genera incluye:

1. **Motivo principal de consulta** — cita textual del paciente.
2. **Síntomas presentes** — lista de lo trabajado.
3. **Estado de ánimo y afecto** — descripción fenomenológica.
4. **Patrones cognitivos** — distorsiones, esquemas, etc.
5. **Evaluación de riesgo** — los 4 enums (suicidalidad, autolesión, heteroagresión, consumo) + notas.
6. **Cuestionarios** — los que se aplicaron en la sesión, con score y banda.
7. **Fase del protocolo** y **cómo se cubrió**.
8. **Técnicas aplicadas**.
9. **Áreas para explorar en próxima sesión** — sugerencias.
10. **Impresión preliminar** — sin etiqueta DSM.
11. **Acciones recomendadas para ti** — con prioridad.
12. **Resumen para el paciente** — lo único que él ve.
13. **Tareas propuestas** — alineadas con la fase.
14. **Notas para el supervisor** — observaciones que no encajan en otros campos (opcional).

Tú puedes:
- **Aprobarlo** tal cual.
- **Editarlo** y aprobar tu versión.
- **Rechazarlo** con un motivo (la IA aprende del rechazo y regenera).

> 🟡 PARA PABLO: ¿hay algún campo que falte? ¿Algún campo que sobre? ¿La estructura del informe (orden de los apartados) la cambiarías?

---

## Otras decisiones

> 🟡 PARA PABLO:
>
> 1. **¿Cuánto tiempo tienes para revisar cada informe?** Si normalmente reviewas 5 min por informe, lo diseñamos para que sea escaneable. Si tienes más tiempo, podemos darte más detalle.
>
> 2. **¿Quieres recibir alerta por email/notificación cuando llega un `[URGENTE]`?** ¿O prefieres revisar todo desde el panel sin alertas?
>
> 3. **Periodicidad de revisión esperada**: ¿revisas informes el mismo día, en 24 horas, en 48? Esto afecta a cómo Serenia comunica al paciente cuándo verá su psicólogo el informe.
