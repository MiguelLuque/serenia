# 01 — Cuestionarios que necesitamos integrar

Hola Pablo. Vamos a meter en Serenia 5 cuestionarios nuevos (más los 2 que ya tenemos). Para cada uno, lo más útil es que nos mandes **directamente lo que tú usas en consulta**: el cuadernillo del paciente + la hoja de corrección. Así nos aseguramos de usar la versión validada que tú avalas y evitamos que nosotros traduzcamos por libre.

## Lo que ya tenemos integrado (no toques)

- **PHQ-9** (depresión, 9 ítems)
- **GAD-7** (ansiedad, 7 ítems)

Estos ya estaban, no hay que cambiar nada.

## Lo que añadimos en Plan 8

Para cada cuestionario, idealmente nos mandas:

1. **El cuadernillo del paciente** en español — la versión que tú pasas en consulta. PDF, Word, foto del papel, lo que sea.
2. **La hoja de corrección / scoring** — cómo se suman los ítems, en qué puntuaciones cambian las bandas (leve / moderado / severo).
3. **Cualquier nota clínica** que consideres importante (ej. ítems invertidos en STAI, ítems con escala diferente en Hamilton).

### 1. BDI-II — Inventario de Depresión de Beck-II

- 21 ítems, escala 0-3 cada uno.
- Lo dispararemos cuando el PHQ-9 dé moderado o superior, para profundizar.
- Hay varias traducciones validadas al español (Sanz y Vázquez, 2011, es la más usada en España). **Pásanos la que uses tú**.

> 🟡 PARA PABLO: ¿qué traducción del BDI-II usas en consulta? Mándanos el cuadernillo + scoring.

---

### 2. BAI — Inventario de Ansiedad de Beck

- 21 ítems, escala 0-3 cada uno.
- Lo dispararemos cuando el GAD-7 dé moderado o superior.

> 🟡 PARA PABLO: ¿qué traducción del BAI usas? Cuadernillo + scoring.

---

### 3. STAI — State-Trait Anxiety Inventory

- 40 ítems en total: 20 de **estado** (ansiedad ahora mismo) + 20 de **rasgo** (ansiedad como tendencia).
- Tiene **ítems invertidos** (algunos puntúan al revés porque están redactados en positivo). La versión española estándar tiene una lista concreta de cuáles son.
- Lo dispararemos solo si tras BAI hay sospecha de ansiedad rasgo (paciente describe ansiedad crónica >6 meses, no reactiva).

> 🟡 PARA PABLO: ¿qué versión del STAI usas? Cuadernillo + scoring + **lista exacta de los ítems invertidos** (es lo único que no podemos deducir solo del cuadernillo).

---

### 4. C-SSRS — Columbia Suicide Severity Rating Scale (versión screener)

Este sustituye al ASQ que teníamos antes. Es importante.

- Versión screener: 6 ítems Sí/No.
- El screener oficial dice "cualquier Sí = positivo", pero **nosotros queremos más granularidad** para que la app reaccione distinto en cada caso.

Nuestra propuesta de granularidad — **necesitamos que la firmes o la cambies**:

| Banda | Cuándo dispararla | Qué hace la app |
|---|---|---|
| `negative` | Todos los ítems = No | Sigue la sesión con normalidad |
| `low_risk` | Ítems 1 o 2 = Sí (deseo de morir / pensamientos no específicos) | Acknowledge la ideación pasiva, no inyecta protocolo de crisis |
| `moderate_risk` | Ítem 3 = Sí (pensamientos activos sin método ni intención) | Profundiza con el paciente, refuerza red de apoyo |
| `high_risk` | Ítem 4 = Sí (ítem con plan o intención) | Da Línea 024 + marca sesión para revisión clínica el mismo día |
| `acute_risk` | Ítem 5 o 6 = Sí (intención clara o conducta suicida reciente) | Cierre inmediato con copy de seguridad + Línea 024 + alerta urgente al psicólogo |

> 🟡 PARA PABLO:
>
> 1. ¿Te valen estos 5 niveles? ¿Reagruparías alguno? ¿Añadirías otro?
> 2. ¿Qué cuadernillo usas tú? Es importante que la formulación de los ítems en la app sea idéntica a la versión validada — si nos pasas el documento original lo transcribimos textual.
> 3. ¿Hay diferencia clínica entre el screener "lifetime" y el "since last visit"? ¿Cuál usamos en sesión 1 y cuál en sesiones siguientes?

---

### 5. HAM-D — Hamilton Depression Rating Scale (17 ítems, clinician-rated)

Este es distinto: **lo administras tú**, no el paciente. La app tendrá una pantalla en el panel clínico donde tú vayas marcando puntuación por ítem.

- 17 ítems con escalas distintas (algunos 0-2, otros 0-4 — hay que respetar la escala original de cada ítem).
- Cada ítem tiene su descripción de los anclajes (qué significa 0, qué significa 1, qué significa 2…).

> 🟡 PARA PABLO:
>
> 1. ¿Qué versión española de la HAM-D usas? Pásanos cuadernillo + scoring + la **descripción de los anclajes por ítem** (esto es lo más laborioso de transcribir y necesitamos que sea idéntico a tu versión).
> 2. ¿La administras siempre o solo en casos concretos (depresión severa)? Eso nos ayuda a saber dónde poner el botón en la UI.

---

## Resumen de qué nos mandas

```
[ ] BDI-II — cuadernillo + scoring
[ ] BAI — cuadernillo + scoring
[ ] STAI — cuadernillo + scoring + lista de ítems invertidos
[ ] C-SSRS — cuadernillo + decisión sobre los 5 niveles
[ ] HAM-D — cuadernillo + scoring + anclajes por ítem
```

Mándalo por WhatsApp en cualquier formato — fotos del cuadernillo en papel también valen, las leemos.
