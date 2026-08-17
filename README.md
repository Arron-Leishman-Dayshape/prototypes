# High Volume Prototypes

Static site for HTML mocks: one landing page, shareable URLs, live updates via git deploy, and **feedback stored per prototype** (no email).

## Quick start (local)

```bash
cd ~/Desktop/prototypes
npx --yes serve .
```

Open the URL it prints. Don’t use `file://` — the manifest needs HTTP.

## How feedback works

- Each mock has its own thread (`feedback.html?id=practitioner-kanban`).
- Reviewers use the floating **Feedback** button on that mock only.
- On the hub, every card links to **Open** and that prototype’s **Feedback** inbox.
- Notes never mix across prototypes.

## Feedback store (shared across reviewers)

Static HTML can’t keep a shared inbox by itself. Use a free [Supabase](https://supabase.com) project (takes ~5 minutes):

1. Create a project → **SQL** → run:

```sql
create table feedback (
  id uuid primary key default gen_random_uuid(),
  prototype_id text not null,
  prototype_title text,
  name text,
  rating text,
  message text not null,
  page_url text,
  page_path text,
  created_at timestamptz default now()
);

create index on feedback (prototype_id, created_at desc);

alter table feedback enable row level security;
create policy "Anyone can read feedback" on feedback for select using (true);
create policy "Anyone can add feedback" on feedback for insert with check (true);
```

2. **Project Settings → API** → copy **Project URL** and **anon public** key into `config.js`:

```js
supabaseUrl: 'https://xxxx.supabase.co',
supabaseAnonKey: 'eyJhbGciOi...',
```

3. Commit, push, redeploy.

Until those keys are set, feedback still saves **per prototype in that browser only** (fine for your own testing).

### Optional screenshots

Feedback can include an optional UI screenshot (click an element or capture the page). Run this once in the Supabase SQL Editor so images sync for everyone:

```sql
alter table feedback
  add column if not exists screenshot_data text;
```

(Also in `supabase-screenshot.sql`.)

### First-party heatmaps & sessions

Mocks record clicks, scroll depth, and sessions automatically. Run `supabase-telemetry.sql` once in Supabase so data syncs across reviewers. Insights → Heatmaps / Sessions then show that data (no Clarity required).

### Export

On each prototype’s Insights page, use **Export comments** to download a self-contained HTML file (comments + screenshots).

## Add a mock

1. Put the HTML in `mocks/` (e.g. `mocks/my-flow.html`).
2. On the root `<html>` tag:

```html
<html lang="en-GB" data-prototype-id="my-flow" data-prototype-title="My flow">
```

3. Before `</body>`:

```html
<script src="../config.js"></script>
<script src="../shared/feedback-store.js"></script>
<script src="../shared/feedback.js" defer></script>
```

4. Register in `manifest.json` (the `id` must match `data-prototype-id`):

```json
{
  "id": "my-flow",
  "title": "My flow",
  "description": "Short blurb for reviewers.",
  "path": "mocks/my-flow.html",
  "status": "active",
  "updated": "2026-08-07"
}
```

5. Push — share links keep working.

### Changelog (build to-dos)

Hub ⋯ menu → **Changelog** opens an internal to-do list per prototype:

- Annotated screenshots (select UI on the mock)
- Description of the change for developers
- **Mark done** / **Mark not done**

Run `supabase-changelog.sql` once in the Supabase SQL Editor so the list syncs across the team.

## Deploy (free)

### Cloudflare Pages

### GitHub Pages (primary)

Repo: `Arron-Leishman-Dayshape/prototypes`  
Live: `https://arron-leishman-dayshape.github.io/prototypes/`  
Deploy: push to `main` (Pages from branch `main` / root).

### Cloudflare Pages (optional)

1. Push this repo to GitHub (`Arron-Leishman-Dayshape/prototypes`).
2. [Cloudflare Pages](https://pages.cloudflare.com) → Connect repo.
3. Framework: **None** · Build command: empty · Output directory: `/` or blank.

### Netlify (optional)

Publish directory: `.` · No build command.

## Share with reviewers vs internal

- **Reviewers:** use **Share** on a hub card (or the mock URL). They get the mock only — can leave feedback, cannot open the hub or view threads.
- **Your team:** use **Copy hub link** on the hub (includes a secret `?key=`). That unlocks the hub + feedback inboxes.
- Change `internalAccessKey` in `config.js` anytime to revoke old hub links.

