-- Portable repair: retain all existing profiles and roles. Missing profiles
-- are created for existing auth users only, with the safe patient default.
-- Clinician provisioning is an explicit administrative operation, never a
-- fixture or a user-editable metadata claim.
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
