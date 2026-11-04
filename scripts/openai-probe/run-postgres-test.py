#!/usr/bin/env python3
"""Disposable PostgreSQL; never runs SQL outside an owned, verified container."""
import os
import json
import re
import subprocess
import sys
import time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tests/tooling'))
from chronology_local_docker import LocalDocker, run_bounded
os.chdir(ROOT)

if not __debug__:
    raise RuntimeError('This test requires assertions')

runtime = LocalDocker()
try:
    runtime.start()
    container = runtime.container_id
    nonce = runtime.nonce
    if not container or not re.fullmatch('[a-f0-9]{32}', nonce):
        raise RuntimeError('Test container ID missing')
    fmt = '{{json .Id}}|{{json .Name}}|{{json .Config.Image}}|{{json .HostConfig.NetworkMode}}|{{json (index .Config.Labels "serenia.chronology-rehearsal")}}'
    identity = runtime.command('inspect', '--format', fmt, container).stdout.strip().split('|')
    expected = [container, '/serenia-profile-dashboard-' + nonce[:12], 'postgres:17.6-bookworm', 'none', nonce]
    if len(identity) != 5 or [json.loads(field) for field in identity] != expected:
        raise RuntimeError('Synthetic container identity mismatch')
    for _ in range(80):
        ready = runtime.command('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', check=False)
        if ready.returncode == 0:
            break
        time.sleep(.25)
    else:
        raise RuntimeError('Synthetic PostgreSQL did not start')
    # This schema can only be created fresh in the verified disposable container.
    # Distinct tables let both cases run without TRUNCATE, DELETE, or public writes.
    schema = 'serenia_probe_' + nonce
    ddl = f"""
BEGIN;
CREATE SCHEMA "{schema}";
CREATE TYPE "{schema}".actor_type AS ENUM ('user','service','system');
CREATE TABLE "{schema}".race_reservations (
 id uuid primary key default gen_random_uuid(), actor_type "{schema}".actor_type not null,
 actor_id uuid, entity_type text not null, entity_id uuid, action text not null,
 diff_json jsonb not null default '{{}}', created_at timestamptz not null default now()
);
CREATE TABLE "{schema}".lost_reservations (LIKE "{schema}".race_reservations INCLUDING ALL);
COMMIT;
"""
    runtime.command('exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', sql=ddl)
    env = {k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR') if k in os.environ}
    env['PROBE_DOCKER_ENDPOINT'] = runtime.endpoint
    env['PROBE_CONTAINER_ID'] = container
    env['PROBE_CONTAINER_NONCE'] = nonce
    result = run_bounded([*runtime.prefix, 'node', '--conditions=react-server', '--import', 'tsx', '--test', 'scripts/openai-probe/postgres-concurrency.test.ts'], env, 120)
    print(result.stdout)
    if result.returncode:
        print(result.stderr, file=sys.stderr)
        raise RuntimeError('Synthetic PostgreSQL test failed')
finally:
    runtime.cleanup()
