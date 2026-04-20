-- supabase/migrations/20260419000001_enums.sql

create type conversation_status as enum ('active', 'closed', 'archived');
create type session_status as enum ('open', 'paused', 'closed');
create type questionnaire_instance_status as enum (
  'proposed', 'in_progress', 'submitted', 'scored', 'cancelled'
);
create type assessment_status as enum (
  'draft_ai',
  'pending_clinician_review',
  'reviewed_confirmed',
  'reviewed_modified',
  'rejected',
  'superseded'
);
create type review_status as enum ('pending', 'in_review', 'reviewed', 'rejected', 'needs_followup');
create type risk_severity as enum ('low', 'moderate', 'high', 'critical');
create type risk_status as enum ('open', 'acknowledged', 'escalated', 'closed');
create type risk_type as enum (
  'suicidal_ideation', 'self_harm', 'severe_distress', 'crisis_other'
);
create type generated_by_source as enum ('ai', 'clinician', 'system');
create type assessment_type as enum ('intake', 'follow_up', 'closure', 'review');
create type trigger_source as enum ('ai', 'clinician', 'schedule', 'user');
create type onboarding_status as enum ('pending', 'consent', 'age_gate', 'baseline', 'complete');
create type risk_profile_status as enum ('unknown', 'low', 'elevated', 'active_protocol');
create type message_role as enum ('user', 'assistant', 'tool', 'system');
create type actor_type as enum ('user', 'service', 'system');
