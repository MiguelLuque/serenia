# Task 1 report — signal dispositions and answer candidates

## Implemented

- Added `classifyCrisisSignal` and exported disposition/risk types in `lib/shared/chat/crisis-detector.ts`; retained `detectCrisis` lexical matching and its return shape.
- Added `classifySafetyClarificationReply`, which preserves `skip` separately from `unclear` and only accepts unambiguous standalone yes/no replies.
- Added unit coverage for contextual Spanish/media/education/quoted/third-party/denial/historical mentions, direct current suicide and self-harm statements, mixed clauses, ambiguous statements, and clarification response categories.
- The routing helper is explicitly documented as conversation routing, not clinical severity inference or diagnosis.

## Verification

- RED: the new focused tests failed before helper implementation (missing exports).
- `rtk npx vitest run tests/chat/crisis-detector.test.ts`: passed, 35 tests.
- `rtk npm test`: 99 test files passed and 1 failed; 1,299 tests passed and 4 failed. All four failures were in `tests/tooling/dependency-integration.test.ts`, where child Node processes were denied listening on `127.0.0.1` (`listen EPERM: operation not permitted`).
- `rtk git diff --check`: passed.

## Independent review follow-up

- Review identified clause-wide context masking, topic precedence errors, missed current cutting, overconfident explicit routing for conflicted ideation, and a negative clarification phrasing gap.
- Added regression coverage first; RED: 8 requested cases failed before the fix.
- Reworked routing to classify cue-bearing clauses independently, prioritize an explicit personal current clause, prefer self-harm when that is the explicit clause, and leave uncertain/contradictory language ambiguous. Added current cutting and historical injury handling without inferring intentionality from `me hice daño hoy`.
- Clarification now recognizes `No, no estoy pensando en eso` as negative while compound or contradictory replies remain unclear.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 44 tests.
- Full suite: `rtk npm test` had 99 files pass and 1 fail; 1,308 tests passed and 4 failed. All four remain `tests/tooling/dependency-integration.test.ts` child-process localhost bind failures (`listen EPERM: operation not permitted 127.0.0.1`).
- Routing remains heuristic conversation triage, non-diagnostic, and not a validated screener.

## Task 1 follow-up: ordinary grooming and type narrowing

- Added failing cases for hair/nail grooming, mixed-context risk type, `No quiero vivir`, and unequivocal denials.
- RED: 6 assertions failed before the changes. Added grooming exclusions for ordinary `cortarme`/`me corto` language; current self-harm cases (`me corto ahora`, `me estoy cortando`) remain covered and pass.
- Ambiguous classification now preserves the risk type of the ambiguous clause, so an earlier contextual clause cannot overwrite it. `No quiero vivir` is ambiguous; direct denials such as `No quiero suicidarme` stay contextual.
- Added explicit `ClauseClassification`/`CrisisDisposition` typing to remove the prior TypeScript inference error.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 51 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,315 tests passed and 4 failed in `tests/tooling/dependency-integration.test.ts`. Each failure is a child Node server bind error, `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: grooming scope and negation

- Added RED tests for progressive hair/nail grooming, negation scope, clear future denials, and shared `quiero` scope across coordinated clauses; 7 assertions failed before the fix.
- `Me estoy cortando el pelo/uñas` now remains `none`. `No quiero dejar de pensar en suicidarme` and `No quiero dejar de autolesionarme` remain ambiguous. `No voy a suicidarme` and `No voy a autolesionarme` are contextual denials. Coordinated `Quiero cortarme el pelo y quitarme la vida` retains the explicit suicidal-ideation clause.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 58 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,322 tests passed and 4 failed. All four failures remain child-process bind denials in `tests/tooling/dependency-integration.test.ts`: `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: clause boundaries and explicit-current threshold

- Added the re-review cases first; RED: 7 test cases failed before the fix.
- Clause boundaries now retain whether a clause follows a clear `y` coordination or punctuation/other connector. Positive `quiero` carries only over `y`, and never from a negated clause. Semicolon clauses do not inherit intent.
- `No quiero dejar de...` and `No voy a dejar de...` remain ambiguous. Clear `No voy a suicidarme/autolesionarme` remains contextual. Broad wishes to disappear or end everything no longer cross the `explicit_current` threshold on their own.
- Accepted direct personal statements remain explicit; coordinated positive intent with `quitarme la vida` or `matarme` remains explicit.
- Focused suite: 70 tests passed. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,334 passed and 4 failed. All four are in `tests/tooling/dependency-integration.test.ts` due child Node servers receiving `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: explicit intent and behavior boundary

- Added RED coverage for temporal broad expressions and explicit plan, intent, and behavior phrases. Seven cases failed before the update.
- Temporal words no longer elevate broad/figurative `desaparecer` or `acabar con todo` language. Added direct patterns for stated plan, imminent intent, current cutting, current intentional harm, and current self-injury while preserving `me hice daño hoy` as ambiguous.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 77 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,341 passed and 4 failed in `tests/tooling/dependency-integration.test.ts`. All failures report `listen EPERM: operation not permitted 127.0.0.1` for child Node servers.

## Task 1 follow-up: direct denials and additional explicit statements

- Added RED tests for six direct negations, six additional personal intent/plan statements, and a denial followed by a positive clause. Eleven assertions failed before implementation.
- Explicit routing now requires an affirmative, direct intent/plan/behavior pattern; direct negation cannot satisfy it. Positive clauses after a separate denial remain eligible and retain priority. Added Spanish patterns for first-person suicide intent, planned self-harm, and stated current behavior.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 90 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,354 passed and 4 failed in dependency integration. Child processes fail binding localhost with exact error `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: scoped negation and self-harm direct signals

