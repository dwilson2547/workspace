# UI Redesign — Design Document

**Date:** 2026-02-21
**Scope:** Full frontend rebuild. No backend changes. All API endpoints already exist.

---

## Goals

- Replace bare inline-style HTML with a production-quality dark desktop UI
- Add the missing import flow (the critical gap — no media can be added without it)
- Add face correction UI (reassign, rename, merge) wired to existing backend endpoints
- Establish a consistent design system (color tokens, shared primitives) for future work

---

## Stack Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Styling | Tailwind CSS | Utility-first, no lock-in, works well with electron-vite |
| Interactive primitives | `@radix-ui/react-dropdown-menu` | Accessible dropdown for Import button, face reassign, people card menu |
| Shared components | 4 tiny primitives (Button, Input, Badge, Spinner) | Minimum abstraction that pays off — consistent focus/hover/disabled states |
| No backend changes | All endpoints exist | Backend is complete; this is purely frontend work |

---

## Color System

Defined as custom tokens in `tailwind.config.js`:

```
surface-0:  #0d0d17   outermost background
surface-1:  #13131f   main content area
surface-2:  #1e1e2e   sidebar
surface-3:  #252538   cards, hover states
text-primary:  #e2e8f0
text-muted:    #64748b
accent:        #6366f1  (indigo)
accent-hover:  #818cf8
danger:        #ef4444
success:       #22c55e
```

---

## App Shell

A new `AppShell.tsx` component wraps every route except `/setup`. It provides the persistent sidebar and the scrollable main content area.

**Layout:**
```
┌───────────────────────────────────────────────────┐
│ sidebar 200px fixed    │  main flex-1 overflow     │
│ ─────────────────────  │                           │
│  📷  Media Manager     │  <page content>           │
│                        │                           │
│  LIBRARIES             │                           │
│  ▸ Vacation 2024       │                           │
│  ▸ Family              │                           │
│  [+ New Library]       │                           │
│                        │                           │
│  ─────────────────     │                           │
│  People                │                           │
│  Settings              │                           │
└───────────────────────────────────────────────────┘
```

- Libraries list is fetched from `GET /libraries/`; items are clickable nav links
- `+ New Library` is an inline form (input + button) that appears on click
- Active route is highlighted with accent color left border
- `People` link is contextual — links to `/library/:name/people` for the currently active library
- Sidebar is always visible (200px); no collapse needed at desktop widths

---

## Pages

### Setup (`/setup`)

First-run wizard. No functional changes, restyled:
- Centered card on `surface-0` background
- "Choose data folder" button → `window.electronAPI.selectFolder()`
- Selected path display → "Continue" button → navigate to `/`

### Home (`/`)

The sidebar now handles library navigation. The Home route:
- If libraries exist → redirect to `/library/:firstName`
- If no libraries exist → centered empty-state card with "Create your first library" CTA (inline form)

### Library (`/library/:name`)

The primary working view.

**Toolbar (top of content area):**
```
Vacation 2024          [Import Media ▾]  [Sort: Newest ▾]
```

**Import Media dropdown** (Radix DropdownMenu):
- "Import files…" → `window.electronAPI.selectFiles()` → array of paths → `POST /libraries/{name}/import/`
- "Import folder…" → `window.electronAPI.selectFolder()` → single path → `POST /libraries/{name}/import/`
- After import resolves: `queryClient.invalidateQueries(['media', libraryName])` to refresh grid
- ImportProgress panel at bottom of screen shows real-time task progress via WebSocket

**Sort dropdown:**
- Newest first (default, `sort_by=imported_at`, `cursor` descending)
- Oldest first (`sort_by=imported_at` ascending)

**Grid:**
- Existing virtualized infinite-scroll grid, Tailwind-styled cards with hover effect
- 6 columns (was 5), 160px tall cards

**Empty state** (when no media):
```
┌──────────────────────────────────────┐
│  No media in this library yet.       │
│  [Import Media ▾]                    │
└──────────────────────────────────────┘
```

### Media Detail (`/library/:name/media/:id`)

