-- Historical one-off data wipe retired from the replayable schema chain.
-- It was executed only in a prelaunch environment. Replaying a migration must
-- never delete accounts or depend on historical identities. Already applied
-- installations retain their history; this no-op does not restore deleted data.
-- Any future data remediation needs a separately authorized operational script.
select 1;
