---
name: invitation-design
description: >-
  Creates or replaces invitation designs in template-editor-starter-kit. Use when
  the user provides a design prompt, mood board, aesthetic brief, or asks to
  build a new wedding invitation template. Only edits template/ — never core/.
  Follow assemble workflow and per-design editor sections from config.json.
---

# Invitation Design Skill

Use this skill when the user wants a **new invitation design** in `template-editor-starter-kit`.

**Trigger phrases:** "create a design", "new template", "make an invitation like…", "English chateau style", "swap the template", any visual/aesthetic brief for a wedding invitation editor product.

**Required context:** User should attach this file (`SKILL.md`) plus their design prompt.

---

## What this repo is (read first)

This is **not** a multi-template platform. It is a **single-design editor factory**:

- **`core/`** = shared engine (editor, API, runtime). **Never edit for a new design.**
- **`template/`** = the only folder you change for a new design.
- **`npm run assemble`** merges both into **`site/`** (deploy output).
- **One Etsy product = one repo = one Netlify site = one `template/` folder.**

The buyer opens a URL, **signs in with Clerk**, creates or opens invitations from the dashboard, edits, publishes, and shares `/i/{publicId}` with guests. Guest invitation pages stay public — no login for guests.

**Auth, dashboard, RSVP inboxes, and invitation naming are in `core/`** — do not re-implement them per design.

---

## Golden rules (do not break these)

1. **Only edit `template/`** unless the user explicitly asks to fix a core engine bug.
2. **Never edit `site/`** — it is generated. Always run `npm run assemble` after template changes.
3. **Never duplicate `core/public/js/editor.js`** into template. Use `config.json` to control sections.
4. **`templateId` must be unique** per product (lowercase, hyphens, e.g. `english-chateau-01`).
5. **`defaults.js`, `render.js`, and `config.json` must stay in sync** — same fields, same features.
6. **`render.js` must register via** `window.InvitationTemplates.register(window.__INVITE_TEMPLATE_ID__, …)` — assemble patches the string literal; write the register call with a string id and assemble rewrites it.
7. **Run assemble and verify** before declaring done.

---

## Design prompt → implementation workflow

Copy this checklist and track progress:

```
Design task:
- [ ] 1. Parse the design brief (visual style, sections needed, features)
- [ ] 2. Choose templateId, name, siteTitle, brandName
- [ ] 3. Update template/config.json (sections + supportedFeatures)
- [ ] 4. Rewrite template/defaults.js (sample content matching the design)
- [ ] 5. Rewrite template/render.js (invitation HTML/CSS structure)
- [ ] 6. Write template/styles.css (design-specific styles)
- [ ] 7. Add template/assets/ (placeholder paths or describe needed files)
- [ ] 8. Run npm run assemble
- [ ] 9. Verify editor sections match config (hidden sections not shown)
- [ ] 10. Verify preview renders without console errors
```

### Step 1 — Parse the brief

Extract:

| Question | Maps to |
|----------|---------|
| Visual style (colors, fonts, layout) | `styles.css`, `render.js`, `theme.colors` in defaults |
| Gatefold / opening animation? | `supportedFeatures: "gatefold"`, gate HTML in render.js |
| Countdown / save-the-date? | section `when`, `content.scratch` |
| Multi-day events? | section `events`, `content.events[]` |
| Travel / journey info? | section `journey`, `content.journey` |
| Background music? | section `media`, `content.media.musicUrl` |
| RSVP form? | section `rsvp`, `content.rsvp` |
| Sections to **omit** | Remove from `editor.sections` AND do not render in `render.js` |

### Step 2 — `template/config.json`

Always update all fields:

```json
{
  "templateId": "your-design-slug-01",
  "name": "Human Readable Name",
  "version": "1.0.0",
  "siteTitle": "Your Design Invitation Editor",
  "brandName": "HoneyBee Studio",
  "supportedFeatures": [],
  "editor": {
    "sections": ["couple", "cover", "intro", "when", "events", "rsvp", "closing", "publish"],
    "features": []
  }
}
```

**`supportedFeatures` values** (document what render.js implements):

| Feature | Meaning |
|---------|---------|
| `gatefold` | Animated gate/door opening on first screen |
| `countdown` | Live countdown to wedding date |
| `scratch` | Scratch-to-reveal date cards |
| `events` | Multi-event schedule section |
| `journey` | Travel / directions section |
| `rsvp` | Guest RSVP form |
| `maps` | Google Maps links on events/location |
| `calendar` | Add-to-calendar buttons |
| `music` | Background audio player |

Only list features the design actually uses.