Two-column layout:

```
┌────────────────────────────────────────┬──────────────┐
│  [← Back]                             │  Info panel  │
│                                        │              │
│  [full-res image with SVG overlays]    │  Description │
│                                        │  ─────────── │
│  Face boxes: clickable, accent border  │  EXIF        │
│  on hover                              │  ─────────── │
│                                        │  People      │
└────────────────────────────────────────┴──────────────┘
```

**Face correction (inline):**
- Each face bounding box is interactive (Radix DropdownMenu trigger)
- Click opens dropdown anchored to the face box:
  ```
  Currently: Alice
  ─────────────────
  Reassign to:
    ◉ Alice  ✓ (current)
    ○ Bob
    ○ Unknown person #3
  ```
- Selecting a person calls `POST /libraries/{name}/people/reassign` with `{ face_id, person_id }`
- Optimistic update: box label changes immediately; right panel people chips refresh on success

### People Browser (`/library/:name/people`)

Grid of circular avatar cards. Each card:
- 160×160 circular face thumbnail (existing logic)
- Name label below
- Face count badge
- `⋮` context menu (Radix DropdownMenu):
  - **Rename** → card name becomes inline `<input>`, confirmed on Enter/blur → `PUT /libraries/{name}/people/{id}/rename`
  - **Merge into…** → opens merge dialog

**Merge dialog** (native `<dialog>` or modal div):
```
Merge Alice into…
[🔍 Search people…       ]
──────────────────────────
  Bob
  Unknown person #3
  Unknown person #5
──────────────────────────
[Cancel]  [Merge → Bob]
```
- Filtered client-side from the already-fetched people list
- Confirm calls `POST /libraries/{name}/people/merge` with `{ source_person_id, target_person_id }`
- After success: source card removed from grid, target card face count updated

Clicking a card navigates to `/library/:name?personId=X` (existing behavior).

### Settings (`/settings`)

Three styled sections:

1. **Data Root** — current path in a code block, "Change folder…" button
2. **HDBSCAN Parameters** — styled range sliders with value display, "Save" button
3. **Clustering Runs** — styled table per library (ID, date, active badge, params, Activate button), "New Clustering Run" button

---

## Shared Primitives (`src/components/ui/`)

Four components, all thin Tailwind wrappers:

| Component | Used for |
|---|---|
| `Button` | All buttons — variants: `default`, `ghost`, `danger` |
| `Input` | Text inputs — consistent focus ring, sizing |
| `Badge` | Active indicator, face count, status |
| `Spinner` | Loading states |

---

## New Dependencies

```
tailwindcss
autoprefixer
postcss
@radix-ui/react-dropdown-menu
```

No backend changes. No other new dependencies.

---

## File Changes Summary

| File | Change |
|---|---|
| `tailwind.config.js` | New — custom color tokens |
| `postcss.config.js` | New — Tailwind PostCSS setup |
| `src/index.css` | Add Tailwind directives |
| `src/components/ui/Button.tsx` | New primitive |
| `src/components/ui/Input.tsx` | New primitive |
| `src/components/ui/Badge.tsx` | New primitive |
| `src/components/ui/Spinner.tsx` | New primitive |
| `src/components/AppShell.tsx` | New — sidebar layout |
| `src/App.tsx` | Wrap routes in AppShell (except /setup) |
| `src/pages/Setup.tsx` | Restyle only |
| `src/pages/Home.tsx` | Redirect logic + empty state |
| `src/pages/Library.tsx` | Import toolbar + sort dropdown |
| `src/components/MediaGrid.tsx` | Tailwind style, 6 columns |
| `src/components/MediaCard.tsx` | Tailwind style + hover |
| `src/pages/MediaDetail.tsx` | Two-column layout + clickable face boxes with reassign |
| `src/pages/People.tsx` | Card grid + ⋮ menu + merge dialog |
| `src/components/PersonCard.tsx` | Tailwind style |
| `src/pages/Settings.tsx` | Styled sections |
| `src/components/ImportProgress.tsx` | Tailwind style |
