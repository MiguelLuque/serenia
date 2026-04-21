# Plan 3 — Chat con IA y sesiones

**Branch base:** `main` (con Plan 2 ya mergeado).
**Branch de trabajo:** `feat/plan-3-chat-sessions`.

## Objetivo

Al terminar este plan:
- Un paciente autenticado puede iniciar una sesión de chat con la IA terapeuta.
- El chat usa AI SDK v6 con streaming, vía Vercel AI Gateway (modelo `gpt-5.4-mini` por defecto, configurable).
- Una sesión dura hasta 60 min; la IA avisa en los últimos 10 min y dispara el cierre.
- Si el paciente abandona ≥30 min sin mensajes, la sesión se cierra sola al siguiente intento de entrar.
- Solo hay **una sesión activa por usuario** a la vez (KISS).
- Mensajes persisten en `messages`; cada sesión tiene estado `active | completed | abandoned`.
- Guardarraíles de seguridad: detección básica de crisis (palabras clave + prompts) con banner permanente **Línea 024 / 112**.
- `docs/agents/` contiene la documentación revisable por el psicólogo (roles, prompts en ES, protocolos, changelog).

## Fuera de alcance

- Cuestionarios embebidos (PHQ-9/GAD-7/ASQ) — van en Plan 4.
- Generación de informe clínico / diagnóstico preliminar — Plan 4.
- Panel clínico — Plan 5.
- Múltiples sesiones simultáneas o desde varios dispositivos (una activa a la vez).

---

## Pre-requisitos

- Plan 2 mergeado a `main`.
- `VERCEL_OIDC_TOKEN` presente en `.env.local` (via `npx vercel env pull`).
- Variables LLM en `.env.local`:
  - `LLM_THERAPIST_PROVIDER=openai`
  - `LLM_THERAPIST_MODEL=gpt-5.4-mini`
  - `LLM_REPORT_PROVIDER=openai`
  - `LLM_REPORT_MODEL=gpt-5.4`
  - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`

---

## Task 1: Migración — tabla `sessions` y extender `conversations`

**Files:**
- Create: `supabase/migrations/20260421000001_sessions_table.sql`

Plan 1 creó `conversations` (genérico). Ahora materializamos **sesiones clínicas** como un tipo concreto de conversación.

```sql
-- supabase/migrations/20260421000001_sessions_table.sql

-- Estado de la sesión.
create type session_status as enum ('active', 'completed', 'abandoned');

-- Una sesión es una conversación clínica con duración acotada.
-- 1:1 con conversations.
create table sessions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  status          session_status not null default 'active',
  started_at      timestamptz not null default now(),
  closed_at       timestamptz,
  last_activity_at timestamptz not null default now(),
  close_reason    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index sessions_user_active_idx on sessions(user_id) where status = 'active';
create index sessions_last_activity_idx on sessions(last_activity_at) where status = 'active';

alter table sessions enable row level security;

create policy "sessions_all_own"
  on sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "sessions_select_clinician"
  on sessions for select
  using (is_clinician());

-- Trigger para updated_at
create trigger sessions_updated_at
  before update on sessions
  for each row execute function touch_updated_at();
```

Commit:
```bash
npx supabase db push
git add supabase/migrations/20260421000001_sessions_table.sql
git commit -m "feat: sessions table with lifecycle and RLS"
```

---

## Task 2: Regenerar tipos Supabase

```bash
npx supabase gen types typescript --linked > lib/supabase/types.ts
npx tsc --noEmit --strict
```

Commit:
```bash
git add lib/supabase/types.ts
git commit -m "chore: regenerate supabase types for sessions table"
```

---

## Task 3: Documentación de agentes — estructura

**Files:**
- Create: `docs/agents/README.md`
- Create: `docs/agents/changelog.md`
- Create: `docs/agents/roles/session-therapist.md`
- Create: `docs/agents/protocols/crisis.md`
- Create: `docs/agents/protocols/session-flow.md`
- Create: `docs/agents/prompts/session-therapist.md`

### `docs/agents/README.md`

Índice en español con:
- Qué es este directorio (la "ficha de empleado" del asistente IA).
- Cómo proponer cambios (PR directo a `.md`, el psicólogo aprueba).
- Enlaces a cada rol, protocolo y prompt.
- Nota: cada cambio debe quedar registrado en `changelog.md` con fecha, autor y motivo clínico.

### `docs/agents/changelog.md`

```markdown
# Changelog de prompts y protocolos

