-- Create user_role enum
create type user_role as enum ('patient', 'clinician');

-- Add new columns (skip display_name and onboarding_status — already exist)
alter table user_profiles
  add column role                user_role not null default 'patient',
  add column birth_date          date,
  add column sex                 text check (sex in ('female', 'male', 'non_binary', 'prefer_not_say')),
  add column country             text,
  add column city                text,
  add column employment          text check (employment in ('employed', 'unemployed', 'student', 'retired', 'homemaker', 'other')),
  add column relationship_status text check (relationship_status in ('single', 'in_relationship', 'married', 'divorced', 'widowed', 'other')),
  add column living_with         text check (living_with in ('alone', 'with_family', 'with_partner', 'with_roommates', 'other')),
  add column prior_therapy       boolean,
  add column current_medication  boolean,
  add column reason_for_consulting text;
