"""Helpers for keeping PostgreSQL regression subprocesses bounded."""
import os
import signal
import subprocess


def finish_query_session(process, timeout=10):
    if process.poll() is None:
        stdin = process.stdin
        if stdin is not None and not stdin.closed:
            try:
                stdin.write('commit;\n')
                stdin.flush()
            except (BrokenPipeError, ValueError):
                pass
            finally:
                if not stdin.closed:
                    try:
                        stdin.close()
                    except (BrokenPipeError, ValueError):
                        pass
    try:
        return_code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired as timed_out:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=2)
        except subprocess.TimeoutExpired as reap_timeout:
            raise RuntimeError('Concurrent PostgreSQL holder could not be reaped after timeout') from reap_timeout
        error_output = process.stderr.read() if process.stderr is not None else ''
        raise RuntimeError('Concurrent PostgreSQL holder timed out and was terminated:\n' + error_output) from timed_out
    error_output = process.stderr.read() if process.stderr is not None else ''
    if return_code:
        raise RuntimeError('Concurrent PostgreSQL holder failed:\n' + error_output)


def run_timed_process(command, input_text, timeout):
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        start_new_session=True,
    )
    try:
        stdout, stderr = process.communicate(input=input_text, timeout=timeout)
    except subprocess.TimeoutExpired as timed_out:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        try:
            process.communicate(timeout=2)
        except subprocess.TimeoutExpired as reap_timeout:
            raise RuntimeError('Timed PostgreSQL test command could not be reaped') from reap_timeout
        raise subprocess.TimeoutExpired(command, timeout) from timed_out
    return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)


def cleanup_container(docker, name, active_error=None, timeout=10, allow_missing=False):
    if isinstance(active_error, SystemExit) and active_error.code in (None, 0):
        active_error = None
    try:
        result = docker('rm', '--force', name, check=False, timeout=timeout)
        if result.returncode == 0:
            return None
        if allow_missing and 'no such container' in (result.stdout + result.stderr).lower():
            return None
        detail = ('PostgreSQL test container cleanup failed (exit ' + str(result.returncode) + '):\n'
                  + result.stdout + result.stderr)
    except Exception as error:
        detail = 'PostgreSQL test container cleanup failed: ' + str(error)
    if active_error is not None:
        if hasattr(active_error, 'add_note'):
            active_error.add_note(detail)
        return detail
    raise RuntimeError(detail)
