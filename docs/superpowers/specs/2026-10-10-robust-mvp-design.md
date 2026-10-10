# Serenia: MVP robusto

Fecha: 2026-10-10. Base auditada: `0a2a139`. El usuario autoriza elaborar el plan, ejecutar mejoras con subagentes y asumir la dirección técnica de esta fase.

## Resultado esperado

Mantener Next.js, Supabase, AI SDK y Workflow, corrigiendo defectos demostrados antes de ampliar el producto. El MVP local debe permitir un ciclo fiable de paciente, cuestionario, cierre, informe y revisión clínica con datos sintéticos. El código del servidor y la base de datos deben ser la autoridad sobre identidad, estado y efectos; las respuestas de modelos solo aportan juicio o texto.

## Requisitos

- Un paciente no puede promover su rol, leer datos ajenos, escribir mensajes del asistente ni fabricar resultados o informes clínicamente validados. Las relaciones entre sesión, conversación, cuestionario e informe conservan el mismo propietario.
- La RPC de cierre autentica al llamante, valida la transición y cierra sesión y conversación de forma atómica e idempotente. Todas las vías de cierre respetan ese contrato. Un fallo de encolado tiene recuperación persistente; el cron llega a su propia autenticación sin una cookie de usuario.
- La revisión clínica y sus tareas se guardan en una transacción que preserva una única versión vigente, sin duplicación al repetir o concurrir. El worker revalida relaciones antes de leer con privilegios elevados.
- El historial del modelo se reconstruye desde datos autorizados del servidor. El cliente solo puede añadir un turno de usuario; límites e idempotencia evitan falsificación y repeticiones. El servidor valida la propuesta y confirmación de cierre, sin convertir un juicio probabilístico en permiso.
- Una nueva señal explícita de crisis no se suprime por un cuestionario pendiente o por el límite temporal. Mantener las escalas y copy clínica aprobadas; no promover borradores de prompts ni inventar cortes clínicos.
- Los cuestionarios validan la totalidad de respuestas y opciones antes de escribir. Respuestas, resultado, estado y riesgos se guardan de forma atómica e idempotente. Un cuestionario finalizado no bloquea el siguiente; seguridad conserva prioridad. C-SSRS respeta saltos documentados; cualquier cambio de ventana temporal pendiente de acuerdo clínico se documenta como gate.
- Onboarding valida fechas calendáricas y edad mínima de 18 años. La aceptación se conserva con versión/fecha. La interfaz no promete una revisión humana actual sin evidencia.
- El clínico ve y puede corregir todas las dimensiones de riesgo del esquema. El paciente recibe la versión autorizada vigente; rechazados y sustituidos quedan fuera. El chat tiene error recuperable y los formularios reflejan selección a tecnología asistiva.
- Mantener pruebas existentes útiles y añadir regresiones sobre fallos encontrados. Tests mock no prueban RLS: validar migraciones/privilegios/transacciones en PostgreSQL efímero con actores ficticios. Añadir verificación de navegador con transporte sintético, sin pacientes ni gasto LLM.
- Actualizar dependencias afectadas con versiones fijadas y lockfile, sin `audit fix --force`. Lint, tipos, tests y build pasan mediante comandos del repositorio. Telemetría de herramientas desactivada.

## IA y alcance de entrega

Investigar Jev de TypeSafe, OpenAI Decisions y modelos de conversación/informes con documentación primaria actual. Proponer un adaptador de decisiones acotado y evaluación en español, inicialmente sin influir en pacientes. Puntuaciones de cuestionarios, edad, permisos y transiciones siguen en código. No elegir proveedor por benchmarks publicitarios, ni afirmar mejoras de calidad/coste no medidas.

No se despliega ni modifica la BD remota en esta fase. Una mejora local no equivale a autorización clínica, jurídica ni aceptación en producción. El informe final identifica migraciones por aplicar, configuración externa y acuerdos pendientes. Los secretos y los datos de pacientes no forman parte de fixtures, prompts de evaluación ni logs públicos.

## Criterios de finalización

Todos los bloques del plan están implementados, revisados y consolidados; los gates locales tienen resultados completos; la auditoría distingue corregido, pendiente y no verificado; existe una recomendación de IA con costes trazables y un procedimiento reproducible para comparar candidatos. El último control usa el artefacto construido y una BD sintética, con las limitaciones declaradas.
