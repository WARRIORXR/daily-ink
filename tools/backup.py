"""Back up your Daily Ink journal to your computer.

Signs in with your username and password (the same way the app does), then
saves your entries, tasks, reviews and routines as JSON plus a readable
Markdown file. Standard library only.

Usage:
    python tools/backup.py                      # asks for username + password
    python tools/backup.py --out backups/today

Settings come from .env.local (or the environment): SUPABASE_URL or
VITE_SUPABASE_URL, and SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY.
Entries encrypted in the app stay encrypted in the backup.
"""

from __future__ import annotations

import argparse
import hashlib
import getpass
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TABLES = ("entries", "tasks", "reviews", "routines")
URL_KEYS = ("VITE_SUPABASE_URL", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL")
ANON_KEYS = (
    "VITE_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
)


def read_env_file(path: Path) -> dict[str, str]:
    """Parse KEY=value lines, ignoring comments and surrounding quotes."""
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip().strip("'\"")
    return values


def load_settings(root: Path = ROOT) -> tuple[str, str]:
    env = {**read_env_file(root / ".env"), **read_env_file(root / ".env.local"), **os.environ}
    url = next((env[k] for k in URL_KEYS if env.get(k)), "")
    key = next((env[k] for k in ANON_KEYS if env.get(k)), "")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.local first.")
    return url.rstrip("/"), key


def auth_email_for(username: str) -> str:
    digest = hashlib.sha256(username.strip().lower().encode("utf-8")).hexdigest()
    return f"u-{digest[:40]}@users.dailyink.app"


class Supabase:
    def __init__(self, url: str, anon_key: str):
        self.url = url
        self.anon_key = anon_key
        self.token = anon_key

    def _request(self, method: str, path: str, body=None):
        request = urllib.request.Request(
            self.url + path,
            method=method,
            data=None if body is None else json.dumps(body).encode(),
            headers={
                "apikey": self.anon_key,
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read() or b"null")
        except urllib.error.HTTPError as err:
            detail = json.loads(err.read() or b"{}")
            message = detail.get("msg") or detail.get("message") or detail.get("error_description")
            raise SystemExit(f"Supabase error ({err.code}): {message or err.reason}") from None

    def sign_in(self, username: str, password: str) -> None:
        # Same derived address as the app (src/utils/authEmail.js), so no
        # lookup is needed and none is exposed to strangers.
        email = auth_email_for(username)
        try:
            session = self._request(
                "POST", "/auth/v1/token?grant_type=password", {"email": email, "password": password}
            )
        except SystemExit:
            raise SystemExit("Wrong username or password.") from None
        self.token = session["access_token"]

    def fetch(self, table: str) -> list[dict]:
        return self._request("GET", f"/rest/v1/{table}?select=*&order=created_at")


def to_markdown(username: str, entries: list[dict], tasks: list[dict]) -> str:
    """One section per day, newest first, with that day's tasks underneath."""
    tasks_by_day: dict[str, list[dict]] = {}
    for task in sorted(tasks, key=lambda t: t.get("position", 0)):
        tasks_by_day.setdefault(task["entry_date"], []).append(task)

    lines = [f"# Daily Ink: {username}", ""]
    days = sorted({e["entry_date"] for e in entries} | set(tasks_by_day), reverse=True)
    by_day = {e["entry_date"]: e for e in entries}
    for day in days:
        entry = by_day.get(day, {})
        heading = f"## {day}"
        if entry.get("mood"):
            heading += f" · {entry['mood']}"
        lines += [heading, ""]
        if entry.get("encrypted"):
            lines += ["_(encrypted entry, unlock it in the app to read)_", ""]
        elif entry.get("content", "").strip():
            lines += [entry["content"].strip(), ""]
        for task in tasks_by_day.get(day, []):
            lines.append(f"- [{'x' if task.get('done') else ' '}] {task['title']}")
        if tasks_by_day.get(day):
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--out", type=Path, default=ROOT / "backups" / date.today().isoformat())
    parser.add_argument("--username")
    args = parser.parse_args(argv)

    url, key = load_settings()
    username = args.username or input("Username: ").strip()
    password = getpass.getpass("Password: ")

    client = Supabase(url, key)
    client.sign_in(username, password)
    data = {table: client.fetch(table) for table in TABLES}

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "daily-ink.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    (args.out / "daily-ink.md").write_text(to_markdown(username, data["entries"], data["tasks"]), encoding="utf-8")
    counts = ", ".join(f"{len(rows)} {table}" for table, rows in data.items())
    print(f"Saved {counts} to {args.out}")


if __name__ == "__main__":
    sys.exit(main())
