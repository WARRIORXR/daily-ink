# Daily Ink — Memory Journal

A private, cross-platform daily journal built with **React + Vite + Tailwind CSS + Supabase**, installable as a **PWA** with offline support.

Write one page a day, track your streak, and let Daily Ink resurface old entries at the moment you'd otherwise forget them — with spaced-repetition reviews and a memory quiz before each reveal.

> **🌐 Live demo:** [daily-ink-three.vercel.app](https://daily-ink-three.vercel.app/) — deployed via Vercel.

## Features

### Core
- **Auth** - username + password sign-in (no email address needed, no OAuth). Usernames are case-insensitive. Supabase Auth stores and verifies the password and issues the session behind the scenes using a synthetic internal address
- **Admin login log** - admins get an `/admin` page listing every sign-in, sign-up and sign-out attempt with username, time, result and device (never passwords)
- **Daily entry editor** — autosaving journal page per day, with mood tracking and a task list
- **Calendar view** — month grid with dots for every written day, plus a day-detail panel
- **Search & filters** — full-text search with date range, mood, and "has tasks" filters
- **Dashboard** — current/longest streak, entry count, memories due, and quick actions
- **Live sync** — entries, tasks, and review schedules update in real time across devices and tabs via Supabase Realtime (no refresh needed)

### Memory boosting
- **On This Day** — past entries from the same date in previous years
- **Memory quiz** — old entries stay hidden until you guess which day they're from (the quiz uses your real writing as the prompt)
- **Spaced repetition** — reviews surface on an SM-2-style ladder (1 → 3 → 7 → 14 → 30… days) based on how well you remembered
- **Streak counter** — 🔥 consecutive-day motivation, alive until the day ends

### Privacy & security
- **RLS policies** — every table is scoped to the owner (see `supabase/schema.sql`)
- **Optional encryption** — entries are AES-256-GCM encrypted client-side (passphrase-derived key, PBKDF2) before they ever reach storage; the passphrase is never stored
- **Data export** — JSON and Markdown downloads from Settings
- **Biometric lock** — optional PIN + platform fingerprint/face unlock (WebAuthn) for the app on-device

### UI/UX
- Dark mode (light / dark / system), mobile-responsive, installable PWA with an offline service worker, minimal serif design, accessible (labels, focus rings, skip link, reduced-motion support, live regions for toasts)

## Setup

```bash
npm install
npm run dev
```

Try the deployed version at **[daily-ink-three.vercel.app](https://daily-ink-three.vercel.app/)** — or run it locally with the commands above.

### 1. Database (optional but recommended)

Without Supabase credentials the app runs in **local mode** — everything stays in the browser. To enable cloud sync:

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates the `profiles`, `entries`, `tasks`, `reviews`, `routines` and `login_events` tables with RLS policies and signup triggers, plus `log_auth_event()` for the login log, and registers the tables with the Realtime publication (needed for live cross-device sync). The file is safe to re-run - everything is idempotent.
3. Copy `.env.example` to `.env.local` and fill in your project URL and anon key (Dashboard → Project Settings → API):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

The anon key is safe for the browser; never use the `service_role` key here (the build refuses to run if it finds one). `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are also accepted. Whatever name you use, the value ends up in the browser bundle.

4. **Enable the Email provider and turn off email confirmation (required).** Sign-in is username-based, but Supabase Auth still runs it, so every account gets a synthetic `u-<first 40 hex of sha256(lowercase username)>@users.dailyink.app` address that can never receive mail. The browser derives it from the username, so signing in needs no lookup and nobody can ask the server whether a username exists. In the dashboard go to **Authentication → Providers → Email** (direct link: `https://supabase.com/dashboard/project/<your-project-ref>/auth/providers`): switch the provider **ON** and uncheck **Confirm email**. With the provider off, signups fail with `Email signups are not allowed for this provider`; while confirmation is on, signup tries to send a confirmation email to an address that cannot receive one, so signups fail with `email rate limit exceeded` (Supabase throttles confirmation mail) and any account that does get created can never sign in. Both are hard requirements, not niceties. Supabase rejects reserved domains outright (`.local`, `.test`, `.invalid`), which is why the synthetic address uses a normal-looking one. The login screen detects both misconfigurations automatically (via `/auth/v1/settings`) and shows a banner with a working deep link into the dashboard; the banner re-checks and clears itself when you return from the dashboard.

5. **Make yourself an admin (optional).** Sign up in the app once, then run this in the SQL editor:

```sql
update public.profiles set is_admin = true where username = 'yourname';
```

Admins get an **Admin** tab with a login-activity page (`/admin`): every sign-in, sign-up and sign-out attempt with its username, time, device and result.

> **Passwords are never recorded.** Supabase Auth hashes passwords server-side (bcrypt), so no plaintext password ever exists in this project, and no password hash is readable by anyone. The login log stores the username, user id, time, result, failure reason and browser of each attempt, never the password, and events can only be written through `log_auth_event()`, which takes the user id from the caller's own session. Every failed sign-in shows the same "Wrong username or password" message. The `is_admin` flag can only be set from the SQL editor: a database trigger stops the app from promoting itself, and row level security keeps the log readable by admins alone.

6. **Recommended auth hardening.**
   - Authentication → Policies (or Providers → Email): set the **minimum password length to 8**.
   - Authentication → Rate Limits: keep the defaults on (they limit sign-ins and sign-ups per IP). The app also pauses after 5 failed attempts in a browser, doubling the wait each time.
   - Optional CAPTCHA: create a free [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) widget, put its secret key in Authentication → Attack Protection → **Enable CAPTCHA protection** (provider Turnstile), and build the app with `VITE_TURNSTILE_SITE_KEY=<site key>`. The check then appears on the sign-in and sign-up forms.

**Upgrading an existing project** to username-derived addresses: deploy the app first (it signs in old and new accounts), then run `supabase/migrations/2026-10-20_phase1_auth_hardening.sql` once. Nobody's password changes.

### 2. PWA icons (already generated)

Icons in `public/icons/` are generated by a standard-library Python script:

```bash
python scripts/generate_icons.py
```

## Languages

- **Rust** (`core/`): the app logic. Date math, streaks, the spaced-repetition schedule and review queue, routine scheduling and the memory quiz run in Rust, compiled to WebAssembly. `src/utils/` holds thin JavaScript wrappers so the screens call it like before.
- **Python** (`tools/`, `scripts/`, `tests/`): a journal backup tool, the icon generator, and their tests. Standard library only.
- **JavaScript/React**: the screens and the Supabase connection, which have to run in the browser.

The compiled WebAssembly (`src/core/`) is committed, so `npm run build` and Vercel need no Rust toolchain. Rebuild it only after changing `core/`:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100 --locked
npm run build:core
```

### Back up your journal

```bash
python tools/backup.py
```

It asks for your username and password, then saves your entries, tasks, reviews and routines to `backups/<date>/` as JSON and a readable Markdown file. Encrypted entries stay encrypted.

## Scripts

- `npm run dev`: local development
- `npm run build`: production build
- `npm run preview`: preview the production build (service worker active)
- `npm run lint`: oxlint
- `npm test`: Rust tests (`cargo test`) and Python tests (`unittest`)
- `npm run build:core`: rebuild the Rust core to WebAssembly
- `npm run backup`: back up your journal

## Structure

```
supabase/schema.sql       Database schema + RLS policies + triggers
core/                     Rust app logic (compiled to WebAssembly)
tools/backup.py           Python journal backup tool
scripts/generate_icons.py PWA icon generator (Python, no deps)
tests/                    Python tests
public/
  manifest.webmanifest    PWA manifest
  sw.js                   Service worker (offline app shell)
  icons/                  Generated PNG icons
src/
  config/supabaseClient.js  Supabase client (null when unconfigured)
  context/               Auth, Theme, Toast providers
  hooks/                 useEntries, useReviews, useEncryption,
                         useLock, useEntryContent, useToday
  core/                  generated WebAssembly + JS bindings (npm run build:core)
  utils/                 dates, streaks, spaced repetition, quiz,
                         crypto, lock, export, moods
  components/            Layout, Navbar, EntryEditor, CalendarView,
                         MemoryQuiz, ReviewSession, OnThisDay, …
  pages/                 Home (dashboard), Journal, Entries, Calendar,
                         Review, Settings, Login, Admin (login activity)
```

## How live sync works

- When signed in, the app subscribes to `postgres_changes` on `entries`, `tasks`, and `reviews`, filtered to your user id (RLS still applies to Realtime events).
- Writes from any device appear immediately: new entries, edits, deletes, task toggles, and completed reviews all stream in without a page refresh.
- Sessions auto-refresh in the background and on tab focus, so a stale token never strands you on a loading screen.

## How the memory system works

- Every entry older than a day with no review is **due**.
- The **Review** page runs you through each due memory: a "which day was this?" quiz built from a snippet of your own writing, then the full entry, then a self-grade (**Again / Hard / Good / Easy**) that sets the next interval.
- **On This Day** uses the same quiz before revealing each past-year page on the dashboard.
- Grades update an SM-2-style schedule: first review lands on 1/3/7/14 days, and successful reviews climb the ladder (30, 60, 120, 240 days).

## Notes on encryption

- When enabled, only *new* entries are encrypted; previously saved entries remain as they were.
- The key is derived from your passphrase and kept in `sessionStorage` for the current tab session — reloading the same tab keeps it unlocked; a new session asks again.
- Search still works while encrypted: entries are decrypted in memory and filtered locally.
- **If you forget the passphrase, encrypted entries are unrecoverable.** There is no backdoor.
- The on-device lock (PIN/biometric) is a local convenience gate, not a replacement for account security.