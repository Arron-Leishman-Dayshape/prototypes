# Prototypes hub

Static site for HTML mocks: one landing page, shareable URLs, live updates via git deploy, and a feedback button on every mock.

## Quick start (local)

```bash
cd ~/Desktop/prototypes
npx --yes serve .
```

Open the URL it prints (usually `http://localhost:3000`). Don’t open `index.html` as `file://` — the manifest fetch needs HTTP.

## Add a mock

1. Drop the HTML file in `mocks/` (e.g. `mocks/my-flow.html`).
2. At the end of that file’s `<body>`, before `</body>`, add:

```html
<script src="../config.js"></script>
<script src="../shared/feedback.js" defer></script>
```

3. Register it in `manifest.json`:

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

4. Commit and push — the live site updates; existing share links keep working.

## Deploy (free)

### Cloudflare Pages (recommended)

1. Create a GitHub repo and push this folder.
2. [Cloudflare Pages](https://pages.cloudflare.com) → Connect repo.
3. Build settings: **Framework preset** None · **Build command** empty · **Output directory** `/` (or leave blank for root).
4. You’ll get a URL like `https://your-project.pages.dev`.

### Netlify

1. Push to GitHub.
2. [Netlify](https://app.netlify.com) → Add new site → Import from Git.
3. Publish directory: `.` (repo root). No build command.

### GitHub Pages

Works if the site is at the repo root (or `/docs`). Enable Pages in repo Settings. Note: Paths stay relative, so this folder layout works as-is.

## Feedback emails (Formspree)

1. Sign up at [formspree.io](https://formspree.io) (free tier is enough).
2. Create a form → copy the ID from `https://formspree.io/f/XXXX`.
3. Put that ID in `config.js` as `formspreeId: 'XXXX'`.
4. Redeploy.

Until Formspree is set, feedback still works: it’s stored in the reviewer’s browser `localStorage` (useful for demos, not for collecting remote comments).

## Heatmaps (optional Clarity)

1. Create a project at [clarity.microsoft.com](https://clarity.microsoft.com).
2. Paste the project ID into `config.js` as `clarityId`.
3. Redeploy — Clarity loads on the hub and every mock that includes `feedback.js`.

## Share with reviewers

- Hub: `https://your-site.pages.dev/`
- One mock: `https://your-site.pages.dev/mocks/practitioner-kanban.html`

They open the page, use the floating **Feedback** button, and you get the note (+ page URL, rating, optional name) via Formspree.
