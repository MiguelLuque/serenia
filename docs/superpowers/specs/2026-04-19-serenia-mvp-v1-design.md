# Serenia — MVP v1 — Design Spec

**Date:** 2026-04-19
**Status:** Draft, pending user review
**Scope:** MVP v1 (user-side only). Clinician panel deferred to v1.5.

---

## 1. Product Overview

Serenia is a conversational app specialised in anxiety and depression screening and longitudinal follow-up. Users interact with an AI assistant that can administer validated clinical questionnaires (PHQ-9, GAD-7, ASQ), score them deterministically on the backend, interpret results in conversation, and flag risk situations. AI-generated assessments are always marked as preliminary and pending professional review — the product language never claims diagnosis.

**What the product does:**
- Anxiety and depression symptom screening
- Longitudinal follow-up and trend detection
- Conversational support and psychoeducation
- Structured session summaries
- Suicide/self-harm risk screening and crisis protocol

**What the product does NOT do:**
- Autonomous definitive diagnosis
- Medication recommendations
- Replace a clinical evaluation
- Solve active crises autonomously (it triages and escalates)

---

## 2. Scope

### In MVP v1
- End-user auth (email + password)
- Informed consent (versioned) + age gate (≥18)
- Conversational chat with streaming AI responses
- Embedded questionnaires (PHQ-9, GAD-7, ASQ) rendered inline in the chat
- Deterministic scoring, severity banding, result persistence
- Session open/close with structured summaries
- Cross-session continuity via snapshots (not full-history replay)
- AI-generated preliminary assessments marked `pending_clinician_review`
- Risk detection (classifier + keyword + PHQ-9 item 9) and crisis protocol
- User dashboard: past conversations, past questionnaires, past assessments
- GDPR right-to-erasure flow

### Out of MVP v1 (reserved for v1.5+)
- Clinician web panel and review workflow
- Clinician assignments
- Care plans (table stub only)
- Payments / subscriptions
- Multi-language (ES-ES only for MVP)
- Mobile native app
- PDF export
- Push notifications
- Minors support

### Explicitly not in this project
- No SQL access exposed to the LLM
- No direct LLM scoring of questionnaires
- No diagnosis-claiming UI copy

---

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | Next.js 16, App Router, TypeScript | RSC + Server Actions + Route Handlers |
| UI | shadcn/ui + Tailwind | |
| LLM orchestration | Vercel AI SDK | Provider-agnostic abstraction (see §5) |
| LLM provider (initial) | Anthropic (Claude Sonnet 4.6 + Haiku 4.5) | Swappable via config |
| Backend | Supabase | Postgres + Auth + RLS |
| Region | EU (eu-central-1 or eu-west) | GDPR |
| Deploy | Vercel | |
| Testing | Vitest | Scoring and clinical logic unit-tested |

---

## 4. Architecture Overview

```
┌─ Next.js (App Router) ──────────────────────────────┐
│  RSC + Client Components + shadcn                   │
│  ├─ Server Actions / Route Handlers                 │
│  │  (all sensitive work lives here, never client)   │
│  └─ Vercel AI SDK (useChat, streaming)              │
└─────────────┬───────────────────────────────────────┘
              │
┌─ LLM Orchestrator (server-side) ────────────────────┐
│  ├─ Context Builder (snapshot + last N messages)    │
│  ├─ llm.conversational()  — chat turn               │
│  ├─ llm.fast()            — summaries + classifier  │
│  └─ Tool Handlers                                   │
│     (get_snapshot, propose_q, get_q_result,         │
│      summarize_session, generate_assessment_draft,  │
│      evaluate_risk_signal, activate_risk_protocol)  │
└─────────────┬───────────────────────────────────────┘
              │
┌─ Clinical Logic (pure TS, unit-tested) ─────────────┐
│  scoring(PHQ9), scoring(GAD7), scoring(ASQ),        │
│  severity bands, risk rules, context-snapshot       │
│  assembler                                          │
└─────────────┬───────────────────────────────────────┘
              │
┌─ Supabase ──────────────────────────────────────────┐
│  Postgres (+ enums, RLS) + Auth + Storage (minimal) │
└─────────────────────────────────────────────────────┘
```

### Key architectural decisions

1. **The LLM never talks to Supabase directly.** All tool calls go through server handlers that validate session, apply business rules, and use service-role only for privileged ops (summaries, assessment generation, risk events, audit). User-owned reads go through the user's authenticated client + RLS.

