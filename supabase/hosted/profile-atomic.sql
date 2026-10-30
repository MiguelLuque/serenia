-- Single atomic Management query only. No target mutation or transaction split.
set local lock_timeout = '10s';
set local statement_timeout = '120s';
set local search_path = public, pg_temp;
lock table auth.users, supabase_migrations.schema_migrations in share row exclusive mode;
create temporary table profile_baseline(expected jsonb not null, expected_new jsonb not null) on commit drop;
revoke all on table pg_temp.profile_baseline from public, anon, authenticated, service_role;
insert into pg_temp.profile_baseline values ('{"capturedAt":"2026-10-30","target":{"projectId":"brpozobkoatabctjjadc","organizationId":"jhmhzzaqbzvvppwtwfhz","region":"eu-west-1","plan":"Free"},"counts":{"auth":3,"items":65,"profiles":3,"definitions":5},"catalog":[{"code":"BAI","items":21,"items_sha256":"910666dd581db8a7b92bf4694c54c47045b039328792f5390d06381bc497a1a6","definition_sha256":"bd76a03f6132e819a8a0fc35f769fc694ae3c1b68a1ed427ee05a3e9bd13c8ca"},{"code":"BDI2","items":21,"items_sha256":"47b02e0550f8e2f4322c9326f22a69e8df54718b1b8d4fde598e4b27cf94ebde","definition_sha256":"ba5c841ecda95dcd3cc34b944f6989a79a05e6689e461bc8748233f6f156de02"},{"code":"CSSRS","items":7,"items_sha256":"238a8604a0fdeab09913ce3c230c7723948ff95b4b39292ef775d55b47b3f238","definition_sha256":"017eb76248c16cbb8729dd417d033efb670987a42d2608c39ef0c0897a2ea9ef"},{"code":"GAD7","items":7,"items_sha256":"8ea077be305a2a046ec9f131344bc6585161fdf9cfa5a04d31785ff57f3d9933","definition_sha256":"a38c258a1aa0bf85d62cbc573caa8ff48ec168e0238e3b9194309d7e652786c7"},{"code":"PHQ9","items":9,"items_sha256":"248aca918cdc8298fab08cbb1866b1380268af87c7b1130253cb43f38c2490f9","definition_sha256":"a2e8acf28de4a85dea7192af3720316dc2127efdb9abd550ddc6105a36a13d21"}],"history":[{"name":"enums","version":"20260419000001","statements_md5":"cb2bebd88815d1b2d463885187ac616a"},{"name":"user_tables","version":"20260419000002","statements_md5":"d7f8066fc618d14ae6e6769fb0471fc7"},{"name":"conversation_tables","version":"20260419000003","statements_md5":"a5a5e2c6fb76bb126fec6813cd4e4025"},{"name":"questionnaire_tables","version":"20260419000004","statements_md5":"6d55ea9c49907da3e47aedc9365bfa0b"},{"name":"clinical_tables","version":"20260419000005","statements_md5":"89c8d164afdf4a71b99af46cbebceb6a"},{"name":"v15_stubs","version":"20260419000006","statements_md5":"6503b34ed866a718118c15daef564d03"},{"name":"updated_at_trigger","version":"20260419000007","statements_md5":"f5d1db6e3e0de7581a6e0df81b13be4a"},{"name":"rls_owner_only","version":"20260419000008","statements_md5":"0e72c7f78981e5aa1a7214536a588597"},{"name":"rls_public_and_restricted","version":"20260419000009","statements_md5":"7f011544a8a2424f74f22c3bfa6b2172"},{"name":"gdpr_erase","version":"20260419000010","statements_md5":"eaedd14e1cf6d6460219704176c5d1ce"},{"name":"user_profiles_extend","version":"20260420000001","statements_md5":"d151e3e1efd9b79ac46d108c735cee8e"},{"name":"user_profile_trigger","version":"20260420000002","statements_md5":"7376e06e064b1321df55ea57134f6fd9"},{"name":"rls_clinician_read","version":"20260420000003","statements_md5":"1f83ca4931b8ba435d3ccef89e2d0695"},{"name":"clinical_sessions_extend","version":"20260421000001","statements_md5":"26f4d9226f56d43eadb69325960a20df"},{"name":"close_stale_sessions","version":"20260421000002","statements_md5":"630e87d8e8369173075458391de5b1ee"},{"name":"messages_insert_own","version":"20260421000003","statements_md5":"d152d59d113d753b61565fbeb3e83532"},{"name":"clinical_sessions_single_open","version":"20260421000004","statements_md5":"50bd572bd0083a8ac18ae6948dd79e7e"},{"name":"seed_questionnaires","version":"20260422000001","statements_md5":"7b04599461bbda09f47576c493be159a"},{"name":"questionnaire_answers_insert","version":"20260422000002","statements_md5":"2121c5a43fc69b15792702f3adb07afd"},{"name":"questionnaire_results_risk_events_insert","version":"20260422000003","statements_md5":"1c2fa8a0a0f515d7fd654d1559b7512c"},{"name":"assessments_insert_own","version":"20260422000004","statements_md5":"4cb081ddfbb35e67c3bbbf12f6c5dda1"},{"name":"rls_clinician_write","version":"20260423000001","statements_md5":"95ebe3b75d52aee128dd9721aab92c59"},{"name":"assessments_rejection_reason","version":"20260423000002","statements_md5":"5362406f7ad5fbafe0408cdc7e6dc698"},{"name":"assessments_reviewed_by_auth_users","version":"20260423000003","statements_md5":"ff0d520cdbb48cefa6353a6bee8f0338"},{"name":"patient_tasks","version":"20260424000001","statements_md5":"e08daddb87ee9cd70fb7ce405261d0d7"},{"name":"indexes_patient_context","version":"20260424000002","statements_md5":"86108a034bc5d17e828d7153aed17b5e"},{"name":"patient_context_injections","version":"20260424000003","statements_md5":"2d5400dcd953e73f3ba0702e9905d1ad"},{"name":"assessment_requires_manual_review","version":"20260424000004","statements_md5":"c24ec99b57d19021d4b13647fa8aac35"},{"name":"assessments_clinical_notes","version":"20260426000001","statements_md5":"5830622b76bfbf46c201e5aea42a469b"},{"name":"questionnaires_clinician_rated","version":"20260502000001","statements_md5":"a55d3dc87de61c12bbf418b29fcd1eca"},{"name":"clinical_sessions_protocol_phase","version":"20260502000002","statements_md5":"eb33b2fb5c756eb832b9e02d273be41f"},{"name":"user_profiles_intake_clinico","version":"20260502000003","statements_md5":"d63bf0d56fd656202e87c09df5cc2ee3"},{"name":"wipe_legacy_test_data","version":"20260502000004","statements_md5":"d3f66adf379a4279447a6627efe19d0a"},{"name":"restore_preserved_profiles","version":"20260502000005","statements_md5":"e75d54df0dd6466be8191ded3039d44e"},{"name":"close_session_rpc","version":"20260502000006","statements_md5":"3ff563f335d9387dfe72ef8d60cfd0d5"},{"name":"hot_path_indices","version":"20260502000007","statements_md5":"3ce4080bd2fd6e9bc12c8a9adcbf4bef"},{"name":"seed_bdi2","version":"20260503204403","statements_md5":"38f5f5e0382955de0fc941aa3dc722df"},{"name":"seed_bai","version":"20260516175534","statements_md5":"34143b4c825ba4775e7424179dc481d8"},{"name":"seed_cssrs","version":"20260517151619","statements_md5":"4f2fc5d05b4702b4fcc888704ca56256"},{"name":"drop_asq","version":"20260517153400","statements_md5":"f94f1328d4925f77e77be9893de1c514"},{"name":"serenia_robust_mvp_hosted_atomic","version":"20261024092459","statements_md5":"952ebca2d68a0d53dbf19b22ce9a094e"},{"name":"serenia_final_inbox_pending_review","version":"20261024092547","statements_md5":"1664276978cd2f2d5f5174ae7f8095cb"},{"name":"serenia_review_questionnaire_facts_immutable","version":"20261024203657","statements_md5":"1e0166c24c07a91a872e3f42ecd4426c"}],"platform":{"authOwner":"supabase_auth_admin","rlsRoutine":{"acl":"{postgres=X/postgres,service_role=X/postgres,supabase_admin=X/postgres,supabase_auth_admin=X/postgres}","owner":"postgres","config":["search_path=pg_catalog"],"language":"plpgsql","signature":"public.rls_auto_enable()","volatility":"v","definition_md5":"6998ea6b4c2480f5d2e34b5dcf3f8d36","security_definer":true},"authTriggers":[{"name":"on_auth_user_created","enabled":"O","definition":"CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user()"}],"eventTriggers":[{"name":"ensure_rls","tags":["CREATE TABLE","CREATE TABLE AS","SELECT INTO"],"event":"ddl_command_end","owner":"postgres","enabled":"O","function":"rls_auto_enable()"},{"name":"issue_graphql_placeholder","tags":["DROP EXTENSION"],"event":"sql_drop","owner":"supabase_admin","enabled":"O","function":"set_graphql_placeholder()"},{"name":"issue_pg_cron_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"grant_pg_cron_access()"},{"name":"issue_pg_graphql_access","tags":["CREATE FUNCTION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"grant_pg_graphql_access()"},{"name":"issue_pg_net_access","tags":["CREATE EXTENSION"],"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"grant_pg_net_access()"},{"name":"pgrst_ddl_watch","tags":null,"event":"ddl_command_end","owner":"supabase_admin","enabled":"O","function":"pgrst_ddl_watch()"},{"name":"pgrst_drop_watch","tags":null,"event":"sql_drop","owner":"supabase_admin","enabled":"O","function":"pgrst_drop_watch()"}]},"tableNames":["assessment_jobs","assessments","audit_log","care_plans","chat_turns","clinical_sessions","clinician_reviews","clinicians","consents","conversations","messages","patient_context_injections","patient_tasks","questionnaire_answers","questionnaire_definitions","questionnaire_instances","questionnaire_items","questionnaire_results","risk_events","session_close_proposals","session_summaries","user_clinician_assignments","user_profiles"],"clinicalCounts":{"consents":0,"messages":0,"audit_log":0,"care_plans":0,"clinicians":0,"assessments":0,"risk_events":0,"conversations":0,"patient_tasks":0,"clinical_sessions":0,"clinician_reviews":0,"session_summaries":0,"questionnaire_answers":0,"questionnaire_results":0,"questionnaire_instances":0,"patient_context_injections":0,"user_clinician_assignments":0},"tableFingerprint":"5bb2da4e3fde2707e166f92a819702c0","routineSignatures":["public.assessment_summary_valid_for_risk(doc jsonb)","public.begin_chat_turn(p_session_id uuid, p_user_id uuid, p_request_id text, p_text text, p_crisis boolean, p_urgent boolean)","public.begin_chat_turn_after_onboarding(p_session_id uuid, p_user_id uuid, p_request_id text, p_text text, p_crisis boolean, p_urgent boolean)","public.claim_assessment_jobs(p_limit integer, p_session_id uuid)","public.close_chat_turn(p_session_id uuid, p_request_id text, p_token uuid, p_reason text)","public.close_session_atomic(p_session_id uuid, p_user_id uuid, p_reason text)","public.close_stale_sessions(threshold_minutes integer)","public.complete_patient_onboarding(p_informal_name text, p_pronouns text, p_birth_date date, p_reason text, p_version text, p_accepted boolean)","public.create_questionnaire_atomic(p_session_id uuid, p_user_id uuid, p_conversation_id uuid, p_code text, p_reason text, p_request_id text, p_token uuid)","public.create_session_after_onboarding(p_user_id uuid)","public.create_session_atomic(p_user_id uuid)","public.derive_patient_risk_state_sql(p_reviewed_at timestamp with time zone, p_suicidality text, p_critical boolean, p_latest_open timestamp with time zone, p_latest_high timestamp with time zone, p_previous_at timestamp with time zone, p_previous_reason text, p_now timestamp with time zone)","public.fail_chat_turn(p_session_id uuid, p_request_id text, p_token uuid, p_error text)","public.finish_assessment_job(p_session_id uuid, p_token uuid, p_status text, p_summary jsonb)","public.finish_chat_turn(p_session_id uuid, p_request_id text, p_token uuid, p_parts jsonb, p_chunks jsonb, p_proposal text, p_close_reason text)","public.gdpr_erase_user(target_user_id uuid)","public.get_chat_turn_recovery(p_session_id uuid)","public.get_clinician_inbox_page(p_offset integer, p_limit integer, p_pending_only boolean)","public.get_onboarding_ready()","public.get_patient_session_reports(p_session_ids uuid[])","public.handle_new_auth_user()","public.is_clinician()","public.patient_onboarding_ready(p_user_id uuid)","public.recover_assessment_jobs(p_limit integer)","public.regenerate_assessment_atomic(p_assessment_id uuid, p_expected_status text, p_restore boolean)","public.require_open_message_session()","public.review_assessment_atomic(p_session_id uuid, p_assessment_id uuid, p_action text, p_summary jsonb, p_notes text, p_inherited_updates jsonb, p_reason text)","public.rls_auto_enable()","public.set_updated_at()","public.start_questionnaire_atomic(p_instance_id uuid, p_user_id uuid)","public.submit_questionnaire_atomic(p_instance_id uuid, p_user_id uuid, p_answers jsonb, p_result jsonb, p_risk_severity text)","public.touch_session_atomic(p_session_id uuid)","public.update_assessment_job(p_session_id uuid, p_token uuid, p_action text, p_run_id text)","public.validate_answer_parent()"],"routineFingerprint":"dc3fe3cfc12a9d1c52bdbd9f56de27d9","profileObjectsAbsent":true}'::jsonb, '{"tables":[{"acl":"{postgres=arwdDxtm/postgres,service_role=r/postgres}","rls":true,"name":"profile_extraction_jobs","owner":"postgres","columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"user_id","type":"uuid","default":null,"notnull":true},{"name":"source_message_id","type":"uuid","default":null,"notnull":true},{"name":"session_id","type":"uuid","default":null,"notnull":true},{"name":"conversation_id","type":"uuid","default":null,"notnull":true},{"name":"source_created_at","type":"timestamp with time zone","default":null,"notnull":true},{"name":"consent_epoch","type":"bigint","default":null,"notnull":true},{"name":"status","type":"text","default":"''pending''::text","notnull":true},{"name":"token","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"lease_until","type":"timestamp with time zone","default":null,"notnull":false},{"name":"attempts","type":"integer","default":"0","notnull":true},{"name":"available_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true},{"name":"run_id","type":"text","default":null,"notnull":false},{"name":"error_code","type":"text","default":null,"notnull":false},{"name":"extractor_version","type":"text","default":"''profile-v1''::text","notnull":true},{"name":"model_id","type":"text","default":null,"notnull":false},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true}],"indexes":[{"name":"profile_extraction_jobs_pkey","definition":"CREATE UNIQUE INDEX profile_extraction_jobs_pkey ON public.profile_extraction_jobs USING btree (id)"},{"name":"profile_extraction_jobs_source_message_id_key","definition":"CREATE UNIQUE INDEX profile_extraction_jobs_source_message_id_key ON public.profile_extraction_jobs USING btree (source_message_id)"},{"name":"profile_job_conversation_owner_index","definition":"CREATE INDEX profile_job_conversation_owner_index ON public.profile_extraction_jobs USING btree (conversation_id, user_id)"},{"name":"profile_job_observation_source","definition":"CREATE UNIQUE INDEX profile_job_observation_source ON public.profile_extraction_jobs USING btree (id, user_id, source_message_id, source_created_at)"},{"name":"profile_job_one_active_user","definition":"CREATE UNIQUE INDEX profile_job_one_active_user ON public.profile_extraction_jobs USING btree (user_id) WHERE (status = ANY (ARRAY[''enqueued''::text, ''running''::text]))"},{"name":"profile_job_pending_order","definition":"CREATE INDEX profile_job_pending_order ON public.profile_extraction_jobs USING btree (user_id, source_created_at, id) WHERE (status = ANY (ARRAY[''pending''::text, ''enqueued''::text, ''running''::text]))"},{"name":"profile_job_session_owner_index","definition":"CREATE INDEX profile_job_session_owner_index ON public.profile_extraction_jobs USING btree (session_id, user_id)"}],"policies":null,"triggers":[{"name":"validate_profile_source","enabled":"O","definition":"CREATE TRIGGER validate_profile_source BEFORE INSERT OR UPDATE ON public.profile_extraction_jobs FOR EACH ROW EXECUTE FUNCTION validate_profile_source()"}],"force_rls":false,"constraints":[{"name":"profile_extraction_jobs_attempts_check","definition":"CHECK (((attempts >= 0) AND (attempts <= 3)))"},{"name":"profile_extraction_jobs_consent_epoch_check","definition":"CHECK ((consent_epoch >= 0))"},{"name":"profile_extraction_jobs_error_code_check","definition":"CHECK ((error_code = ANY (ARRAY[''processing_failed''::text, ''claims_exhausted''::text, ''consent_withdrawn''::text])))"},{"name":"profile_extraction_jobs_extractor_version_check","definition":"CHECK ((extractor_version = ''profile-v1''::text))"},{"name":"profile_extraction_jobs_pkey","definition":"PRIMARY KEY (id)"},{"name":"profile_extraction_jobs_source_message_id_key","definition":"UNIQUE (source_message_id)"},{"name":"profile_extraction_jobs_status_check","definition":"CHECK ((status = ANY (ARRAY[''pending''::text, ''enqueued''::text, ''running''::text, ''completed''::text, ''cancelled''::text, ''exhausted''::text])))"},{"name":"profile_extraction_jobs_user_id_fkey","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"},{"name":"profile_job_active_lease","definition":"CHECK (((status = ANY (ARRAY[''enqueued''::text, ''running''::text])) = (lease_until IS NOT NULL)))"},{"name":"profile_job_conversation_owner","definition":"FOREIGN KEY (conversation_id, user_id) REFERENCES conversations(id, user_id) ON DELETE CASCADE"},{"name":"profile_job_observation_source","definition":"UNIQUE (id, user_id, source_message_id, source_created_at)"},{"name":"profile_job_session_owner","definition":"FOREIGN KEY (session_id, user_id) REFERENCES clinical_sessions(id, user_id) ON DELETE CASCADE"},{"name":"profile_job_source","definition":"FOREIGN KEY (source_message_id, session_id, conversation_id, source_created_at) REFERENCES messages(id, session_id, conversation_id, created_at) ON DELETE CASCADE"}]},{"acl":"{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=r/postgres}","rls":true,"name":"profile_observations","owner":"postgres","columns":[{"name":"id","type":"uuid","default":"gen_random_uuid()","notnull":true},{"name":"job_id","type":"uuid","default":null,"notnull":true},{"name":"user_id","type":"uuid","default":null,"notnull":true},{"name":"source_message_id","type":"uuid","default":null,"notnull":true},{"name":"source_created_at","type":"timestamp with time zone","default":null,"notnull":true},{"name":"category","type":"text","default":null,"notnull":true},{"name":"quote","type":"text","default":null,"notnull":true},{"name":"time_scope","type":"text","default":null,"notnull":true},{"name":"supersedes_id","type":"uuid","default":null,"notnull":false},{"name":"status","type":"text","default":"''pending''::text","notnull":true},{"name":"created_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true}],"indexes":[{"name":"profile_observation_owner_recent","definition":"CREATE INDEX profile_observation_owner_recent ON public.profile_observations USING btree (user_id, source_created_at DESC, id DESC)"},{"name":"profile_observation_source_message","definition":"CREATE INDEX profile_observation_source_message ON public.profile_observations USING btree (source_message_id)"},{"name":"profile_observation_target_index","definition":"CREATE INDEX profile_observation_target_index ON public.profile_observations USING btree (supersedes_id, user_id)"},{"name":"profile_observations_id_user_id_key","definition":"CREATE UNIQUE INDEX profile_observations_id_user_id_key ON public.profile_observations USING btree (id, user_id)"},{"name":"profile_observations_job_id_category_quote_key","definition":"CREATE UNIQUE INDEX profile_observations_job_id_category_quote_key ON public.profile_observations USING btree (job_id, category, quote)"},{"name":"profile_observations_pkey","definition":"CREATE UNIQUE INDEX profile_observations_pkey ON public.profile_observations USING btree (id)"}],"policies":[{"cmd":"SELECT","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"tablename":"profile_observations","permissive":"PERMISSIVE","policyname":"profile_observations_owner","schemaname":"public","with_check":null}],"triggers":[{"name":"validate_profile_observation","enabled":"O","definition":"CREATE TRIGGER validate_profile_observation BEFORE INSERT OR UPDATE ON public.profile_observations FOR EACH ROW EXECUTE FUNCTION validate_profile_observation()"}],"force_rls":false,"constraints":[{"name":"profile_observation_source","definition":"FOREIGN KEY (job_id, user_id, source_message_id, source_created_at) REFERENCES profile_extraction_jobs(id, user_id, source_message_id, source_created_at) ON DELETE CASCADE"},{"name":"profile_observation_target","definition":"FOREIGN KEY (supersedes_id, user_id) REFERENCES profile_observations(id, user_id) ON DELETE SET NULL (supersedes_id)"},{"name":"profile_observations_category_check","definition":"CHECK ((category = ANY (ARRAY[''concern''::text, ''goal''::text, ''context''::text, ''functioning''::text, ''resource''::text, ''preference''::text, ''history''::text, ''agreement''::text])))"},{"name":"profile_observations_check","definition":"CHECK ((supersedes_id IS DISTINCT FROM id))"},{"name":"profile_observations_id_user_id_key","definition":"UNIQUE (id, user_id)"},{"name":"profile_observations_job_id_category_quote_key","definition":"UNIQUE (job_id, category, quote)"},{"name":"profile_observations_pkey","definition":"PRIMARY KEY (id)"},{"name":"profile_observations_quote_check","definition":"CHECK (((char_length(quote) >= 1) AND (char_length(quote) <= 400)))"},{"name":"profile_observations_status_check","definition":"CHECK ((status = ANY (ARRAY[''pending''::text, ''confirmed''::text, ''rejected''::text, ''superseded''::text])))"},{"name":"profile_observations_time_scope_check","definition":"CHECK ((time_scope = ANY (ARRAY[''current''::text, ''historical''::text, ''unspecified''::text])))"},{"name":"profile_observations_user_id_fkey","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"}]},{"acl":"{postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=r/postgres}","rls":true,"name":"profile_settings","owner":"postgres","columns":[{"name":"user_id","type":"uuid","default":null,"notnull":true},{"name":"enabled","type":"boolean","default":"false","notnull":true},{"name":"consent_epoch","type":"bigint","default":"0","notnull":true},{"name":"updated_at","type":"timestamp with time zone","default":"clock_timestamp()","notnull":true}],"indexes":[{"name":"profile_settings_pkey","definition":"CREATE UNIQUE INDEX profile_settings_pkey ON public.profile_settings USING btree (user_id)"}],"policies":[{"cmd":"SELECT","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"tablename":"profile_settings","permissive":"PERMISSIVE","policyname":"profile_settings_owner","schemaname":"public","with_check":null}],"triggers":null,"force_rls":false,"constraints":[{"name":"profile_settings_consent_epoch_check","definition":"CHECK ((consent_epoch >= 0))"},{"name":"profile_settings_pkey","definition":"PRIMARY KEY (user_id)"},{"name":"profile_settings_user_id_fkey","definition":"FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE"}]}],"routines":[{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.claim_profile_jobs(p_user_id uuid, p_limit integer)","volatility":"v","definition_md5":"db4d962564a1ed85819239267dd5f750","security_definer":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.enqueue_profile_source()","volatility":"v","definition_md5":"a7bdc37c46632461fbb32d18de3e4823","security_definer":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.finish_profile_job(p_job_id uuid, p_token uuid, p_observations jsonb, p_model_id text)","volatility":"v","definition_md5":"9dfa09d048f12b2a1dc964c8be2e5137","security_definer":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.get_profile_memory()","volatility":"s","definition_md5":"854438778e2e5511ed6964c9641d0294","security_definer":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.get_profile_memory_page(p_before_created_at timestamp with time zone, p_before_id uuid)","volatility":"s","definition_md5":"708dfd82f3972cb9a3cd444c2b3ee380","security_definer":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.lock_profile_job(p_job_id uuid, p_token uuid)","volatility":"v","definition_md5":"103269a7ec1d43167b105af42c4cf255","security_definer":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"sql","signature":"public.profile_message_text(p_parts jsonb)","volatility":"i","definition_md5":"cbabedd72d7ea461b9f528f939ac5627","security_definer":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.profile_source_immutable()","volatility":"v","definition_md5":"b2321f476ae1f3323859fb69b5aa0caa","security_definer":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.review_profile_observation(p_observation_id uuid, p_action text, p_expected_updated_at timestamp with time zone)","volatility":"v","definition_md5":"93f0b7d6025000bfd7bbcfacc724c6eb","security_definer":true},{"acl":"{postgres=X/postgres,authenticated=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.set_profile_enabled(p_enabled boolean)","volatility":"v","definition_md5":"f8aea071c04f8da3739393f641e838a1","security_definer":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.start_profile_job(p_job_id uuid, p_token uuid)","volatility":"v","definition_md5":"f92b49a7134bfb815a6c202ad28f785a","security_definer":true},{"acl":"{postgres=X/postgres,service_role=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.update_profile_job(p_job_id uuid, p_token uuid, p_action text, p_run_id text)","volatility":"v","definition_md5":"d885f6fb32ba616ba2d9cc5f2766fef5","security_definer":true},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.validate_profile_observation()","volatility":"v","definition_md5":"1afb4f0210ae9ba618b51f7710059df7","security_definer":false},{"acl":"{postgres=X/postgres}","owner":"postgres","config":["search_path=public, pg_temp"],"language":"plpgsql","signature":"public.validate_profile_source()","volatility":"v","definition_md5":"2c1827ef1f280864650323947939b7c0","security_definer":false}],"messageIndex":"CREATE UNIQUE INDEX profile_source_identity ON public.messages USING btree (id, session_id, conversation_id, created_at)","messageTriggers":[{"name":"enqueue_profile_source","enabled":"O","definition":"CREATE TRIGGER enqueue_profile_source AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION enqueue_profile_source()"},{"name":"profile_source_immutable","enabled":"O","definition":"CREATE TRIGGER profile_source_immutable BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION profile_source_immutable()"}],"messageConstraint":{"deferred":false,"validated":true,"deferrable":false,"definition":"UNIQUE (id, session_id, conversation_id, created_at)"}}'::jsonb);
create function pg_temp.profile_snapshot(p_old_only boolean) returns jsonb language sql as $snapshot$
with tables_snapshot as (
 select c.relname as name,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.relacl::text as acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select jsonb_agg(jsonb_build_object('name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by co.conname) from pg_constraint co where co.conrelid=c.oid and co.conname<>'profile_source_identity') as constraints,
  (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal and t.tgname not in ('profile_source_immutable','enqueue_profile_source')) as triggers,
  (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) order by i.relname) from pg_index ix join pg_class i on i.oid=ix.indexrelid where ix.indrelid=c.oid and i.relname<>'profile_source_identity') as indexes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and (not p_old_only or c.relname in (select jsonb_array_elements_text(expected->'tableNames') from pg_temp.profile_baseline))
), routines_snapshot as (
 select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.provolatile as volatility,l.lanname as language,p.proconfig as config,p.proacl::text as acl,md5(pg_get_functiondef(p.oid)) as definition_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prokind='f' and (not p_old_only or 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' in (select jsonb_array_elements_text(expected->'routineSignatures') from pg_temp.profile_baseline))
), catalog_snapshot as (
 select d.code,encode(sha256(convert_to((to_jsonb(d)-'id'-'created_at'-'updated_at')::text,'UTF8')),'hex') as definition_sha256,
 (select count(*) from public.questionnaire_items i where i.questionnaire_id=d.id) as items,
 (select encode(sha256(convert_to(coalesce(string_agg((to_jsonb(i)-'id'-'questionnaire_id'-'created_at'-'updated_at')::text,E'\n' order by i.order_index),''),'UTF8')),'hex') from public.questionnaire_items i where i.questionnaire_id=d.id) as items_sha256
 from public.questionnaire_definitions d
)
select jsonb_build_object(
 'history',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_md5',md5(array_to_string(statements,E'\n'))) order by version) from supabase_migrations.schema_migrations),
 'catalog',(select jsonb_agg(to_jsonb(x) order by code) from catalog_snapshot x),
 'tableNames',(select jsonb_agg(name order by name) from tables_snapshot),
 'tableFingerprint',(select md5(jsonb_agg(to_jsonb(t) order by name)::text) from tables_snapshot t),
 'routineSignatures',(select jsonb_agg(signature order by signature) from routines_snapshot),
 'routineFingerprint',(select md5(jsonb_agg(to_jsonb(r) order by signature)::text) from routines_snapshot r),
 'platform',jsonb_build_object('authOwner',pg_get_userbyid((select relowner from pg_class where oid='auth.users'::regclass)),
  'rlsRoutine',(select to_jsonb(r) from routines_snapshot r where signature='public.rls_auto_enable()'),
  'eventTriggers',(select jsonb_agg(jsonb_build_object('name',e.evtname,'event',e.evtevent,'enabled',e.evtenabled,'tags',e.evttags,'function',e.evtfoid::regprocedure::text,'owner',pg_get_userbyid(e.evtowner)) order by e.evtname) from pg_event_trigger e),
  'authTriggers',(select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid='auth.users'::regclass and not t.tgisinternal)),
 'counts',jsonb_build_object('auth', (select count(*) from auth.users),'profiles',(select count(*) from public.user_profiles),'definitions',(select count(*) from public.questionnaire_definitions),'items',(select count(*) from public.questionnaire_items)),
 'clinicalCounts',(select jsonb_build_object('assessments',(select count(*) from public.assessments),'audit_log',(select count(*) from public.audit_log),'care_plans',(select count(*) from public.care_plans),'clinical_sessions',(select count(*) from public.clinical_sessions),'clinician_reviews',(select count(*) from public.clinician_reviews),'clinicians',(select count(*) from public.clinicians),'consents',(select count(*) from public.consents),'conversations',(select count(*) from public.conversations),'messages',(select count(*) from public.messages),'patient_context_injections',(select count(*) from public.patient_context_injections),'patient_tasks',(select count(*) from public.patient_tasks),'questionnaire_answers',(select count(*) from public.questionnaire_answers),'questionnaire_instances',(select count(*) from public.questionnaire_instances),'questionnaire_results',(select count(*) from public.questionnaire_results),'risk_events',(select count(*) from public.risk_events),'session_summaries',(select count(*) from public.session_summaries),'user_clinician_assignments',(select count(*) from public.user_clinician_assignments))),
 'profileObjectsAbsent',to_regclass('public.profile_settings') is null and to_regclass('public.profile_extraction_jobs') is null and to_regclass('public.profile_observations') is null and to_regprocedure('public.get_profile_memory()') is null and to_regprocedure('public.get_profile_memory_page(timestamptz,uuid)') is null
) as baseline;

$snapshot$;
revoke all on function pg_temp.profile_snapshot(boolean) from public, anon, authenticated, service_role;
create function pg_temp.profile_new_metadata() returns jsonb language sql as $new_metadata$
with new_tables as (
 select c.relname as name,pg_get_userbyid(c.relowner) as owner,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.relacl::text as acl,
  (select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as columns,
  (select jsonb_agg(jsonb_build_object('name',co.conname,'definition',pg_get_constraintdef(co.oid)) order by co.conname) from pg_constraint co where co.conrelid=c.oid) as constraints,
  (select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) as triggers,
  (select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
  (select jsonb_agg(jsonb_build_object('name',i.relname,'definition',pg_get_indexdef(i.oid)) order by i.relname) from pg_index ix join pg_class i on i.oid=ix.indexrelid where ix.indrelid=c.oid) as indexes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and c.relname in ('profile_settings','profile_extraction_jobs','profile_observations')
), new_routines as (
 select 'public.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as signature,pg_get_userbyid(p.proowner) as owner,p.prosecdef as security_definer,p.provolatile as volatility,l.lanname as language,p.proconfig as config,p.proacl::text as acl,md5(pg_get_functiondef(p.oid)) as definition_md5
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname='public' and p.prokind='f' and p.proname in ('profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source','validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs','lock_profile_job','start_profile_job','update_profile_job','finish_profile_job','review_profile_observation','get_profile_memory_page')
)
select jsonb_build_object(
 'tables',(select jsonb_agg(to_jsonb(t) order by name) from new_tables t),
 'routines',(select jsonb_agg(to_jsonb(r) order by signature) from new_routines r),
 'messageConstraint',(select jsonb_build_object('definition',pg_get_constraintdef(co.oid),'validated',co.convalidated,'deferrable',co.condeferrable,'deferred',co.condeferred) from pg_constraint co where co.conrelid='public.messages'::regclass and co.conname='profile_source_identity'),
 'messageIndex',(select pg_get_indexdef(i.oid) from pg_class i join pg_namespace n on n.oid=i.relnamespace where n.nspname='public' and i.relname='profile_source_identity'),
 'messageTriggers',(select jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid='public.messages'::regclass and t.tgname in ('profile_source_immutable','enqueue_profile_source'))
);

$new_metadata$;
revoke all on function pg_temp.profile_new_metadata() from public, anon, authenticated, service_role;
create temporary table profile_preservation(relation_name text primary key, expected_count bigint not null, aggregate_sha256 text not null, nonce text not null) on commit drop;
revoke all on table pg_temp.profile_preservation from public, anon, authenticated, service_role;
do $profile_before$
declare expected jsonb; actual jsonb; rel text; total bigint; digest text;
  secret_nonce text := gen_random_uuid()::text || gen_random_uuid()::text;
begin
  if current_setting('server_version_num')::integer not between 170000 and 179999 then raise exception 'Profile packet requires PostgreSQL 17'; end if;
  select b.expected into expected from pg_temp.profile_baseline b;
  -- Lock all old tables, including worker queues and every empty clinical table.
  for rel in select jsonb_array_elements_text(expected->'tableNames') order by 1 loop
    execute format('lock table public.%I in share row exclusive mode',rel);
  end loop;
  actual := pg_temp.profile_snapshot(false);
  if actual->'history' is distinct from expected->'history' then raise exception 'Profile history baseline changed'; end if;
  if actual->'catalog' is distinct from expected->'catalog' then raise exception 'Profile catalog baseline changed'; end if;
  if actual->'platform' is distinct from expected->'platform' then raise exception 'Profile platform baseline changed'; end if;
  if actual->'counts' is distinct from expected->'counts' then raise exception 'Profile counts baseline changed'; end if;
  if actual->'clinicalCounts' is distinct from expected->'clinicalCounts' then raise exception 'Profile clinical baseline changed'; end if;
  if actual->'tableNames' is distinct from expected->'tableNames' or actual->'tableFingerprint' is distinct from expected->'tableFingerprint' then raise exception 'Profile old table baseline changed'; end if;
  if actual->'routineSignatures' is distinct from expected->'routineSignatures' or actual->'routineFingerprint' is distinct from expected->'routineFingerprint' then raise exception 'Profile old routine baseline changed'; end if;
  if actual->'profileObjectsAbsent' is distinct from 'true'::jsonb
    or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
      ('profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source','validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs','lock_profile_job','start_profile_job','update_profile_job','finish_profile_job','review_profile_observation','get_profile_memory_page'))
    or exists(select 1 from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where co.conname='profile_source_identity' and n.nspname='public')
    or to_regclass('public.profile_source_identity') is not null
    or exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname in ('profile_source_immutable','enqueue_profile_source')) then
    raise exception 'Profile added object already exists';
  end if;
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then raise exception 'Profile public table missing RLS'; end if;
  foreach rel in array array['auth.users','public.user_profiles','public.questionnaire_definitions','public.questionnaire_items'] loop
    execute format($q$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to($1 || to_jsonb(r)::text,'UTF8')),'hex') row_hash from %s r) x$q$,rel)
      into total,digest using secret_nonce;
    insert into pg_temp.profile_preservation values(rel,total,digest,secret_nonce);
  end loop;