| Fecha      | Rol afectado        | Cambio                              | Autor         | Motivo clínico |
|------------|---------------------|-------------------------------------|---------------|----------------|
| 2026-04-21 | session-therapist   | Versión inicial                     | @psicologo    | Puesta en marcha |
```

### `docs/agents/roles/session-therapist.md`

Describe el rol: objetivo, alcance, herramientas (tool calls que puede llamar), restricciones, ejemplos de frases OK / NO.

### `docs/agents/protocols/crisis.md`

Protocolo ante detección de ideación suicida, autolesión, violencia doméstica, abuso. Incluye:
- Señales de alerta (lista).
- Recursos ES: **Línea 024 (teléfono gratuito 24/7), 112 emergencias**.
- Frases que la IA debe decir textualmente.
- Escalada automática: marcar `session.close_reason='crisis_detected'` + flag en el informe para el psicólogo.

### `docs/agents/protocols/session-flow.md`

Fases típicas de una sesión de 60 min:
1. Apertura (2-3 min): saludo, verificar estado actual.
2. Exploración (15-20 min): escucha activa, preguntas abiertas.
3. Profundización / cuestionarios (20-25 min): si procede, administrar PHQ-9/GAD-7/ASQ (Plan 4).
4. Cierre (5-10 min): resumen, siguiente paso, despedida.
5. Avisos de tiempo: a los 50 min avisar, a los 58 min cerrar.

### `docs/agents/prompts/session-therapist.md`

El system prompt en español, editable por el psicólogo. Debe incluir:
- Identidad (nombre, rol).
- Principios: escucha activa, validación emocional, evidencia, no diagnosticar, no prescribir.
- Estilo: tuteo amable, frases cortas, sin tecnicismos.
- Qué NO hacer: no dar consejo médico, no recetar medicación, no juzgar, no minimizar.
- Herramientas disponibles (se irán añadiendo — de momento solo `close_session`).
- Cómo invocar el protocolo de crisis.
- Recordar que la conversación será revisada por un psicólogo humano.

Commit:
```bash
git add docs/agents
git commit -m "docs: agent role, protocols, and prompt structure (editable by clinician)"
```

---

## Task 4: Loader de prompts desde markdown

**Files:**
- Modify: `lib/llm/prompts/index.ts`
- Create: `lib/llm/prompts/loader.ts`

El prompt vive en `docs/agents/prompts/session-therapist.md`. Creamos un loader que extrae el cuerpo del `.md` (después del frontmatter si lo hay) y lo devuelve como string. Se lee una sola vez por proceso (cache en memoria).

```ts
// lib/llm/prompts/loader.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const cache = new Map<string, string>()

export function loadPromptFromMarkdown(relativePath: string): string {
  if (cache.has(relativePath)) return cache.get(relativePath)!
  const abs = join(process.cwd(), relativePath)
  const raw = readFileSync(abs, 'utf-8')
  // Strip YAML frontmatter if present
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
  cache.set(relativePath, body)
  return body
}
```

Actualizar `lib/llm/prompts/index.ts` para exponer `getSessionTherapistPrompt()` que llama `loadPromptFromMarkdown('docs/agents/prompts/session-therapist.md')`.

Tests en `tests/llm/prompts.test.ts` verifican que el loader funciona y que el prompt no está vacío.

Commit:
```bash
git add lib/llm/prompts tests/llm
git commit -m "feat: load system prompts from docs/agents markdown files"
```

---

## Task 5: Helper de sesión en `lib/sessions/`

**Files:**
- Create: `lib/sessions/service.ts`
- Create: `tests/sessions/service.test.ts`

Lógica central de sesión. Funciones:

- `getOrResolveActiveSession(userId)`:
  - Busca sesión `active` del usuario.
  - Si última actividad < 30 min → la devuelve.
  - Si ≥ 30 min → la marca `abandoned` con `close_reason='inactivity'` y devuelve `null`.
  - Si no hay ninguna activa → devuelve `null`.
- `createSession(userId)`:
  - Crea `conversations` y `sessions` en transacción (o secuencia con manejo de error).
- `touchSession(sessionId)`: actualiza `last_activity_at = now()`.
- `closeSession(sessionId, reason)`: `status='completed'`, `closed_at=now()`, guarda `close_reason`.
- `isSessionExpired(session)`: boolean — true si `now() - started_at ≥ 60 min`.

Tests con vitest + mocks de supabase (crear sesión, expirar, reabrir tras inactividad).

Commit:
```bash
git add lib/sessions tests/sessions
git commit -m "feat: session service with lifecycle helpers"
```

---

## Task 6: Endpoint `/api/chat` con streaming

**Files:**
- Create: `app/api/chat/route.ts`

Usa AI SDK v6 (`streamText`) con el modelo del Gateway.

```ts
// app/api/chat/route.ts
import { streamText, convertToCoreMessages } from 'ai'
import { createAuthenticatedClient } from '@/lib/supabase/server'
import { getTherapistModel } from '@/lib/llm/models'
import { getSessionTherapistPrompt } from '@/lib/llm/prompts'
import {
  getOrResolveActiveSession,
  touchSession,
  closeSession,
  isSessionExpired,
} from '@/lib/sessions/service'

