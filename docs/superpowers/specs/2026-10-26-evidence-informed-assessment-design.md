# Evaluación contextual sustentada en evidencia: incremento para revisión de Pablo

26-10-2026. Petición de ejecución: «investiga a nivel psicológico y desde la evidencia científica […] Aprende y aplícalo». Se aplica al alcance actual de adultos, ansiedad/ánimo depresivo y revisión profesional. La autorización de implementación no equivale a aprobación clínica.

## Enfoque elegido

Se conserva una entrevista semiestructurada y flexible, con medidas como complemento y formulación funcional provisional. Una secuencia rígida de tests no cubre curso, funcionamiento o explicaciones alternativas; un diagnóstico autónomo del LLM no está validado. El enfoque se aplica al piloto supervisado, conservando el esquema, instrumentos, bandas y controles de seguridad existentes.

## Cambios concretos

1. **Fidelidad de respuestas:** al preparar ítems C-SSRS para el informe, distinguir valores normalizados por salto de negaciones directamente acreditadas. No modificar scoring, persistencia ni atribuir retrospectivamente quién contestó qué. Usar una aclaración conservadora de procedencia cuando la regla hace el ítem no aplicable.
2. **Memoria corregible:** un informe rechazado no se usa como borrador pendiente de revisión. Conservar la historia de sesiones y las fuentes canónicas independientes; no borrar eventos ni promover un borrador a revisión clínica.
3. **Método del piloto:** concretar entrevista contextual, datos no explorados, discrepancias entre escala/relato, alternativas pertinentes, hipótesis contrastable y seguimiento de funcionamiento/objetivos. Diferenciar formulación de diagnóstico; no introducir preguntas exhaustivas ni diagnósticos nuevos por chat. Propuesta 0.2.0-pilot pendiente de Pablo.
4. **Evaluación honesta:** inventariar los dos prompts piloto además de los base sin afirmar ejecución de modelos. Preparar episodios ficticios con ramas y rúbrica para comprobar método y límites; nunca presentar coincidencias textuales como validación clínica.

## Límites

Sin migraciones, nuevos puntos de corte/instrumentos, diagnóstico automático, cambio de modelo, notificaciones ni acceso a pacientes. No se alteran las ramas high/acute ni sus gates. Los enums heredados sin estado no evaluado, el ciclo de herramientas y el consentimiento persistido siguen siendo trabajo separado; no se considerarán resueltos por un prompt. La versión desplegada se conserva mientras se comprueba el cambio.

## Verificación

Regresiones RED→GREEN para memoria rechazada, procedencia de saltos y metadatos de evaluación. Revisión independiente de prompts/casos y del delta de código. Suite focal y siete gates nativos sobre un commit exacto. Los episodios clínicos se etiquetan NO EJECUTADOS hasta conversar con el proveedor y recibir revisión humana; passing tests no prueba precisión diagnóstica ni eficacia.

## Fuentes y transferencia

La síntesis de guías, estudios y límites de transferencia queda en `docs/research/2026-10-26-psychological-assessment-evidence.md`. El diseño es una decisión de ingeniería dentro de la petición, no una nueva regla firmada por Pablo. Las discrepancias con notas históricas y las decisiones clínicas pendientes permanecen visibles.
