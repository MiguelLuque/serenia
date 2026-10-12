# Hosted Supabase preflight — read-only handoff

Observed 2026-10-12 09:31–09:34 UTC. Source HEAD: `c345887015cb82d6211955c58b028b8819be5cb6`. Project: `brpozobkoatabctjjadc` (Serenia), organization `jhmhzzaqbzvvppwtwfhz`, region `eu-west-1`, PostgreSQL `17.6.1.104` / engine17 / ga. Organization FREE plan is prior root-agent metadata; it was not independently re-fetched by this agent.

**Read-only inspection complete; migration/connection/production gate remains blocked.** Following the root agent's one authorized restore, this agent observed COMING_UP → RESTORING → ACTIVE_HEALTHY, without repeating restore/restart. No remote mutation, API-key retrieval, credential read, clinical row retrieval, app deployment, new project/branch, or spending was performed. Main Next.js/Workflow application remains local; Supabase supplies DB/Auth and does not host this Next.js application.

## Exact aggregate evidence

A single SELECT/UNION query ran as `postgres`, `rolbypassrls=true`, `rolsuper=false`, at `2026-10-12 09:32:26.788615+00`. These are exact COUNT(*) values, not estimates or RLS-filtered patient counts.

| Relation | Exact rows |
| --- | ---: |
| auth.users | 2 |
| public.assessments | 0 |
| public.audit_log | 0 |
| public.care_plans | 0 |
| public.clinical_sessions | 0 |
| public.clinician_reviews | 0 |
| public.clinicians | 0 |
| public.consents | 0 |
| public.conversations | 0 |
| public.messages | 0 |
| public.patient_context_injections | 0 |
| public.patient_tasks | 0 |
| public.questionnaire_answers | 0 |
| public.questionnaire_definitions | 5 |
| public.questionnaire_instances | 0 |
| public.questionnaire_items | 65 |
| public.questionnaire_results | 0 |
| public.risk_events | 0 |
| public.session_summaries | 0 |
| public.user_clinician_assignments | 0 |
| public.user_profiles | 2 |

**The project is not empty:** two Auth accounts and two profiles exist. Their identities, roles, values and ownership were deliberately not inspected. All 17 other present non-catalog public tables in the count above have zero rows. The five definitions and 65 items are existing instrument catalog rows, whose actual text/configuration was not read. This snapshot does not prove nobody uses the project or that deletion is safe.

Compact list_tables returned estimated rows=0 even for auth.users, user_profiles, questionnaire_definitions and questionnaire_items. Those estimates cannot establish absence.

Public has 20 existing application tables, all RLS enabled, FORCE RLS false. Auth has 27 platform tables; recent OAuth/WebAuthn/SCIM/recovery tables report RLS false in their private Auth schema. That is metadata, not proof they are API-exposed. No `private` schema exists. `public.chat_turns`, `public.session_close_proposals` and `public.assessment_jobs` are absent, not empty. The proposed columns assessments.review_request_json/regeneration_previous_status, patient_tasks.source_task_index, consents.server_recorded, questionnaire_instances.submission_json/chat_request_id are also absent (catalog query returned zero rows).

Other observed schemas: extensions, graphql, graphql_public, realtime, storage, supabase_migrations, vault. Only relation metadata was enumerated there; their data counts and contents are unknown. No secrets or SQL/query logs were queried. Other Auth-table row counts are unknown; compact estimates are not used as evidence.

## History and content drift

Hosted: 40 migrations. Local: 45. Thirty-six version/name pairs match; 34 have equal coarse content fingerprints. Two same-version files differ; four additional historical migrations have different hosted timestamps and content. Five October files are genuinely pending. Thus a naive version-only comparison yields nine apparently absent local versions and four extra hosted versions; the four historical ones must not be replayed as new work.

Fingerprint method: hosted history returns only md5(array_to_string(statements, newline)), statement counts/lengths and MD5 after removing all whitespace and semicolons. Local SHA-256 is over exact file bytes. The coarse comparison ignores whitespace and semicolons even inside literals/comments; equality is evidence of matching normalized text, **not byte identity or a full semantic schema diff**. Differing hashes require review, not automatic history repair. Raw historical SQL was never returned.

