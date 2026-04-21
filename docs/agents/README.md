# Agentes de Serenia

Este directorio es la **ficha de empleado** del asistente de IA que atiende a los pacientes de Serenia. Aquí viven su rol, los protocolos que debe seguir y los prompts que se le envían.

> **Principio:** la IA trabaja para un psicólogo humano. Este directorio existe para que el psicólogo pueda revisar y modificar el comportamiento del asistente **sin tocar código**. Todo lo que cambies aquí se aplica en la siguiente sesión.

## Estructura

- [`roles/`](roles/) — Qué hace cada agente, alcance, herramientas, restricciones.
- [`protocols/`](protocols/) — Procedimientos clínicos (crisis, flujo de sesión, etc.).
- [`prompts/`](prompts/) — System prompts en español. **El frontmatter YAML (entre `---`) es metadata y NO se envía al modelo.** Todo lo que hay debajo del frontmatter se envía literalmente al modelo como system prompt en cada llamada. Se cargan en runtime desde estos `.md`.
- [`changelog.md`](changelog.md) — Historial de cambios con motivo clínico.

## Cómo proponer un cambio

1. Abre un Pull Request modificando el `.md` correspondiente.
2. Añade una entrada en [`changelog.md`](changelog.md) con fecha, archivo, cambio, autor y motivo clínico.
3. El psicólogo responsable aprueba (o rechaza) el PR.
4. Al mergear, el cambio entra en la siguiente sesión nueva (los prompts se cachean por proceso).

## Agentes activos

- **Session Therapist** ([rol](roles/session-therapist.md) · [prompt](prompts/session-therapist.md)): atiende la sesión de chat con el paciente, duración máx. 60 min.

## Protocolos

- **[Crisis](protocols/crisis.md)** — ideación suicida, autolesión, violencia. Recursos ES: Línea 024, 112.
- **[Flujo de sesión](protocols/session-flow.md)** — apertura, exploración, cierre.
