#!/usr/bin/env python3
"""Exercise signal, timeout, identity and context handling with a fake Docker CLI."""
import json
import os
import pathlib
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
HARNESS = ROOT / 'tests/tooling/chronology-integration.test.py'
MODULE_DIR = ROOT / 'tests/tooling'
FAKE_ID = 'a' * 64

SHIM = r'''#!PYTHON
import json, os, pathlib, subprocess, sys, time
base=pathlib.Path(__file__).resolve().parent
mode=(base/'scenario').read_text().strip()
endpoint='tcp://127.0.0.1:2375' if mode=='remote' else ('unix:///nonexistent-chronology-test-socket' if mode=='missing' else 'unix://'+str(base/'docker.sock'))
args=sys.argv[1:]
with (base/'calls.jsonl').open('a') as f:
    f.write(json.dumps({'command':args[2] if len(args)>2 and args[0]=='--host' else args[0],
        'explicitHost':len(args)>1 and args[0]=='--host' and args[1]==endpoint,
        'selectorsAbsent':all(x not in os.environ for x in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_CONFIG','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'))})+'\n')
if args[:2]==['context','inspect']:
    print(json.dumps(endpoint)); sys.exit(0)
if len(args)<3 or args[0]!='--host' or args[1]!=endpoint:
    sys.exit(82)
args=args[2:]
state=base/'container.json'
if args[0]=='run':
    name=args[args.index('--name')+1]
    label=args[args.index('--label')+1].split('=',1)[1]
    value={'id':'a'*64,'name':name,'label':'foreign' if mode=='foreign' else label}
    if mode=='delayed':
        code='import pathlib,time;time.sleep(.6);pathlib.Path('+repr(str(state))+').write_text('+repr(json.dumps(value))+')'
        subprocess.Popen([sys.executable,'-c',code],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        (base/'requested').write_text('1')
        while True: time.sleep(.05)
    state.write_text(json.dumps(value))
    (base/'created').write_text('1')
    if mode=='foreign':
        print('name already in use',file=sys.stderr); sys.exit(1)
    end=time.monotonic()+30
    while mode in ('signal','hang') and not (base/'release').exists() and time.monotonic()<end:
        time.sleep(.02)
    print(value['id']); sys.exit(0)
if args[0]=='inspect':
    foreign=base/'foreign.json'
    candidates=[json.loads(p.read_text()) for p in (state,foreign) if p.exists()]
    matches=[x for x in candidates if args[-1] in (x['name'],x['id'])]
    if not matches:
        print('error: no such object: '+('b'*64 if mode=='wrong_absence' else args[-1]),file=sys.stderr); sys.exit(1)
    value=matches[0]
    if mode in ('signal_cleanup','signal_cleanup_rm_unconfirmed') and (base/'driver-ready').exists():
        (base/'cleanup-inspect-start').write_text('1')
        while not (base/'release-cleanup').exists(): time.sleep(.02)
    print(value['id'],value['label']); sys.exit(0)
if args[0]=='exec':
    value=json.loads(state.read_text())
    if value['id'] not in args:
        (base/'wrong-exec').write_text('1'); sys.exit(4)
    (base/'exec-called').write_text('1')
    time.sleep(.1); sys.exit(1)
if args[0]=='rm':
    value=json.loads(state.read_text())
    if args[-1]!=value['id'] or value['label']=='foreign':
        (base/'wrong-remove').write_text('1'); sys.exit(3)
    (base/'removed').write_text(args[-1])
    if mode not in ('rm_unconfirmed','signal_cleanup_rm_unconfirmed'): state.unlink()
    sys.exit(0)
sys.exit(83)
'''


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        # /tmp exists on both Linux and macOS and keeps AF_UNIX paths short even
        # when TMPDIR points to the long per-user macOS temporary directory.
        self.temporary = tempfile.TemporaryDirectory(prefix='sd-', dir='/tmp')
        self.path = pathlib.Path(self.temporary.name)
        self.socket = socket.socket(socket.AF_UNIX)
        self.socket.bind(str(self.path / 'docker.sock'))
        self.socket.listen(1)
        shim = self.path / 'docker'
        shim.write_text(SHIM.replace('#!PYTHON', '#!' + sys.executable))
        shim.chmod(0o700)

    def tearDown(self):
        self.socket.close()
        self.temporary.cleanup()

    def env(self):
        return {'PATH': str(self.path) + ':/usr/bin:/bin', 'HOME': str(self.path),
                'DOCKER_HOST': 'tcp://attacker.invalid:2375', 'DOCKER_CONTEXT': 'remote-danger',
                'DOCKER_CONFIG': '/nonexistent-config', 'DOCKER_TLS_VERIFY': '1',
                'DOCKER_CERT_PATH': '/nonexistent-certs'}

    def launch(self, scenario, short_timeout=False):
        (self.path / 'scenario').write_text(scenario)
        if short_timeout:
            code = ("import sys,runpy;sys.path.insert(0," + repr(str(MODULE_DIR)) + ");"
                    "import chronology_local_docker as d;d.COMMAND_TIMEOUT=1;d.CLEANUP_GRACE=2;"
                    "runpy.run_path(" + repr(str(HARNESS)) + ",run_name='__main__')")
            args = [sys.executable, '-c', code]
        else:
            args = [sys.executable, str(HARNESS)]
        return subprocess.Popen(args, env=self.env(), stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, start_new_session=True)

    def launch_driver(self, scenario, body):
        (self.path / 'scenario').write_text(scenario)
        code = ("import pathlib,sys,time;sys.path.insert(0," + repr(str(MODULE_DIR)) + ");"
                "import chronology_local_docker as d;d.CLEANUP_GRACE=1;"
                "r=d.LocalDocker();r.start();base=pathlib.Path(" + repr(str(self.path)) + ");" + body)
        return subprocess.Popen([sys.executable, '-c', code], env=self.env(), stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, text=True, start_new_session=True)

    def wait_file(self, name, process):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if (self.path / name).exists(): return
            if process.poll() is not None:
                self.fail('driver exited before ' + name + ': ' + process.stderr.read()[-500:])
            time.sleep(.02)
        self.fail('driver did not reach ' + name)

    def test_unix_socket_path_is_short_before_and_after_symlink_resolution(self):
        path = self.path / 'docker.sock'
        # macOS sun_path is limited to 104 bytes including the terminating NUL.
        self.assertLess(len(os.fsencode(path)), 104)
        self.assertLess(len(os.fsencode(path.resolve())), 104)
        self.assertTrue(path.is_socket())

    def test_cleanup_uses_verified_id_after_rename_and_foreign_replacement(self):
        body = ("base.joinpath('driver-ready').write_text('1');"
                "exec(\"while not base.joinpath('release').exists(): time.sleep(.02)\");r.cleanup()")
        process = self.launch_driver('renamed', body)
        try:
            self.wait_file('driver-ready', process)
            state = json.loads((self.path / 'container.json').read_text())
            original_name = state['name']
            state['name'] = 'renamed-owned-container'
            (self.path / 'container.json').write_text(json.dumps(state))
            (self.path / 'foreign.json').write_text(json.dumps({'id':'b'*64,'name':original_name,'label':'foreign'}))
            (self.path / 'release').write_text('1')
            _, stderr = process.communicate(timeout=12)
            self.assertEqual(process.returncode, 0, stderr)
            self.assertEqual((self.path / 'removed').read_text(), FAKE_ID)
            self.assertFalse((self.path / 'container.json').exists())
            self.assertTrue((self.path / 'foreign.json').exists())
            self.assertFalse((self.path / 'wrong-remove').exists())
        finally:
            if process.poll() is None: process.kill(); process.wait(timeout=5)

    def test_unconfirmed_removal_fails_closed(self):
        process = self.launch_driver('rm_unconfirmed', 'r.cleanup()')
        _, stderr = process.communicate(timeout=15)
        self.assertNotEqual(process.returncode, 0, stderr)
        self.assertTrue((self.path / 'container.json').exists())

    def test_absence_error_for_a_different_id_is_not_accepted(self):
        process = self.launch_driver('wrong_absence', 'r.cleanup()')
        _, stderr = process.communicate(timeout=12)
        self.assertNotEqual(process.returncode, 0)
        self.assertIn('CLEANUP_FAILED', stderr)
        self.assertIn('Could not confirm test container state', stderr)

    def test_sigterm_during_cleanup_is_propagated_after_removal(self):
        process = self.launch_driver('signal_cleanup', "base.joinpath('driver-ready').write_text('1');r.cleanup()")
        try:
            self.wait_file('cleanup-inspect-start', process)
            os.kill(process.pid, signal.SIGTERM)
            (self.path / 'release-cleanup').write_text('1')
            _, stderr = process.communicate(timeout=12)
            self.assertEqual(process.returncode, 128 + signal.SIGTERM, stderr)
            self.assertFalse((self.path / 'container.json').exists())
            self.assertEqual((self.path / 'removed').read_text(), FAKE_ID)
        finally:
            if process.poll() is None: process.kill(); process.wait(timeout=5)

    def test_cleanup_failure_preserves_original_error(self):
        body = "exec(\"try:\\n raise ValueError('original_failure_marker')\\nfinally:\\n r.cleanup()\")"
        process = self.launch_driver('rm_unconfirmed', body)
        _, stderr = process.communicate(timeout=15)
        self.assertNotEqual(process.returncode, 0)
        self.assertIn('original_failure_marker', stderr)
        self.assertIn('CLEANUP_FAILED', stderr)

    def test_sigterm_during_unconfirmed_cleanup_keeps_cancel_status_and_error(self):
        process = self.launch_driver('signal_cleanup_rm_unconfirmed', "base.joinpath('driver-ready').write_text('1');r.cleanup()")
        try:
            self.wait_file('cleanup-inspect-start', process)
            os.kill(process.pid, signal.SIGTERM)
            (self.path / 'release-cleanup').write_text('1')
            _, stderr = process.communicate(timeout=15)
            self.assertEqual(process.returncode, 128 + signal.SIGTERM, stderr)
            self.assertIn('CLEANUP_FAILED', stderr)
            self.assertTrue((self.path / 'container.json').exists())
        finally:
            if process.poll() is None: process.kill(); process.wait(timeout=5)

    def test_sigterm_during_cleanup_preserves_original_failure(self):
        body = "base.joinpath('driver-ready').write_text('1');exec(\"try:\\n raise ValueError('original_failure_marker')\\nfinally:\\n r.cleanup()\")"
        process = self.launch_driver('signal_cleanup', body)
        try:
            self.wait_file('cleanup-inspect-start', process)
            os.kill(process.pid, signal.SIGTERM)
            (self.path / 'release-cleanup').write_text('1')
            _, stderr = process.communicate(timeout=12)
            self.assertNotEqual(process.returncode, 0)
            self.assertIn('original_failure_marker', stderr)
            self.assertFalse((self.path / 'container.json').exists())
        finally:
            if process.poll() is None: process.kill(); process.wait(timeout=5)

    def wait_created(self, process):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if (self.path / 'created').exists():
                return
            if process.poll() is not None:
                self.fail('harness ended before simulated creation: ' + process.stderr.read()[-500:])
            time.sleep(.02)
        self.fail('simulated container was not created')

    def assert_pinned_clean_commands(self):
        calls = [json.loads(x) for x in (self.path / 'calls.jsonl').read_text().splitlines()]
        self.assertTrue(calls)
        self.assertTrue(all(x['selectorsAbsent'] for x in calls))
        self.assertTrue(all(x['explicitHost'] for x in calls if x['command'] != 'context'))
        return calls

    def test_sigterm_during_start_removes_only_labeled_container(self):
        process = self.launch('signal')
        try:
            self.wait_created(process)
            started = time.monotonic()
            os.kill(process.pid, signal.SIGTERM)
            _, stderr = process.communicate(timeout=12)
            self.assertEqual(process.returncode, 128 + signal.SIGTERM, stderr)
            self.assertLess(time.monotonic() - started, 5, 'cleanup must begin promptly on SIGTERM')
            self.assertEqual((self.path / 'removed').read_text(), FAKE_ID)
            self.assertFalse((self.path / 'container.json').exists())
            self.assertFalse((self.path / 'wrong-remove').exists())
            calls = self.assert_pinned_clean_commands()
            self.assertTrue(any(x['command']=='inspect' for x in calls))
            self.assertTrue(any(x['command']=='rm' for x in calls))
        finally:
            if process.poll() is None:
                process.kill(); process.wait(timeout=5)

    def test_foreign_container_name_collision_is_never_removed(self):
        process = self.launch('foreign', short_timeout=True)
        _, stderr = process.communicate(timeout=12)
        self.assertNotEqual(process.returncode, 0, stderr)
        self.assertTrue((self.path / 'container.json').exists())
        self.assertFalse((self.path / 'removed').exists())
        self.assertFalse((self.path / 'wrong-remove').exists())
        calls = self.assert_pinned_clean_commands()
        self.assertFalse(any(x['command']=='rm' for x in calls))

    def test_sigterm_before_delayed_daemon_creation_is_rechecked(self):
        process = self.launch('delayed')
        try:
            deadline = time.monotonic() + 10
            while not (self.path / 'requested').exists() and time.monotonic() < deadline:
                if process.poll() is not None:
                    self.fail('harness exited before simulated request: ' + process.stderr.read()[-500:])
                time.sleep(.02)
            self.assertTrue((self.path / 'requested').exists())
            os.kill(process.pid, signal.SIGTERM)
            _, stderr = process.communicate(timeout=12)
            self.assertEqual(process.returncode, 128 + signal.SIGTERM, stderr)
            self.assertEqual((self.path / 'removed').read_text(), FAKE_ID)
            self.assertFalse((self.path / 'container.json').exists())
            self.assertFalse((self.path / 'wrong-remove').exists())
            self.assert_pinned_clean_commands()
        finally:
            if process.poll() is None:
                process.kill(); process.wait(timeout=5)

    def test_start_timeout_still_removes_created_labeled_container(self):
        process = self.launch('hang', short_timeout=True)
        _, stderr = process.communicate(timeout=12)
        self.assertNotEqual(process.returncode, 0, stderr)
        self.assertIn('Docker command timed out', stderr)
        self.assertNotIn(str(self.path / 'docker.sock'), stderr)
        self.assertNotIn('unix://', stderr)
        self.assertEqual((self.path / 'removed').read_text(), FAKE_ID)
        self.assertFalse((self.path / 'container.json').exists())
        self.assertFalse((self.path / 'wrong-remove').exists())
        self.assert_pinned_clean_commands()

    def test_normal_start_executes_only_against_verified_immutable_id(self):
        process = self.launch('normal')
        try:
            deadline = time.monotonic() + 10
            while not (self.path / 'exec-called').exists() and time.monotonic() < deadline:
                if process.poll() is not None:
                    self.fail('harness exited before exec: ' + process.stderr.read()[-500:])
                time.sleep(.02)
            self.assertTrue((self.path / 'exec-called').exists())
            os.kill(process.pid, signal.SIGTERM)
            _, stderr = process.communicate(timeout=12)
            self.assertEqual(process.returncode, 128 + signal.SIGTERM, stderr)
            self.assertFalse((self.path / 'wrong-exec').exists())
            self.assertEqual((self.path / 'removed').read_text(), FAKE_ID)
            self.assertFalse((self.path / 'wrong-remove').exists())
            self.assert_pinned_clean_commands()
        finally:
            if process.poll() is None:
                process.kill(); process.wait(timeout=5)

    def test_remote_context_and_missing_socket_fail_before_start(self):
        for scenario in ('remote', 'missing'):
            with self.subTest(scenario=scenario):
                process = self.launch(scenario, short_timeout=True)
                _, stderr = process.communicate(timeout=8)
                self.assertNotEqual(process.returncode, 0)
                self.assertIn('Docker local Unix socket could not be verified', stderr)
                self.assertNotIn('tcp://127.0.0.1:2375', stderr)
                self.assertFalse((self.path / 'created').exists())


if __name__ == '__main__':
    unittest.main()