| Local file | Exact local SHA-256 | Hosted version by matching name | Hosted joined-statement MD5 | Comparison |
| --- | --- | --- | --- | --- |
| 20260419000001_enums.sql | 9e3ca8546349e7340d373f53876c5d8c8f89abfc69139d9a0982c37e91dfa49b | 20260419000001 | cb2bebd88815d1b2d463885187ac616a | NORMALIZED_MATCH |
| 20260419000002_user_tables.sql | 16410380deae2a6dcf1d58b8612876e3f47d387bef643fc88a77ecaa101ec770 | 20260419000002 | d7f8066fc618d14ae6e6769fb0471fc7 | NORMALIZED_MATCH |
| 20260419000003_conversation_tables.sql | fc02ebc2ff6a7b6778047471901af3743b86e4248e95af20d85b9a381e59ed88 | 20260419000003 | a5a5e2c6fb76bb126fec6813cd4e4025 | NORMALIZED_MATCH |
| 20260419000004_questionnaire_tables.sql | 19222fec76fabef91c1850bc35a134f88840d4f99a218705400b7d20dbd6e965 | 20260419000004 | 6d55ea9c49907da3e47aedc9365bfa0b | NORMALIZED_MATCH |
| 20260419000005_clinical_tables.sql | db84e0ee23ff9d5daa27f4a599e12deb17f308e6e71c2a1f23d2661be63e2115 | 20260419000005 | 89c8d164afdf4a71b99af46cbebceb6a | NORMALIZED_MATCH |
| 20260419000006_v15_stubs.sql | d29e29b61217fb08a0e1930e40b4227c3c72ab3d606d94bde1256f34e6caa837 | 20260419000006 | 6503b34ed866a718118c15daef564d03 | NORMALIZED_MATCH |
| 20260419000007_updated_at_trigger.sql | 47f3ea622d4037c0fd8111553e483023f51c78be40c90e3a75f652579132aaaa | 20260419000007 | f5d1db6e3e0de7581a6e0df81b13be4a | NORMALIZED_MATCH |
| 20260419000008_rls_owner_only.sql | 225835c1d7a71144f04b37be28a5746f4b51ec1cd4c14fda6070a32436a80ef5 | 20260419000008 | 0e72c7f78981e5aa1a7214536a588597 | NORMALIZED_MATCH |
| 20260419000009_rls_public_and_restricted.sql | 25c6f9190229838b787750f69d1b8bb50eaed7772da45bb9bd7d58bb6c183dfb | 20260419000009 | 7f011544a8a2424f74f22c3bfa6b2172 | NORMALIZED_MATCH |
| 20260419000010_gdpr_erase.sql | dfa6064c0d6546634ad1bbeea90f40ab8590890efc646e74f9dfe1edf635b3cb | 20260419000010 | eaedd14e1cf6d6460219704176c5d1ce | NORMALIZED_MATCH |
| 20260420000001_user_profiles_extend.sql | d448d7ef92ecb8f3d497a3e97cece16def9b3c94ed75b3fcdb2e65efc0c167f3 | 20260420000001 | d151e3e1efd9b79ac46d108c735cee8e | NORMALIZED_MATCH |
| 20260420000002_user_profile_trigger.sql | 355602981279e2c81d35275ba92ba2fa1754f6bcd61fd7a3692c4b3dc213ea3d | 20260420000002 | 7376e06e064b1321df55ea57134f6fd9 | NORMALIZED_MATCH |
| 20260420000003_rls_clinician_read.sql | b393aff3be1ea9f46a0b6e6fb1101d4b3de2da2d3d5d92a47cb146392f1f5bf8 | 20260420000003 | 1f83ca4931b8ba435d3ccef89e2d0695 | NORMALIZED_MATCH |
| 20260421000001_clinical_sessions_extend.sql | 7a4f81329998b903a85d884c6edc16c0fcc6e9300442bd8888fa0588fdced3b6 | 20260421000001 | 26f4d9226f56d43eadb69325960a20df | NORMALIZED_MATCH |
| 20260421000002_close_stale_sessions.sql | f0045fd53a7354034c224fb564fadc02d60ab946b846c450f53c31f441cd64ee | 20260421000002 | 630e87d8e8369173075458391de5b1ee | NORMALIZED_MATCH |
| 20260421000003_messages_insert_own.sql | 35fd59e2f66fcc3c6a36f54bc440bf037bdd575d4d8fdf5664f65b25b09a1cce | 20260421000003 | d152d59d113d753b61565fbeb3e83532 | NORMALIZED_MATCH |
| 20260421000004_clinical_sessions_single_open.sql | 284d5748ec3d3b4eccea2fe48b05ca6a169dd1959eddf4ec357ad684581b8e9b | 20260421000004 | 50bd572bd0083a8ac18ae6948dd79e7e | NORMALIZED_MATCH |
| 20260422000001_seed_questionnaires.sql | e3651e1ef5c077ad1a3739ef7f3ea9b16854bdce891ad5c46caf05d873b9d776 | 20260422000001 | 7b04599461bbda09f47576c493be159a | NORMALIZED_MATCH |
| 20260422000002_questionnaire_answers_insert.sql | 0e5a3fa94350cfbb828fa434fb7fb9e3108950cd37b703255865ec80b1d45ea6 | 20260422000002 | 2121c5a43fc69b15792702f3adb07afd | NORMALIZED_MATCH |
| 20260422000003_questionnaire_results_risk_events_insert.sql | 4a2e80ace14a54dce37972b6de18953793e111a0f4031290ad532983ad240dce | 20260422000003 | 1c2fa8a0a0f515d7fd654d1559b7512c | NORMALIZED_MATCH |
| 20260422000004_assessments_insert_own.sql | c305e283b7ab3603ced659823deb9f7210a70900ef394c8d1babfcb86f94ec21 | 20260422000004 | 4cb081ddfbb35e67c3bbbf12f6c5dda1 | NORMALIZED_MATCH |
| 20260423000001_rls_clinician_write.sql | 24575832c7a1c790f0e6fd0edcdc47ca4ba9a660a9e5c21b5910fe27552575a3 | 20260423000001 | 95ebe3b75d52aee128dd9721aab92c59 | NORMALIZED_MATCH |
| 20260423000002_assessments_rejection_reason.sql | 628b1ad1aba09418bc21ed04b6c0a52a73a7a141ebd83b67fa520ffaeed2a57e | 20260423000002 | 5362406f7ad5fbafe0408cdc7e6dc698 | NORMALIZED_MATCH |
| 20260423000003_assessments_reviewed_by_auth_users.sql | 0fb140c4491b418f83768535f3c7af8cb33d7085fc8971095c6e8a9d00a96700 | 20260423000003 | ff0d520cdbb48cefa6353a6bee8f0338 | NORMALIZED_MATCH |
| 20260424000001_patient_tasks.sql | ab031f3eac9db26914ec10960c89871ce347d7318dca056c4e599eff64fe0854 | 20260424000001 | e08daddb87ee9cd70fb7ce405261d0d7 | NORMALIZED_MATCH |
| 20260424000002_indexes_patient_context.sql | beb755fc9b1ed975365d8ebc0043f25578530121964486db25cb7b93f18cbe26 | 20260424000002 | 86108a034bc5d17e828d7153aed17b5e | NORMALIZED_MATCH |
| 20260424000003_patient_context_injections.sql | ec8848dcb9ffa2c382d6d1ecd4b9e93f829951bebff82b6bdcc3d781229ec683 | 20260424000003 | 2d5400dcd953e73f3ba0702e9905d1ad | NORMALIZED_MATCH |
| 20260424000004_assessment_requires_manual_review.sql | 96e27bda7d377c023a38162d0d4cd363d360ae3bc9d8d6047490d8980fa012a5 | 20260424000004 | c24ec99b57d19021d4b13647fa8aac35 | NORMALIZED_MATCH |
| 20260426000001_assessments_clinical_notes.sql | b940a5ac2abf81b7d16649deecedf11c1382122cdb7db39e1e9d43cae7e1e09a | 20260426000001 | 5830622b76bfbf46c201e5aea42a469b | NORMALIZED_MATCH |
| 20260502000001_questionnaires_clinician_rated.sql | 52402bd7a8765bf0883ab18fd4507a08b7b1b971281cb2f3edfb8bd90d4ca153 | 20260502000001 | a55d3dc87de61c12bbf418b29fcd1eca | NORMALIZED_MATCH |
| 20260502000002_clinical_sessions_protocol_phase.sql | 465af2775b91cda503d360b1b78d3fc1a8c5323a37be8d40186780ad8f97298e | 20260502000002 | eb33b2fb5c756eb832b9e02d273be41f | NORMALIZED_MATCH |
| 20260502000003_user_profiles_intake_clinico.sql | f30b8c22ccddba0931205a7f09238ff1b62d7b378c711f812b7af60cfabcadd8 | 20260502000003 | d63bf0d56fd656202e87c09df5cc2ee3 | NORMALIZED_MATCH |
| 20260502000004_wipe_legacy_test_data.sql | 12fa0696a98825c023975a90d0565e9ff4c92b1bfcb9417b8d23b165aa1f4488 | 20260502000004 | d3f66adf379a4279447a6627efe19d0a | CONTENT_DIFFERENCE |
| 20260502000005_restore_preserved_profiles.sql | 9af34ea26d447726902edb209b086f429673efcf1533cbd624651459aea69b18 | 20260502000005 | e75d54df0dd6466be8191ded3039d44e | CONTENT_DIFFERENCE |
| 20260502000006_close_session_rpc.sql | b7907dc5b569e938d2a951a2a6fae3d0f3b421bfc1364029e4ea8ef4f9d8e993 | 20260502000006 | 3ff563f335d9387dfe72ef8d60cfd0d5 | NORMALIZED_MATCH |
| 20260502000007_hot_path_indices.sql | 4831986833ab7e4d45ef7fe837f75d835df247413405b494827eb4ae82c01907 | 20260502000007 | 3ce4080bd2fd6e9bc12c8a9adcbf4bef | NORMALIZED_MATCH |
| 20260503000001_seed_bdi2.sql | 0e9b4a652da95ac2d50909ca75ea0f25b7af0e4d496c46d13e8a2ae501620578 | 20260503204403 | 38f5f5e0382955de0fc941aa3dc722df | VERSION_AND_CONTENT_DIFFERENCE |
| 20260503000002_seed_bai.sql | a98091b4f4dee2a07e8d713514d3c7b46d5c498d70364f3358d0639f62b3cc0c | 20260516175534 | 34143b4c825ba4775e7424179dc481d8 | VERSION_AND_CONTENT_DIFFERENCE |
| 20260517000001_seed_cssrs.sql | f1cec56c78bb593b7e09878ac3ee6060daf3b4a1a793be6c461fd6c386d28d26 | 20260517151619 | 4f2fc5d05b4702b4fcc888704ca56256 | VERSION_AND_CONTENT_DIFFERENCE |
| 20260517000002_drop_asq.sql | f5cd32db145243de52abbcb31512ea9b43a434f01f4d8d4e432bcb253ba079a0 | 20260517153400 | f94f1328d4925f77e77be9893de1c514 | VERSION_AND_CONTENT_DIFFERENCE |
| 20261010075359_robust_authorization_review.sql | 91e1840c6a8d2c1f0ea086b3ffe7742859a49b5c55860dcb6401aeeac23e0c82 | absent | — | PENDING |
| 20261010123627_robust_chat_questionnaires_recovery.sql | 11d7b8d3b913624c4e6afd8720875bb9f1575848306af6d8f8746330a97c16ea | absent | — | PENDING |
| 20261010231957_patient_flows_acceptance_private_reports.sql | e3676f8e38a54ace7ee0f7177963849582cce6316c6b90383107ee0bae37663b | absent | — | PENDING |
| 20261012083833_acceptance_strict_function_lint.sql | d662ac2e2e188a76350d7a0656fa20696632240d4257f36ca159ddd58ea37bba | absent | — | PENDING |
| 20261012084307_acceptance_strict_rls_advisors.sql | 465eb192ef1595c046f3d392139a476ff740355de3f80680a17b5b5a9760e358 | absent | — | PENDING |

