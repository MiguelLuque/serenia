# Pablo Profile Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Publicar el perfil aceptado sólo para la cuenta ficticia de Pablo conservando URL/credenciales y consentimiento propio.
**Architecture:** Allowlist de servidor en cada entrypoint de la aplicación/procesamiento, SQL owner-only intacto; paquete atómico alojado con fuentes exactas y guards; merge/push/Vercel Git y smoke autenticado.
**Tech Stack:** Next16.4.1, Supabase/Postgres17, Workflow4.8.13, AI6.0.303; dependencias/modelos existentes.
**Spec:** docs/superpowers/specs/2026-10-30-pablo-profile-release-design.md

## Global Constraints

- Sólo proyecto/equipo/BD/alias exactos de la Spec. Usuario ya autorizó publicación; no pedir de nuevo permisos de rutina.
- Comandos rtk; root cwd /Users/miguelluque/git/serenia; sin .env.local, claves impresas, datos reales, rol clínico, reset/push/repairBD, nuevos costes/proveedores/dependencias.
- Rama base93fc4ef; memoria está probada localmente, no repetir su implementación ni atribuir tests sintéticos a calidad clínica.
- Un implementer a la vez, revisión por task; root prepara preflight oficial y ejecuta sólo la aplicación/mutación externa final. Evidencia completa y stdout compacto.

## Review Focus

- Actor no autorizado con body falsificado: ningún perfil/contexto/modelo, chat base conservado (Task1).
- Worker/cron se saltan UI: owner cargado debe gobernar toda extracción/claim (Task1).
- Configuración ausente/incorrecta no debe activar globalmente ni romper chat (Task1).
- Drift de historia/platform con mismos conteos: packet falla y rollback conserva estado (Task2).
- Mismo correo/enlace pero onboarding sin aceptar: acceso preparado sin actuar por Pablo ni atribuir calidad de conversación a un login (Task3).

### Task1: Allowlist completa de aplicación y procesamiento

Files: lib/server/profile/{config,context,dispatch}.ts; lib/server/workflows/extract-profile.ts; app/api/chat/route.ts; app/api/internal/close-stale-sessions/route.ts; app/app/{layout.tsx,perfil/page.tsx,perfil/actions.ts}; .env.example; tests/profile/* y harness afectados.

Interfaces: `progressiveProfileAvailable(env=process.env):boolean` coarse flag+valid config; `progressiveProfileEnabled(env=process.env,userId?:string):boolean` owner gating. Helper de IDs para cron puede elegir implementer con firma documentada. `loadProfileContext(client,currentText,userId?:string)` recibe Auth validado; ClaimedProfileJob incluye user_id verificado por claim; workflow sigue argumentos sóloIDs/token. Sin cambios SQL ni prompts/modelos.

- [ ] Escribir RED de valid/invalid/missing allowlist, no-owner, noVERCELlocal, calleridentity, nonallowlisted actions/page/context, worker antes de start/modelo, cron sin claimglobal y límites10/2.
- [ ] Ejecutar focused y conservar fallos esperados; implementar gate en todos los callers sin duplicar semánticas ni aceptar identidad del body.
- [ ] FocusedGREEN, lint/typecheck, una suite completa final; commit+reporte y revisión independiente.

### Task2: Paquete SQL alojado exacto y protegido

Files nuevos: scripts/profile-hosted-packet.mjs, scripts/test-profile-hosted-packet.py; supabase/hosted/profile-* fuentes/manifest/baseline; tests/tooling/profile-hosted-packet.test.ts si aporta cobertura del generador. No tocar migraciones fuente ni paquetes históricos.

Interfaces: root entrega baseline oficial43versiones/platform/dependencias/cuestionarios, fileJSON sin secretos. Export `makeProfilePacket(root=resolve('.'))`→{packet:Buffer,manifest} incluye offsets/bytes/SHA de las cuatro fuentes. Target cerrado. Generador se limita a generar artefactos; no aplica remoto. Harness PG17 aislado reproduce baseline/platform con fixtures vacíos conocidos y demuestra normalapply+rollback/guards.

- [ ] Leer baseline/operación hospedada y cuatro fuentes; diseño de guards exactos que no dependa sólo de counts. RED de drift y fuente alterada.
- [ ] Generar paquete nuevo, comparar fuentes por offsets/SHA y preservar Auth/perfiles/cuestionarios opacamente.
- [ ] Tests positivos/negativos SQL atómicos y generadorGREEN; commit+reporte/revisión. Root valida paquete revisado antes de apply.

### Task3: Publicación y aceptación (root)

- [ ] Revisión global del delta93fc4ef→release, siete gates y evidencia clínica diferenciada.
- [ ] Preflight oficial fresco exacto y comparar hash del packet revisado; aplicar por MCP una vez; postcheck catálogo/grants/rows/history/mapping/advisors/tipos.
- [ ] Configurar flags sólo cuenta dedicada, preservar secretos; fast-forward main y comprobar CI/VercelSHA/aliasREADY.
- [ ] Login API/HTTP cuenta dedicada sin consentimientos, feature entrypoint coherente; semántica17casos sólo con canal oficial de credenciales y datos ficticios, o marcar explícitamente noejecutado.
- [ ] Misma URL/credenciales en final, actualizar handoff y nota para usuario; guardar recibos sin secretos. No correo adicional automático.
