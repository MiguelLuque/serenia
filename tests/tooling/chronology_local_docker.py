"""Bounded Docker lifecycle for the synthetic chronology rehearsal only."""
import json
import os
import pathlib
import re
import shutil
import signal
import stat
import subprocess
import sys
import threading
import time
import urllib.parse
import uuid

COMMAND_TIMEOUT = 25
INTERACTIVE_TIMEOUT = 20
CLEANUP_COMMAND_TIMEOUT = 5
CLEANUP_GRACE = 8
LABEL_KEY = 'serenia.chronology-rehearsal'
PREFIX = ['rtk', 'proxy'] if shutil.which('rtk') else []


def stop_group(process):
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    except OSError:
        process.kill()


def run_bounded(args, env, timeout, text_input=None, on_start=None):
    process = subprocess.Popen(args, stdin=subprocess.PIPE if text_input is not None else subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                               env=env, start_new_session=True)
    try:
        if on_start is not None:
            on_start(process)
        stdout, stderr = process.communicate(input=text_input, timeout=timeout)
    except BaseException:
        stop_group(process)
        try:
            process.communicate(timeout=2)
        except subprocess.TimeoutExpired:
            pass
        raise
    return subprocess.CompletedProcess(args, process.returncode, stdout, stderr)


class LocalDocker:
    def __init__(self):
        # Do not inherit Docker selectors, TLS settings, credentials or API tokens.
        self.env = {k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR', 'LANG') if k in os.environ}
        self.prefix = ['rtk', 'proxy'] if shutil.which('rtk', path=self.env.get('PATH')) else []
        self.nonce = uuid.uuid4().hex
        self.name = 'serenia-profile-dashboard-' + self.nonce[:12]
        self.container_id = None
        self.launch_attempted = False
        self.started = False
        self.starting = False
        self.start_process = None
        self.cleaning = False
        self.terminate_requested = False
        self.previous_handler = signal.getsignal(signal.SIGTERM)
        signal.signal(signal.SIGTERM, self._on_term)
        try:
            self.endpoint = self._resolve_local_endpoint()
        except BaseException:
            signal.signal(signal.SIGTERM, self.previous_handler)
            raise

    def _on_term(self, signum, _frame):
        self.terminate_requested = True
        if self.starting and self.start_process is not None:
            stop_group(self.start_process)
        if not self.starting and not self.cleaning:
            raise SystemExit(128 + signum)

    def _track_start(self, process):
        self.start_process = process
        if self.terminate_requested:
            stop_group(process)

    def _resolve_local_endpoint(self):
        try:
            result = run_bounded([*self.prefix, 'docker', 'context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], self.env, COMMAND_TIMEOUT)
            if result.returncode != 0 or len(result.stdout) > 8192:
                raise ValueError('context unavailable')
            endpoint = json.loads(result.stdout)
            if not isinstance(endpoint, str):
                raise ValueError('invalid context')
            parsed = urllib.parse.urlsplit(endpoint)
            path = urllib.parse.unquote(parsed.path)
            if (parsed.scheme != 'unix' or parsed.netloc or parsed.query or parsed.fragment
                    or not pathlib.PurePosixPath(path).is_absolute() or '\x00' in path
                    or not stat.S_ISSOCK(os.stat(path).st_mode)):
                raise ValueError('not an absolute Unix socket')
            return 'unix://' + path
        except (ValueError, OSError, json.JSONDecodeError, subprocess.TimeoutExpired):
            raise RuntimeError('Docker local Unix socket could not be verified') from None

    def argv(self, *args):
        return [*self.prefix, 'docker', '--host', self.endpoint, *args]

    def command(self, *args, sql=None, check=True, cleanup=False):
        if self.terminate_requested and not cleanup and not self.starting:
            raise SystemExit(128 + signal.SIGTERM)
        try:
            result = run_bounded(self.argv(*args), self.env,
                                 CLEANUP_COMMAND_TIMEOUT if cleanup else COMMAND_TIMEOUT,
                                 text_input=sql, on_start=self._track_start if self.starting else None)
        except subprocess.TimeoutExpired:
            raise RuntimeError('Docker command timed out') from None
        if self.terminate_requested and not cleanup:
            raise SystemExit(128 + signal.SIGTERM)
        if check and result.returncode:
            # Do not expose endpoint, Docker configuration, or a foreign container's metadata.
            raise RuntimeError('Docker command failed (exit ' + str(result.returncode) + ')')
        if self.terminate_requested and not cleanup and not self.starting:
            raise SystemExit(128 + signal.SIGTERM)
        return result

    def start(self):
        self.launch_attempted = True
        self.starting = True
        try:
            result = self.command('run', '--pull', 'never', '--detach', '--rm', '--name', self.name,
                                  '--label', LABEL_KEY + '=' + self.nonce, '--network', 'none',
                                  '--tmpfs', '/var/lib/postgresql/data:rw', '-e',
                                  'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17.6-bookworm')
            self.started = result.returncode == 0
            if self.terminate_requested:
                raise SystemExit(128 + signal.SIGTERM)
            created_id = result.stdout.strip()
            if not re.fullmatch('[a-f0-9]{64}', created_id):
                raise RuntimeError('Docker did not return a full test container ID')
            identity = self.command('inspect', '--format', '{{.Id}} {{index .Config.Labels "' + LABEL_KEY + '"}}', created_id)
            if identity.stdout.strip().split() != [created_id, self.nonce]:
                raise RuntimeError('Docker test container identity could not be verified')
            self.container_id = created_id
        finally:
            self.starting = False
            self.start_process = None
        if self.terminate_requested:
            raise SystemExit(128 + signal.SIGTERM)

    def interactive(self, *args):
        if self.terminate_requested:
            raise SystemExit(128 + signal.SIGTERM)
        process = subprocess.Popen(self.argv(*args), stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True, bufsize=1, env=self.env,
                                   start_new_session=True)
        timer = threading.Timer(INTERACTIVE_TIMEOUT, stop_group, args=(process,))
        timer.daemon = True
        timer.start()
        process._serenia_timer = timer
        return process

    @staticmethod
    def finish(process):
        process._serenia_timer.cancel()
        if process.poll() is None:
            stop_group(process)
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            raise RuntimeError('Docker client did not terminate') from None

    def _inspect_owned(self, reference):
        result = self.command('inspect', '--format', '{{.Id}} {{index .Config.Labels "' + LABEL_KEY + '"}}',
                              reference, check=False, cleanup=True)
        if result.returncode != 0:
            absent = re.fullmatch(r'(?:error(?: response from daemon)?:\s*)?no such (?:object|container):\s*(.+)',
                                  result.stderr.strip(), flags=re.IGNORECASE)
            if absent and absent.group(1).strip().strip("\"'") == reference:
                return None
            raise RuntimeError('Could not confirm test container state')
        fields = result.stdout.strip().split()
        if (len(fields) != 2 or not re.fullmatch('[a-f0-9]{64}', fields[0])
                or fields[1] != self.nonce or (self.container_id and fields[0] != self.container_id)):
            raise RuntimeError('Test container identity could not be confirmed')
        return fields[0]

    def _cleanup_container(self):
        if not self.launch_attempted:
            return
        # A verified immutable ID remains authoritative even after a rename. Name
        # lookup is only a fallback for an interrupted start without a returned ID.
        reference = self.container_id or self.name
        deadline = time.monotonic() + (0 if self.container_id or self.started else CLEANUP_GRACE)
        while True:
            owned_id = self._inspect_owned(reference)
            if owned_id is not None:
                removed = self.command('rm', '--force', owned_id, check=False, cleanup=True)
                if removed.returncode != 0:
                    raise RuntimeError('Could not remove own test container')
                verify_deadline = time.monotonic() + CLEANUP_GRACE
                while self._inspect_owned(owned_id) is not None:
                    if time.monotonic() >= verify_deadline:
                        raise RuntimeError('Test container removal could not be confirmed')
                    time.sleep(.2)
                return
            if self.container_id:
                return
            if self.started or time.monotonic() >= deadline:
                # If creation was interrupted before an ID arrived, a daemon could
                # still complete after this bounded observation period.
                raise RuntimeError('Test container absence after interrupted start is unverified')
            time.sleep(.2)

    def cleanup(self):
        self.cleaning = True
        pending = sys.exc_info()[1]
        cleanup_error = None
        try:
            self._cleanup_container()
        except BaseException as error:
            cleanup_error = error
        finally:
            signal.signal(signal.SIGTERM, self.previous_handler)
            self.cleaning = False
        if cleanup_error is not None:
            print('CLEANUP_FAILED: ' + str(cleanup_error), file=sys.stderr)
            if pending is None:
                if self.terminate_requested:
                    raise SystemExit(128 + signal.SIGTERM) from cleanup_error
                raise cleanup_error
        if self.terminate_requested and pending is None and cleanup_error is None:
            raise SystemExit(128 + signal.SIGTERM)