- Added RED cases for `no dejo de`, `no me atrevo`, `no solo quiero`, direct self-harm ideation/plan, and mixed explicit suicidal/self-harm clauses; 7 cases failed before the change.
- Replaced broad negation suppression with specific clear-denial patterns. Other negative constructions remain ambiguous; `no solo quiero` is read as direct affirmative desire. Added direct self-harm ideation, intent and plan phrases. Explicit suicidal ideation takes precedence over self-harm when both clauses are explicit, independent of order.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 98 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,362 passed and 4 failed in dependency integration. Child Node listeners are blocked with `listen EPERM: operation not permitted 127.0.0.1`.

## Scope and limitations

The classifier uses deterministic lexical/context patterns. It does not infer clinical severity and is not a validated screener. The broad linguistic limits of those heuristics remain for later review; this task intentionally does not modify persistence, route behavior, migrations, or protocol documentation.

## Task 1 follow-up: categorical negation and combined topics

- Added RED tests for `nunca/jamás` denials, uncertain `no creo que quiera`, both orders of combined suicidal-ideation/self-harm cues in one clause, and retained `no solo quiero` affirmation.
- Clear denial now requires a narrowly matched negative predicate; uncertainty remains ambiguous. When both cue families occur in one clause, suicidal ideation wins consistently.
- Focused suite: `rtk npx vitest run tests/chat/crisis-detector.test.ts` passed, 103 tests. `rtk npm run typecheck` passed.
- Full suite: 99 files passed, 1 failed; 1,367 passed and 4 failed in dependency integration. Child listeners return `listen EPERM: operation not permitted 127.0.0.1`.

## Task 1 follow-up: restrict `no solo quiero` intent

- Added regression coverage preserving `No solo quiero suicidarme` as explicit while routing `No solo quiero hablar de suicidio` as contextual conversation content. RED reproduced the second case as incorrectly explicit.
- Narrowed the `no solo quiero` direct-intent alternative to recognized self-directed acts and marked ordinary discussion about suicide as contextual.
- Focused suite: 104 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. The full suite was not rerun for this regex-only follow-up.

## Task 1 follow-up: conversation topic vs personal intent

- Added RED coverage for direct suicidal ideation embedded in a conversational-topic phrase, ordinary talk about suicide, and an attributed third-party quote. The two personal-intent cases failed before the fix.
- Split broad conversational context from third-party attribution. Topic mentions no longer suppress a separate direct personal intent in the same clause; explicit attribution to another person still routes contextually.
- Focused suite: 107 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. The full suite was not rerun for this narrow classifier follow-up.

## Task 1 follow-up: attribution structure

- Added RED coverage for a companion mention alongside personal intent, an attributed direct quote, and a third-party belief about the user's intent. The companion and belief cases failed before the change.
- Attribution now requires a third-party subject followed by a speech/belief verb. A quote remains contextual; a third-party belief about the user's risk remains ambiguous; incidental companion mentions no longer suppress explicit personal intent.
- Focused suite: 111 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite was not rerun for this narrow classifier follow-up.

## Task 1 follow-up: attributed quote boundaries

- Added RED tests for quotes introduced by `mi amigo me dijo` / `mi madre dijo`, plus direct intent followed by a friend's belief about the speaker. All three assertions failed before the fix.
- Quote attribution now requires a third-party subject at clause start followed by a reporting verb, including a first-person recipient (`me dijo`). Belief attribution only applies when it leads the clause. A later attribution about another matter no longer suppresses direct intent.
- Focused suite: 114 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite was not rerun for this bounded change.

## Task 1 follow-up: broader reported-speech subjects

- Added RED cases for `un amigo`, `mi pareja`, and `mi compañero` reporting a quoted statement; all three initially routed explicit.
- Expanded only the clause-leading attribution grammar with these subject forms and reporting verbs. Incidental later third-party mentions remain outside the attribution rule, preserving direct personal intent.
- Focused suite: 117 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this narrow fix.

## Task 1 follow-up: quoted punctuation in attribution

