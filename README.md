# Daily Ink

A React + Vite daily journal app styled with Tailwind CSS. Entries save in the browser until you add Supabase credentials.

## Setup

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in your Supabase project values when you want cloud sync:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Scripts

- `npm run dev` — local development
- `npm run build` — production build
- `npm run preview` — preview the production build

## Structure

- `src/components` — shared UI
- `src/pages` — routes
- `src/hooks` — React hooks
- `src/utils` — helpers (dates, Supabase client)
