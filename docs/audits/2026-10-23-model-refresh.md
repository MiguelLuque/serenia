# Modelos y herramientas: actualización23octubre2026

Fuentes primarias consultadas hoy. Investigación documental, sin llamadas pagadas ni cambio del modelo paciente. Complementa los informes10/12oct y corrige la antigua afirmación de caché gratuita en Decisions.

## Candidatos por tarea

| Uso previsto | Candidato | USD por millón de tokens, entrada/salida | Disposición |
| --- | --- | --- | --- |
| Conversación/informe | GPT6.1Sol | 2/10, Standard/contexto corto | Comparar con el Sonnet actual y Sonnet5.5 en español; herramientas mediante Responses API. |
| Conversación/informe | Sonnet5.5 | 2/10 | Misma tarifa base no implica mismo coste por tarea ni calidad; verificar streaming/herramientas/esquemas antes de promoción. |
| Decisiones auxiliares en sombra | Decisions, GPT6Luna | 0.10/0 | Candidato prioritario provisional; caché facturada y privacidad/configuración por comprobar. |
| Decisiones auxiliares en sombra | Jev1.13 estable | 0.042/0 | Menor tarifa de entrada; validar español/calibración con datos representativos. |

[Sol6.1](https://developers.openai.com/api/docs/models/gpt-6.1-sol) mantiene las tarifas base y distingue Standard, contexto largo, modos rápidos y procesamiento regional. La documentación requiere Responses para herramientas; Chat Completions no admite herramientas para este modelo. El preset Gateway no demuestra por sí solo esa compatibilidad. [Sonnet5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview) conserva2/10 y rechaza temperature/top_p/top_k; la elección forzada de herramienta también requiere revisar su guía. Son gates de migración, no cambios ya aplicados a pacientes.

## Corrección material: caché de Decisions

La [guía actual de Decisions](https://developers.openai.com/api/docs/guides/decisions) cobra caché de lectura/escritura a las tarifas estándar de [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna): lectura0.01USD/M y escritura predeterminada0.125USD/M. Salida gratuita. La tabla anterior12oct que decía caché gratuita queda supersedida. La caché de mayor duración tiene otra tarifa y no está representada por el estimador de una sola tarifa de escritura.

El input total ya incluye lecturas/escrituras cacheadas: se restan del input ordinario antes de valorar cada categoría. Ejemplo estimado:1Minput con200klectura/100kescritura cuesta0.0845USD; con multiplicador de contexto largo y prima regional resulta0.1859USD. No son mediciones de uso. Regiones y retención requieren comprobar elegibilidad/configuración; no se infiere que nuestra cuenta tenga ZDR o acuerdos clínicos habilitados.

La API admite caché implícita sobre input compartido a partir de1.024tokens. Las decisiones y preguntas siguen sin autoridad sobre permisos, edad, puntuaciones, alertas o cierre. La corrección del preset/fecha y sus regresiones se ejecuta como Task10; el auxiliar continúa apagado y desconectado del paciente.

## Jev y criterio de elección

[TypeSafe](https://docs.typesafe.ai/models) lista Jev1.14 desde14oct a0.042USD/M, con jev-preview apuntando a1.14 mientras jev-latest conserva1.13 estable. Mantener un ID explícito evita que una actualización del alias cambie resultados sin evaluación. No se promociona1.14. TypeSafe sigue indicando que inglés es su idioma de mejor rendimiento; esto no mide el español de nuestro caso.

Elegir por coste total de tarea correcta: entrada/salida/razonamiento/caché, intentos fallidos, latencia, abstención y errores críticos. Decisions primero en sombra es una preferencia provisional de integración, no una superioridad clínica demostrada frente a Jev. El benchmark español/gold clínico y la decisión de tratamiento de datos siguen pendientes. Los defaults paciente se conservan.

## Herramientas actuales de Supabase

La nueva [Knowledge Base](https://supabase.com/kb), anunciada23oct en el [changelog](https://supabase.com/changelog), reúne resolución de errores y guías aplicadas. Los [prompts oficiales de observabilidad](https://supabase.com/docs/guides/observability/automate-with-agents) proponen revisiones de salud/seguridad/rendimiento/recursos mediante MCP de sólo lectura, agregación y redacción. Para Serenia se usan primero bajo demanda; no se ha creado ninguna automatización ni activado telemetría/exportación. Las skills oficiales del repositorio mantienen su commit y hashes fijados; se recuperaron y verificaron tras desaparecer los temporales.