- Added RED cases for third-party quotes wrapped in Spanish/typographic quotation marks and introduced with a colon; both initially classified as explicit.
- Attribution matching now trims only surrounding quotation marks before checking the clause-leading subject/reporting verb. A direct personal clause after the quote remains explicit.
- Focused suite: 120 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this narrow adjustment.

## Task 1 follow-up: prevent intent propagation from quotes

- Added RED cases for two intents coordinated inside a third-party quote, quoted intent followed by a separate self-harm clause, and the equivalent speaker-owned coordinated intent.
- Clause splitting now respects quote boundaries, so conjunctions inside quotes do not create artificial clauses. Shared `quiero` inheritance is also disabled when its source clause has a third-party attribution lead.
- Focused suite: 123 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this targeted change.

## Task 1 follow-up: postposed quote attribution

- Added RED cases for quote-first clauses followed by a reporting verb and third-party subject, plus a later direct personal disclosure after that attribution.
- A quote clause is now linked to the immediately following clause only when it is quote-delimited and that clause begins with a supported reporting verb plus third-party subject. This keeps attributed content contextual without suppressing later direct personal intent.
- Focused suite: 126 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this narrow change.

## Task 1 follow-up: indirect-object postposed attribution

- Added RED cases for `me dijo mi amigo` and `me contó mi pareja` following a quoted clause; both failed before the update. Existing positive coordinated first-person intent remains covered.
- The postposed attribution lead now allows an immediate indirect-object `me` before the reporting verb while still requiring a following third-party subject.
- Focused suite: 128 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this narrow update.
- Expanded follow-up verification covered adjacent `dijo/dice`, `contó/cuenta`, and `comentó/comenta` in both attribution orders, with and without `me`, including quote wrappers. A later incidental reporting verb still preserves direct intent. Final focused suite: 141 tests passed; typecheck and diff check passed.

## Task 1 follow-up: causal clauses and postposed pronouns

- Added RED cases for quoted third-party intent followed by personal intent after `porque`, the same quote without personal intent, and postposed `dijo él/ella` attribution. The mixed-intent and pronoun cases failed before implementation.
- `porque` now separates clauses so quote attribution cannot suppress a separate personal signal. Postposed reporting clauses also recognize `él/ella` as third-party subjects.
- Focused suite: 145 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this targeted change.

## Task 1 follow-up: quote spans and speaker-owned intent

- Added RED cases for introductory/punctuated quote attribution, quote then a new sentence with personal intent, quoted non-risk wording followed by a risk cue, topic-discussion intent sharing, and speaker self-harm plus a third-party suicide quote.
- Quoted cue spans now contribute contextual evidence, then only adjacent reporting lead/tail is removed before classifying speaker clauses. Sentence punctuation is a boundary. Shared `quiero` inheritance is limited to direct speaker intent or grooming; quoted intent and broad topic discussion cannot authorize it.
- The `porque` own-intent case and direct coordinated signals remain covered and pass. Focused suite: 151 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this targeted follow-up.

## Task 1 follow-up: resolve quote provenance before routing

- Added RED cases for an unattributed quote (ambiguous), an affirmative own-thought frame (explicit), a negated/third-party thought frame (ambiguous), and nested explicit third-party attribution (contextual). Four cases failed before the fix.
- Quoted risk cues are no longer contextual by default. The helper checks adjacent/embedded third-party reporting, known media framing, and affirmative/negative own-thought framing before assigning a candidate. Only attributed or media quote spans are contextual; uncertain provenance is ambiguous; an affirmative own frame is evaluated with its quoted content.
- Focused suite: 156 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this targeted follow-up.

## Task 1 follow-up: context scope, thought frames, and open quotes

- Added RED cases for remote media context, own affirmative and negative thought frames, `dice que` third-party framing, and an unclosed quote after a reporting lead. Five assertions failed before the fix.
- Media context now requires a nearby title relation rather than any earlier media noun. `No pienso:` is treated as a negative frame and remains ambiguous; third-party `dice que` is likewise uncertain. Unclosed quotes are parsed as spans, allowing a clear third-party reporting lead to establish contextual attribution.
- Focused suite: 161 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this scoped follow-up.

## Task 1 follow-up: nested quote spans and evidence reduction

- Added the requested matrix for root intent endorsement, uncertain outer wrappers around nested reporting, direct reporting inside/outside wrappers, postposed attribution, speaker intent after a quote, and risk-type separation. Two cases failed before the span-level fix.
- Replaced whole-envelope attribution with nested quote spans. Each span is classified after masking child spans; a report only attributes the immediately contained quote. Root own-intent endorsement is handled separately, and the final reducer keeps disposition and risk type from the same evidence.
- Verified root own-intention suffixes only in the supported `es mi intención` frame; generic suffix words such as `es` do not become media context. Media titles remain contextual.
- Focused suite: 169 tests passed. `rtk npm run typecheck` and `rtk git diff --check` passed. Full suite not rerun for this scoped update.
