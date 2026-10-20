"""Tests for the Python tools. Run with: python -m unittest discover tests"""

import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / "tools"), str(ROOT / "scripts")]

import backup  # noqa: E402
import generate_icons  # noqa: E402


class BackupTests(unittest.TestCase):
    def test_markdown_groups_days_newest_first_and_hides_encrypted_text(self):
        entries = [
            {"entry_date": "2026-10-18", "content": "  Old page  ", "mood": "calm"},
            {"entry_date": "2026-10-19", "content": "enc:v1:abc", "encrypted": True},
        ]
        tasks = [
            {"entry_date": "2026-10-18", "title": "Second", "done": False, "position": 1},
            {"entry_date": "2026-10-18", "title": "First", "done": True, "position": 0},
            {"entry_date": "2026-10-17", "title": "Task-only day", "done": False, "position": 0},
        ]
        md = backup.to_markdown("maya", entries, tasks)
        self.assertLess(md.index("## 2026-10-19"), md.index("## 2026-10-18 · calm"))
        self.assertIn("_(encrypted entry", md)
        self.assertNotIn("enc:v1:abc", md)
        self.assertIn("Old page\n\n- [x] First\n- [ ] Second", md)
        self.assertIn("## 2026-10-17\n\n- [ ] Task-only day", md)

    def test_settings_prefer_env_local_and_accept_vite_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".env").write_text("SUPABASE_URL=https://old.supabase.co\n")
            (root / ".env.local").write_text(
                "# comment\nVITE_SUPABASE_URL='https://new.supabase.co/'\nSUPABASE_ANON_KEY=\"key\"\n"
            )
            env_backup = dict(backup.os.environ)
            for name in backup.URL_KEYS + backup.ANON_KEYS:
                backup.os.environ.pop(name, None)
            try:
                self.assertEqual(backup.load_settings(root), ("https://new.supabase.co", "key"))
            finally:
                backup.os.environ.clear()
                backup.os.environ.update(env_backup)


    def test_auth_email_matches_the_app_and_ignores_case_and_spaces(self):
        # Same value src/utils/authEmail.js and schema.sql auth_email_for() give.
        expected = "u-a95db5b0ac159e4384ff55ef91c94a98dc563d66@users.dailyink.app"
        self.assertEqual(backup.auth_email_for("maya"), expected)
        self.assertEqual(backup.auth_email_for("  Maya "), expected)


class IconTests(unittest.TestCase):
    def test_icon_is_a_valid_png(self):
        png = generate_icons.draw_icon(48)
        self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
        width, height = struct.unpack(">II", png[16:24])
        self.assertEqual((width, height), (48, 48))
        idat_len = struct.unpack(">I", png[33:37])[0]
        raw = zlib.decompress(png[41:41 + idat_len])
        self.assertEqual(len(raw), 48 * (48 * 4 + 1))


if __name__ == "__main__":
    unittest.main()
