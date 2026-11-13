# Serenia: selección de modelos y coste por tarea

Fecha de investigación: **1 de noviembre de 2026**. Fuentes públicas consultadas aproximadamente a las **16:06–16:12 UTC**; documento terminado a las 17:20 UTC. Estado: **propuesta para evaluación**, sin cambio de modelos, configuración, credenciales, presupuestos ni despliegues y sin inferencias de pago.

La hipótesis de ahorro que probaría primero es **Luna para conversación y extracción acotadas + Sol para el borrador de informe**, comparada con Haiku 5.5 para las tareas frecuentes y Sonnet 5.5 para informe/evaluación. Terra es un candidato reciente para conversación que merece comparación, pero cuesta más por token que el actual GPT-5.4 mini. No hay evidencia local de que alguno mejore la conversación en español, la fidelidad del perfil o la utilidad clínica; esas conclusiones requieren evaluación con casos de Serenia y revisión humana.

## Evidencia y alcance

Se descargó mediante un GET público sin credenciales el **catálogo completo de 498 modelos**, no una página parcial ni un listado recordado: [Vercel AI Gateway `/v1/models`](https://ai-gateway.vercel.sh/v1/models). Copia privada e ignorada por Git: `.cache/model-research-20261101/catalog.json`. SHA-256 del archivo: `a0f22c61b24b6c3d7533ff1cfc581abe9ab30cc470edb79cce018f04660f45a8`.

Los IDs, fechas de `released`, precios y etiquetas Gateway de las tablas proceden de esa instantánea. Los precios del JSON son USD/token; aquí se multiplican por 1.000.000. Las páginas oficiales enlazadas se abrieron y leyeron, además de realizar búsquedas. El catálogo público **no demuestra acceso del equipo, crédito disponible, elegibilidad para su capa gratuita, rendimiento ni calidad clínica**. Vercel documenta que la elegibilidad del equipo es una anotación de consulta autenticada; no se hizo esa consulta. [Documentación de descubrimiento](https://vercel.com/docs/ai-gateway/models-and-providers).

El modelo de referencia para el cálculo es `openai/gpt-5.4-mini`; su precio Gateway se volvió a verificar. Root verificó por CLI oficial la configuración no secreta de producción a las17:28UTC: conversational/fast/structured están configurados como openai/gpt-5.4-mini; fast no tiene consumidores en la fuente. Esto acredita configuración, no qué modelo respondió a una petición: no hubo generación nueva en este estudio. El recibo privado production-roles-20261101.json conserva target/equipo/fecha sin claves.

## Precios comparables: Standard, texto, contexto corto

USD por millón de tokens, sin impuestos, herramientas externas, caché escrita, descuentos de cuenta ni recargos regionales. La columna Gateway se refiere al modelo normal, **sin sufijos `-batch` o `-fast`**. La comparación directa usa la tarifa pública del proveedor, no los créditos de una suscripción de chat.

| ID exacto de Gateway | `released` en catálogo, UTC | Gateway entrada / salida / lectura caché | Directo entrada / salida / lectura caché | Condición |
| --- | --- | --- | --- | --- |
| `openai/gpt-5.4-mini` | 2026-03-17 | 0,75 / 4,50 / 0,075 | No revalidado en este estudio | Referencia, no propuesta de novedad |
| `openai/gpt-6-luna` | 2026-09-22 | 0,10 / 0,50 / 0,01 | 0,10 / 0,50 / 0,01 | Hasta 272.000 tokens de entrada |
| `openai/gpt-6.1-terra` | 2026-10-26 | 1,00 / 5,00 / 0,05 | 1,00 / 5,00 / 0,05 | Hasta 272.000 tokens de entrada |
| `openai/gpt-6.1-sol` | 2026-09-29 | 2,00 / 10,00 / 0,10 | 2,00 / 10,00 / 0,10 | Hasta 272.000 tokens de entrada |
| `openai/gpt-6-astra` | 2026-09-04 | 10,00 / 50,00 / 1,00 | 10,00 / 50,00 / 1,00 | Hasta 272.000 tokens de entrada |
| `anthropic/claude-haiku-5.5` | 2026-10-07 | 0,10 / 0,50 / 0,01 | 0,10 / 0,50 / 0,01 | Hasta 100.000 tokens de entrada |
| `anthropic/claude-sonnet-5.5` | 2026-09-28 | 2,00 / 10,00 / 0,10 | 2,00 / 10,00 / 0,10 | Standard |
| `google/gemini-3.5-flash-lite` | 2026-07-21 | 0,30 / 2,50 / 0,03 | 0,30 / 2,50 / 0,03 | Standard; alternativa de control |
| `google/gemini-3.8-flash` | 2026-09-02 | 0,75 / 3,75 / 0,075 | 0,75 / 3,75 / 0,075 | Promoción hasta 2026-12-31 |
| `google/gemini-4-argon` | 2026-10-13 | 2,00 / 10,00 / 0,10 | 2,00 / 10,00 / 0,10 | Introducción hasta 2026-11-30 |

Fuentes directas: OpenAI Docs de [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Astra](https://developers.openai.com/api/docs/models/gpt-6-astra); Anthropic [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview) y [precios](https://platform.claude.com/docs/en/about-claude/pricing); Google [precios de Gemini](https://ai.google.dev/gemini-api/docs/pricing). Igualdad de estas tarifas base no implica igualdad de factura final o de condiciones de tratamiento de datos.

### Ajustes que cambian la comparación

- **OpenAI 6:** las páginas de modelo indican que por encima de 272.000 tokens de entrada se aplican 2× a entrada/caché y 1,5× a salida para toda la petición. Batch/Flex cuestan un 50% menos que Standard; Fast cuesta 2×. Sol también documenta Ultrafast a 6×. No se usan esos precios en los escenarios. Sol/Luna escriben caché a 1,25× la entrada según sus páginas; Terra especifica 30 minutos a 1,25 USD/MTok y 12 horas a 2,50. El JSON Gateway sólo aporta una tarifa base de escritura para estos modelos; no acredita todas las opciones de retención de la API directa. Ver fuentes OpenAI anteriores.
- **Haiku 5.5:** al superar 100.000 tokens de entrada, la tarifa pasa a 0,50 / 2,50 / 0,05. Su escritura cuesta 0,125 para 5 minutos o 0,20 para 1 hora en el tramo corto; en el largo, 0,625 o 1,00. Sonnet escribe a 2,50 o 4,00 respectivamente. Anthropic documenta Batch con un 50% de descuento en entrada/salida; no confundir sus IDs Gateway `-batch` con llamadas interactivas. Ver páginas de modelo anteriores.
- **Google:** Flash 3.8 pasa a 1,50 / 7,50 / 0,15 el 2027-01-01. Argon pasa a 4,00 / 20,00 / 0,20 el 2026-12-01. El catálogo actual refleja los precios promocionales actuales, no garantiza los futuros. Flash 3.8 tiene almacenamiento de caché explícita de 0,50 USD/MTok/h durante la promoción; Argon sólo admite caché implícita. Ver [precios oficiales](https://ai.google.dev/gemini-api/docs/pricing).
- **Región:** el catálogo incluye precios regionales diferentes; por ejemplo, Luna EU 0,11 / 0,55, Haiku EU 0,11 / 0,55, Terra EU 1,10 / 5,50 y Sol/Sonnet/Argon EU 2,20 / 11,00. Debe fijarse la ruta autorizada antes de presupuestar. Una etiqueta de región disponible no acredita la configuración efectiva ni la aceptación del tratamiento de datos clínicos.
- **Razonamiento:** la salida facturable no es sólo el texto visible. OpenAI factura los tokens de razonamiento como salida; `max_output_tokens` abarca razonamiento y salida visible. Google incluye explícitamente thinking en salida. No sumar dos veces razonamiento si `output_tokens` ya lo incluye. Mayor esfuerzo o una segunda pasada pueden eliminar parte del ahorro. [OpenAI: razonamiento](https://developers.openai.com/api/docs/guides/reasoning), [Google: precios](https://ai.google.dev/gemini-api/docs/pricing).
- **Caché:** un prefijo parecido no equivale a un hit. Se deben separar tokens normales, lecturas, escrituras y almacenamiento, con los contadores reales. No presupuestar un descuento del 90–95% sobre toda la petición.

## Shortlist por tarea: hipótesis que hay que contrastar

| Tarea | Primer candidato | Comparador relevante | Motivo y criterio decisivo |
| --- | --- | --- | --- |
| Conversación en español con herramientas de Serenia | `openai/gpt-6-luna` | `anthropic/claude-haiku-5.5`; después `openai/gpt-6.1-terra` | Luna/Haiku comparten tarifa baja. Terra es la novedad más reciente de esta selección, y OpenAI lo presenta para escritura natural. Elegir según empatía, seguimiento contextual, contención, uso correcto de herramientas y latencia medida; la fecha no demuestra esas propiedades. |
| Extracción y correcciones del perfil con fuentes | `openai/gpt-6-luna` | `anthropic/claude-haiku-5.5` | Tarea acotada, JSON, evidencia por campo, negación/corrección y abstención cuando falta información. Haiku está documentado para extracción/clasificación; eso no acredita fidelidad en Serenia. Escalar casos ambiguos a Sol, con coste adicional registrado. |
| Borrador estructurado del informe para revisión humana | `openai/gpt-6.1-sol` | `anthropic/claude-sonnet-5.5` | Más margen de razonamiento para integrar evidencia y contradicciones, con igual tarifa base entre ambos. Comparar calidad clínica revisada, trazabilidad y omisiones. La persona revisora mantiene la decisión; JSON válido no equivale a conclusión clínica válida. |
| Evaluación de apoyo o escalado excepcional | `anthropic/claude-sonnet-5.5` si genera OpenAI; Sol si genera Anthropic | `openai/gpt-6-astra` o `google/gemini-4-argon` sólo en casos seleccionados | Otra familia puede aportar un contraste, pero no garantiza independencia de errores. Astra cuesta 5× Sol por token; Argon comparte ahora tarifa con Sol y sube en diciembre. Ninguno es árbitro clínico ni sustituye revisión humana. |

Fuentes del posicionamiento general: [OpenAI: catálogo](https://developers.openai.com/api/docs/models), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Haiku](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Gemini: modelos](https://ai.google.dev/gemini-api/docs/models). Las asignaciones concretas a Serenia son **inferencias de diseño pendientes de evaluación**, no resultados publicados.

Gemini 3.8 Flash queda como comparador secundario de conversación: es más barato que la referencia sólo en salida, y tiene subida anunciada. Flash-Lite puede entrar si Luna/Haiku no cumplen o no están accesibles; su nombre no lo convierte en la opción más barata. No extendería la matriz inicial a todos los modelos nuevos antes de obtener una comparación útil de estas parejas.

## Compatibilidad: verificación necesaria antes de cambiar IDs

El catálogo marca `tool-use`, `structured-output` y especificaciones AI SDK `v2/v3/v4` para los candidatos de texto. Eso demuestra capacidad anunciada, no que la combinación de versión instalada, opciones y ruta de Serenia funcione.

En la **API directa**, OpenAI exige Responses para herramientas con Sol 6.1 y Terra 6.1. Luna permite herramientas en Chat Completions sólo con esfuerzo `none`; admite razonamiento y herramientas por Responses. Gateway puede traducir su protocolo de entrada al protocolo del proveedor: **no se puede concluir fallo por ver Chat Completions o una versión del SDK**. Antes de adoptar, verificar la ruta real Gateway → proveedor, parámetros transmitidos, tool calls/resultados, streaming y JSON con el esquema exacto. Las restricciones directas son una comprobación pendiente, no un diagnóstico de incompatibilidad. [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

Haiku/Sonnet 5.5 figuran con `temperature: false` en Gateway; Sonnet documenta error 400 si se envían `temperature`, `top_p` o `top_k`. Gemini 3.8 Flash admite `low/medium/high`, y su página indica que `minimal` da error. No reutilizar opciones de razonamiento de una familia por analogía. [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview), [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash).

## Calculadora: escenarios sintéticos, no consumo observado

Unidad: una sesión hipotética. Cadencia elegida **sólo para comparar**:

| Trabajo por sesión | Llamadas | Entrada por llamada | Salida facturable por llamada | Total entrada / salida |
| --- | ---: | ---: | ---: | ---: |
| Conversación | 20 | 8.000 | 600 | 160.000 / 12.000 |
| Extracción de perfil, una cada cinco respuestas | 4 | 6.000 | 1.000 | 24.000 / 4.000 |
| Borrador de informe | 1 | 16.000 | 2.500 | 16.000 / 2.500 |
| Total | 25 | — | — | 200.000 / 18.500 |

**Cadencia actual frente al supuesto:** el código actual extrae por cada mensaje de usuario con memoria activada. Las cuatro extracciones de esta tabla son una cadencia hipotética para comparar tarifas, no una optimización implementada ni aprobada. Manteniendo20extracciones (6.000/1.000 cada una), la misma sesión sintética costaría0,37725USD con todo GPT-5.4mini y0,10100USD con Luna conversación/perfil + Sol informe:73,23%menos por tarifa, sin cambiar la unidad por mensaje. Ninguna cifra es consumo medido.

Los tokens de salida incluyen hipotéticamente todo el razonamiento facturable. No se han medido; si un modelo produce más razonamiento, hay que sustituirlos por su consumo real. Igual número de tokens entre familias permite comparar tarifas, **no** implica igual tokenización del mismo texto en español. Entrada incluye instrucciones, historial, esquema, herramientas y resultados. Sin caché, reintentos, herramientas de búsqueda ni coste de infraestructura:

`coste = Σ llamadas × (entrada × precio_entrada + salida_facturable × precio_salida) / 1.000.000`

| Hipótesis, mismo volumen normalizado | USD/sesión | USD/1.000 sesiones | USD/10.000 sesiones |
| --- | ---: | ---: | ---: |
| Referencia: todo GPT-5.4 mini | 0,23325 | 233,25 | 2.332,50 |
| Todo Luna o todo Haiku 5.5, tramo corto | 0,02925 | 29,25 | 292,50 |
| Todo Terra | 0,29250 | 292,50 | 2.925,00 |
| Todo Sol o Sonnet 5.5 o Argon, tarifa actual | 0,58500 | 585,00 | 5.850,00 |
| Todo Gemini 3.8 Flash, tarifa actual | 0,219375 | 219,375 | 2.193,75 |
| Todo Gemini 3.5 Flash-Lite | 0,10625 | 106,25 | 1.062,50 |
| Todo Astra | 2,92500 | 2.925,00 | 29.250,00 |
| Luna conversación + Luna perfil + Sol informe | **0,08340** | **83,40** | **834,00** |
| Terra conversación + Luna perfil + Sol informe | 0,28140 | 281,40 | 2.814,00 |

La combinación Luna/Luna/Sol reduce un **64,24%** el coste de tokens de este supuesto frente a la referencia; todo Luna reduce un 87,46%, pero no tiene calidad demostrada para informes. La combinación con Terra aumenta un 20,64%: adoptar lo más reciente en cada llamada no asegura ahorro.

Sensibilidades reproducibles:

- Evaluar el 5% de los informes con una llamada Sonnet de 20.000 entrada + 3.000 salida añade `0,05 × (20.000×2 + 3.000×10)/1.000.000 = 0,0035` USD/sesión: 3,50 USD/1.000 sesiones. Es una cadencia propuesta, no un umbral validado.
- Escalar el 10% de las 20 llamadas de conversación de Luna a Terra mediante una **segunda llamada**, con los mismos 8.000/600 tokens, añade 0,022 USD/sesión; la primera llamada sigue facturada. La combinación eficiente pasa a 105,40 USD/1.000 sesiones antes del evaluador.
- Si, de forma hipotética, el 50% de la entrada de cada trabajo de Luna/Luna/Sol son lecturas de caché reales, el coste baja de 0,08340 a 0,05992 USD/sesión, **antes de escrituras/almacenamiento**. Fórmula completa: `(tokens_normales×Pentrada + tokens_leídos×Plectura + tokens_escritos×Pescritura + salida_total×Psalida)/1e6 + almacenamiento + herramientas`. Cada token de entrada debe pertenecer a su clase facturable sin duplicarse.
- Duplicar los tokens de salida aumenta la combinación Luna/Luna/Sol en 0,033 USD/sesión. No se puede aplicar el mismo presupuesto de razonamiento a todos y asumir el mismo resultado.

## Qué falta para seleccionar y activar

1. Comprobar acceso del equipo y la ruta de cada finalista sin interpretar catálogo público como autorización. El último 403 referido en el contexto de trabajo no se repitió aquí y no permite extrapolar acceso a otros modelos. Tampoco se consultaron saldos, claves ni presupuestos.
2. Ejecutar, cuando se autoricen llamadas, los mismos casos ficticios de conversación, correcciones contradictorias, negaciones, terceros, temporalidad y fuentes insuficientes. Medir esquema válido, campos respaldados, errores de atribución, retractación aplicada, uso de herramientas y coste real por resultado aceptado. No inventar porcentajes de precisión o latencia.
3. Revisar informes con una persona clínica: afirmaciones sin fuente, diagnósticos no sustentados, incertidumbre, límites y utilidad. Un evaluador LLM es una señal adicional que también necesita contraste humano.
4. Medir p50/p95 de tiempo hasta primer token y fin, reintentos, truncamientos, errores, tokens de razonamiento y cache hits. La comparación final usa coste por sesión aceptada, incluida revisión/retrabajo, no sólo USD/MTok.
5. Confirmar versión instalada y parámetros admitidos en el recorrido real; completar los gates del repositorio antes de activar cualquier cambio. Este estudio documental no ejecuta pruebas de aplicación ni acredita producción o aceptación clínica.

La capa gratuita directa de Google no equivale a la de Gateway. Google anuncia Flash 3.8 gratuito con condiciones y señala uso de contenido para mejorar productos en esa capa; Argon no ofrece Free tier. Los límites y la elegibilidad de la cuenta concreta no se verificaron. OpenAI muestra Free no soportado para los modelos 6 consultados. No se presupone que una promoción o acceso gratuito cubra el caso de Serenia. [Google: precios](https://ai.google.dev/gemini-api/docs/pricing), [OpenAI: Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra).