export async function POST(req: Request) {
  const supabase = await createAuthenticatedClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages, sessionId } = await req.json()

  // 1) Validar sesión pertenece al usuario y está activa.
  // 2) Si la sesión ha superado 60 min, cerrarla y devolver un mensaje de despedida.
  // 3) touchSession() antes de llamar al LLM.
  // 4) streamText() con system prompt + tools (de momento solo close_session).
  // 5) onFinish: persistir mensaje user + respuesta IA en tabla messages.

  // ... implementación concreta con AI SDK v6 ...
}
```

Tool `close_session` declarado en el mismo archivo (schema con Zod):
- Descripción: "Cierra la sesión actual. Usar solo cuando el paciente quiera terminar o se alcance el tiempo límite."
- Params: `{ reason: 'user_request' | 'time_limit' | 'crisis_detected' }`

Commit:
```bash
git add app/api/chat/route.ts
git commit -m "feat: chat streaming endpoint with session lifecycle"
```

---

## Task 7: Persistencia de mensajes

**Files:**
- Create: `lib/sessions/messages.ts`

Helper para insertar mensajes en `messages` (tabla ya creada en Plan 1).
- `saveUserMessage(conversationId, content, userId)`
- `saveAssistantMessage(conversationId, content, userId)` — se llama desde `onFinish` del stream.

Cada mensaje usa el `content_parts` schema (Zod discriminated union ya definido en `lib/types/messages.ts`).

Tests en `tests/sessions/messages.test.ts`.

Commit:
```bash
git add lib/sessions/messages.ts tests/sessions/messages.test.ts
git commit -m "feat: message persistence helpers"
```

---

## Task 8: UI de chat — componentes base

**Files:**
- Create: `components/chat/chat-view.tsx`
- Create: `components/chat/message-bubble.tsx`
- Create: `components/chat/chat-input.tsx`
- Create: `components/chat/crisis-banner.tsx`

Usar `useChat` del AI SDK v6. Props de `ChatView`: `sessionId`, `initialMessages`, `expiresAt`.

- `MessageBubble`: burbuja user (derecha, fondo oscuro) vs assistant (izquierda, fondo claro). Markdown simple.
- `ChatInput`: textarea auto-resize, botón enviar, Enter = submit, Shift+Enter = newline. Disabled si `expiresAt < now`.
- `CrisisBanner`: pie fijo con "Si estás en crisis: **Línea 024** (gratuito 24/7) · **112** (emergencias)". Discreto pero siempre visible.

Sin dependencias nuevas más allá de AI SDK + react-markdown (si hace falta).

Commit:
```bash
git add components/chat
git commit -m "feat: chat UI components (bubbles, input, crisis banner)"
```

---

## Task 9: Página `/app/sesion/[id]`

**Files:**
- Create: `app/app/sesion/[id]/page.tsx`

Server component:
- Lee la sesión por id, valida que pertenece al `user`.
- Si `status !== 'active'` → redirige a `/app` (o muestra vista read-only).
- Si sesión expiró (>60 min) → la cierra y redirige a `/app`.
- Lee `messages` de la conversación y pasa como `initialMessages` al `ChatView`.

```tsx
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // ... fetch sesión, mensajes ...
  return <ChatView sessionId={id} initialMessages={messages} expiresAt={expiresAt} />
}
```

Commit:
```bash
git add app/app/sesion
git commit -m "feat: session chat page"
```

---

## Task 10: Home `/app` — iniciar o continuar sesión

**Files:**
- Modify: `app/app/page.tsx`
- Create: `app/app/actions.ts`

Al cargar `/app` (solo paciente):
- Llama `getOrResolveActiveSession(user.id)`.
- Si hay activa → botón "Continuar tu sesión" + link a `/app/sesion/[id]`.
- Si no → botón "Iniciar nueva sesión" que llama server action `startSession()` → crea sesión y redirige a `/app/sesion/[id]`.

Mantener la vista actual para `role='clinician'`.

Commit:
```bash
git add app/app
git commit -m "feat: start or continue session from app home"
```

---

## Task 11: Aviso de tiempo y cierre automático

**Files:**
- Modify: `app/api/chat/route.ts`
- Modify: `components/chat/chat-view.tsx`

En el endpoint `/api/chat`:
- Calcular `minutosRestantes` antes de llamar al modelo.
- Si ≤ 10 → añadir al system prompt: "Quedan X minutos de la sesión. Empieza a cerrar si procede."
- Si ≤ 0 → cerrar sesión automáticamente y devolver mensaje de despedida ("Se ha alcanzado el límite de tiempo. He preparado las notas para que tu psicólogo las revise. Nos vemos en la próxima sesión.").

En UI:
- Contador visible arriba de la conversación ("45 min restantes").
- Cuando quedan ≤ 10 min: banner suave ("Queda poco tiempo en esta sesión").
- Cuando expira: input disabled + botón "Volver al inicio".

Commit:
```bash
git add app/api/chat/route.ts components/chat
git commit -m "feat: session time warnings and auto-close at 60min"
```

---

## Task 12: Cron / cierre lazy de sesiones abandonadas

**Files:**
- Create: `supabase/migrations/20260421000002_close_stale_sessions.sql` (opcional — función SQL)

Para no depender de un worker externo, el cierre de sesiones abandonadas se hace **lazy** (ya implementado en `getOrResolveActiveSession`). Además creamos una función SQL idempotente para limpieza masiva si se quiere ejecutar desde Supabase Scheduled Functions en el futuro:

```sql
create or replace function close_stale_sessions(threshold_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update sessions
  set status = 'abandoned',
      closed_at = now(),
      close_reason = 'inactivity'
  where status = 'active'
    and last_activity_at < now() - make_interval(mins => threshold_minutes);
  get diagnostics n = row_count;
  return n;
end;
$$;
```

Commit:
```bash
git add supabase/migrations/20260421000002_close_stale_sessions.sql
git commit -m "feat: SQL function to bulk close stale sessions"
```

---

## Task 13: Detección básica de crisis

**Files:**
- Create: `lib/chat/crisis-detector.ts`
- Create: `tests/chat/crisis-detector.test.ts`

Detector simple basado en regex sobre el **último mensaje del usuario**. Palabras clave en ES: "suicid", "quitarme la vida", "matarme", "no quiero vivir", "hacerme daño", "autolesión", etc.

Si detecta → el endpoint `/api/chat`:
- Prepende al system prompt el **protocolo de crisis** completo (de `docs/agents/protocols/crisis.md`).
- Guarda flag `crisis_flag=true` en el mensaje insertado.
- Muestra la Línea 024 **muy visiblemente** en la respuesta (la IA lo incluye textualmente).

**Esto es un guardarraíl minimal, NO un sistema de cribado clínico** — el cuestionario ASQ (Plan 4) es el que hace screening real.

Tests con casos positivos y negativos.

Commit:
```bash
git add lib/chat tests/chat
git commit -m "feat: keyword-based crisis detector with protocol injection"
```

---

## Task 14: Verificación final

- [ ] Tests: `npm test` (todos verdes).
- [ ] Build: `npm run build`.
- [ ] Smoke test manual:
  1. Login como paciente (de Plan 2).
  2. `/app` → "Iniciar nueva sesión" → `/app/sesion/[id]`.
  3. Escribir mensaje → respuesta streaming de la IA.
  4. Recargar página → conversación preservada.
  5. Cerrar pestaña, abrir a los 5 min → `/app` muestra "Continuar".
  6. Esperar > 30 min sin interactuar → `/app` muestra "Iniciar nueva".
  7. Decir a la IA "quiero hacerme daño" → responde con protocolo crisis + Línea 024.
  8. Pedirle "ya me tengo que ir" → llama tool `close_session` y cierra.
  9. Banner crisis visible en todo momento.

Commit final:
```bash
git commit --allow-empty -m "feat: Plan 3 chat and sessions complete"
```

---

## Deliverables

- Chat con streaming vía AI Gateway (`gpt-5.4-mini`).
- Sesiones con lifecycle 60 min + auto-close por inactividad 30 min.
- Docs `docs/agents/` editables por el psicólogo, linkadas al runtime.
- Detección básica de crisis + banner Línea 024 permanente.
- UI de chat funcional en `/app/sesion/[id]`.

**Siguiente:** Plan 4 — Cuestionarios embebidos y generación de informe/diagnóstico.
