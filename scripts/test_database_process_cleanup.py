import io
import subprocess
import unittest
from unittest.mock import patch

from scripts.chat_view_close_concurrency import run_chat_view_close_concurrency
from scripts.database_test_processes import cleanup_container, finish_query_session


class _Input:
    def __init__(self):
        self.closed = False

    def write(self, value):
        if self.closed:
            raise ValueError('write to closed input')
        return len(value)

    def flush(self):
        if self.closed:
            raise ValueError('flush of closed input')

    def close(self):
        self.closed = True


class _SlowHolder:
    def __init__(self):
        self.pid = 424242
        self.stdin = _Input()
        self.stderr = io.StringIO('holder stuck after COMMIT')
        self.killed = False

    def poll(self):
        return -9 if self.killed else None

    def wait(self, timeout=None):
        if not self.killed:
            raise subprocess.TimeoutExpired(['psql'], timeout)
        return -9

    def kill(self):
        self.killed = True


class _AnnotatedError:
    def __init__(self):
        self.notes = []

    def add_note(self, note):
        self.notes.append(note)


class DatabaseTestProcessCleanupTest(unittest.TestCase):
    def test_timed_out_holder_is_killed_and_reaped(self):
        process = _SlowHolder()

        def kill_group(pid, signal):
            self.assertEqual(pid, process.pid)
            process.killed = True

        with patch('scripts.database_test_processes.os.killpg', side_effect=kill_group) as killpg:
            with self.assertRaisesRegex(RuntimeError, 'timed out'):
                finish_query_session(process, timeout=0.01)

        killpg.assert_called_once()
        self.assertTrue(process.killed)
        self.assertTrue(process.stdin.closed)
        self.assertIsNotNone(process.poll())

    def test_container_cleanup_uses_a_deadline_and_reports_timeout(self):
        active_error = _AnnotatedError()
        calls = []

        def docker(*args, **kwargs):
            calls.append((args, kwargs))
            raise subprocess.TimeoutExpired(['docker', 'rm'], kwargs['timeout'])

        detail = cleanup_container(docker, 'synthetic-container', active_error=active_error, timeout=3)

        self.assertEqual(calls[0][0], ('rm', '--force', 'synthetic-container'))
        self.assertEqual(calls[0][1]['timeout'], 3)
        self.assertIn('cleanup failed', detail)
        self.assertIn(detail, active_error.notes)

    def test_container_cleanup_failure_fails_after_successful_system_exit(self):
        def docker(*_args, **_kwargs):
            raise subprocess.TimeoutExpired(['docker', 'rm'], 10)

        with self.assertRaisesRegex(RuntimeError, 'cleanup failed'):
            cleanup_container(docker, 'synthetic-container', active_error=SystemExit(0))

    def test_unconfirmed_start_only_ignores_missing_container(self):
        def docker(*_args, **_kwargs):
            return subprocess.CompletedProcess(['docker', 'rm'], 1, '', 'Error response from daemon: No such container: synthetic')

        self.assertIsNone(cleanup_container(docker, 'synthetic', allow_missing=True))

        with self.assertRaisesRegex(RuntimeError, 'cleanup failed'):
            cleanup_container(docker, 'synthetic', allow_missing=False)

    def test_lock_barrier_queries_have_server_and_client_timeouts(self):
        calls = []
        holder = _SlowHolder()

        def query(sql, timeout=None):
            calls.append((sql, timeout))
            if "state='idle in transaction'" in sql:
                return '?column?\n----------\nt\n'
            if 'pg_blocking_pids' in sql:
                raise subprocess.TimeoutExpired(['psql'], timeout)
            if 'close_session_from_chat_view' in sql:
                return 'turn_pending'
            return ''

        def finish(process):
            process.killed = True

        with self.assertRaises(subprocess.TimeoutExpired):
            run_chat_view_close_concurrency(query, lambda _sql: holder, finish)

        polls = [(sql, timeout) for sql, timeout in calls if 'pg_stat_activity' in sql]
        self.assertTrue(polls)
        self.assertTrue(all(timeout is not None and timeout > 0 for _, timeout in polls))
        self.assertTrue(all('statement_timeout' in sql for sql, _ in polls))
        self.assertTrue(holder.killed)


if __name__ == '__main__':
    unittest.main()
