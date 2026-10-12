# Refresco de modelos — 12 octubre 2026

Investigación del controlador con fuentes primarias actuales. Complementa la comparativa del10oct; no ejecuta proveedores ni cambia modelos/presets del paciente.

Sol6.1 conserva entrada2/salida10, caché lectura0.10/escritura2.50USD por millón. Sonnet5.5 conserva entrada2/salida10 y lectura0.10. Ambos siguen como candidatos del benchmark de conversación/informes. [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [Sonnet](https://platform.claude.com/docs/en/models/sonnet-5-5/overview).

Haiku5.5, publicado7oct, merece entrar en la futura comparación auxiliar con Luna. Sus tarifas cambian con el tamaño del prompt:

| USD por millón | Prompt hasta100.000tokens | Prompt superior100.000tokens |
| --- | ---: | ---: |
| Entrada | 0.10 | 0.50 |
| Salida | 0.50 | 2.50 |
| Caché lectura | 0.01 | 0.05 |
| Escritura5min /1h | 0.125 /0.20 | 0.625 /1.00 |

La tarifa depende del prompt completo; no modelar sólo el exceso como una tarifa marginal. El tokenizer cambia respecto a Haiku4.5 y aumenta aproximadamente30% sus tokens para el mismo texto. Comparar uso facturado y razonamiento, además de tarifa. [Modelo y precios Haiku5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview).

Gateway publica `anthropic/claude-haiku-5.5`. Sus ejemplos incluyen opciones nuevas de AI SDK7; Serenia usa6.0.303 y requiere smoke propio de streaming, herramientas y esquema antes de cualquier promoción. [Gateway](https://vercel.com/ai-gateway/models/claude-haiku-5.5). Búsqueda actual en app/lib/scripts: ningún consumidor `llm.fast()` encontrado; prioridad inmediata conversación/informes. Este refresco no añade un preset de Haiku5.5 ni una tarifa constante incorrecta al evaluador existente.

Decisions Luna mantiene0.10USD/M de entrada, sin cargos salida/caché; primas regionales/contexto aparte. Jev1.13 mantiene0.042USD/M. Preferencia provisional Decisions en sombra: precisión española y calibración no medidas; la advertencia de TypeSafe sobre idiomas favorece probar primero, no demuestra un ganador. [Decisions](https://developers.openai.com/api/docs/guides/decisions), [Jev](https://docs.typesafe.ai/models).

Los costes iguales por token no demuestran calidad/precio iguales por tarea. Benchmark ciego en español, compatibilidad, todos los intentos y configuración de datos siguen como gates externos. Los adapters auxiliares permanecen desconectados/apagados y el gold clínico pendiente de aprobación.