2. **Scoring lives in TypeScript, not Postgres.** PHQ-9/GAD-7/ASQ algorithms as unit-testable TS modules. Persistence of result is a transactional Supabase RPC that writes `answers` + `result` atomically.

3. **Messages are discriminated JSON.** `messages.parts` is a `jsonb` array of parts (type discriminator: `text | questionnaire_render | questionnaire_result | risk_alert | tool_invocation`). Same shape in DB, server API, and client — Zod-typed in `lib/types/messages.ts`.

4. **Risk preempts.** A fast classifier (Haiku + keyword filter) runs before every assistant turn. If risk is detected, normal conversation is interrupted: a `risk_alert` part is emitted, a `risk_event` row is created, and crisis resources are rendered.

5. **Continuity by snapshot, not by history replay.** On session close, Haiku produces a structured summary. On reopen, the context builder sends only `case_snapshot + last session summary + last 6–10 messages`. Full history is never re-sent to the LLM.

6. **Streaming.** Assistant replies are streamed via AI SDK `streamText`. Tool results (questionnaire render, result card, risk alert) arrive as non-streamed structured parts and are inserted into the message stream.

---

## 5. LLM Portability Layer

Goal: the choice of provider/model is a configuration decision, not a refactor.

### Abstraction

**Single abstraction: Vercel AI SDK.** It already is a multi-provider standard. `streamText`, `generateText`, `generateObject`, and `tool()` behave uniformly across Anthropic, OpenAI, Google, Mistral, Groq.

**On top: internal role-based layer in `lib/llm/`.**

```ts
// lib/llm/models.ts
export const llm = {
  conversational: () => <LanguageModel>,   // main chat turn
  fast:           () => <LanguageModel>,   // summaries + classifier
  structured:     () => <LanguageModel>,   // generateObject payloads
};
```

The rest of the codebase requests `llm.conversational()`. Nobody imports `@ai-sdk/anthropic` outside `lib/llm/`. Switching from Claude to GPT or Gemini = change `models.ts` + env vars.

### Rules to stay portable

1. **No `@ai-sdk/<provider>` imports outside `lib/llm/`.** Enforced by PR review (optionally by eslint-plugin-import `no-restricted-paths`).
2. **Prompts in plain Markdown**, no Anthropic-specific XML tags. Markdown is the common-denominator style across providers.
3. **Tool definitions are AI SDK-native** with Zod schemas. Portable across providers.
4. **Provider-specific optimisations** (prompt caching, thinking tokens, etc.) live only inside `lib/llm/`, behind per-provider feature flags, invisible to callers.
5. **Config via env:**
   - `LLM_CONVERSATIONAL_PROVIDER`, `LLM_CONVERSATIONAL_MODEL`
   - `LLM_FAST_PROVIDER`, `LLM_FAST_MODEL`
   - `LLM_STRUCTURED_PROVIDER`, `LLM_STRUCTURED_MODEL`
6. **Risk classifier** defaults to `llm.fast()` but is a pluggable strategy. Swappable for a local model later without touching callers.

### Deferred options (not in MVP)
- Vercel AI Gateway sitting in front of all providers (fallbacks, mirroring, dashboard-level routing). Adding it later means changing `baseURL` inside `lib/llm/`, nothing else.

### Anti-patterns avoided
- No custom `LLMClient` interface wrapping AI SDK. That reintroduces what AI SDK already gives and adds maintenance cost.
- No custom streaming event protocol. AI SDK `UIMessage` is the standard.

---

## 6. Data Model

All tables have `id uuid pk default gen_random_uuid()` (or `uuidv7()` if extension is enabled — optimisation pendiente), `created_at timestamptz default now()`, and (where mutable) `updated_at timestamptz` with trigger.

### User & consent
- **`user_profiles`** — extends `auth.users`. Columns: `user_id (fk)`, `display_name`, `locale`, `timezone`, `current_focus`, `last_known_risk_level`, `active_care_plan_id (null, fk reserved)`, `consent_version`, `consent_given_at`, `onboarding_status`, `risk_profile_status`, `baseline_summary`, `last_reviewed_assessment_id (null, fk reserved)`.
- **`consents`** — append-only. Columns: `user_id`, `consent_version`, `accepted_at`, `payload_json` (what was consented to).

