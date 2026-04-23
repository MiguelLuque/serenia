# Feature flags — guía operativa

**Fecha:** 2026-04-23
**Ámbito:** operaciones (ops). No es documentación de producto ni de desarrollo.

Este documento recoge los feature flags activos en Serenia, cómo se controlan en local y en Vercel, y cuál es el procedimiento de kill switch para cada uno.

---

## `FEATURE_CROSS_SESSION_CONTEXT`

### Qué controla

Activa la **continuidad entre sesiones** en el endpoint `/api/chat`. Cuando el flag vale `on`:

- Se inyecta un `patientContextBlock` en el system prompt construido a partir del último `assessment` validado del paciente (Tier A / historic) o del último draft no validado con sesión cerrada (Tier B).
- Se inyecta un `riskOpeningNotice` derivado de `derivePatientRiskState(ctx)` cuando hay `open_risk_events` o el último assessment reportó ideación — con tres variantes de copy (vigilancia / activo / agudo).
- Se considera la tabla `patient_tasks` para listar acuerdos pendientes.
- Se escribe una fila de telemetría por cada `/api/chat` que inyecta contexto (ver sección de telemetría más abajo).

Cuando el flag **no** vale `on` (cualquier otro valor, incluido ausente o vacío), `/api/chat` se comporta exactamente como antes de Plan 6: system prompt sin contexto longitudinal, sin aviso de riesgo, sin telemetría.

### Estado por defecto

La política depende de si la app ya está **lanzada oficialmente a usuarios reales** o no. A fecha de 2026-04-23 Serenia está en **pre-lanzamiento**: no hay usuarios reales, el entorno local apunta a la BD de producción y los features nuevos se activan con `flag=on` desde el día 1 para poder validarlos end-to-end antes del lanzamiento. Esto permite descubrir problemas con los datos reales en vez de hacerlo el día del lanzamiento.

#### Activación pre-lanzamiento (aplica **ahora**)

Se permite encender el flag a `on` en **cualquier entorno — incluyendo producción** — mientras la app no esté oficialmente lanzada. Único prerrequisito:

1. El [smoke checklist](../superpowers/specs/2026-04-23-plan-6-smoke-checklist.md) manual ha pasado al menos una vez en ese entorno (o en uno equivalente que use la misma BD y la misma build).

El sign-off clínico y la Fase 2 de métricas **no son bloqueantes** en este modo — son aún deseables pero no se exigen para encender el flag. El razonamiento: si no hay usuarios reales, la única forma de detectar drift entre el copy firmado y el copy que realmente ve el modelo es mirando prompts generados con datos reales, y eso requiere el flag encendido.

#### Activación post-lanzamiento (se aplicará tras el lanzamiento oficial)

Cuando la app se lance oficialmente a usuarios reales (fecha/hito a determinar, se actualizará este documento en ese momento), el flag volverá a `off` por defecto en producción y a partir de ese instante aplicará la política estricta: **debe permanecer en `off`** en todos los entornos donde pueda tocar a un usuario real hasta que se cumplan **ambas** condiciones:

1. El documento de sign-off clínico [`2026-04-23-plan-6-cross-session-continuity-signoff.md`](../superpowers/specs/2026-04-23-plan-6-cross-session-continuity-signoff.md) esté firmado por el revisor primario y el revisor independiente.
2. La instrumentación de métricas de Fase 2 (`continuity_references`, regex de referencia, vistas y cron) esté desplegada y recogiendo datos. La Fase 2 se planificará en un plan separado cuando el equipo decida encender el flag en producción.

El momento del "switch" entre ambos modos coincide con el lanzamiento oficial. Hasta entonces, usar el modo pre-lanzamiento.

### Cómo alternar el flag en local

En `.env.local` (no commited), añadir o modificar:

```
FEATURE_CROSS_SESSION_CONTEXT=on
```

Reiniciar el dev server (`pnpm dev`) para que el proceso Node coja el nuevo valor. Para volver a `off` basta con cambiar el valor (o borrar la línea) y reiniciar.

### Cómo alternar el flag en Vercel

1. Ir al dashboard del proyecto en `https://vercel.com/{team}/{project}/settings/environment-variables`.
2. Buscar `FEATURE_CROSS_SESSION_CONTEXT`.
3. Editar el valor a `on` y marcar los **environments** donde aplicar (Preview, Production, o ambos). Cada environment mantiene su propio valor — se puede encender solo en Preview para validar antes.
4. Guardar.
5. **Re-desplegar.** Los cambios de environment variables **no** se aplican a despliegues existentes; hay que lanzar un nuevo deploy (por ejemplo con `vercel redeploy` o un merge/push trivial a la rama del environment).

### Dónde se lee en código

[app/api/chat/route.ts:117](../../app/api/chat/route.ts) — línea:

```ts
const featureOn = process.env.FEATURE_CROSS_SESSION_CONTEXT === 'on'
```

La comprobación es estrictamente `=== 'on'`. Cualquier otro valor (incluido `'true'`, `'1'`, `'ON'`) se trata como apagado.

### Telemetría cuando el flag está `on`

Cuando el flag está encendido, cada invocación a `/api/chat` que construya un bloque de contexto escribe una fila en la tabla `patient_context_injections` a través de [`lib/patient-context/telemetry.ts`](../../lib/patient-context/telemetry.ts). Campos registrados:

- `user_id`, `session_id`
- `tier` — uno de `tierA`, `historic`, `tierB`, `none`
- `risk_state` — uno de `none`, `watch`, `active`, `acute`
- recuento de caracteres del bloque de contexto inyectado
- recuento de `pending_tasks` considerados
- bandera de si el `riskOpeningNotice` se activó
- id del último assessment validado (o `null` si no había)
- secciones truncadas por el cap de 2500 caracteres (p. ej. `areas_for_exploration`, `presenting_issues`, `chief_complaint_capped`)

La escritura de telemetría se hace con rol de servicio y nunca bloquea la respuesta del chat (fallos se loggean en stderr).

### Kill switch

Flip del flag de `on` a `off` + redeploy:

- **En producción/preview (Vercel):** cambiar el valor en el dashboard a `off`, lanzar un nuevo deploy. El siguiente `/api/chat` tras el deploy leerá el nuevo valor desde `process.env` y no inyectará contexto. No hay caché del bloque de contexto — cada petición relee el flag.
- **En local:** cambiar `.env.local` y reiniciar `pnpm dev`.

**No se necesita limpieza en base de datos.** Apagar el flag no borra las filas existentes de `patient_context_injections` ni las `patient_tasks` — simplemente detiene la escritura de nuevas filas y la inyección de nuevos bloques. Si algún día se quiere borrar la telemetría histórica, es un `DELETE` manual separado que no forma parte del kill switch.

### Documentos relacionados

- [Smoke checklist](../superpowers/specs/2026-04-23-plan-6-smoke-checklist.md) — verificación manual end-to-end antes de encender el flag en cualquier entorno.
- [Sign-off clínico](../superpowers/specs/2026-04-23-plan-6-cross-session-continuity-signoff.md) — aprobación clínica de la copy generada.