| Local version/name with drift | Hosted version | Local coarse MD5 | Hosted coarse MD5 |
| --- | --- | --- | --- |
| 20260502000004 wipe_legacy_test_data | 20260502000004 | bc926bd6e56187810210ded1d5280d3c | 6c47bfe4e8e65a2cf9c109dc69a1da53 |
| 20260502000005 restore_preserved_profiles | 20260502000005 | bf33163b81e619bb5de8858ab20d880f | bcf5ec56ac33daa01a7f07dc492b4cc2 |
| 20260503000001 seed_bdi2 | 20260503204403 | 9ad7ee99d770c318fb320aa6754283ee | 79080fe0a4ffdeed38cbaef74833f973 |
| 20260503000002 seed_bai | 20260516175534 | 738c3ad29f59d2cfd2b7f2f04361e8d8 | 0fcd6c0ee592096c5b99d3b6c3f387c4 |
| 20260517000001 seed_cssrs | 20260517151619 | fd97d764bf5a8cc6169e9e891f3447ba | ccc2ec73f8a2a99acaacd6694fcdc9f8 |
| 20260517000002 drop_asq | 20260517153400 | 26e430eec35c631750ed02ec30ea8e87 | 302b9f8b6187f1d414d0b42f86214e9a |

Same-version historical changes:
- `20260502000004_wipe_legacy_test_data`: local 402-byte reviewed no-op; hosted history has five statements / 5,357 joined characters. Local comments explicitly state historical installations retain their history and this no-op does not restore deleted data. Preserve the already-applied hosted record; do not replay/reset it.
- `20260502000005_restore_preserved_profiles`: local 377-byte generic INSERT of missing profiles; hosted history has two statements / 1,921 joined characters. Preserve the applied record; real historical identities were not read.
- Four seed/drop names differ in version and coarse content (BDI2 20260503204403, BAI 20260516175534, CSSRS 20260517151619, drop-ASQ 20260517153400). They are already recorded as applied hosted migrations. Their local counterparts include later wrappers/guards and cannot be assumed identical. Replaying seeds risks duplicated/conflicting catalog data; local drop-ASQ contains DELETE with cascading consequences. Any intended catalog delta must be separately reconciled and reviewed without changing approved prompts, cuts or bands.