### Conversation & messages
- **`conversations`** — `user_id`, `title`, `status (active|closed|archived)`, `started_at`, `ended_at`, `latest_session_summary_id`.
- **`clinical_sessions`** — `conversation_id`, `user_id`, `status (open|paused|closed)`, `opened_at`, `closed_at`, `closure_reason`, `summary_id (null)`.
- **`messages`** — `conversation_id`, `session_id (null)`, `role (user|assistant|tool|system)`, `parts jsonb`, `visible_to_user bool`, `created_at`. `parts` is a Zod-typed discriminated union: `text | questionnaire_render | questionnaire_result | risk_alert | tool_invocation`.
- **`session_summaries`** — `session_id`, `user_id`, `summary_json` (see Appendix B), `generated_by (ai|clinician)`.

### Questionnaires
- **`questionnaire_definitions`** — `code (PHQ9|GAD7|ASQ)`, `name`, `domain`, `version`, `language`, `is_active`, `scoring_strategy`, `source_reference`, `instructions_json`. Public read to authenticated users.
- **`questionnaire_items`** — `questionnaire_id`, `order_index`, `prompt`, `response_type`, `options_json`, `numeric_value_map_json`, `is_required`, `risk_flag_rule`.
- **`questionnaire_instances`** — `user_id`, `conversation_id`, `session_id`, `questionnaire_id`, `triggered_by (ai|clinician|schedule|user)`, `trigger_reason`, `status (proposed|in_progress|submitted|scored|cancelled)`, `started_at`, `submitted_at`, `scored_at`.
- **`questionnaire_answers`** — `instance_id`, `item_id`, `answer_raw`, `answer_numeric`, `answered_at`.
- **`questionnaire_results`** — `instance_id`, `total_score`, `severity_band`, `subscores_json`, `flags_json`, `interpretation_json`, `requires_review bool`.

### Clinical assessments
- **`assessments`** — `user_id`, `session_id`, `generated_by (ai|clinician)`, `assessment_type (intake|follow_up|closure|review)`, `summary_json`, `status (draft_ai|pending_clinician_review|reviewed_confirmed|reviewed_modified|rejected|superseded)`, `review_status`, `reviewed_by (null, fk reserved)`, `reviewed_at`, `supersedes_assessment_id (null)`.

### Risk
- **`risk_events`** — `user_id`, `conversation_id`, `session_id`, `source_type (message|questionnaire|manual_review)`, `risk_type (suicidal_ideation|self_harm|severe_distress|...)`, `severity`, `payload_json`, `status (open|acknowledged|escalated|closed)`, `acknowledged_at`, `closed_at`. Service-role write; user read-only.

### Audit
- **`audit_log`** — `actor_type (user|service|system)`, `actor_id`, `entity_type`, `entity_id`, `action`, `diff_json`. Append-only, service-role write only. Users cannot read.

### Reserved for v1.5 (schema created, empty, RLS denies all)
`clinicians`, `user_clinician_assignments`, `clinician_reviews`, `care_plans`. Created so FKs (`assessments.reviewed_by`, `user_profiles.active_care_plan_id`) are satisfied from day one.

### Enums (Postgres native, not CHECK constraints)
`conversation_status`, `session_status`, `questionnaire_instance_status`, `assessment_status`, `review_status`, `risk_severity`, `risk_status`, `risk_type`, `generated_by_source`, `assessment_type`, `trigger_source`.

### RLS strategy summary
- `user_profiles`, `consents`, `conversations`, `messages`, `clinical_sessions`, `session_summaries`, `questionnaire_instances`, `questionnaire_answers`, `questionnaire_results`, `assessments`, `risk_events`: **owner-only** via `user_id = auth.uid()`.
- `questionnaire_definitions`, `questionnaire_items`: **read to all authenticated**, no write for users.
- `audit_log`: **deny all** to clients. Service-role only.
- `clinicians` et al.: deny all in MVP. Policies added in v1.5.
- **Service-role** bypasses RLS — used only in Route Handlers / Server Actions for: writing assistant messages, scoring, summaries, assessment drafts, risk events, audit.

### Deletion and GDPR
- Soft delete (`deleted_at`) for normal user flows (delete conversation, archive, etc.).
- **Hard delete** only via `gdpr_erase_user(user_id)` RPC (service-role). Cascades across all owned tables; replaces `audit_log.actor_id` with a stable tombstone UUID to preserve tamper-evidence without retaining PII.

---

## 7. Tool Catalog (LLM)

Every tool is a server-side handler invoked by the LLM via AI SDK `tool()`. Handlers validate session ownership, apply rules, return Zod-validated JSON.