end;
$profile_before$;

-- BEGIN EXACT 20261028081958_progressive_profile.sql SHA256 1d57bcd44f9f37de88a68b46a75e1271b86f36acacfde228178dbd3d27545205
-- Opt-in author-reported memory. No clinical conclusions, score or permission changes.
create table profile_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 enabled boolean not null default false,
 consent_epoch bigint not null default 0 check(consent_epoch>=0),
 updated_at timestamptz not null default clock_timestamp()
);
alter table messages add constraint profile_source_identity unique(id,session_id,conversation_id,created_at);
create table profile_extraction_jobs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 source_message_id uuid not null unique,
 session_id uuid not null,
 conversation_id uuid not null,
 source_created_at timestamptz not null,
 consent_epoch bigint not null check(consent_epoch>=0),
 status text not null default 'pending' check(status in ('pending','enqueued','running','completed','cancelled','exhausted')),
 token uuid not null default gen_random_uuid(),
 lease_until timestamptz,
 attempts integer not null default 0 check(attempts between 0 and 3),
 available_at timestamptz not null default clock_timestamp(),
 run_id text,
 error_code text check(error_code in ('processing_failed','claims_exhausted','consent_withdrawn')),
 extractor_version text not null default 'profile-v1' check(extractor_version='profile-v1'),
 model_id text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint profile_job_source foreign key(source_message_id,session_id,conversation_id,source_created_at) references messages(id,session_id,conversation_id,created_at) on delete cascade,
 constraint profile_job_session_owner foreign key(session_id,user_id) references clinical_sessions(id,user_id) on delete cascade,
 constraint profile_job_conversation_owner foreign key(conversation_id,user_id) references conversations(id,user_id) on delete cascade,
 constraint profile_job_observation_source unique(id,user_id,source_message_id,source_created_at),
 constraint profile_job_active_lease check((status in ('enqueued','running'))=(lease_until is not null))
);
create unique index profile_job_one_active_user on profile_extraction_jobs(user_id) where status in ('enqueued','running');
create index profile_job_pending_order on profile_extraction_jobs(user_id,source_created_at,id) where status in ('pending','enqueued','running');
create index profile_job_session_owner_index on profile_extraction_jobs(session_id,user_id);
create index profile_job_conversation_owner_index on profile_extraction_jobs(conversation_id,user_id);
create table profile_observations (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 source_message_id uuid not null,
 source_created_at timestamptz not null,
 category text not null check(category in ('concern','goal','context','functioning','resource','preference','history','agreement')),
 quote text not null check(char_length(quote) between 1 and 400),
 time_scope text not null check(time_scope in ('current','historical','unspecified')),
 supersedes_id uuid,
 status text not null default 'pending' check(status in ('pending','confirmed','rejected','superseded')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint profile_observation_source foreign key(job_id,user_id,source_message_id,source_created_at) references profile_extraction_jobs(id,user_id,source_message_id,source_created_at) on delete cascade,
 unique(id,user_id),
 unique(job_id,category,quote),
 constraint profile_observation_target foreign key(supersedes_id,user_id) references profile_observations(id,user_id) on delete set null (supersedes_id),
 check(supersedes_id is distinct from id)
);
create index profile_observation_owner_recent on profile_observations(user_id,source_created_at desc,id desc);
create index profile_observation_target_index on profile_observations(supersedes_id,user_id);
create index profile_observation_source_message on profile_observations(source_message_id);

alter table profile_settings enable row level security;
alter table profile_extraction_jobs enable row level security;
alter table profile_observations enable row level security;
revoke all on profile_settings,profile_extraction_jobs,profile_observations from public,anon,authenticated,service_role;
grant select on profile_settings,profile_observations to authenticated;
grant select on profile_settings,profile_extraction_jobs,profile_observations to service_role;
create policy profile_settings_owner on profile_settings for select to authenticated using(user_id=(select auth.uid()));
create policy profile_observations_owner on profile_observations for select to authenticated using(user_id=(select auth.uid()));

-- Same canonical source as the extractor: text parts in order, separated by LF.
create function profile_message_text(p_parts jsonb) returns text language sql immutable set search_path=public,pg_temp as $$
 select coalesce(string_agg(part->>'text',E'\n' order by ordinal),'')
 from jsonb_array_elements(case when jsonb_typeof(p_parts)='array' then p_parts else '[]'::jsonb end) with ordinality as parts(part,ordinal)
 where part->>'type'='text' and jsonb_typeof(part->'text')='string'
$$;
revoke all on function profile_message_text(jsonb) from public,anon,authenticated,service_role;

create function profile_source_immutable() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if row(new.id,new.parts,new.role,new.session_id,new.conversation_id,new.created_at) is distinct from row(old.id,old.parts,old.role,old.session_id,old.conversation_id,old.created_at)
  and exists(select 1 from profile_extraction_jobs where source_message_id=old.id) then
  raise exception 'Profile source is immutable' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function profile_source_immutable() from public,anon,authenticated,service_role;
create trigger profile_source_immutable before update on messages for each row execute function profile_source_immutable();

create function enqueue_profile_source() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; cfg profile_settings%rowtype;
begin
 if new.role<>'user' or new.session_id is null then return new; end if;
 select s.user_id into uid from clinical_sessions s join conversations c on c.id=s.conversation_id and c.user_id=s.user_id
 where s.id=new.session_id and s.conversation_id=new.conversation_id;
 if uid is null then raise exception 'Profile source ownership mismatch' using errcode='23514'; end if;
 select * into cfg from profile_settings where user_id=uid for update;
 if not found or not cfg.enabled then return new; end if;
 insert into profile_extraction_jobs(user_id,source_message_id,session_id,conversation_id,source_created_at,consent_epoch)
 values(uid,new.id,new.session_id,new.conversation_id,new.created_at,cfg.consent_epoch) on conflict(source_message_id) do nothing;
 return new;
end $$;
revoke all on function enqueue_profile_source() from public,anon,authenticated,service_role;
create trigger enqueue_profile_source after insert on messages for each row execute function enqueue_profile_source();

-- Foreign keys also fence elevated SQL writes. Role/quote constraints need row validation.
create function validate_profile_source() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if not exists(select 1 from messages m where m.id=new.source_message_id and m.role='user') then
  raise exception 'Profile source must be user authored' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function validate_profile_source() from public,anon,authenticated,service_role;
create trigger validate_profile_source before insert or update on profile_extraction_jobs for each row execute function validate_profile_source();

create function validate_profile_observation() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare source_text text;
begin
 if tg_op='UPDATE' then
  if row(new.job_id,new.user_id,new.source_message_id,new.source_created_at,new.category,new.quote,new.time_scope) is distinct from row(old.job_id,old.user_id,old.source_message_id,old.source_created_at,old.category,old.quote,old.time_scope)
   or (new.supersedes_id is distinct from old.supersedes_id and new.supersedes_id is not null) then
   raise exception 'Profile observation source is immutable' using errcode='23514';
  end if;
  -- SET NULL preserves the correction's independent source and invalidates stale UI versions.
  if new.supersedes_id is distinct from old.supersedes_id then
   new.updated_at=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
  end if;
  return new;
 end if;
 select profile_message_text(m.parts) into source_text from messages m where m.id=new.source_message_id and m.role='user';
 if source_text is null or char_length(source_text)>8000 or position(new.quote in source_text)=0 then
  raise exception 'Profile quote must match bounded user source' using errcode='23514';
 end if;
 if tg_op='INSERT' and new.supersedes_id is not null and not exists(
  select 1 from profile_observations o where o.id=new.supersedes_id and o.user_id=new.user_id and o.status='confirmed'
   and o.category=new.category and o.source_created_at<new.source_created_at
 ) then raise exception 'Profile correction target invalid' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function validate_profile_observation() from public,anon,authenticated,service_role;
create trigger validate_profile_observation before insert or update on profile_observations for each row execute function validate_profile_observation();

create function set_profile_enabled(p_enabled boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg profile_settings%rowtype;
begin
 if auth.uid() is null or not patient_onboarding_ready(auth.uid()) then raise exception 'Owned adult profile required' using errcode='42501'; end if;
 if p_enabled is null then raise exception 'Profile preference required' using errcode='23514'; end if;
 insert into profile_settings(user_id) values(auth.uid()) on conflict(user_id) do nothing;
 select * into cfg from profile_settings where user_id=auth.uid() for update;
 update profile_settings set enabled=p_enabled,consent_epoch=cfg.consent_epoch+case when p_enabled then 0 else 1 end,updated_at=clock_timestamp() where user_id=cfg.user_id;
 if not p_enabled then
  update profile_extraction_jobs set status='cancelled',token=gen_random_uuid(),lease_until=null,error_code='consent_withdrawn',updated_at=clock_timestamp()
   where user_id=cfg.user_id and status in ('pending','enqueued','running');
 end if;
end $$;
revoke all on function set_profile_enabled(boolean) from public,anon,service_role;
grant execute on function set_profile_enabled(boolean) to authenticated;

create function get_profile_memory() returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authenticated owner required' using errcode='42501'; end if;
 -- One SQL snapshot; read never creates settings or reads another owner's records.
 select jsonb_build_object(
  'enabled',coalesce((select enabled from profile_settings where user_id=auth.uid()),false),
  'pending_jobs',(select count(*) from profile_extraction_jobs where user_id=auth.uid() and consent_epoch=(select consent_epoch from profile_settings where user_id=auth.uid()) and status in ('pending','enqueued','running')),
  'failed_jobs',(select count(*) from profile_extraction_jobs where user_id=auth.uid() and consent_epoch=(select consent_epoch from profile_settings where user_id=auth.uid()) and status='exhausted'),
  'observations',coalesce((select jsonb_agg(jsonb_build_object(
   'id',o.id,'category',o.category,'quote',o.quote,'time_scope',o.time_scope,'status',o.status,
   'supersedes_id',o.supersedes_id,'source_message_id',o.source_message_id,'session_id',o.session_id,
   'source_created_at',o.source_created_at,'updated_at',o.updated_at,
   'disputed',o.status='confirmed' and exists(select 1 from profile_observations child where child.supersedes_id=o.id and child.user_id=o.user_id and child.status='pending')
  ) order by o.source_created_at desc,o.id desc) from (
   select obs.*,j.session_id from profile_observations obs join profile_extraction_jobs j on j.id=obs.job_id and j.user_id=obs.user_id
   where obs.user_id=auth.uid() order by obs.source_created_at desc,obs.id desc limit 100
  ) o),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function get_profile_memory() from public,anon,service_role;
grant execute on function get_profile_memory() to authenticated;

create function claim_profile_jobs(p_user_id uuid default null,p_limit integer default 1)
returns setof profile_extraction_jobs language plpgsql security definer set search_path=public,pg_temp as $$
declare cfg profile_settings%rowtype; j profile_extraction_jobs%rowtype; claimed integer:=0;
begin
 if p_limit is null or p_limit not between 1 and 10 then raise exception 'Profile claim limit invalid' using errcode='23514'; end if;
 -- Settings is always the first lock. SKIP LOCKED lets independent users advance.
 for cfg in select s.* from profile_settings s where s.enabled and (p_user_id is null or s.user_id=p_user_id)
  and exists(select 1 from profile_extraction_jobs job where job.user_id=s.user_id and job.status in ('pending','enqueued','running'))
  order by s.user_id for update skip locked
 loop
  loop
   select * into j from profile_extraction_jobs where user_id=cfg.user_id and status in ('pending','enqueued','running') order by source_created_at,id limit 1 for update;
   exit when not found;
   -- Never skip an unavailable oldest source in favour of a newer one.
   exit when (j.status='pending' and j.available_at>clock_timestamp()) or (j.status in ('enqueued','running') and j.lease_until>clock_timestamp());
   if j.consent_epoch<>cfg.consent_epoch then
    update profile_extraction_jobs set status='cancelled',token=gen_random_uuid(),lease_until=null,error_code='consent_withdrawn',updated_at=clock_timestamp() where id=j.id;
   elsif j.attempts>=3 then
    update profile_extraction_jobs set status='exhausted',lease_until=null,error_code='claims_exhausted',updated_at=clock_timestamp() where id=j.id;
   else
    update profile_extraction_jobs set status='enqueued',token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes',attempts=attempts+1,run_id=null,error_code=null,updated_at=clock_timestamp() where id=j.id returning * into j;
    return next j;
    claimed=claimed+1;
    exit;
   end if;
  end loop;
  exit when claimed>=p_limit;
 end loop;
end $$;
revoke all on function claim_profile_jobs(uuid,integer) from public,anon,authenticated;
grant execute on function claim_profile_jobs(uuid,integer) to service_role;

-- Internal fenced lock shared by worker RPCs, deliberately not executable by clients.
create function lock_profile_job(p_job_id uuid,p_token uuid) returns profile_extraction_jobs
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid; cfg profile_settings%rowtype; j profile_extraction_jobs%rowtype;
begin
 select user_id into uid from profile_extraction_jobs where id=p_job_id;
 if uid is null then raise exception 'Profile job unavailable' using errcode='42501'; end if;
 select * into cfg from profile_settings where user_id=uid for update;
 if not found or not cfg.enabled then raise exception 'Profile consent inactive' using errcode='42501'; end if;
 select * into j from profile_extraction_jobs where id=p_job_id and user_id=uid for update;
 if not found or j.token is distinct from p_token or j.consent_epoch<>cfg.consent_epoch
  or j.status not in ('enqueued','running','completed')
  or (j.status<>'completed' and (j.lease_until is null or j.lease_until<=clock_timestamp())) then
  raise exception 'Profile claim stale' using errcode='42501';
 end if;
 return j;
end $$;
revoke all on function lock_profile_job(uuid,uuid) from public,anon,authenticated,service_role;

create function start_profile_job(p_job_id uuid,p_token uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare j profile_extraction_jobs%rowtype;
begin
 j=lock_profile_job(p_job_id,p_token);
 if j.status='completed' then return false; end if;
 if j.status<>'enqueued' then raise exception 'Profile worker already started' using errcode='40001'; end if;
 update profile_extraction_jobs set status='running',updated_at=clock_timestamp() where id=j.id;
 return true;
end $$;
revoke all on function start_profile_job(uuid,uuid) from public,anon,authenticated;
grant execute on function start_profile_job(uuid,uuid) to service_role;

create function update_profile_job(p_job_id uuid,p_token uuid,p_action text,p_run_id text default null) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare j profile_extraction_jobs%rowtype;
begin
 if p_action is null or p_action not in ('enqueued','failed') or (p_run_id is not null and char_length(p_run_id) not between 1 and 200) then raise exception 'Profile job update invalid' using errcode='23514'; end if;
 j=lock_profile_job(p_job_id,p_token);
 if p_action='enqueued' then
  -- Workflow can start/finish before its dispatch acknowledgement returns.
  update profile_extraction_jobs set run_id=coalesce(p_run_id,run_id),updated_at=clock_timestamp() where id=j.id;
 else
  if j.status='completed' then raise exception 'Profile job already completed' using errcode='40001'; end if;
  update profile_extraction_jobs set status=case when attempts>=3 then 'exhausted' else 'pending' end,
   lease_until=null,available_at=clock_timestamp()+interval '30 seconds',error_code='processing_failed',updated_at=clock_timestamp() where id=j.id;
 end if;
end $$;
revoke all on function update_profile_job(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function update_profile_job(uuid,uuid,text,text) to service_role;

create function finish_profile_job(p_job_id uuid,p_token uuid,p_observations jsonb,p_model_id text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare j profile_extraction_jobs%rowtype; o jsonb; target uuid; source_text text;
begin
 j=lock_profile_job(p_job_id,p_token);
 if j.status='completed' then return; end if;
 if j.status<>'running' then raise exception 'Profile worker not running' using errcode='23514'; end if;
 if p_model_id is null or char_length(btrim(p_model_id)) not between 1 and 200 then raise exception 'Profile model identifier required' using errcode='23514'; end if;
 if jsonb_typeof(p_observations) is distinct from 'array' or jsonb_array_length(p_observations)>5 then raise exception 'Profile output invalid' using errcode='23514'; end if;
 select profile_message_text(parts) into source_text from messages where id=j.source_message_id and role='user' and created_at=j.source_created_at;
 if source_text is null or char_length(source_text)>8000 then raise exception 'Profile source unavailable or too long' using errcode='23514'; end if;
 for o in select value from jsonb_array_elements(p_observations) loop
  if jsonb_typeof(o) is distinct from 'object' then raise exception 'Profile observation invalid' using errcode='23514'; end if;
  if not (o ?& array['category','quote','time_scope','supersedes_id']) or (o-array['category','quote','time_scope','supersedes_id'])<>'{}'::jsonb
   or jsonb_typeof(o->'category') is distinct from 'string' or jsonb_typeof(o->'quote') is distinct from 'string' or jsonb_typeof(o->'time_scope') is distinct from 'string'
   or jsonb_typeof(o->'supersedes_id') not in ('null','string') then raise exception 'Profile observation fields invalid' using errcode='23514'; end if;
  begin target=(o->>'supersedes_id')::uuid;
  exception when invalid_text_representation then raise exception 'Profile correction identifier invalid' using errcode='23514'; end;
  insert into profile_observations(job_id,user_id,source_message_id,source_created_at,category,quote,time_scope,supersedes_id)
  values(j.id,j.user_id,j.source_message_id,j.source_created_at,o->>'category',o->>'quote',o->>'time_scope',target);
 end loop;
 -- Every validation/insertion rolls back with the whole statement on failure.
 update profile_extraction_jobs set status='completed',lease_until=null,model_id=btrim(p_model_id),error_code=null,updated_at=clock_timestamp() where id=j.id;
end $$;
revoke all on function finish_profile_job(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function finish_profile_job(uuid,uuid,jsonb,text) to service_role;

create function review_profile_observation(p_observation_id uuid,p_action text,p_expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o profile_observations%rowtype; target profile_observations%rowtype;
begin
 if auth.uid() is null then raise exception 'Authenticated owner required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('confirm','reject') then raise exception 'Profile review action invalid' using errcode='23514'; end if;
 -- Reviews remain available after opt-out; keep the same mutex as extraction.
 perform 1 from profile_settings where user_id=auth.uid() for update;
 select * into o from profile_observations where id=p_observation_id and user_id=auth.uid() for update;
 if not found then raise exception 'Owned profile observation required' using errcode='42501'; end if;
 if p_expected_updated_at is distinct from o.updated_at or o.status not in ('pending','confirmed') or (p_action='confirm' and o.status<>'pending') then
  raise exception 'Profile observation changed; reload' using errcode='40001';
 end if;
 if p_action='confirm' and o.supersedes_id is not null then
  select * into target from profile_observations where id=o.supersedes_id and user_id=o.user_id for update;
  if not found or target.status<>'confirmed' or target.category<>o.category or target.source_created_at>=o.source_created_at then
   raise exception 'Profile correction changed; reload' using errcode='40001';
  end if;
  update profile_observations set status='superseded',updated_at=clock_timestamp() where id=target.id or (supersedes_id=target.id and user_id=o.user_id and status='pending' and id<>o.id);
 end if;
 update profile_observations set status=case when p_action='confirm' then 'confirmed' else 'rejected' end,updated_at=greatest(clock_timestamp(),o.updated_at+interval '1 microsecond') where id=o.id;
end $$;
revoke all on function review_profile_observation(uuid,text,timestamptz) from public,anon,service_role;
grant execute on function review_profile_observation(uuid,text,timestamptz) to authenticated;

-- END EXACT 20261028081958_progressive_profile.sql

-- BEGIN EXACT 20261028180058_profile_review_rejected_target.sql SHA256 01a00ea14358c9d70b99a74bd0569660d9689ca157aaa1dbb37c35fde3687a06
-- Forward-only I1 fix: retain rejected targets while confirming their later source.
-- Fail closed against the reviewed baseline; preserve signature, owner and grants.
do $guard$
declare routine record; routine_id oid;
begin
 routine_id=to_regprocedure('public.review_profile_observation(uuid,text,timestamptz)');
 if routine_id is null or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='review_profile_observation')<>1 then
  raise exception 'Unexpected profile review forward baseline';
 end if;
 select * into routine from pg_proc where oid=routine_id;
 if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef
  or routine.prorettype<>'void'::regtype or routine.proretset or routine.provolatile<>'v'
  or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
  or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or routine.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or md5(routine.prosrc)<>'7b88b47b6bd68b6a10b47134e082033e'
  or md5(pg_get_functiondef(routine_id))<>'8e334461d08720096d2e740fedfe8ec7' then
  raise exception 'Unexpected profile review forward baseline';
 end if;
end;
$guard$;
create or replace function review_profile_observation(p_observation_id uuid,p_action text,p_expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o profile_observations%rowtype; target profile_observations%rowtype;
begin
 if auth.uid() is null then raise exception 'Authenticated owner required' using errcode='42501'; end if;
 if p_action is null or p_action not in ('confirm','reject') then raise exception 'Profile review action invalid' using errcode='23514'; end if;
 -- Reviews remain available after opt-out; keep the same mutex as extraction.
 perform 1 from profile_settings where user_id=auth.uid() for update;
 select * into o from profile_observations where id=p_observation_id and user_id=auth.uid() for update;
 if not found then raise exception 'Owned profile observation required' using errcode='42501'; end if;
 if p_expected_updated_at is distinct from o.updated_at or o.status not in ('pending','confirmed') or (p_action='confirm' and o.status<>'pending') then
  raise exception 'Profile observation changed; reload' using errcode='40001';
 end if;
 if p_action='confirm' and o.supersedes_id is not null then
  select * into target from profile_observations where id=o.supersedes_id and user_id=o.user_id for update;
  if not found or target.status not in ('confirmed','rejected') or target.category<>o.category or target.source_created_at>=o.source_created_at then
   raise exception 'Profile correction changed; reload' using errcode='40001';
  end if;
  -- Keep a rejected target and its version as evidence of the owner's review.
  update profile_observations set status='superseded',updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond')
   where (id=target.id and status='confirmed')
    or (supersedes_id=target.id and user_id=o.user_id and status='pending' and id<>o.id);
 end if;
 update profile_observations set status=case when p_action='confirm' then 'confirmed' else 'rejected' end,updated_at=greatest(clock_timestamp(),o.updated_at+interval '1 microsecond') where id=o.id;
end $$;

do $verified$
declare routine record;
begin
 select * into routine from pg_proc where oid='public.review_profile_observation(uuid,text,timestamptz)'::regprocedure;
 if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef
  or routine.prorettype<>'void'::regtype or routine.proretset or routine.provolatile<>'v'
  or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
  or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
  or routine.proacl is distinct from array['postgres=X/postgres','authenticated=X/postgres']::aclitem[]
  or md5(routine.prosrc)<>'303c0266096ff91a18407264f5274567' then
  raise exception 'Profile review forward changed an unexpected contract';
 end if;
end;
$verified$;

-- END EXACT 20261028180058_profile_review_rejected_target.sql

-- BEGIN EXACT 20261028185351_profile_nonretryable_conflicts.sql SHA256 9fbff95d4afaa1c4076fca09674a0c601db86af9b69b4ff3e35a7acfdf342827
-- Business conflicts are terminal decisions, not PostgreSQL serialization failures.
-- PostgREST 14 retries 40001 internally; PT409 returns a reloadable HTTP conflict.
-- Forward only: refuse drift and preserve every routine's API, owner and ACL.
do $profile_conflicts$
declare expected record; routine pg_proc%rowtype; routine_id oid; before_metadata jsonb; definition text;
begin
 for expected in select * from (values
  ('public.review_profile_observation(uuid,text,timestamptz)','review_profile_observation','303c0266096ff91a18407264f5274567','45f8e4a112cfe356f01d9331f72b7775','388738c656736cb0d5e738b5187de4ef','93f0b7d6025000bfd7bbcfacc724c6eb','void',array['postgres=X/postgres','authenticated=X/postgres']::text[],2),
  ('public.start_profile_job(uuid,uuid)','start_profile_job','f60f672eaf906f202a8ba2c39220d312','a9b68aa353cb81e2cf8ff133e15adc9e','a47e4b02473adbfe0758dda6d3164d99','f92b49a7134bfb815a6c202ad28f785a','boolean',array['postgres=X/postgres','service_role=X/postgres']::text[],1),
  ('public.update_profile_job(uuid,uuid,text,text)','update_profile_job','a1776a28d9f37bb3d17f3bb08c6d63df','6fb05f0519fd5207886cbc0e61c4f6ea','52a452c3a58da9be382f8f336795e412','d885f6fb32ba616ba2d9cc5f2766fef5','void',array['postgres=X/postgres','service_role=X/postgres']::text[],1)
 ) as baseline(signature,name,source_md5,definition_md5,new_source_md5,new_definition_md5,return_type,acl,code_count)
 loop
  routine_id=to_regprocedure(expected.signature);
  if routine_id is null or (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname=expected.name)<>1 then
   raise exception 'Unexpected profile conflict routine: %',expected.name;
  end if;
  select * into routine from pg_proc where oid=routine_id;
  if pg_get_userbyid(routine.proowner)<>'postgres' or not routine.prosecdef or routine.proretset
   or routine.prorettype<>expected.return_type::regtype or routine.provolatile<>'v'
   or routine.prolang<>(select oid from pg_language where lanname='plpgsql')
   or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
   or routine.proacl is distinct from expected.acl::aclitem[]
   or md5(routine.prosrc)<>expected.source_md5
   or md5(pg_get_functiondef(routine_id))<>expected.definition_md5
   or (length(routine.prosrc)-length(replace(routine.prosrc,'errcode=''40001''','')))/length('errcode=''40001''')<>expected.code_count then
   raise exception 'Unexpected profile conflict baseline: %',expected.name;
  end if;
  before_metadata=to_jsonb(routine)-'prosrc';
  definition=replace(pg_get_functiondef(routine_id),'errcode=''40001''','errcode=''PT409''');
  execute definition;
  select * into routine from pg_proc where oid=routine_id;
  if to_jsonb(routine)-'prosrc' is distinct from before_metadata
   or md5(routine.prosrc)<>expected.new_source_md5
   or md5(pg_get_functiondef(routine_id))<>expected.new_definition_md5 then
   raise exception 'Profile conflict changed an unexpected contract: %',expected.name;
  end if;
 end loop;
end;
$profile_conflicts$;

-- END EXACT 20261028185351_profile_nonretryable_conflicts.sql

-- BEGIN EXACT 20261030152754_profile_memory_history_page.sql SHA256 c9cc722dd713d6ee209f65b77b3ef912e2ae732443c8bdad424b2fa7c9293c6d
-- Bounded owner history; independent of chat/worker context budgets.
create function get_profile_memory_page(p_before_created_at timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb; owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authenticated owner required' using errcode='42501'; end if;
 if (p_before_created_at is null) <> (p_before_id is null)
  or (p_before_created_at is not null and not isfinite(p_before_created_at)) then
  raise exception 'Complete finite profile cursor required' using errcode='23514';
 end if;
 -- One statement/snapshot; the indexed keyset and lookahead are bounded to101.
 with candidates as materialized (
  select obs.*,j.session_id from profile_observations obs
  join profile_extraction_jobs j on j.id=obs.job_id and j.user_id=obs.user_id
  where obs.user_id=owner_id and (p_before_created_at is null or (obs.source_created_at,obs.id)<(p_before_created_at,p_before_id))
  order by obs.source_created_at desc,obs.id desc limit 101
 ), page as materialized (
  select * from candidates order by source_created_at desc,id desc limit 100
 )
 select jsonb_build_object(
  'enabled',coalesce((select enabled from profile_settings where user_id=owner_id),false),
  'pending_jobs',(select count(*) from profile_extraction_jobs where user_id=owner_id and consent_epoch=(select consent_epoch from profile_settings where user_id=owner_id) and status in ('pending','enqueued','running')),
  'failed_jobs',(select count(*) from profile_extraction_jobs where user_id=owner_id and consent_epoch=(select consent_epoch from profile_settings where user_id=owner_id) and status='exhausted'),
  'observations',coalesce((select jsonb_agg(jsonb_build_object(
   'id',o.id,'category',o.category,'quote',o.quote,'time_scope',o.time_scope,'status',o.status,
   'supersedes_id',o.supersedes_id,'source_message_id',o.source_message_id,'session_id',o.session_id,
   'source_created_at',o.source_created_at,'updated_at',o.updated_at,
   'disputed',o.status='confirmed' and exists(select 1 from profile_observations child where child.user_id=owner_id and child.supersedes_id=o.id and child.status='pending')
  ) order by o.source_created_at desc,o.id desc) from page o),'[]'::jsonb),
  'next_cursor',case when (select count(*) from candidates)>100 then
   (select jsonb_build_object('source_created_at',source_created_at,'id',id) from page order by source_created_at,id limit 1)
   else null end
 ) into result;
 return result;
end $$;
revoke all on function get_profile_memory_page(timestamptz,uuid) from public,anon,service_role;
grant execute on function get_profile_memory_page(timestamptz,uuid) to authenticated;

-- END EXACT 20261030152754_profile_memory_history_page.sql

-- PROFILE PRESERVATION CHECK: no row transformation is authorized.
do $profile_after$
declare expected jsonb; actual jsonb; original record; total bigint; digest text;
  rel text; role_name text; privilege_name text; routine record; expected_execute boolean;
  new_tables text[] := array['profile_extraction_jobs','profile_observations','profile_settings'];
  owner_rpcs text[] := array['set_profile_enabled','get_profile_memory','get_profile_memory_page','review_profile_observation'];
  worker_rpcs text[] := array['claim_profile_jobs','start_profile_job','update_profile_job','finish_profile_job'];
  new_routines text[] := array['profile_message_text','profile_source_immutable','enqueue_profile_source','validate_profile_source','validate_profile_observation','set_profile_enabled','get_profile_memory','claim_profile_jobs','lock_profile_job','start_profile_job','update_profile_job','finish_profile_job','review_profile_observation','get_profile_memory_page'];
begin
  select b.expected into expected from pg_temp.profile_baseline b;
  for original in select * from pg_temp.profile_preservation loop
    execute format($q$select count(*),encode(sha256(convert_to(coalesce(string_agg(row_hash,'' order by row_hash),''),'UTF8')),'hex')
      from (select encode(sha256(convert_to($1 || to_jsonb(r)::text,'UTF8')),'hex') row_hash from %s r) x$q$,original.relation_name)
      into total,digest using original.nonce;
    if total<>original.expected_count or digest<>original.aggregate_sha256 then raise exception 'Profile account/catalog preservation failed'; end if;
  end loop;
  actual := pg_temp.profile_snapshot(true);
  if actual->'history' is distinct from expected->'history' then raise exception 'Profile history preservation failed'; end if;
  if actual->'platform' is distinct from expected->'platform' then raise exception 'Profile platform preservation failed'; end if;
  if actual->'catalog' is distinct from expected->'catalog' or actual->'counts' is distinct from expected->'counts' or actual->'clinicalCounts' is distinct from expected->'clinicalCounts' then raise exception 'Profile data baseline preservation failed'; end if;
  if actual->'tableNames' is distinct from expected->'tableNames' or actual->'tableFingerprint' is distinct from expected->'tableFingerprint' then raise exception 'Profile old table preservation failed'; end if;
  if actual->'routineSignatures' is distinct from expected->'routineSignatures' or actual->'routineFingerprint' is distinct from expected->'routineFingerprint' then raise exception 'Profile old routine preservation failed'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')) <> jsonb_array_length(expected->'tableNames')+3
    or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) then raise exception 'Profile table set/RLS mismatch'; end if;
  foreach rel in array new_tables loop
    execute format('select count(*) from public.%I',rel) into total;
    if total<>0 then raise exception 'Profile default data must remain empty'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
        if has_table_privilege(role_name,format('public.%I',rel),privilege_name) is distinct from
          (privilege_name='SELECT' and (role_name='service_role' or (role_name='authenticated' and rel<>'profile_extraction_jobs'))) then raise exception 'Profile table ACL mismatch'; end if;
      end loop;
    end loop;
    if exists(select 1 from pg_class c, lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where c.oid=format('public.%I',rel)::regclass and a.grantee=0) then raise exception 'Profile PUBLIC table ACL remains'; end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f') <> jsonb_array_length(expected->'routineSignatures')+14 then raise exception 'Profile function set mismatch'; end if;
  for routine in select p.*,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(new_routines) loop
    if pg_get_userbyid(routine.proowner)<>'postgres' or routine.proconfig is distinct from array['search_path=public, pg_temp']::text[]
      or routine.prosecdef is distinct from (routine.proname not in ('profile_message_text','validate_profile_source','validate_profile_observation'))
      or pg_get_functiondef(routine.oid) ~* 'errcode\s*=\s*''40001''' then raise exception 'Profile function security/source mismatch'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      expected_execute := (role_name='authenticated' and routine.proname=any(owner_rpcs)) or (role_name='service_role' and routine.proname=any(worker_rpcs));
      if has_function_privilege(role_name,routine.oid,'EXECUTE') is distinct from expected_execute then raise exception 'Profile function ACL mismatch'; end if;
    end loop;
    if exists(select 1 from aclexplode(coalesce(routine.proacl,acldefault('f',routine.proowner))) a where a.grantee=0) then raise exception 'Profile PUBLIC function EXECUTE remains'; end if;
  end loop;
  if not exists(select 1 from pg_constraint where conrelid='public.messages'::regclass and conname='profile_source_identity' and contype='u')
    or (select count(*) from pg_trigger where tgrelid='public.messages'::regclass and tgname in ('profile_source_immutable','enqueue_profile_source') and tgenabled='O')<>2 then raise exception 'Profile message additions missing'; end if;
  if exists(select 1 from pg_constraint co join pg_class c on c.oid=co.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and co.conname='profile_source_identity' and co.conrelid<>'public.messages'::regclass)
    or exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname in ('profile_source_immutable','enqueue_profile_source') and t.tgrelid<>'public.messages'::regclass) then raise exception 'Profile excluded-name collision'; end if;
  -- Includes exact new columns/defaults/constraints/indexes/policies/triggers,
  -- function signatures/source/ACL/config and both authorized message bindings.
  if pg_temp.profile_new_metadata() is distinct from (select expected_new from pg_temp.profile_baseline) then raise exception 'Profile new object metadata mismatch'; end if;
end;
$profile_after$;
