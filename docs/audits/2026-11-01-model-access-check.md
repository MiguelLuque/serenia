# Comprobación de acceso a los candidatos GPT-6

Estado a 1 de noviembre de 2026, 21:52:09 UTC: **BLOCKED_ACCESS**. Se intentaron dos peticiones técnicas; ninguna devolvió una generación. La evaluación de calidad sigue **ONLINE_NOT_RUN**.

## Autorización y alcance

El usuario autorizó hasta 5 USD de créditos existentes de AI Gateway para probar GPT-6 Luna en conversación/memoria y GPT-6.1 Sol en informes, con casos ficticios. No autorizó compras, recargas ni cambios de modelos en el piloto. El subconjunto OpenAI del [manifiesto](../research/2026-11-01-model-evaluation-manifest.md) tiene 37 casos: 9 de conversación, 15 de perfil y 13 de informe. La comparación con Anthropic no está incluida en esta autorización.

Antes de ejecutar esos casos se comprobaron ambos modelos con un mensaje técnico ficticio que solicitaba únicamente `OK`. Estas peticiones no usan contexto clínico, cuentas de pacientes, herramientas ni continuaciones. No evalúan calidad, diagnóstico, fluidez o compatibilidad del flujo completo.

## Controles y resultado observado

La credencial efímera procedió de la CLI oficial de Vercel, desde un directorio limpio, sin leer `.env.local`. El proceso hijo recibió únicamente el entorno permitido y comprobó el ámbito y caducidad del token. El preflight exigió saldo existente suficiente y las tarifas Standard aprobadas del catálogo público para ambos identificadores.

Se limitó el transporte a dos POST, uno por identificador, contra AI Gateway. Cada petición tenía 32 tokens máximos de salida, un cuerpo acotado, 15 segundos de timeout y cero reintentos del SDK. No se habilitaron compras, BYOK, alternativas de modelo ni operaciones externas. Los reintentos internos del Gateway no se han medido.

El ensayo previo interceptó las dos peticiones antes del POST: **0 POST reales**. La reserva conservadora conjunta calculada fue 0,006197625 USD, dentro del límite adicional de 0,05 USD para estas comprobaciones. Esta reserva no es coste facturado ni uso medido.

| Modelo solicitado | Intentos HTTP del cliente | Respuesta | Tipo de error | Tiempo hasta fallo del SDK |
| --- | ---: | --- | --- | ---: |
| `openai/gpt-6-luna` | 1 | 403 | `no_providers_available` | 830 ms |
| `openai/gpt-6.1-sol` | 1 | 403 | `no_providers_available` | 279 ms |

En ambos casos el diagnóstico del Gateway fue: “Free tier users do not have access to this model.” No se recibió una respuesta generada, un desglose de uso de tokens ni un identificador de generación para consultar facturación. **Coste facturado: desconocido**; no se sustituye por cero. Los tiempos anteriores miden rechazos de acceso, no latencia de inferencia.

Se detuvo la batería antes de enviar ningún caso del manifiesto. No se compraron créditos, crearon claves, cambiaron presupuestos, modificaron modelos del piloto ni enviaron correos.

## Desbloqueo necesario

La [documentación oficial de precios de Vercel](https://vercel.com/docs/ai-gateway/pricing), consultada en esta comprobación, distingue un catálogo limitado para créditos gratuitos del acceso completo con créditos comprados. Comprar créditos cambia el equipo al nivel de pago y termina la asignación mensual gratuita. Es una decisión de facturación distinta del permiso de consumir saldo ya existente; no se ha ejecutado.

Si se habilitan créditos de pago, antes de reanudar habrá que verificar de nuevo acceso, saldo, tarifas y presupuesto restante. No repetir los 37 casos mientras se mantenga este rechazo. La batería y la revisión de Pablo siguen pendientes; no promover modelos por su precio ni por una comprobación de acceso. Los bloqueos de dependencias y SQL alojado siguen separados y sin resolver por este resultado.

## Recibos locales

Archivos privados ignorados en `.cache/model-research-20261101/`, sin publicar credenciales:

| Archivo | SHA-256 |
| --- | --- |
| `access-probe.mts` | `e10a7b19df820258c564090d0960bd02c165795f366bcdf173419fcd004a623c` |
| `access-probe-launcher.mjs` | `5b8fc6f66a422e67ea8adb1f1d07485cc4ba4f43c6e60b0ff78511ceb46fab12` |
| `access-probe-dry.json` | `83151bf2527060f989f10b386f6208c8341a9ac83401b319c1f06bd06ec99201` |
| `access-probe-results.json` | `89c9956e6dccfa448da6f6af97c473e2434bf733a9945c48fdfb094ef46605f8` |

El primer preflight se detuvo antes de generación por una comparación de precios con conversión de escala en coma flotante. Se corrigió comparando tarifas en la misma unidad; el ensayo y las dos peticiones registrados arriba son posteriores. No se interpreta ese fallo previo como un cambio real de precios.
