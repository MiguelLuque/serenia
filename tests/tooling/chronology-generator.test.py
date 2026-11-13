#!/usr/bin/env python3
"""Isolated regression checks for the chronology packet generator."""
import hashlib
import json
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
FILES = [
    'scripts/chronology-dashboard-packet.py',
    'supabase/migrations/20261101104931_assessment_observed_chronology.sql',
    'supabase/hosted/profile-baseline-20261101.json',
    'supabase/hosted/profile-dashboard-20261102.json',
    'supabase/hosted/profile-manifest.json',
    'supabase/hosted/profile-new-objects.json',
    'supabase/hosted/profile-new-objects-query.sql',
    'supabase/hosted/chronology-readback-20261102.sql',
]


class GeneratorTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='serenia-chronology-gen-')
        self.root = pathlib.Path(self.temporary.name)
        for path in FILES:
            dst = self.root / path
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / path, dst)

    def tearDown(self):
        self.temporary.cleanup()

    def run_generator(self, *extra):
        return subprocess.run([sys.executable, '-O', str(self.root / FILES[0]), *extra],
                              cwd=tempfile.gettempdir(), text=True, capture_output=True, timeout=10)

    def test_repeat_is_identical_and_has_fixed_prepared_identity(self):
        result = self.run_generator()
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest_path = self.root / 'supabase/hosted/chronology-dashboard-20261102.json'
        wrapper_path = self.root / 'supabase/hosted/chronology-dashboard-20261102.sql'
        first = (manifest_path.read_bytes(), wrapper_path.read_bytes())
        manifest = json.loads(first[0])
        self.assertEqual(manifest['status'], 'PREPARED_NOT_APPLIED')
        self.assertEqual(manifest['wrapperSha256'], hashlib.sha256(first[1]).hexdigest())
        self.assertEqual(manifest['wrapperBytes'], len(first[1]))
        self.assertEqual((manifest['oldHistoryCount'], manifest['newHistoryCount']), (44, 45))
        self.assertEqual(self.run_generator().returncode, 0)
        self.assertEqual(first, (manifest_path.read_bytes(), wrapper_path.read_bytes()))

    def test_rejects_every_modified_input_even_with_python_optimization(self):
        self.assertEqual(self.run_generator().returncode, 0)
        wrapper = self.root / 'supabase/hosted/chronology-dashboard-20261102.sql'
        original_wrapper = wrapper.read_bytes()
        for name in FILES[1:]:
            with self.subTest(path=name):
                path = self.root / name
                original = path.read_bytes()
                path.write_bytes(original + b'\n')
                self.assertNotEqual(self.run_generator().returncode, 0)
                self.assertEqual(wrapper.read_bytes(), original_wrapper)
                path.write_bytes(original)

    def test_rejects_future_local_version_and_extra_arguments(self):
        self.assertEqual(self.run_generator().returncode, 0)
        future = self.root / 'supabase/migrations/20990101000000_future.sql'
        future.write_text('-- fixture only\n')
        self.assertNotEqual(self.run_generator().returncode, 0)
        future.unlink()
        self.assertNotEqual(self.run_generator('--target=remote').returncode, 0)

    def test_rejects_symlinked_source_and_output_without_following_them(self):
        self.assertEqual(self.run_generator().returncode, 0)
        source = self.root / FILES[1]
        original = source.read_bytes()
        source.unlink()
        source.symlink_to(self.root / 'missing-source-sentinel')
        self.assertNotEqual(self.run_generator().returncode, 0)
        self.assertFalse((self.root / 'missing-source-sentinel').exists())
        source.unlink()
        source.write_bytes(original)
        wrapper = self.root / 'supabase/hosted/chronology-dashboard-20261102.sql'
        wrapper.unlink()
        wrapper.symlink_to(self.root / 'missing-output-sentinel')
        self.assertNotEqual(self.run_generator().returncode, 0)
        self.assertFalse((self.root / 'missing-output-sentinel').exists())

    def test_does_not_overwrite_an_unexpected_existing_artifact(self):
        self.assertEqual(self.run_generator().returncode, 0)
        wrapper = self.root / 'supabase/hosted/chronology-dashboard-20261102.sql'
        modified = wrapper.read_bytes() + b'\n-- user change\n'
        wrapper.write_bytes(modified)
        result = self.run_generator()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(wrapper.read_bytes(), modified)


if __name__ == '__main__':
    unittest.main()
