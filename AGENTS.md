# Agent instructions — prototypes hub

This repo is the High Volume Prototypes hub (not Dayshape). Live site: https://arronleishman.github.io/prototypes/

## Goal

Keep shareable HTML mocks in one place. Reviewers open a mock URL, leave feedback on **that prototype only**, and updates go live on push to `main`.

## Layout

- `index.html` — internal landing page (gated by `internalAccessKey`)
- `manifest.json` — list of mocks (required for hub cards)
- `mocks/*.html` — individual prototypes (**public** share links)
- `feedback.html?id=<prototype-id>` — internal per-prototype inbox (gated)
- `changelog.html?id=<prototype-id>` — internal build to-do / annotated changelog (gated)
- `config.js` — site name, Supabase keys, `internalAccessKey` (do not remove keys)
- `shared/access.js` — hub/thread access gate
- `shared/feedback-store.js`, `shared/feedback.js`, `shared/feedback.css` — feedback widget
- `shared/changelog-store.js` — changelog / done-toggle store
- `supabase-changelog.sql` — run once in Supabase for shared changelog sync
- `scripts/add-changelog.mjs` — agent/CLI helper to add a changelog item
- `.cursor/rules/in-dev-changelog.mdc` — auto-log changes when status is `in-development`

## Adding or updating a mock

1. Put/update the file at `mocks/<id>.html` (kebab-case id).
2. On the root element:

```html
<html lang="en-GB" data-prototype-id="<id>" data-prototype-title="<Human title>">
```

3. Before `</body>`:

```html
<script src="../config.js"></script>
<script src="../shared/access.js"></script>
<script src="../shared/feedback-store.js"></script>
<script src="../shared/telemetry-store.js"></script>
<script src="../shared/telemetry.js" defer></script>
<script src="../shared/feedback.js" defer></script>
```

4. Register/update `manifest.json` (`id` must match `data-prototype-id`):

```json
{
  "id": "<id>",
  "title": "<Human title>",
  "description": "<One-line blurb>",
  "path": "mocks/<id>.html",
  "status": "active",
  "updated": "YYYY-MM-DD"
}
```

5. Commit and push to `main` (GitHub Pages deploys automatically).

## Do / don’t

- **Do** keep each mock self-contained HTML when possible.
- **Do** scope feedback to the prototype via `data-prototype-id`.
- **Do** update `manifest.json` whenever you add/rename a mock.
- **Do** share **mock URLs only** with external reviewers (Share on the hub card).
- **Don’t** share the hub URL (or `?key=…`) outside your team.
- **Don’t** put Dayshape app source here — HTML mocks only.
- **Don’t** remove or overwrite `supabaseUrl` / `supabaseAnonKey` / `internalAccessKey` in `config.js`.
- **Don’t** mix feedback across prototypes or reintroduce Formspree/email unless asked.

## Share URLs (after push)

- **Reviewer (public mock):** `https://arronleishman.github.io/prototypes/mocks/<id>.html`  
  They can use the mock + leave feedback. No hub, no View thread.
- **Internal hub:** use **Copy hub link** on the hub (includes `?key=…`)  
  Or: `https://arronleishman.github.io/prototypes/?key=<internalAccessKey>`
- **Internal feedback:** from the hub only (also requires the key)