### Step 3 — Editor sections (different per design)

The editor reads `config.json` → `editor.sections` at assemble time → `window.__INVITE_EDITOR__`.

**Available section IDs** (must match `id="sec-{id}"` in `core/public/editor.html`):

| ID | Panel | Omit when… |
|----|-------|------------|
| `couple` | Names | Never (almost always needed) |
| `cover` | Hero, date, timezone | Never for standard designs |
| `intro` | Opening copy | Minimal / save-the-date only designs |
| `when` | Countdown + scratch | No countdown or scratch reveal |
| `events` | Event list | Single-day, no schedule |
| `journey` | Travel info | No destination/travel content |
| `media` | Music upload | Silent invitations |
| `rsvp` | RSVP settings | No guest replies |
| `closing` | Closing line | Ultra-minimal designs |
| `publish` | Share link | Auto-included — do not remove from config |

**Example — minimal save-the-date:**

```json
"editor": {
  "sections": ["couple", "cover", "when", "closing", "publish"]
}
```

**Example — full weekend wedding:**

```json
"editor": {
  "sections": ["couple", "cover", "intro", "when", "events", "journey", "media", "rsvp", "closing", "publish"]
}
```

When you omit a section:
1. Remove it from `editor.sections`
2. Do **not** render that block in `render.js` (or wrap in `if (content.journey?.enabled)` etc.)
3. You may leave unused defaults in `defaults.js` — harmless

### Step 4 — `template/defaults.js`

- Keep `TEMPLATE_ID` and `TEMPLATE_VERSION` — assemble overwrites them from config.
- Export `defaultContent()` returning the full content object.
- Sample names, dates, and copy should match the **design aesthetic** (not generic placeholders if the brief specifies a theme).
- Every field `render.js` reads must exist here with sensible defaults.
- Use `/assets/...` paths for bundled media.

**Content paths the editor can edit** (use these — do not invent new top-level keys unless render-only):

```
content.couple.{brideName, groomName}
content.weddingDateTime.{date, startTime, timezone}
content.text.* — see core/public/js/editor.js TEXT_FIELDS
content.scratch.{enabled, cards[], completionText}
content.events[]
content.journey.{enabled, title, subtitle, departLine, seatNote, meetHeading, meetLine, stopNote, arrivalHeading, arrivalLine, extraNote, mapsUrl}
content.media.{musicUrl, heroImageUrl, gallery}
content.rsvp.{enabled, deadline, attendanceOptions, notificationEmails}
content.location.{venue, address, mapsUrl}
content.theme.{colors}
content.language — keep "en"
```

If the design needs copy the default editor cannot edit, store it in `content.text` using an existing field creatively, or accept it as fixed copy in `render.js`.

### Step 5 — `template/render.js`

Structure (follow the Classic Floral example in `template/render.js`):

```javascript
(() => {
  "use strict";
  const { escapeHtml, safeUrl, formatDate, formatShortDate, formatTime, chrome } = window.InviteLib;

  window.InvitationTemplates.register("placeholder-id", {
    id: "placeholder-id",  // assemble syncs id from config
    version: "1.0.0",
    render(root, invitation, options) {
      const content = invitation.content || {};
      // Build HTML string, assign root.innerHTML
      // Call window.InviteRuntime helpers after mount if needed
    },
  });
})();
```

**Render rules:**

- Use `escapeHtml()` for all user text — prevents XSS.
- Use `safeUrl()` for links and media URLs.
- Use `window.InviteLib` date/time formatters for consistency.
- Respect `options.embedded` for editor preview (pass through to runtime).
- Gate optional blocks: `if (content.journey?.enabled)`, `if (content.rsvp?.enabled !== false)`, etc.
- Asset fallbacks: `safeUrl(content.media?.heroImageUrl) || "/assets/hero.jpg"`
- After setting `root.innerHTML`, the runtime (`runtime.js`) attaches interactivity — follow existing patterns for gatefold, scratch canvases, countdown, RSVP.

**Do not** import modules. This runs in the browser as a plain script.

### Step 6 — `template/styles.css`

- Design-specific overrides only.
- Base styles live in `core/public/css/invitation.css`.
- Assemble copies this to `site/public/css/template.css` and links it in HTML.
- Use CSS variables from theme when possible: `content.theme.colors`.

### Step 7 — `template/assets/`

- Reference files as `/assets/filename.ext` in defaults and render.
- If you cannot create binary assets, use sensible filenames in code and add a comment listing required assets for the user.
- Do not hotlink external images as defaults (buyer uploads replace them).

### Step 8 — Assemble and verify