Local Git provenance: historical sanitization is represented in commit `44c0c4c`; earlier wipe/restore commit `1f0c591`, BDI2 introduction `61ef35c`. No historical commit containing real identities was printed or edited.

## Pending October packet — exact order, not authorization to apply

1. `20261010075359_robust_authorization_review.sql`: revokes anon access and authenticated operational writes; narrows profile column grants and adds patient-only insert policy; rewrites clinician/closure/review/regeneration functions with explicit authorization/EXECUTE grants; revokes obsolete bulk closure; adds compound ownership/conversation FKs, unique constraints, answer-parent trigger, reviewer consistency check, source_task_index/review_request_json/regeneration_previous_status. Existing inconsistent ownership/review data deliberately causes failure. Locking/index/constraint validation must be considered even if clinical counts are currently zero. New cascades change future deletion behavior. No blanket data wipe.
2. `20261010123627_robust_chat_questionnaires_recovery.sql`: creates three RLS-protected operational tables restricted to service_role; adds questionnaire submission/request columns, partial indexes, timestamp default and open-message trigger; supplies atomic session/questionnaire/chat RPCs, token/lease fencing and assessment outbox dispatch/recovery. DML inside functions executes when called, not as a migration-wide bulk data update. New objects require exact baseline functions/FKs from step1; CREATE statements are not an idempotent reapply procedure.
3. `20261010231957_patient_flows_acceptance_private_reports.sql`: adds consent server_recorded=false default and withdraws direct consent writes; wraps/renames atomic RPCs with adult/current-acknowledgement checks; removes owner access to full assessments and exposes a bounded patient-facing projection; adds clinician-inbox/risk parity functions/indexes. Existing consent rows would become server_recorded=false; existing profiles require the current technical acknowledgement through the app. This is an application access change, not approval of legal consent. Functions depend on step2 contracts.
4. `20261012083833_acceptance_strict_function_lint.sql`: replaces GDPR erasure and close-turn function definitions to satisfy strict local function lint, preserving grants/contracts. The GDPR function contains audit actor tombstoning and deletion of auth.users with cascades **when explicitly invoked**; deploying its definition itself does not erase any account. Review any invocation separately; deletion cannot invalidate already issued JWTs by itself.
5. `20261012084307_acceptance_strict_rls_advisors.sql`: merges exact owner/clinician SELECT-policy baselines using OR and role applicability predicates, wraps auth.uid() calls in scalar subqueries, sets set_updated_at search_path. DO guards deliberately reject unexpected policy names/commands/roles; step1 must create conversations_read_owner/sessions_read_owner/instances_read_owner first. Current hosted baseline contains original ALL policies and 42 public policies; applying this file out of order must fail.

