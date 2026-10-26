# Versión de conversación para prueba supervisada por Pablo

25-10-2026. Petición: investigar sus notas y preparar una versión mejorada para que él la pruebe. Diseño técnico del piloto, no aprobación clínica de esta versión.

## Evidencia y propósito

Las respuestas originales están en `docs/handoff/respuesta de pablo/*.md.txt`; las copias `_utf8/` son equivalentes tras normalizar codificación/BOM/saltos. Son plantillas con respuestas intercaladas. Conservar su marco TCC/ACT, agencia, psicoeducación breve, prácticas individualizadas, ocho fases y capacidad de atender un problema espontáneo. No atribuirle todo el texto de las plantillas ni aprobación del ensamblaje nuevo.

El objetivo es una versión ejecutable con la que Pablo pueda juzgar comprensión, evaluación contextual, formulación provisional, selección de instrumentos/prácticas, reparación y respeto al rechazo. La auditoría base está en `docs/audits/2026-10-25-clinical-conversation-review.md`.

## Enfoques considerados y decisión técnica

1. Cambiar los prompts publicados directamente: sencillo, pero sustituye la referencia anterior y mezcla cambios clínicos pendientes con correcciones de software.
2. **Variante de conversación y reporte para pruebas, seleccionada por configuración del servidor:** permite comparar y revisar explícitamente las divergencias con las notas de Pablo. Es la opción escogida técnicamente para satisfacer la petición de una versión que él pueda probar.
3. Nuevo clasificador/modelo de decisiones y nuevas tablas: introduce otro sistema sin evaluación y más estados clínicos; no es necesario para esta ronda.

La autorización de implementar procede de la petición actual y de la delegación técnica previa del usuario. No se representa como firma de Pablo. Las propuestas clínicas quedan identificadas en el material de prueba.

## Contrato del piloto

- `FEATURE_CLINICAL_CONVERSATION_PILOT=on` selecciona dos nuevos prompts literales versionados. Sólo se permite fuera de `NODE_ENV=production`; una configuración de producción con flag on se rechaza, sin fallback silencioso. No es un parámetro del navegador ni permite elegir archivos arbitrarios.
- El comando `dev:clinical` usa Next instalado, loopback127.0.0.1:3217, piloto on y continuidad on. No añade claves ni proveedor; utiliza la configuración local existente.
- Recorrido: demanda/objetivo → duración/curso/función/contexto/recursos proporcionales → comprensión funcional provisional y corregible → instrumento con propósito/permiso → devolución → práctica/siguiente paso acordado. No preguntar todo en cada turno, ni usar contador como suficiencia.
- Conservar TCC/ACT y el mapa de fases; una fase por contador no demuestra que se haya trabajado. No afirmar completado terapéutico ni alta automática. Registrar pendientes en el informe existente. No imponer una técnica tras rechazo para cumplir una fase.
- Interpretación contextual por el modelo conversacional existente: en el piloto, una coincidencia léxica llega con historial y estado a la conversación, en vez de provocar siempre la misma respuesta estática. No se introduce clasificador ni se interpreta negación como seguridad. El aviso distingue observación automática y valoración pendiente; conserva los avisos estructurados de preocupación y las instrucciones de atención oportuna. Expiración y fallos con señal mantienen fallback existente. El gate SQL de cierre no se relaja.
- **Límite explícito:** el registro SQL de coincidencias conserva `suicidal_ideation/high`. Este piloto no cambia esa semántica ni la considera juicio clínico confirmado. Debe explicarse a Pablo y en el informe. Prueba sólo con casos ficticios supervisados; no habilitar para pacientes reales.
- Los resultados canónicos puntuados de la sesión permanecen disponibles en cada turno con el piloto. Incluye ítems sólo si se leyeron de su instancia real; no inferir síntomas de un total. La instrucción distingue datos disponibles de una orden de repetir la devolución.
- Cuestionarios ordinarios: invitación textual y espera de aceptación en un turno posterior. La variante debe poder explicar con honestidad si la propuesta pendiente aún bloquea otra; no fingir cancelación. No nuevas tools/SQL de cancelación en esta ronda.
- Cierre: mantener doble paso y aceptación persistida actual. Si una expresión natural no pasa el gate, aclarar brevemente la confirmación necesaria; no afirmar que ya cerró. No ampliar regex TS sin SQL.
- Informe piloto: mismo JSON y scoring canónico; describir demanda, curso/función/contexto/recursos conocidos y huecos, hipótesis contrastada/corregida, pertinencia y acuerdos reales. El esquema no distingue `unknown` en algunos enums: explicitar no explorado en notas y revisión pendiente; `none` no certifica ausencia. No activar orientación diagnóstica nueva ni modificar cortes para resolverlo. Mostrar esta limitación a Pablo.
- Correcciones generales verificables: instrucciones de contexto sobreviven al máximo de tareas; retorno sin informe no se presenta como primera visita; fallo al leer riesgo no se convierte en «ninguno».

## Límites de esta entrega

Sin diseño visual, nuevas patologías/instrumentos, cambios de bandas/cortes, migraciones, proveedores, claves, publicación, correos, avisos externos ni datos reales. Comparar calidad/precio de modelos requiere medir estas tareas después; esta versión no declara un ganador sin medición.

## Validación y entrega

Regresiones de datos/estado y selección del piloto, permisos existentes, fallbacks, historial y riesgo estructurado. Casos E01–E11 convertidos en material de prueba con ramas y rúbrica; no atribuir resultados de conversación a respuestas sintéticas. Conservar evidencia RED→GREEN, tests/lint/tipos y gates obligatorios de `docs/operations/dependency-gates.md`, con commit exacto del build aislado. Revisión independiente al final.

Guía para Pablo: procedencia de criterios, diferencias de esta versión, arranque/reversión por flag, escenarios ficticios, puntuación con turnos y decisiones pendientes. «Lista para prueba supervisada» no equivale a eficacia clínica demostrada ni a lanzamiento.
