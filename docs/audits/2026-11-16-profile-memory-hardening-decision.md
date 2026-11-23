# Decisión: endurecer la extracción de memoria progresiva

## Alcance aprobado

Primera tanda limitada a dos recorridos que la auditoría Astra confirmó:

1. La cola SQL crea trabajos para mensajes de seguridad aunque la ruta del chat omite el despacho inmediato.
2. Un worker puede revocar el consentimiento después de iniciar el trabajo pero antes de llamar al extractor, sin volver a comprobarlo.

## Decisiones

- La extracción de memoria solo se habilita para mensajes ordinarios elegibles, indicados por el servidor en la admisión del turno y persistidos en la fila fuente. SQL fuerza la exclusión de señales directas y respuestas de seguridad. El clasificador de ambigüedad es TypeScript; la ruta debe enviar `false` para todo `isSafetyTurn`.
- La admisión ordinaria con elegibilidad bloquea la fila de consentimiento después de bloquear la sesión y antes de crear el turno. Así revocación y admisión se serializan, y el lease empieza después de cualquier espera por consentimiento. Replays y turnos de seguridad no adquieren ese bloqueo adicional.
- Los trabajos antiguos cuya elegibilidad no puede probarse se cancelan, con rotación de token y sin borrar observaciones, mensajes ni conversaciones. No hay backfill automático.
- El worker revalida consentimiento, epoch, token, lease y elegibilidad inmediatamente antes de invocar al proveedor. La transacción no puede abarcar la llamada externa: la revocación posterior a esa autorización no puede cancelar el envío, pero sí impide persistir resultados.
- En esta tanda no cambiaremos si las citas `pending` entran al contexto conversacional, cómo se vinculan correcciones antiguas ni el límite de recuperación de citas. Son decisiones de producto separadas y requieren pruebas de evaluación antes de cambiar su conducta.

## No objetivos

- No aplicar migraciones a Supabase alojado, cambiar flags de Vercel, llamar a modelos ni desplegar.
- No modificar puntuaciones, instrumentos, lógica de riesgo ni informes clínicos.
- No afirmar validación diagnóstica por superar pruebas técnicas.