Each file's exact content hash is in the inventory above. Nothing in this packet authorizes a remote reset, auth-account deletion, direct data correction, migration-history repair, role change, or deployment.

## Hosted advisors — no warnings suppressed

Both advisor endpoints completed successfully at approximately 09:31:56 UTC. Counts are findings, not necessarily distinct vulnerabilities or rows.

### security

| Notice | Level | Findings | Entities | Remediation |
| --- | --- | ---: | --- | --- |
| function_search_path_mutable | WARN | 1 | public.set_updated_at | [Official remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) |
| anon_security_definer_function_executable | WARN | 5 | public.close_session_atomic, public.close_stale_sessions, public.handle_new_auth_user, public.is_clinician, public.rls_auto_enable | [Official remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) |
| authenticated_security_definer_function_executable | WARN | 5 | public.close_session_atomic, public.close_stale_sessions, public.handle_new_auth_user, public.is_clinician, public.rls_auto_enable | [Official remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| auth_leaked_password_protection | WARN | 1 | Auth | [Official remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |

### performance

| Notice | Level | Findings | Entities | Remediation |
| --- | --- | ---: | --- | --- |
| unindexed_foreign_keys | INFO | 25 | public.assessments.assessments_supersedes_assessment_id_fkey, public.assessments.fk_assessments_reviewed_by, public.care_plans.care_plans_user_id_fkey, public.clinical_sessions.fk_sessions_summary, public.clinician_reviews.clinician_reviews_assessment_id_fkey, public.clinician_reviews.clinician_reviews_clinician_id_fkey, public.clinicians.clinicians_user_id_fkey, public.consents.consents_user_id_fkey, public.conversations.conversations_user_id_fkey, public.conversations.fk_conversations_latest_summary, public.messages.messages_session_id_fkey, public.patient_context_injections.patient_context_injections_last_validated_assessment_id_fkey, public.patient_context_injections.patient_context_injections_session_id_fkey, public.patient_tasks.patient_tasks_acordada_en_assessment_id_fkey, public.patient_tasks.patient_tasks_closed_by_assessment_id_fkey, public.questionnaire_answers.questionnaire_answers_item_id_fkey, public.questionnaire_instances.questionnaire_instances_conversation_id_fkey, public.risk_events.risk_events_conversation_id_fkey, public.risk_events.risk_events_session_id_fkey, public.session_summaries.session_summaries_session_id_fkey, public.session_summaries.session_summaries_user_id_fkey, public.user_clinician_assignments.user_clinician_assignments_clinician_id_fkey, public.user_clinician_assignments.user_clinician_assignments_user_id_fkey, public.user_profiles.fk_user_profiles_care_plan, public.user_profiles.fk_user_profiles_last_assessment | [Official remediation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |
| auth_rls_initplan | WARN | 19 | public.user_profiles, public.consents, public.conversations, public.clinical_sessions, public.messages, public.session_summaries, public.questionnaire_instances, public.patient_tasks, public.questionnaire_answers, public.questionnaire_results, public.assessments, public.risk_events | [Official remediation](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan) |
| unused_index | INFO | 18 | public.messages, public.questionnaire_instances, public.risk_events, public.audit_log, public.patient_tasks, public.patient_context_injections, public.clinical_sessions, public.assessments | [Official remediation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) |
| multiple_permissive_policies | WARN | 67 | public.assessments, public.clinical_sessions, public.conversations, public.messages, public.patient_tasks, public.questionnaire_answers, public.questionnaire_instances, public.questionnaire_results, public.risk_events, public.user_profiles | [Official remediation](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies) |

Current public function ACL metadata:

| Function | SECURITY DEFINER | search_path | anon EXECUTE | authenticated EXECUTE | service_role EXECUTE | Body MD5 |
| --- | --- | --- | --- | --- | --- | --- |
| close_session_atomic(p_session_id uuid, p_user_id uuid, p_reason text) | true | search_path=public | true | true | true | ba4a2a01b7fcc376bca9a2c6b797af4d |
| close_stale_sessions(threshold_minutes integer) | true | search_path=public | true | true | true | 921d223f5c0fd4ac62681efee4d1a571 |
| gdpr_erase_user(target_user_id uuid) | true | search_path=public | false | false | true | 35f10e6ed183acb84eba1bbd5d4df395 |
| handle_new_auth_user() | true | search_path=public | true | true | true | 80b4cef3633f554d4c9aedcb4c57702f |
| is_clinician() | true | search_path=public | true | true | true | 0939d5669d5f3fffd8851f720eff35fa |
| rls_auto_enable() | true | search_path=pg_catalog | true | true | true | 99be20677b456ea8d3be47bdd44fb369 |
| set_updated_at() | false | unset | true | true | true | 9b1889f56258bf9d6554213c05019c76 |

All listed function owners are postgres. Anonymous callable privileged functions are concrete current exposure metadata; function bodies were not invoked/read. Trigger-return/event-trigger functions may not be directly invocable through PostgREST, so ACL warnings alone are not an exploit proof. Nevertheless they are not silently exempted.

The pending packet addresses anon access to close_session_atomic/is_clinician and obsolete close_stale_sessions, and mutable set_updated_at path. It does **not** remove public privileges on handle_new_auth_user or hosted-only rls_auto_enable, nor alter leaked-password protection. Some authenticated SECURITY DEFINER calls are intentional app contracts that still require ownership/clinician checks and a reviewed advisor decision. Hosted policy-role inventory can differ from the fixture's role inventory, affecting multiple-policy findings. Post-packet advisors must be rerun; local strict advisor PASS cannot be projected onto hosted.

The 25 uncovered FK findings are INFO, not permission to indiscriminately add indexes. The 18 unused indexes do not justify dropping indexes immediately after restore or with minimal historical traffic.

## Prerequisites, rollback and verification proposals

Before any external write:
1. Freeze a reviewed source commit and confirm all five hashes still match; obtain the main owner's Task6/app/DB verification evidence for that commit. This agent did not rerun its suites/build/local SQL.
2. Reconcile the six historical differences with a deployment manifest that preserves all 40 applied hosted records. Explicitly decide how local historical names are represented for this existing project. Do not invent `migration repair`, retimestamp, or mark unknown SQL applied merely to make lists agree. A normal blind push/seed/reset is blocked.
3. Inspect only necessary catalog definitions/constraints/grants or their hashes to resolve remaining schema drift. This handoff is not a full schema equivalence proof. Review the two hosted/platform function ACL warnings and Auth warning against current official docs; any necessary changes require their own forward migration/config packet and approval. Do not infer paid-plan availability or approve costs.
4. Establish a secure, tested recoverability plan for the two existing accounts/profiles and instrument catalog. Backup availability/retention and restore capability were not verified. Do not fetch/export clinical data or credentials under this read-only scope. Backups include sensitive data and require a specifically scoped handling plan. Existing FREE plan metadata is not proof of backup/PITR entitlement.
5. Approve the exact project and migration sequence, maintenance window, verification plan and isolated remote execution mechanism; the repository's local-only wrapper must not be bypassed casually. Connecting the local app needs separately scoped credentials/configuration handling; no .env.local/global credentials were read here.

Migration transaction failure should preserve that migration's state, but all five files must not be assumed one atomic transaction. If a later step fails, earlier committed migrations remain. Use tested reviewed forward corrections and keep the application stopped/compatible while repairing. Renames, privilege withdrawal and access-projection changes need explicit rollback SQL/compatibility testing before application. No arbitrary DROP, reverse policy broadening or account deletion as rollback; restoring a backup is a separate operation with data-loss/downtime implications and must be tested.

After approved execution, rerun read-only history/hash/schema/ACL/policy checks and exact counts. Confirm the two existing accounts/profiles are preserved and catalog is unchanged unless a separately reviewed delta exists. Run hosted security/performance advisors, fail closed on unreviewed warnings, and verify strict lint/types using an approved remote-compatible toolchain. Then perform consent/Auth/JWT/PostgREST owner/other-user/anon/clinician tests with specifically approved synthetic actors and cleanup that targets only those new actors. Validate local Next.js HTTP/browser + generated Workflow runtime/restart against hosted DB/Auth before claiming hosted integration. Those tests are future writes, not performed in this preflight.

## Sources and current limits

Repository operations: docs/operations/supabase.md and docs/operations/dependency-gates.md. Installed official Supabase/Postgres skills were read. [Supabase migration workflow](https://supabase.com/docs/guides/deployment/database-migrations) calls for migration-managed remote schema and serialized deployment. MCP search_docs retrieved [free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [upgrading/restore limits](https://supabase.com/docs/guides/platform/upgrading), and [local backup restoration](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup).

Changelog.md was attempted: web fetch rejected text/markdown; sandbox urllib GET failed DNS. Relevant current official docs and MCP search_docs succeeded. No implementation decisions or mutations were made under that limited changelog access.

No project/user memory entry was found in the quick registry search; no memory-derived fact is used. Status/history/counts/advisors/schema/ACL observations are live MCP evidence and may change. Auth Site URL, redirect allowlist, signup/email configuration, current Data API exposed schemas/grants beyond observed function ACLs, publishable/secret credentials, backup availability, project activity, complete schema equivalence, hosted application traffic and Next.js/Workflow hosted acceptance remain unverified.

## Additional hosted execution and fixture gates

Live follow-up trigger metadata (same read-only preflight): event trigger `ensure_rls`, event `ddl_command_end`, enabled `O`, owner postgres, invokes public.rls_auto_enable. Row trigger `on_auth_user_created` on auth.users, enabled `O`, relation owner supabase_auth_admin, invokes public.handle_new_auth_user. Both invoked SECURITY DEFINER functions are owned by postgres. Review platform ownership, creator/execution roles, inherited PUBLIC EXECUTE and trigger/event-trigger semantics before any grants change; an event trigger is not an ordinary RPC. PostgreSQL requires EXECUTE on the routine when creating/replacing a row trigger. A separate forward ACL proposal must preserve Auth signup and administrative DDL behavior and be tested with isolated synthetic actors; no grant was changed. [PostgreSQL CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html)

Current official documentation says leaked-password protection requires **Pro Plan or above**. Parent metadata reports FREE; eligibility cannot be treated as a free config switch. Verify current organization entitlement; a paid upgrade is a separate human decision. The warning remains unresolved, and no spend/config change was performed. [Supabase password security](https://supabase.com/docs/guides/auth/password-security)

MCP apply_migration accepts only name/project_id/query, with **no explicit version argument**. If applying through it stamps current versions instead of local filenames' versions, subsequent history diverges again. A version-preserving remote execution mechanism or explicitly reviewed canonical artifact mapping must be established first; do not invent post-hoc history repair.

Hosted fixtures must use cryptographically random passwords kept in private memory/files, never the local public test constant. Role changes must target only IDs generated by that approved run. A global clinician inbox can expose the two pre-existing profiles: constrain test data/reads to the run's own IDs and prevent existing profile/user values from being fetched/printed. Synthetic actor creation/role assignment/cleanup are future writes requiring their scoped packet; this preflight performed none.

Changelog cache review: the owner's today-fetched .cache/acceptance/supabase-changelog.md was read, 100,226 bytes, SHA-256 `958bf033618a6f7b920e3505f8e1fd2f861f6ceb8c687b4451aeff6c4a04ccd3`. This resolves the direct-fetch limitation noted above. Relevant breaking tags include Sep25 PostgreSQL15.19/17.11, Jul22 extension-version pinning, Apr28 public Data/GraphQL API grants. Current official release page describes rollout from PostgreSQL17.6 to17.11 and potential extension/custom-operator compatibility work; hosted metadata still reports17.6.1.104, so version support/security and extension compatibility remain a production follow-up. No upgrade was attempted. [PostgreSQL minor release](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes)

Current grant-change timeline says new projects use explicit grants from May30 and existing projects transition October30; this project predates May30. New tables in the five-file packet already carry explicit grants, but the project's live default-privilege/exposure configuration remains unverified. [Data/GraphQL API grant changes](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)


