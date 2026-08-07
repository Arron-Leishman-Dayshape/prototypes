# Agent instructions — prototypes hub

This repo is the High Volume Prototypes hub (not Dayshape). Live site: https://arronleishman.github.io/prototypes/

## Goal

Keep shareable HTML mocks in one place. Reviewers open a mock URL, leave feedback on **that prototype only**, and updates go live on push to `main`.

## Layout

- `index.html` — landing page (reads `manifest.json`)
- `manifest.json` — list of mocks (required for hub cards)
- `mocks/*.html` — individual prototypes
- `feedback.html?id=<prototype-id>` — per-prototype feedback inbox
- `config.js` — site name + Supabase keys (do not remove keys)
- `shared/feedback-store.js`, `shared/feedback.js`, `shared/feedback.css` — feedback widget

## Adding or updating a mock

1. Put/update the file at `mocks/<id>.html` (kebab-case id).
2. On the root element:

```html
<html lang="en-GB" data-prototype-id="<id>" data-prototype-title="<Human title>">
```

3. Before `</body>`:

```html
<script src="../config.js"></script>
<script src="../shared/feedback-store.js"></script>
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
- **Don’t** put Dayshape app source here — HTML mocks only.
- **Don’t** remove or overwrite `supabaseUrl` / `supabaseAnonKey` in `config.js`.
- **Don’t** mix feedback across prototypes or reintroduce Formspree/email unless asked.

## Share URLs (after push)

- Hub: `https://arronleishman.github.io/prototypes/`
- Mock: `https://arronleishman.github.io/prototypes/mocks/<id>.html`
- Feedback: `https://arronleishman.github.io/prototypes/feedback.html?id=<id>`