```bash
npm run assemble
```

Local test (requires `.env` with `MONGODB_URI`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`):

```bash
npm run dev
```

Sign in at http://localhost:8888, create an invitation, verify preview and publish.

**Verification checklist:**

- [ ] `site/public/js/template-meta.js` has correct `__INVITE_TEMPLATE_ID__` and `__INVITE_EDITOR__`
- [ ] `site/public/js/templates/template.js` exists and registers template
- [ ] Editor sidebar shows only configured sections
- [ ] Preview renders the design (no "Template unavailable" error)
- [ ] Omitted sections are hidden in editor AND absent from guest view
- [ ] Publish flow unchanged (do not break `core/`)

---

## Common mistakes (avoid)

| Mistake | Fix |
|---------|-----|
| Editing `core/public/js/editor.js` for one design | Use `config.json` editor.sections |
| Editing files in `site/` | Edit `template/`, run assemble |
| Mismatched `templateId` in config vs render | Let assemble patch; use placeholder string in register call |
| New editor fields without HTML inputs | Use existing `content.text.*` fields or fixed copy in render |
| Rendering journey when section omitted | Check config intent; gate with `enabled` flag |
| Forgetting `escapeHtml` on user text | Always escape in render.js |
| Same `templateId` across two Etsy products | Unique slug per product/repo |

---

## Extending the editor (rare)

Only if the user explicitly needs **new editable fields** not covered by existing sections:

1. Add form fields to `core/public/editor.html` inside the relevant `sec-*` section
2. Wire read/write in `core/public/js/editor.js`
3. Add validation in `core/server/lib/validate.js`
4. This change affects **all designs using that core version** — prefer reusing existing fields first.

Default approach: **different designs = different sections + different render/layout**, not different editor code.

---

## File map (what to touch)

| File | Action per design |
|------|-------------------|
| `template/config.json` | Always rewrite |
| `template/defaults.js` | Always rewrite |
| `template/render.js` | Always rewrite |
| `template/styles.css` | Always rewrite |
| `template/assets/*` | Add/replace assets |
| `core/**` | Do not touch |
| `scripts/assemble.js` | Do not touch |
| `site/**` | Never edit directly |

---

## Example agent prompt (user copy-paste)

```
@SKILL.md

Design: Art deco golden Gatsby invitation
- Black and gold, geometric borders
- No journey section
- Countdown + scratch reveal enabled
- Three events (welcome, ceremony, reception)
- RSVP enabled, no background music
- templateId: art-deco-gatsby-01
```

Expected agent behavior: rewrite all of `template/`, run assemble, report verification results and any assets the user must add manually.

---

## Duplicating the repo for another Etsy product

When the user copies this repo for a new design:

1. **Only edit `template/`** — never `core/` unless fixing a shared engine bug.
2. Update `config.json` with a new unique `templateId`, `siteTitle`, and `brandName`.
3. Rewrite `defaults.js`, `render.js`, `styles.css`, and `assets/`.
4. Run `npm run assemble` (or `npm run dev`, which assembles first).
5. Reuse the same Clerk keys and MongoDB cluster; add the new Netlify domain in Clerk.

Do not touch Clerk auth, dashboard, or RSVP code — it ships with `core/` on every copy.

---

## Thoughts behind this architecture

**Problem:** Selling invitation editors on Etsy means many designs, frequent new products, and buyers who need to manage invitations and RSVP replies.

**Wrong approach:** Copy the whole app per design → editor bugs multiply, features diverge, maintenance nightmare.

**Right approach:** Stable engine + swappable template module + assemble step → same editor quality everywhere, design work isolated to ~4 files.

**Per-design editor sections:** Not every invitation needs journey or scratch cards. `config.json` drives which panels appear so buyers see a clean, relevant editor — not empty sections for features their design does not use.

**Clerk in `core/`:** One Clerk app serves all design deploys. Each site reuses the same keys; invitations are scoped by Clerk user (`ownerId`) and `templateId`. Duplicate the repo, swap `template/`, deploy — auth and dashboards work without extra setup.

**Invitation naming:** The **Name** panel in the editor (always visible, not in `editor.sections`) lets buyers label drafts on the dashboard. Default label: **Unnamed invitation**. This is separate from couple names on the guest invitation.

---

## Reference: Classic Floral

The bundled example (`classic-floral-01`) demonstrates gatefold, scratch, events, journey, RSVP, and music. Read these before writing a new design:

- `template/config.json`
- `template/defaults.js`
- `template/render.js`
- `template/styles.css`

Use as structural reference; replace visuals and copy entirely for the new brief.