### Context / continuity
| Tool | Purpose |
|---|---|
| `get_case_snapshot()` | Longitudinal summary, last assessment, recent scores, open alerts, active plan |
| `get_recent_questionnaire_results({ codes?, within_days? })` | Filtered recent results |
| `get_assessment_timeline()` | Chronology of assessments visible to user |

### Questionnaires
| Tool | Purpose |
|---|---|
| `list_eligible_questionnaires({ context })` | Which questionnaires are proposable given frequency rules, recent history, signals |
| `propose_questionnaire({ code, reason })` | Creates `questionnaire_instance(proposed)`, returns render payload for the chat |
| `get_questionnaire_result({ instance_id })` | Returns scored result |

### Session closure
| Tool | Purpose |
|---|---|
| `summarize_session({ session_id })` | Haiku-generated structured summary (see Appendix B) |
| `generate_assessment_draft({ session_id })` | Creates `assessment` in `draft_ai` → `pending_clinician_review` |

### Risk
| Tool | Purpose |
|---|---|
| `evaluate_risk_signal({ text })` | Classifier + keyword → `{ risk_detected, severity, reasons[] }` |
| `activate_risk_protocol({ severity, source })` | Creates `risk_event`, returns ES crisis resources (024, 112) + protocol script |

### Tools deliberately not exposed
- No free SQL, no `query_database`
- No direct `write_assessment` — only `generate_assessment_draft` which runs deterministic logic
- No `delete_*` — deletions only through UI Server Actions or the GDPR RPC

### Frontend Server Actions (not LLM tools)
- `submitQuestionnaireAnswers(instanceId, answers)` — validates ownership, scores, persists, returns result
- `createConversation()`, `closeSession(sessionId, reason)`
- `eraseMyData()` — triggers GDPR cascade

---

## 8. Key Flows

### 8.1 User message → AI response
1. Client POSTs message to `/api/chat` (streaming).
2. Server validates session, persists user message.
3. Server runs **risk classifier** (`llm.fast()` + keyword filter) on the user message.
4. If risk → preempt: insert `risk_alert` part + `risk_event`, stream crisis protocol, end turn.
5. Otherwise, context builder assembles `system_prompt + case_snapshot + last_session_summary + last 6–10 messages + tool_definitions`.
6. `streamText` with `llm.conversational()`. Claude may emit tool calls; server executes iteratively.
7. Stream back to client. All parts persisted to `messages.parts` at turn end.

### 8.2 Embedded questionnaire
1. Assistant calls `propose_questionnaire({ code, reason })`. Server creates instance `proposed`, returns definition.
2. Assistant emits a `questionnaire_render` part. Client renders it as a shadcn form inline.
3. User submits → Server Action `submitQuestionnaireAnswers` → deterministic scoring in TS → write `answers` + `result` transactionally.
4. Client inserts a `questionnaire_result` part into the thread and triggers the next LLM turn with the result in context.
5. If `result.flags` includes suicidal ideation (PHQ-9 item 9 ≥ 1) → server triggers `activate_risk_protocol` before continuing.

### 8.3 Session close & resume
1. Close trigger: explicit (button) or implicit (inactivity 30 min). Server Action `closeSession`.
2. Backend runs `summarize_session` (`llm.fast()`) → writes `session_summaries`.
3. If the session included new questionnaires → `generate_assessment_draft` → `assessments` in `pending_clinician_review`.
4. Reopen: new session, context builder loads `snapshot + last summary + last N messages`. Full history is never re-sent.

### 8.4 Risk
- Signal sources: free-text message (classifier), PHQ-9 item 9 ≥ 1, GAD-7 very high + hopelessness language.
- Response: interrupt normal conversation, emit sticky `risk_alert` part with **024** (línea de atención a la conducta suicida, ES), **112** emergencies, immediate grounding steps. Optionally launch ASQ screening.
- Create `risk_event` with `status=open`. User must acknowledge the alert to dismiss it.

### 8.5 Onboarding
- Register (email + password) → consent screen (versioned) → sign `consents` → age gate (≥18) → optional baseline (PHQ-9 + GAD-7).

---

## 9. Non-Functional Requirements

