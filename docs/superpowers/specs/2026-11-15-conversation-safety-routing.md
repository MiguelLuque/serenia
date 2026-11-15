# Conversation safety routing: contextual mentions and one-time clarification

## Purpose

Prevent a keyword match in a quote, media title, third-party account, clear denial, or figurative phrase from becoming a high-severity suicidal-ideation record or repeatedly taking over an otherwise ordinary conversation. Preserve a deterministic response to a direct current safety disclosure. This is operational conversation routing, not diagnosis or a validated screener.

## Evidence boundary

- NIMH describes a positive screen as a reason for a brief safety assessment by a trained clinician; it distinguishes current suicidal thoughts, plan, intent, past behavior, and other factors when deciding disposition. A lexical match in ordinary chat is not that screen or assessment.
- The Columbia Lighthouse Project describes C-SSRS as a structured set of plain-language questions for screening ideation and behavior. Serenia must not claim that its keyword rules reproduce or score C-SSRS.
- Pablo must review the wording, routing thresholds, clinician handoff, and pilot cases before any clinical use.

## Signal contract

The classifier returns one disposition and, where meaningful, a risk type:

| Disposition | Meaning | Conversation and persistence |
| --- | --- | --- |
| `none` | No configured safety cue matched. | Ordinary chat. |
| `contextual` | The cue is clearly quoted/attributed, media/educational, third-party, a clear denial, or a non-current historical reference without a current personal signal. | Ordinary chat; no crisis event, urgent interruption, or crisis closure. The complete user message remains available to the ordinary conversation and later clinician review. |
| `ambiguous` | A cue may concern the user now, but the text does not establish current intent or behavior. | Ask one brief, direct question for the relevant domain. Create no crisis event. Persist a server-only prompt marker. Accept a response category only when the database confirms the immediately preceding completed assistant turn contains the marker. `skip`/`unclear` must not be converted into a denial and must stop repetition. |
| `explicit_current` | The user's own statement explicitly indicates current suicidal ideation/intent/plan/behavior, or current intentional self-harm. | Return a deterministic, non-diagnostic safety response and relevant Spanish resources; create a provisional, correctly typed event for clinician review; do not call the model for this turn. It may interrupt an unresolved generation. Do not close the session solely because of this classification. Existing hard time limits remain authoritative. |

`riskType` is one of `suicidal_ideation`, `self_harm`, or `crisis_other`; it describes the reported topic, not a diagnosis. Preserve the existing operational `high` event for a direct current signal, but record `needs_clinician_review=true` and `interpretation=provisional_text_signal_not_diagnosis`; the label is a triage flag, not a clinical severity judgment. A yes to an ambiguity clarification is a separate moderate, prompt-linked signal and must not be mislabeled as a high-severity suicidal-ideation diagnosis.

Clear contextual evidence in one clause must not suppress a separate explicit current first-person disclosure in another clause. Clear negation alone must not suppress contradictory current intent, plan, means, or behavior. When clauses conflict and no direct current signal is established, ask once rather than resolving the contradiction automatically.

## Response contract

- For an ambiguous suicidal-ideation cue ask only whether the user is thinking about suicide now; for an ambiguous self-harm cue ask only whether the user is thinking about intentionally harming themselves now. Provide `sí`, `no`, `no lo sé`, and changing the topic as valid options.
- An affirmative answer creates a provisional moderate event using the risk type bound to the server prompt and routes to brief support/resources plus clinician review. It is not an automated assessment, severity score, or diagnosis.
- A negative answer is acknowledged without repeating the safety question. `unclear` is not a denial; acknowledge that the app cannot determine current danger, offer resources, and let the user change topic. `skip` follows the user's new topic and consumes the prompt so it cannot recur on the next turn.
- The stored prompt marker is untrusted if it comes from the HTTP request. Only a marker read from the immediately preceding server-stored completed response under the session lock can authorize a categorized answer. Retries replay the first stored category.

## Acceptance cases

1. Movie/series/title, education, an unendorsed quote, third-party report, and a clear denial remain in ordinary chat with no event or crisis closure.
2. A direct current first-person disclosure returns resources, records the correct provisional type, and is not diagnosed or auto-closed.
3. An ambiguous first-person cue receives one domain-specific question and no event; an affirmative is stored once with its prompt type, a negative is acknowledged, and unclear/skip does not cause repetition.
4. Forged, stale, superseded, or out-of-order prompt markers cannot classify a response. A repeated request cannot change a previously stored answer or create duplicate events.
5. Session time limits, ownership, replay, turn leases, and urgent interruption rules remain intact. Contextual cues do not bypass inactivity checks or convert time-limit closure into crisis closure.

## References

- [NIMH Adult Outpatient Brief Suicide Safety Assessment Guide](https://www.nimh.nih.gov/research/research-conducted-at-nimh/asq-toolkit-materials/adult-outpatient/adult-outpatient-brief-suicide-safety-assessment-guide)
- [Columbia Lighthouse Project: About the C-SSRS](https://cssrs.columbia.edu/the-columbia-scale-c-ssrs/about-the-scale/)
