# Setting up Cozy Planner (100% free)

The app works right away with **no setup**: everything saves on the device it's opened on. These steps add the extras, all on free tiers with **no credit card**.

| Step | What it gives her | Time |
|---|---|---|
| 1. Deploy to Vercel | A link she can open and install on her phone | 5 min |
| 2. Supabase | Sync between phone + laptop, sign-in | 10 min |
| 3. Groq key | TT gives real AI replies (offline TT still works without it) | 3 min |
| 4. Web push | Reminders arrive even when the app is closed | 10 min |
| 5. Keep-alive | Stops the free Supabase project from pausing | 2 min |

---

## 0. Run it locally

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests
npm run e2e          # browser tests (first run: npx playwright install chromium)
```

## 1. Deploy (Vercel Hobby, free)

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** → pick the repo → **Deploy**. The defaults work (framework Vite, output `dist`).
3. On her iPhone: open the link in **Safari** → Share → **Add to Home Screen**. On Android, Chrome offers **Install app**.

(Netlify and Cloudflare Pages also work; `public/_redirects` is included.)

### Or: GitHub Pages (free)

1. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`. The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) builds and publishes to `https://<your-username>.github.io/<repo-name>/` (this repo: `https://tonyw-y.github.io/life-planner/`).
3. To turn on sync and push reminders, add repo secrets (**Settings → Secrets and variables → Actions**): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_VAPID_PUBLIC_KEY`. Then re-run the workflow. In Supabase step 3 below, use the Pages URL (including `/life-planner/`) as the Site URL and redirect URL.

Pick **one** address (Vercel *or* Pages) for her to use. Data saved on the device belongs to the address it was opened at.

## 2. Sync with Supabase (free)

1. Create a project at [supabase.com](https://supabase.com) (Free plan).
2. **SQL Editor** → paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
3. **Authentication → URL Configuration**: set **Site URL** to the Vercel link, and add it under **Redirect URLs**. This is where the magic sign-in link lands.
4. **Project Settings → API**: copy the **Project URL** and **anon public** key.
5. In Vercel → Project → **Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL` = project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key

   Then redeploy. For local dev, put the same values in `.env` (copy `.env.example`).
6. In the app: **Settings → Sync** → enter her email → open the magic link. Do the same on each device with the same email.

Free limits: 500 MB database and 50k monthly users. One person's planner uses a tiny fraction. Images are compressed to roughly 200 KB or less. Settings shows a usage meter that warns at 80%.

## 3. TT's AI with Groq (free)

1. Get a key at [console.groq.com](https://console.groq.com) (free, no card).
2. Install the Supabase CLI (`brew install supabase/tap/supabase`), then:

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set GROQ_API_KEY=gsk_your_key
supabase functions deploy tt-chat
```

If the free rate limit is ever hit, or there's no key, TT automatically uses its built-in offline replies. Crisis messages are always handled by the app's built-in safety response (988 / 741741 / 911), never left to the AI alone.

## 4. Reminders when the app is closed (free Web Push)

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Add the **public** key to Vercel env as `VITE_VAPID_PUBLIC_KEY` and redeploy.
3. Give the server both keys:

```bash
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
supabase functions deploy send-reminders
```

4. In the **SQL Editor**, store two secrets, then run [`0002_reminder_cron.sql`](supabase/migrations/0002_reminder_cron.sql):

```sql
select vault.create_secret('https://YOUR-PROJECT.supabase.co', 'project_url');
select vault.create_secret('YOUR-SERVICE-ROLE-KEY', 'service_role_key');  -- Settings → API → service_role
```

5. On her phone (installed to the home screen, signed in): **Settings → Turn on notifications**.

This uses about 43k function calls a month. The free tier allows 500k.

While the app is open, reminders also fire in-app with no setup at all.

## 5. Keep the free project awake

Free Supabase projects pause after 7 days with no activity. The included GitHub Action [`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) pings the database every 3 days. In GitHub → repo → **Settings → Secrets and variables → Actions**, add `SUPABASE_URL` and `SUPABASE_ANON_KEY`. That's it.

---

### Good to know

- **Nothing is lost on exit.** Every change is written to the device's database right away, half-typed text autosaves, and the timer is stored as timestamps. **Settings → Your data** has backup download/restore, automatic weekly snapshots, and a 30-day Trash.
- **Location-based alerts** only work while the app is open. Web apps can't watch location in the background.
- **Total cost: $0.** No paid APIs, no trials, nothing that asks for billing.