### Clinical safety
- UI copy never claims diagnosis. Uses: *cribado*, *evaluación preliminar*, *resumen de síntomas*.
- AI assessments always labelled *Generada por IA — Pendiente de revisión*.
- PHQ-9 item 9 ≥ 1 always triggers risk protocol.
- ASQ administered whenever the risk classifier flags + user consents to the screening.
- Questionnaires (ES version) require clinician review before production. Tracked in §10.

### Privacy & GDPR
- EU-hosted Supabase region.
- Consent is versioned and append-only.
- Right to erasure: `gdpr_erase_user` RPC + UI flow.
- `audit_log` append-only, immutable to users.
- Data Processing Agreements required with Supabase, Anthropic, Vercel (user's operational responsibility, not in code).
- PII minimisation: no real name required; display_name optional.

### Frequency rules
- PHQ-9 / GAD-7: no re-administration within 14 days unless clinical change is detected or user requests.
- ASQ: on-demand, triggered by risk signals.

### Performance
- First token latency target: <1.5s (Sonnet streaming).
- Classifier latency: <400ms (Haiku).
- Session reopen context build: <300ms (single Postgres round trip + one summary row).

### Observability
- Structured logs per tool call (tool name, duration, user_id, outcome). No message content in logs.
- Cost tracking per model role via AI SDK usage metadata.

---

## 10. Open Clinical Tasks (pre-production)

These are outside code scope but must be resolved before a real user uses Serenia:
- Clinician validates Spanish versions of PHQ-9, GAD-7, ASQ (wording, instructions, scoring).
- Clinician validates severity band thresholds and interpretation copy.
- Clinician validates risk protocol script and the classifier's false-negative tolerance.
- Legal review of consent text and GDPR flow.
- DPAs signed with Supabase, Anthropic, Vercel.

---

## Appendix A — `messages.parts` schema (Zod)

```ts
type MessagePart =
  | { type: "text"; text: string }
  | { type: "questionnaire_render"; instanceId: string; code: QuestionnaireCode;
      title: string; description: string; items: QuestionnaireItemRender[]; submitLabel: string }
  | { type: "questionnaire_result"; instanceId: string; code: QuestionnaireCode;
      totalScore: number; severityBand: SeverityBand; summary: string; flags: Flag[] }
  | { type: "risk_alert"; severity: RiskSeverity; resources: CrisisResource[];
      protocolScript: string; requiresAcknowledgement: true }
  | { type: "tool_invocation"; toolName: string; state: "pending" | "result" | "error";
      input?: unknown; output?: unknown };
```

## Appendix B — `session_summaries.summary_json` schema

```json
{
  "session_id": "sess_123",
  "user_state_summary": {
    "main_topics": ["ansiedad anticipatoria", "insomnio"],
    "reported_changes": ["más nervios desde hace una semana"],
    "functional_impact": ["dificultad para concentrarse en el trabajo"]
  },
  "questionnaires_administered": [
    { "code": "GAD7", "score": 11, "severity": "moderate" }
  ],
  "risk_summary": { "risk_detected": false, "risk_level": "low" },
  "recommended_next_steps": [
    "seguimiento en 7 días",
    "revisar sueño",
    "evaluar PHQ-9 si persiste bajo estado de ánimo"
  ]
}
```

## Appendix C — Directory layout (planned)

```
serenia/
├─ app/
│  ├─ (auth)/login, register, consent
│  ├─ (app)/chat, history, assessments, settings
│  └─ api/chat/route.ts
├─ components/            # shadcn + app-specific
├─ lib/
│  ├─ llm/                # portability layer
│  │  ├─ models.ts        # roles: conversational, fast, structured
│  │  ├─ config.ts        # env → provider+model resolution
│  │  ├─ prompts/         # markdown prompts
│  │  ├─ tools/           # AI SDK tool definitions
│  │  └─ classifiers/
│  │     └─ risk.ts
│  ├─ clinical/
│  │  ├─ scoring/         # PHQ9, GAD7, ASQ
│  │  ├─ severity.ts
│  │  └─ risk-rules.ts
│  ├─ supabase/
│  │  ├─ client.ts        # authenticated client
│  │  ├─ server.ts        # service-role client (server-only)
│  │  └─ rpc/             # typed RPC wrappers
│  ├─ types/
│  │  └─ messages.ts      # parts discriminated union (Zod)
│  └─ context/
│     └─ builder.ts       # case snapshot assembler
├─ supabase/
│  ├─ migrations/
│  └─ seed/               # questionnaire definitions (PHQ-9, GAD-7, ASQ)
├─ tests/                 # vitest
└─ docs/
```
