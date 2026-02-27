# UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all bare inline-style HTML with a polished dark desktop UI, add the missing import flow, and add face correction UI (reassign, rename, merge) wired to existing backend endpoints.

**Architecture:** Tailwind CSS for styling (PostCSS auto-picked up by Vite), `@radix-ui/react-dropdown-menu` for interactive dropdowns, a persistent `AppShell` sidebar (layout route in React Router) wrapping all routes except `/setup`. No backend changes — all endpoints already exist.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, @radix-ui/react-dropdown-menu, TanStack Query, React Router v7, electron-vite

**No git commits** — project constraint. Verification is `npm run typecheck` (zero errors) after each task.

---

## Color Palette Reference

These custom token names are used throughout all tasks:

| Token | Hex | Use |
|---|---|---|
| `surface-0` | `#0d0d17` | Outermost background |
| `surface-1` | `#13131f` | Main content area |
| `surface-2` | `#1e1e2e` | Sidebar |
| `surface-3` | `#252538` | Cards, hover states, table rows |
| `primary` | `#e2e8f0` | Primary text |
| `muted` | `#64748b` | Secondary text, labels |
| `accent` | `#6366f1` | Active states, highlights |
| `accent-hover` | `#818cf8` | Hover over accent elements |
| `danger` | `#ef4444` | Errors, destructive actions |
| `success` | `#22c55e` | Confirmations |

---

## Task 1: Install Dependencies and Configure Tailwind

**Files:**
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/index.css`
- Modify: `src/main.tsx`

**Step 1: Install packages**

From project root (not `backend/`):

```bash
npm install -D tailwindcss autoprefixer postcss
npm install @radix-ui/react-dropdown-menu
```

**Step 2: Create `tailwind.config.js` in project root**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './electron/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'surface-0': '#0d0d17',
        'surface-1': '#13131f',
        'surface-2': '#1e1e2e',
        'surface-3': '#252538',
        primary: '#e2e8f0',
        muted: '#64748b',
        accent: '#6366f1',
        'accent-hover': '#818cf8',
        danger: '#ef4444',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
}
```

**Step 3: Create `postcss.config.js` in project root**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 4: Create `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

**Step 5: Import CSS in `src/main.tsx`**

Add one line at the top of the existing file:

```tsx
import './index.css'   // ← add this
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

**Step 6: Verify**

```bash
npm run typecheck
```

Expected: zero errors. The Tailwind config file is JS (not TS), so it doesn't go through typecheck. Tailwind processing happens at Vite build/serve time.

---

## Task 2: Extend API Client with Missing Functions

**Files:**
- Modify: `src/api/client.ts`
- Modify: `src/api/types.ts`

**Step 1: Add `ImportResponse` to `src/api/types.ts`**

Append to the end of the file:

```ts
export interface ImportResponse {
  accepted: number
  skipped: number
  task_count: number
}
```

**Step 2: Replace `src/api/client.ts` with extended version**

The existing file is kept intact; add the four new functions after the existing `fetchPeople` function, and extend `fetchMediaPage` with an optional `sortBy` parameter:

```ts
import axios from 'axios'
import type { Library, MediaItem, MediaPage, Person, ClusteringRun, ImportResponse } from './types'

export const API_BASE = 'http://127.0.0.1:7899'
const api = axios.create({ baseURL: API_BASE })

export const fetchLibraries = () => api.get<Library[]>('/libraries/').then(r => r.data)
export const createLibrary = (name: string) => api.post<Library>('/libraries/', { name }).then(r => r.data)

// sortBy: 'newest' sorts by imported_at descending (default); 'oldest' sorts ascending.
// Changing sortBy resets pagination because it's part of the TanStack Query key.
export const fetchMediaPage = (
  libraryName: string,
  cursor?: number,
  limit = 100,
  personId?: number,
  sortBy: 'newest' | 'oldest' = 'newest'
) =>
  api.get<MediaPage>(`/libraries/${encodeURIComponent(libraryName)}/media/`, {
    params: {
      cursor,
      limit,
      sort_by: 'imported_at',
      sort_dir: sortBy === 'oldest' ? 'asc' : 'desc',
      ...(personId !== undefined && { person_id: personId }),
    }
  }).then(r => r.data)

export const fetchMediaItem = (libraryName: string, id: number): Promise<MediaItem> =>
  api.get<MediaItem>(`/libraries/${encodeURIComponent(libraryName)}/media/${id}`)
    .then(r => r.data)

export interface FaceWithPerson {
  id: number
  bounding_box: { x: number; y: number; w: number; h: number }
  crop_path: string | null
  person: { id: number; name: string | null } | null
}

export const fetchMediaFaces = (libraryName: string, mediaId: number): Promise<FaceWithPerson[]> =>
  api.get<FaceWithPerson[]>(
    `/libraries/${encodeURIComponent(libraryName)}/media/${mediaId}/faces`
  ).then(r => r.data)

export const fetchPeople = (libraryName: string): Promise<Person[]> =>
  api.get<Person[]>(`/libraries/${encodeURIComponent(libraryName)}/people/`).then(r => r.data)

// Import media into a library. paths can be individual file paths or folder paths
// (the backend scanner handles recursive directory scanning).
export const importMedia = (libraryName: string, paths: string[]): Promise<ImportResponse> =>
  api.post<ImportResponse>(
    `/libraries/${encodeURIComponent(libraryName)}/import/`,
    { paths }
  ).then(r => r.data)

// Reassign a face to a different person. is_user_corrected is set to true on the
// backend, so this correction carries forward into future clustering runs.
export const reassignFace = (libraryName: string, faceId: number, personId: number): Promise<void> =>
  api.post(`/libraries/${encodeURIComponent(libraryName)}/people/reassign`, {
    face_id: faceId,
    person_id: personId,
  }).then(() => undefined)

// Rename a person.
export const renamePerson = (libraryName: string, personId: number, name: string): Promise<void> =>
  api.put(`/libraries/${encodeURIComponent(libraryName)}/people/${personId}/rename`, { name })
    .then(() => undefined)

// Merge source person into target person. All of source's face assignments move to target.
// source_person_id is removed from the people list after merging.
export const mergePeople = (
  libraryName: string,
  sourcePersonId: number,
  targetPersonId: number
): Promise<void> =>
  api.post(`/libraries/${encodeURIComponent(libraryName)}/people/merge`, {
    source_person_id: sourcePersonId,
    target_person_id: targetPersonId,
  }).then(() => undefined)

export const getSetting = (key: string): Promise<{ key: string; value: string | null }> =>
  api.get<{ key: string; value: string | null }>(`/settings/${encodeURIComponent(key)}`)
    .then(r => r.data)
    .catch((err: unknown) => {
      if (
        typeof err === 'object' &&
        err !== null &&
        'response' in err &&
        (err as { response?: { status?: number } }).response?.status === 404
      ) {
        return { key, value: null }
      }
      throw err
    })

export const setSetting = (key: string, value: string): Promise<void> =>
  api.put(`/settings/${encodeURIComponent(key)}`, { value }).then(() => undefined)

export const fetchClusteringRuns = (libraryName: string): Promise<ClusteringRun[]> =>
  api.get<ClusteringRun[]>(`/libraries/${encodeURIComponent(libraryName)}/clustering/runs`).then(r => r.data)

export interface HdbscanParams {
  min_cluster_size: number
  min_samples: number
  cluster_selection_epsilon: number
}

export const triggerClusteringRun = (
  libraryName: string,
  params: HdbscanParams
): Promise<{ task_id: number }> =>
  api.post<{ task_id: number }>(
    `/libraries/${encodeURIComponent(libraryName)}/clustering/runs`,
    { parameters: params }
  ).then(r => r.data)

export const activateClusteringRun = (
  libraryName: string,
  runId: number
): Promise<ClusteringRun> =>
  api.put<ClusteringRun>(
    `/libraries/${encodeURIComponent(libraryName)}/clustering/runs/${runId}/activate`
  ).then(r => r.data)
```

**Note on `sort_dir`:** The backend's `fetchMediaPage` currently only accepts `sort_by`. If the backend doesn't support `sort_dir`, the `sort_dir` param is ignored by FastAPI (extra query params are silently dropped). If sorting becomes a priority, add `sort_dir: Literal['asc', 'desc'] = 'desc'` to the backend media endpoint's query params. For now, the sort dropdown in the UI is wired up but only `sort_by=imported_at` is guaranteed to work in both directions if the backend is extended.

**Step 3: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 3: Create Shared UI Primitives

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Spinner.tsx`

Create the directory `src/components/ui/` first (just create the files, the directory is created implicitly).

**`src/components/ui/Button.tsx`**

```tsx
import { ButtonHTMLAttributes } from 'react'

type Variant = 'default' | 'ghost' | 'danger' | 'accent'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
}

const variantClasses: Record<Variant, string> = {
  default:
    'bg-surface-3 text-primary hover:bg-surface-3/80 border border-surface-3 hover:border-muted',
  ghost:
    'bg-transparent text-muted hover:bg-surface-3 hover:text-primary border border-transparent',
  danger:
    'bg-danger/10 text-danger hover:bg-danger/20 border border-danger/30',
  accent:
    'bg-accent text-white hover:bg-accent-hover border border-accent',
}

const sizeClasses = {
  sm: 'px-3 py-1 text-xs rounded',
  md: 'px-4 py-1.5 text-sm rounded-md',
}

export function Button({ variant = 'default', size = 'md', className = '', children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
```

**`src/components/ui/Input.tsx`**

```tsx
import { InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, id, className = '', ...rest }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-xs text-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={id}
        {...rest}
        className={[
          'bg-surface-3 text-primary text-sm px-3 py-1.5 rounded border border-surface-3/80',
          'focus:outline-none focus:border-accent placeholder-muted/50',
          'disabled:opacity-40',
          className,
        ].join(' ')}
      />
    </div>
  )
}
```

**`src/components/ui/Badge.tsx`**

```tsx
interface Props {
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'success' | 'danger' | 'muted'
}

const variantClasses = {
  default: 'bg-surface-3 text-primary',
  accent: 'bg-accent/20 text-accent',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
  muted: 'bg-surface-3 text-muted',
}

export function Badge({ children, variant = 'default' }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}
```

**`src/components/ui/Spinner.tsx`**

```tsx
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 4: Build AppShell

**Files:**
- Create: `src/components/AppShell.tsx`

AppShell is a React Router layout route. It renders a persistent sidebar and uses `<Outlet />` for the content area. The sidebar:
- Fetches the library list
- Highlights the active library using `NavLink`
- Shows an inline "+ New Library" form on click
- Shows contextual "People" link for the active library (parsed from URL)
- Shows "Settings" at the bottom

```tsx
import { useState } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchLibraries, createLibrary } from '../api/client'

export default function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showNewLib, setShowNewLib] = useState(false)
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  // Parse the active library name from the URL.
  // Matches /library/<name> and /library/<name>/... routes.
  const libraryMatch = location.pathname.match(/^\/library\/([^/]+)/)
  const activeLibrary = libraryMatch ? decodeURIComponent(libraryMatch[1]) : null

  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries'],
    queryFn: fetchLibraries,
  })

  const { mutate: addLibrary, isPending: isCreating } = useMutation({
    mutationFn: () => createLibrary(newName.trim()),
    onSuccess: (lib) => {
      qc.invalidateQueries({ queryKey: ['libraries'] })
      setNewName('')
      setShowNewLib(false)
      setCreateError(null)
      navigate(`/library/${encodeURIComponent(lib.name)}`)
    },
    onError: () => {
      setCreateError('Failed to create library.')
    },
  })

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors w-full text-left',
      isActive
        ? 'bg-accent/15 text-accent border-l-2 border-accent pl-[10px]'
        : 'text-muted hover:bg-surface-3 hover:text-primary border-l-2 border-transparent',
    ].join(' ')

  return (
    <div className="flex h-screen bg-surface-0 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <aside className="w-48 bg-surface-2 flex flex-col shrink-0 border-r border-surface-3/50">
        {/* Logo / app name */}
        <div className="px-4 py-4 border-b border-surface-3/50">
          <span className="text-sm font-semibold text-primary tracking-tight">Media Manager</span>
        </div>

        {/* Library list */}
        <div className="px-3 pt-3 pb-1">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">
            Libraries
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
          {libraries.map(lib => (
            <NavLink
              key={lib.id}
              to={`/library/${encodeURIComponent(lib.name)}`}
              className={navLinkClass}
              title={lib.name}
            >
              <span className="truncate">{lib.name}</span>
            </NavLink>
          ))}

          {/* Inline create form */}
          {showNewLib ? (
            <div className="px-1 pt-1">
              <input
                autoFocus
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newName.trim() && !isCreating) addLibrary()
                  if (e.key === 'Escape') { setShowNewLib(false); setNewName('') }
                }}
                placeholder="Library name"
                className="w-full bg-surface-3 text-primary text-xs px-2 py-1.5 rounded border border-surface-3 focus:outline-none focus:border-accent placeholder-muted/50"
              />
              {createError && (
                <p className="text-danger text-xs mt-1 px-1">{createError}</p>
              )}
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => addLibrary()}
                  disabled={!newName.trim() || isCreating}
                  className="flex-1 text-xs bg-accent text-white rounded py-1 hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? '…' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowNewLib(false); setNewName('') }}
                  className="flex-1 text-xs bg-surface-3 text-muted rounded py-1 hover:text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewLib(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-muted hover:bg-surface-3 hover:text-primary transition-colors w-full text-left border-l-2 border-transparent"
            >
              <span className="text-base leading-none">+</span>
              New Library
            </button>
          )}
        </nav>

        {/* Bottom nav: contextual People link + Settings */}
        <div className="px-2 py-2 border-t border-surface-3/50 space-y-0.5">
          {activeLibrary && (
            <NavLink
              to={`/library/${encodeURIComponent(activeLibrary)}/people`}
              className={navLinkClass}
            >
              People
            </NavLink>
          )}
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content                                                         */}
      {/* ------------------------------------------------------------------ */}
      <main className="flex-1 bg-surface-1 overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 5: Update App.tsx Routing

**Files:**
- Modify: `src/App.tsx`

Replace the entire file. AppShell becomes a layout route (no `path`) wrapping all routes except `/setup`.

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './components/AppShell'
import Setup from './pages/Setup'
import Home from './pages/Home'
import Library from './pages/Library'
import MediaDetail from './pages/MediaDetail'
import People from './pages/People'
import Settings from './pages/Settings'
import ImportProgress from './components/ImportProgress'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          {/* AppShell is a layout route: renders sidebar + <Outlet /> */}
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/library/:name" element={<Library />} />
            <Route path="/library/:name/media/:id" element={<MediaDetail />} />
            <Route path="/library/:name/people" element={<People />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
        <ImportProgress />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 6: Restyle Setup Page

**Files:**
- Modify: `src/pages/Setup.tsx`

The logic is identical — only the markup changes to Tailwind-styled centered card layout.

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSetting, setSetting } from '../api/client'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function Setup() {
  const navigate = useNavigate()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSetting('data_root').then(s => {
      if (s.value) navigate('/')
    }).catch(() => {
      // 404 means not set — stay on setup page
    })
  }, [navigate])

  const handleChooseFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) { setSelectedPath(path); setError(null) }
  }

  const handleContinue = async () => {
    if (!selectedPath) return
    setError(null)
    setSaving(true)
    try {
      await setSetting('data_root', selectedPath)
      navigate('/')
    } catch {
      setError('Failed to save settings. Is the backend running?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-8">
      <div className="bg-surface-2 rounded-xl p-8 w-full max-w-md border border-surface-3/50 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-primary mb-2">Welcome to Media Manager</h1>
          <p className="text-sm text-muted leading-relaxed">
            Choose a folder where your media library data will be stored. This is where
            thumbnails, face crops, and the database will live — not your photos themselves.
          </p>
        </div>

        <div className="space-y-4">
          <Button variant="default" onClick={handleChooseFolder} className="w-full justify-center">
            Choose data folder…
          </Button>

          {selectedPath && (
            <div className="bg-surface-3/50 rounded-md px-3 py-2">
              <p className="text-xs text-muted mb-0.5">Selected:</p>
              <p className="text-sm text-primary font-mono break-all">{selectedPath}</p>
            </div>
          )}

          {error && (
            <p className="text-danger text-sm">{error}</p>
          )}

          <Button
            variant="accent"
            onClick={handleContinue}
            disabled={!selectedPath || saving}
            className="w-full justify-center"
          >
            {saving ? <><Spinner className="w-3.5 h-3.5" /> Saving…</> : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 7: Update Home Page

**Files:**
- Modify: `src/pages/Home.tsx`

With the sidebar handling library navigation, the Home page's only job is:
1. Redirect to `/library/:firstName` if any library exists
2. Show a centered empty-state card with a create form if no libraries exist

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSetting, fetchLibraries, createLibrary } from '../api/client'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'

export default function Home() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [newName, setNewName] = useState('')
  const [mutateError, setMutateError] = useState<string | null>(null)

  // Redirect to setup if data_root not set
  useEffect(() => {
    let active = true
    getSetting('data_root')
      .then(s => { if (active && !s.value) navigate('/setup') })
      .catch(() => { if (active) navigate('/setup') })
    return () => { active = false }
  }, [navigate])

  const { data: libraries, isLoading } = useQuery({
    queryKey: ['libraries'],
    queryFn: fetchLibraries,
  })

  // Redirect to first library as soon as we have one
  useEffect(() => {
    if (libraries && libraries.length > 0) {
      navigate(`/library/${encodeURIComponent(libraries[0].name)}`, { replace: true })
    }
  }, [libraries, navigate])

  const { mutate: addLibrary, isPending: isCreating } = useMutation({
    mutationFn: () => createLibrary(newName.trim()),
    onError: () => setMutateError('Failed to create library.'),
    onSuccess: (lib) => {
      qc.invalidateQueries({ queryKey: ['libraries'] })
      setNewName('')
      setMutateError(null)
      navigate(`/library/${encodeURIComponent(lib.name)}`)
    },
  })

  // While checking / redirecting, show a spinner
  if (isLoading || (libraries && libraries.length > 0)) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="w-6 h-6 text-muted" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="bg-surface-2 rounded-xl p-8 w-full max-w-sm border border-surface-3/50 shadow-xl text-center">
        <div className="text-4xl mb-4">📷</div>
        <h2 className="text-lg font-semibold text-primary mb-1">No libraries yet</h2>
        <p className="text-sm text-muted mb-6">
          Create a library to get started. Then import your photos and videos.
        </p>
        <div className="space-y-3">
          <Input
            value={newName}
            onChange={e => { setNewName(e.target.value); setMutateError(null) }}
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) addLibrary() }}
            placeholder="Library name (e.g. Vacation 2024)"
          />
          {mutateError && <p className="text-danger text-xs">{mutateError}</p>}
          <Button
            variant="accent"
            className="w-full justify-center"
            onClick={() => addLibrary()}
            disabled={!newName.trim() || isCreating}
          >
            {isCreating ? <><Spinner className="w-3.5 h-3.5" /> Creating…</> : 'Create Library'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 8: Add Import Functionality to Library Page

**Files:**
- Modify: `src/pages/Library.tsx`
- Modify: `src/components/MediaGrid.tsx` (add `sortBy` prop)

This is the critical missing feature. The Library page gets a toolbar with an Import dropdown and a sort control.

**`src/pages/Library.tsx`** (complete replacement):

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { importMedia } from '../api/client'
import MediaGrid from '../components/MediaGrid'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

type SortBy = 'newest' | 'oldest'

// Shared Tailwind classes for Radix dropdown items — defined once to stay DRY.
const dropdownItemClass =
  'flex items-center px-3 py-2 text-sm text-primary cursor-pointer rounded ' +
  'hover:bg-surface-3 focus:outline-none focus:bg-surface-3 select-none data-[disabled]:opacity-40'

const dropdownContentClass =
  'bg-surface-2 border border-surface-3 rounded-md shadow-xl py-1 min-w-[160px] z-50 ' +
  'animate-in fade-in-0 zoom-in-95'

export default function Library() {
  const { name } = useParams<{ name: string }>()
  const qc = useQueryClient()
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [importError, setImportError] = useState<string | null>(null)

  const libraryName = name ? decodeURIComponent(name) : ''

  const { mutate: doImport, isPending: isImporting } = useMutation({
    mutationFn: (paths: string[]) => importMedia(libraryName, paths),
    onSuccess: (result) => {
      setImportError(null)
      qc.invalidateQueries({ queryKey: ['media', libraryName] })
      if (result.accepted === 0 && result.skipped > 0) {
        setImportError(`All ${result.skipped} file(s) already in library.`)
      }
    },
    onError: () => setImportError('Import failed. Is the backend running?'),
  })

  const handleImportFiles = async () => {
    const paths = await window.electronAPI.selectFiles()
    if (paths && paths.length > 0) doImport(paths)
  }

  const handleImportFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) doImport([path])
  }

  if (!name) return <div className="p-4 text-muted">No library selected.</div>

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-3/50 shrink-0">
        <h2 className="text-base font-semibold text-primary flex-1 truncate">{libraryName}</h2>

        {/* Sort dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm">
              {sortBy === 'newest' ? 'Newest first' : 'Oldest first'} ▾
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={dropdownContentClass} sideOffset={4} align="end">
              <DropdownMenu.Item className={dropdownItemClass} onSelect={() => setSortBy('newest')}>
                {sortBy === 'newest' && <span className="mr-2 text-accent">✓</span>}
                {sortBy !== 'newest' && <span className="mr-2 opacity-0">✓</span>}
                Newest first
              </DropdownMenu.Item>
              <DropdownMenu.Item className={dropdownItemClass} onSelect={() => setSortBy('oldest')}>
                {sortBy === 'oldest' && <span className="mr-2 text-accent">✓</span>}
                {sortBy !== 'oldest' && <span className="mr-2 opacity-0">✓</span>}
                Oldest first
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {/* Import dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="accent" size="sm" disabled={isImporting}>
              {isImporting ? <><Spinner className="w-3 h-3" /> Importing…</> : 'Import Media ▾'}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className={dropdownContentClass} sideOffset={4} align="end">
              <DropdownMenu.Item className={dropdownItemClass} onSelect={handleImportFiles}>
                Import files…
              </DropdownMenu.Item>
              <DropdownMenu.Item className={dropdownItemClass} onSelect={handleImportFolder}>
                Import folder…
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {importError && (
        <div className="px-4 py-2 bg-danger/10 border-b border-danger/20 text-danger text-sm">
          {importError}
          <button className="ml-2 text-danger/70 hover:text-danger" onClick={() => setImportError(null)}>×</button>
        </div>
      )}

      {/* Grid or empty state */}
      <div className="flex-1 min-h-0">
        <MediaGrid
          libraryName={libraryName}
          sortBy={sortBy}
          onEmpty={() => (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <div className="text-5xl opacity-30">🖼️</div>
              <div>
                <p className="text-muted text-sm mb-3">No media in this library yet.</p>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <Button variant="accent">Import Media ▾</Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className={dropdownContentClass} sideOffset={4}>
                      <DropdownMenu.Item className={dropdownItemClass} onSelect={handleImportFiles}>
                        Import files…
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className={dropdownItemClass} onSelect={handleImportFolder}>
                        Import folder…
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

This will fail because `MediaGrid` doesn't yet accept `sortBy` or `onEmpty`. Continue to Task 9.

---

## Task 9: Restyle MediaGrid and MediaCard

**Files:**
- Modify: `src/components/MediaGrid.tsx`
- Modify: `src/components/MediaCard.tsx`

**`src/components/MediaGrid.tsx`** — adds `sortBy` and `onEmpty` props, increases to 6 columns:

```tsx
import { useInfiniteQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useEffect, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMediaPage } from '../api/client'
import type { MediaItem, MediaPage } from '../api/types'
import MediaCard from './MediaCard'
import { Spinner } from './ui/Spinner'

const COLUMNS = 6
const CARD_HEIGHT = 160

interface Props {
  libraryName: string
  personId?: number
  sortBy?: 'newest' | 'oldest'
  onEmpty?: () => ReactNode
}

export default function MediaGrid({ libraryName, personId, sortBy = 'newest', onEmpty }: Props) {
  const parentRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ['media', libraryName, personId, sortBy] as const,
    queryFn: ({ pageParam }: { pageParam: number | undefined }) =>
      fetchMediaPage(libraryName, pageParam, 100, personId, sortBy),
    getNextPageParam: (last: MediaPage) => last.next_cursor ?? undefined,
    initialPageParam: undefined as number | undefined,
  })

  const items: MediaItem[] = data?.pages.flatMap(p => p.items) ?? []
  const rowCount = Math.ceil(items.length / COLUMNS)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 3,
  })

  const virtualItems = virtualizer.getVirtualItems()

  useEffect(() => {
    const lastItem = virtualItems.at(-1)
    if (!lastItem) return
    if (lastItem.index >= rowCount - 2 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [virtualItems, rowCount, hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="w-6 h-6 text-muted" />
      </div>
    )
  }

  if (items.length === 0 && onEmpty) {
    return <div className="h-full">{onEmpty()}</div>
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualItems.map(vRow => {
          const rowItems = items.slice(vRow.index * COLUMNS, (vRow.index + 1) * COLUMNS)
          return (
            <div
              key={vRow.key}
              style={{ position: 'absolute', top: vRow.start }}
              className="flex gap-0.5 w-full"
            >
              {rowItems.map(item => (
                <MediaCard
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/library/${encodeURIComponent(libraryName)}/media/${item.id}`)}
                />
              ))}
            </div>
          )
        })}
      </div>
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <Spinner className="w-4 h-4 text-muted" />
        </div>
      )}
    </div>
  )
}
```

**`src/components/MediaCard.tsx`**:

```tsx
import { MediaItem } from '../api/types'
import { API_BASE } from '../api/client'

interface Props { item: MediaItem; onClick?: () => void }

export default function MediaCard({ item, onClick }: Props) {
  const src = item.thumbnail_path
    ? `${API_BASE}/thumbnail?path=${encodeURIComponent(item.thumbnail_path)}`
    : undefined

  return (
    <div
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      role="button"
      tabIndex={0}
      aria-label={item.file_name}
      className="relative flex-1 cursor-pointer overflow-hidden bg-surface-3 group"
      style={{ height: 160, minWidth: 0 }}
    >
      {src ? (
        <img
          src={src}
          alt={item.file_name}
          className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-2">
          <span className="text-muted text-xs text-center break-all leading-snug">{item.file_name}</span>
        </div>
      )}
      {/* Video badge */}
      {item.media_type === 'video' && (
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
          ▶
        </div>
      )}
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />
    </div>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 10: Redesign MediaDetail Layout

**Files:**
- Modify: `src/pages/MediaDetail.tsx`

This is split into two tasks (10 and 11) for clarity. Task 10 does the layout and styling. Task 11 adds the interactive face reassign dropdown.

Key change: replace SVG face overlays + ResizeObserver with absolutely-positioned `<div>` elements using **percentage-based coordinates** from the fractional bounding box values. This eliminates the need for `imgDims` state and `ResizeObserver`.

```tsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { fetchMediaItem, fetchMediaFaces, fetchPeople, reassignFace } from '../api/client'
import { API_BASE } from '../api/client'
import type { FaceWithPerson } from '../api/client'
import type { Person } from '../api/types'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'

const MAX_EXIF_ROWS = 20

const dropdownItemClass =
  'flex items-center px-3 py-1.5 text-sm text-primary cursor-pointer rounded ' +
  'hover:bg-surface-3 focus:outline-none focus:bg-surface-3 select-none'

// ── FaceBox ──────────────────────────────────────────────────────────────────
// Absolutely-positioned interactive face bounding box using percentage coords.
// The bounding_box values (x, y, w, h) are 0–1 fractions of image dimensions.
interface FaceBoxProps {
  face: FaceWithPerson
  people: Person[]
  libraryName: string
  onReassigned: () => void
}

function FaceBox({ face, people, libraryName, onReassigned }: FaceBoxProps) {
  const bb = face.bounding_box
  const qc = useQueryClient()

  const { mutate: doReassign } = useMutation({
    mutationFn: (personId: number) => reassignFace(libraryName, face.id, personId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mediaFaces'] })
      onReassigned()
    },
  })

  const currentName = face.person?.name ?? null
  const isNamed = !!currentName

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <div
          style={{
            position: 'absolute',
            left: `${bb.x * 100}%`,
            top: `${bb.y * 100}%`,
            width: `${bb.w * 100}%`,
            height: `${bb.h * 100}%`,
          }}
          className={[
            'border-2 cursor-pointer group transition-colors',
            isNamed ? 'border-accent/70 hover:border-accent' : 'border-yellow-500/70 hover:border-yellow-400',
          ].join(' ')}
          role="button"
          tabIndex={0}
          aria-label={`Face: ${currentName ?? 'Unidentified'}`}
        >
          {/* Name label at bottom of box */}
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] px-1 py-0.5 truncate leading-tight text-center"
            style={{ color: isNamed ? '#818cf8' : '#facc15' }}>
            {currentName ?? '?'}
          </div>
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="bg-surface-2 border border-surface-3 rounded-md shadow-xl py-1 z-50 min-w-[180px]"
          sideOffset={4}
        >
          <div className="px-3 py-1.5 text-xs text-muted border-b border-surface-3 mb-1">
            Currently: <span className="text-primary">{currentName ?? 'Unidentified'}</span>
          </div>
          <div className="px-2 py-0.5 text-[10px] text-muted uppercase tracking-wider">Reassign to:</div>
          {people.map(person => {
            const isCurrent = person.id === face.person?.id
            return (
              <DropdownMenu.Item
                key={person.id}
                className={dropdownItemClass}
                onSelect={() => { if (!isCurrent) doReassign(person.id) }}
              >
                <span className="w-4 shrink-0 text-accent">{isCurrent ? '✓' : ''}</span>
                <span className="truncate">{person.name ?? `Person #${person.id}`}</span>
              </DropdownMenu.Item>
            )
          })}
          {people.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted">No people in library yet. Run clustering first.</div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ── MediaDetail ───────────────────────────────────────────────────────────────
export default function MediaDetail() {
  const { name, id } = useParams<{ name: string; id: string }>()
  const navigate = useNavigate()

  const libraryName = name ? decodeURIComponent(name) : ''
  const mediaId = id ? parseInt(id, 10) : 0

  const { data: item, isLoading: itemLoading, error: itemError } = useQuery({
    queryKey: ['mediaItem', libraryName, mediaId],
    queryFn: () => fetchMediaItem(libraryName, mediaId),
    enabled: !!libraryName && !!mediaId,
  })

  const { data: faces = [], refetch: refetchFaces } = useQuery({
    queryKey: ['mediaFaces', libraryName, mediaId],
    queryFn: () => fetchMediaFaces(libraryName, mediaId),
    enabled: !!libraryName && !!mediaId,
  })

  const { data: people = [] } = useQuery({
    queryKey: ['people', libraryName],
    queryFn: () => fetchPeople(libraryName),
    enabled: !!libraryName,
  })

  if (!name || !id) return <div className="p-4 text-muted">Invalid URL.</div>
  if (itemLoading) return <div className="flex items-center justify-center h-full"><Spinner className="w-6 h-6 text-muted" /></div>
  if (itemError || !item) return <div className="p-4 text-danger">Media item not found.</div>

  const imgSrc = `${API_BASE}/thumbnail?path=${encodeURIComponent(item.file_path)}`

  // Unique people across all faces in this image (for the People chips section)
  const peopleMap = new Map<number, { id: number; name: string | null }>()
  for (const face of faces) {
    if (face.person && !peopleMap.has(face.person.id)) {
      peopleMap.set(face.person.id, face.person)
    }
  }
  const uniquePeople = Array.from(peopleMap.values())

  const exifRows: [string, string][] = []
  if (item.exif_data) {
    for (const [key, val] of Object.entries(item.exif_data)) {
      if (val === null || val === undefined || val === '') continue
      exifRows.push([key, String(val)])
      if (exifRows.length >= MAX_EXIF_ROWS) break
    }
  }

  return (
    <div className="flex flex-col h-full text-primary">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-surface-3/50 shrink-0">
        <button
          onClick={() => navigate(`/library/${encodeURIComponent(libraryName)}`)}
          className="text-sm text-muted hover:text-primary transition-colors"
          aria-label="Back to library"
        >
          ← Back
        </button>
        <span className="text-sm text-muted truncate">{item.file_name}</span>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="muted">{item.media_type}</Badge>
          {item.width && item.height && (
            <Badge variant="muted">{item.width}×{item.height}</Badge>
          )}
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: image + face overlays */}
        <div className="flex-1 flex items-center justify-center p-6 overflow-hidden bg-surface-0/50">
          {/* The wrapper must be inline-block so percentage positioning is relative to the image */}
          <div className="relative inline-block max-w-full">
            <img
              src={imgSrc}
              alt={item.file_name}
              className="block max-w-full max-h-[calc(100vh-120px)] rounded"
            />
            {/* Face boxes rendered as absolutely-positioned divs using % coords */}
            {faces.map((face: FaceWithPerson) => (
              <FaceBox
                key={face.id}
                face={face}
                people={people}
                libraryName={libraryName}
                onReassigned={() => refetchFaces()}
              />
            ))}
          </div>
        </div>

        {/* Right: info panel */}
        <div className="w-72 shrink-0 border-l border-surface-3/50 overflow-y-auto flex flex-col gap-0 divide-y divide-surface-3/30">

          {/* BLIP description */}
          <section className="px-4 py-4">
            <h3 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Description</h3>
            <p className="text-sm leading-relaxed text-primary/80">
              {item.blip_description ?? <span className="text-muted italic">No description yet</span>}
            </p>
          </section>

          {/* People chips */}
          {uniquePeople.length > 0 && (
            <section className="px-4 py-4">
              <h3 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">People</h3>
              <div className="flex flex-wrap gap-1.5">
                {uniquePeople.map(person => (
                  <Link
                    key={person.id}
                    to={`/library/${encodeURIComponent(libraryName)}?personId=${person.id}`}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
                  >
                    {person.name ?? 'Unnamed'}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* File info */}
          <section className="px-4 py-4">
            <h3 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">Info</h3>
            <dl className="space-y-1.5">
              {item.captured_at && (
                <div className="flex gap-2">
                  <dt className="text-xs text-muted w-20 shrink-0">Captured</dt>
                  <dd className="text-xs text-primary">{new Date(item.captured_at).toLocaleString()}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-xs text-muted w-20 shrink-0">Imported</dt>
                <dd className="text-xs text-primary">{new Date(item.imported_at).toLocaleString()}</dd>
              </div>
            </dl>
          </section>

          {/* EXIF */}
          {exifRows.length > 0 && (
            <section className="px-4 py-4">
              <h3 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-2">EXIF</h3>
              <dl className="space-y-1">
                {exifRows.map(([key, val]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="text-[11px] text-muted w-28 shrink-0 truncate" title={key}>{key}</dt>
                    <dd className="text-[11px] text-primary/80 break-all">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Note:** The `FaceBox` component above already includes the reassign dropdown (Task 11 is embedded here). This avoids a half-working intermediate state.

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 11: Redesign People Browser with Corrections

**Files:**
- Modify: `src/pages/People.tsx`
- Modify: `src/components/PersonCard.tsx`

The People page is rebuilt to include a `⋮` context menu on each card with Rename and Merge actions.

**`src/components/PersonCard.tsx`** — simplified; correction controls moved to People.tsx:

```tsx
import { Person } from '../api/types'
import { API_BASE } from '../api/client'

interface Props {
  person: Person
  onClick: () => void
}

export default function PersonCard({ person, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
      role="button"
      tabIndex={0}
      className="flex flex-col items-center gap-2 cursor-pointer group"
    >
      <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-3 ring-2 ring-transparent group-hover:ring-accent/40 transition-all">
        {person.cover_face_crop_path ? (
          <img
            src={`${API_BASE}/thumbnail?path=${encodeURIComponent(person.cover_face_crop_path)}`}
            className="w-full h-full object-cover"
            alt={person.name ?? `Person ${person.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-muted/40">?</div>
        )}
      </div>
      <div className="text-sm text-primary text-center truncate max-w-[140px]">
        {person.name ?? `Unknown #${person.id}`}
      </div>
      <div className="text-xs text-muted">{person.face_count} photos</div>
    </div>
  )
}
```

**`src/pages/People.tsx`** — includes ⋮ menu, inline rename, and merge dialog:

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { fetchPeople, renamePerson, mergePeople } from '../api/client'
import type { Person } from '../api/types'
import PersonCard from '../components/PersonCard'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Spinner } from '../components/ui/Spinner'

const dropdownItemClass =
  'flex items-center px-3 py-1.5 text-sm text-primary cursor-pointer rounded ' +
  'hover:bg-surface-3 focus:outline-none select-none'

// ── MergeDialog ───────────────────────────────────────────────────────────────
interface MergeDialogProps {
  sourcePerson: Person
  allPeople: Person[]
  libraryName: string
  onClose: () => void
  onMerged: () => void
}

function MergeDialog({ sourcePerson, allPeople, libraryName, onClose, onMerged }: MergeDialogProps) {
  const [filter, setFilter] = useState('')
  const [target, setTarget] = useState<Person | null>(null)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  const { mutate: doMerge, isPending } = useMutation({
    mutationFn: () => mergePeople(libraryName, sourcePerson.id, target!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people', libraryName] })
      onMerged()
      onClose()
    },
    onError: () => setError('Merge failed.'),
  })

  const candidates = allPeople.filter(p =>
    p.id !== sourcePerson.id &&
    (p.name ?? `Person #${p.id}`).toLowerCase().includes(filter.toLowerCase())
  )

  const sourceName = sourcePerson.name ?? `Person #${sourcePerson.id}`
  const targetName = target ? (target.name ?? `Person #${target.id}`) : null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-2 rounded-xl p-6 w-full max-w-sm border border-surface-3 shadow-2xl">
        <h3 className="text-base font-semibold text-primary mb-1">
          Merge <span className="text-accent">{sourceName}</span> into…
        </h3>
        <p className="text-xs text-muted mb-4">
          All faces assigned to {sourceName} will move to the chosen person.
        </p>

        <Input
          autoFocus
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search people…"
          className="mb-2"
        />

        <div className="max-h-44 overflow-y-auto rounded border border-surface-3 mb-4">
          {candidates.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted text-center">No matches</p>
          ) : (
            candidates.map(p => (
              <button
                key={p.id}
                onClick={() => setTarget(p)}
                className={[
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  target?.id === p.id
                    ? 'bg-accent/20 text-accent'
                    : 'text-primary hover:bg-surface-3',
                ].join(' ')}
              >
                {p.name ?? `Person #${p.id}`}
                <span className="text-muted text-xs ml-2">({p.face_count} photos)</span>
              </button>
            ))
          )}
        </div>

        {error && <p className="text-danger text-xs mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            disabled={!target || isPending}
            onClick={() => doMerge()}
          >
            {isPending
              ? <><Spinner className="w-3 h-3" /> Merging…</>
              : `Merge → ${targetName ?? '…'}`}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── PersonRow ─────────────────────────────────────────────────────────────────
// Wraps a PersonCard with a ⋮ context menu for rename + merge.
interface PersonRowProps {
  person: Person
  allPeople: Person[]
  libraryName: string
  onNavigate: (person: Person) => void
  onUpdated: () => void
}

function PersonRow({ person, allPeople, libraryName, onNavigate, onUpdated }: PersonRowProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(person.name ?? '')
  const [mergeTarget, setMergeTarget] = useState(false)
  const qc = useQueryClient()

  const { mutate: doRename } = useMutation({
    mutationFn: (name: string) => renamePerson(libraryName, person.id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['people', libraryName] })
      onUpdated()
    },
    onError: () => setIsRenaming(false),
  })

  const confirmRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== person.name) {
      doRename(trimmed)
    }
    setIsRenaming(false)
  }

  return (
    <div className="relative flex flex-col items-center">
      {/* PersonCard handles the main click */}
      <PersonCard
        person={person}
        onClick={() => !isRenaming && onNavigate(person)}
      />

      {/* Inline rename input overlays the name */}
      {isRenaming && (
        <div className="absolute bottom-7 left-0 right-0 px-1">
          <input
            autoFocus
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={confirmRename}
            onKeyDown={e => {
              if (e.key === 'Enter') confirmRename()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            className="w-full bg-surface-3 text-primary text-xs px-2 py-1 rounded border border-accent focus:outline-none"
          />
        </div>
      )}

      {/* ⋮ context menu */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="absolute top-0 right-0 text-muted hover:text-primary bg-surface-3/80 rounded px-1.5 py-0.5 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Person options"
          >
            ⋮
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="bg-surface-2 border border-surface-3 rounded-md shadow-xl py-1 z-50 min-w-[130px]"
            sideOffset={4}
          >
            <DropdownMenu.Item
              className={dropdownItemClass}
              onSelect={() => { setIsRenaming(true); setRenameValue(person.name ?? '') }}
            >
              Rename
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={dropdownItemClass}
              onSelect={() => setMergeTarget(true)}
            >
              Merge into…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {mergeTarget && (
        <MergeDialog
          sourcePerson={person}
          allPeople={allPeople}
          libraryName={libraryName}
          onClose={() => setMergeTarget(false)}
          onMerged={onUpdated}
        />
      )}
    </div>
  )
}

// ── People page ───────────────────────────────────────────────────────────────
export default function People() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const libraryName = name ? decodeURIComponent(name) : ''

  const { data: people = [], isLoading, error } = useQuery({
    queryKey: ['people', libraryName],
    queryFn: () => fetchPeople(libraryName),
    enabled: !!libraryName,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="w-6 h-6 text-muted" />
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-danger text-sm">Failed to load people.</div>
  }

  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <div className="text-4xl opacity-30">👤</div>
        <p className="text-muted text-sm max-w-xs">
          No people found yet. Import some media, then run face detection and clustering from Settings.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="text-base font-semibold text-primary mb-1">People</h2>
      <p className="text-xs text-muted mb-6">{people.length} {people.length === 1 ? 'person' : 'people'} · Click to browse their photos</p>

      <div className="flex flex-wrap gap-6">
        {people.map(person => (
          <div key={person.id} className="group relative">
            <PersonRow
              person={person}
              allPeople={people}
              libraryName={libraryName}
              onNavigate={p => navigate(`/library/${encodeURIComponent(libraryName)}?personId=${p.id}`)}
              onUpdated={() => qc.invalidateQueries({ queryKey: ['people', libraryName] })}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 12: Restyle Settings Page

**Files:**
- Modify: `src/pages/Settings.tsx`

The logic is identical. Only the markup changes to Tailwind-styled sections. Key classes: section headers use `text-[10px] font-semibold text-muted uppercase tracking-widest`, form controls use the shared `Button` and `Input` primitives.

Replace the entire file:

```tsx
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSetting, setSetting,
  fetchLibraries, fetchClusteringRuns, triggerClusteringRun, activateClusteringRun,
} from '../api/client'
import type { HdbscanParams } from '../api/client'
import type { ClusteringRun } from '../api/types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

const DEFAULT_HDBSCAN: HdbscanParams = {
  min_cluster_size: 5,
  min_samples: 1,
  cluster_selection_epsilon: 0.0,
}

function parseHdbscanParams(raw: string | null | undefined): HdbscanParams {
  if (!raw) return { ...DEFAULT_HDBSCAN }
  try {
    const parsed = JSON.parse(raw) as Partial<HdbscanParams>
    return {
      min_cluster_size: parsed.min_cluster_size ?? DEFAULT_HDBSCAN.min_cluster_size,
      min_samples: parsed.min_samples ?? DEFAULT_HDBSCAN.min_samples,
      cluster_selection_epsilon: parsed.cluster_selection_epsilon ?? DEFAULT_HDBSCAN.cluster_selection_epsilon,
    }
  } catch {
    return { ...DEFAULT_HDBSCAN }
  }
}

// ── Slider row ────────────────────────────────────────────────────────────────
interface SliderRowProps {
  label: string
  id: string
  min: number; max: number; step: number; value: number
  onChange: (v: number) => void
  hint?: string
}
function SliderRow({ label, id, min, max, step, value, onChange, hint }: SliderRowProps) {
  return (
    <div className="flex items-center gap-4">
      <label htmlFor={id} className="text-sm text-muted w-52 shrink-0">
        {label}: <span className="text-primary font-mono">{step < 1 ? value.toFixed(2) : value}</span>
      </label>
      <input
        id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
        className="w-48 accent-accent"
      />
      {hint && <span className="text-xs text-muted/60">{hint}</span>}
    </div>
  )
}

// ── Clustering runs table ─────────────────────────────────────────────────────
interface ClusteringRunsTableProps {
  libraryName: string
  hdbscanParams: HdbscanParams
}
function ClusteringRunsTable({ libraryName, hdbscanParams }: ClusteringRunsTableProps) {
  const qc = useQueryClient()
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)

  const { data: runs = [], isLoading } = useQuery<ClusteringRun[]>({
    queryKey: ['clusteringRuns', libraryName],
    queryFn: () => fetchClusteringRuns(libraryName),
  })

  const { mutate: doTrigger, isPending: isTriggering } = useMutation({
    mutationFn: () => triggerClusteringRun(libraryName, hdbscanParams),
    onSuccess: () => { setTriggerError(null); qc.invalidateQueries({ queryKey: ['clusteringRuns', libraryName] }) },
    onError: () => setTriggerError('Failed to start clustering run.'),
  })

  const { mutate: doActivate } = useMutation({
    mutationFn: (runId: number) => activateClusteringRun(libraryName, runId),
    onSuccess: () => { setActivateError(null); qc.invalidateQueries({ queryKey: ['clusteringRuns', libraryName] }) },
    onError: () => setActivateError('Failed to activate run.'),
  })

  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-primary mb-2">{libraryName}</h4>
      {isLoading && <Spinner className="w-4 h-4 text-muted" />}
      {!isLoading && runs.length === 0 && (
        <p className="text-xs text-muted mb-2">No clustering runs yet.</p>
      )}
      {runs.length > 0 && (
        <div className="overflow-x-auto rounded border border-surface-3 mb-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-3 bg-surface-3/50">
                {['#', 'Created', 'Status', 'min_cluster', 'min_samples', 'epsilon', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-muted font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b border-surface-3/50 hover:bg-surface-3/30">
                  <td className="px-3 py-2 text-muted">{run.run_number}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(run.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {run.is_active
                      ? <Badge variant="accent">Active</Badge>
                      : <Badge variant="muted">Inactive</Badge>}
                  </td>
                  <td className="px-3 py-2 text-center">{run.parameters.min_cluster_size}</td>
                  <td className="px-3 py-2 text-center">{run.parameters.min_samples}</td>
                  <td className="px-3 py-2 text-center">{run.parameters.cluster_selection_epsilon.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {!run.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => doActivate(run.id)}>
                        Activate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {activateError && <p className="text-danger text-xs mb-1">{activateError}</p>}
      <Button size="sm" variant="default" onClick={() => doTrigger()} disabled={isTriggering}>
        {isTriggering ? <><Spinner className="w-3 h-3" /> Starting…</> : '+ New Clustering Run'}
      </Button>
      {triggerError && <p className="text-danger text-xs mt-1">{triggerError}</p>}
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────
export default function Settings() {
  const qc = useQueryClient()

  // Data root
  const { data: dataRootSetting } = useQuery({ queryKey: ['setting', 'data_root'], queryFn: () => getSetting('data_root') })
  const currentDataRoot = dataRootSetting?.value ?? null
  const [dataRootSaving, setDataRootSaving] = useState(false)
  const [dataRootError, setDataRootError] = useState<string | null>(null)

  const handleChooseDataRoot = async () => {
    const path = await window.electronAPI.selectFolder()
    if (!path) return
    setDataRootSaving(true)
    setDataRootError(null)
    try {
      await setSetting('data_root', path)
      qc.invalidateQueries({ queryKey: ['setting', 'data_root'] })
    } catch {
      setDataRootError('Failed to save data root.')
    } finally {
      setDataRootSaving(false)
    }
  }

  // HDBSCAN params
  const { data: hdbscanSetting } = useQuery({ queryKey: ['setting', 'hdbscan_params'], queryFn: () => getSetting('hdbscan_params') })
  const [hdbscanParams, setHdbscanParams] = useState<HdbscanParams>(DEFAULT_HDBSCAN)
  const [hdbscanSaving, setHdbscanSaving] = useState(false)
  const [hdbscanError, setHdbscanError] = useState<string | null>(null)
  const [hdbscanSaved, setHdbscanSaved] = useState(false)

  useEffect(() => {
    if (hdbscanSetting !== undefined) setHdbscanParams(parseHdbscanParams(hdbscanSetting.value))
  }, [hdbscanSetting])

  useEffect(() => { setHdbscanSaved(false) }, [hdbscanParams])

  const handleHdbscanSave = async () => {
    setHdbscanSaving(true); setHdbscanError(null); setHdbscanSaved(false)
    try {
      await setSetting('hdbscan_params', JSON.stringify(hdbscanParams))
      setHdbscanSaved(true)
    } catch {
      setHdbscanError('Failed to save HDBSCAN parameters.')
    } finally {
      setHdbscanSaving(false)
    }
  }

  // Libraries for clustering runs tables
  const { data: libraries = [] } = useQuery({ queryKey: ['libraries'], queryFn: fetchLibraries })

  const sectionClass = 'border-b border-surface-3/50 pb-8 mb-8'
  const headingClass = 'text-[10px] font-semibold text-muted uppercase tracking-widest mb-4'

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-primary mb-8">Settings</h1>

      {/* Data Root */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Data Root Directory</h2>
        <p className="text-xs text-muted mb-3">
          Where thumbnails, face crops, and the database are stored. Not your original photos.
        </p>
        {currentDataRoot && (
          <div className="bg-surface-3/50 rounded px-3 py-2 mb-3 font-mono text-xs text-primary break-all">
            {currentDataRoot}
          </div>
        )}
        <Button variant="default" onClick={handleChooseDataRoot} disabled={dataRootSaving}>
          {dataRootSaving ? <><Spinner className="w-3 h-3" /> Saving…</> : 'Change folder…'}
        </Button>
        {dataRootError && <p className="text-danger text-xs mt-2">{dataRootError}</p>}
      </section>

      {/* HDBSCAN */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Default HDBSCAN Parameters</h2>
        <p className="text-xs text-muted mb-4">
          Used when creating a new clustering run. Affects how faces are grouped into people.
        </p>
        <div className="space-y-3 mb-4">
          <SliderRow label="min_cluster_size" id="min_cluster_size" min={2} max={50} step={1}
            value={hdbscanParams.min_cluster_size}
            onChange={v => setHdbscanParams(p => ({ ...p, min_cluster_size: v }))}
            hint="2–50" />
          <SliderRow label="min_samples" id="min_samples" min={1} max={10} step={1}
            value={hdbscanParams.min_samples}
            onChange={v => setHdbscanParams(p => ({ ...p, min_samples: v }))}
            hint="1–10" />
          <SliderRow label="cluster_selection_epsilon" id="epsilon" min={0} max={1} step={0.01}
            value={hdbscanParams.cluster_selection_epsilon}
            onChange={v => setHdbscanParams(p => ({ ...p, cluster_selection_epsilon: v }))}
            hint="0–1.0" />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="default" onClick={handleHdbscanSave} disabled={hdbscanSaving}>
            {hdbscanSaving ? <><Spinner className="w-3 h-3" /> Saving…</> : 'Save Parameters'}
          </Button>
          {hdbscanSaved && <span className="text-success text-sm">Saved.</span>}
          {hdbscanError && <span className="text-danger text-sm">{hdbscanError}</span>}
        </div>
      </section>

      {/* Clustering Runs */}
      <section>
        <h2 className={headingClass}>Clustering Runs</h2>
        {libraries.length === 0 && (
          <p className="text-xs text-muted">No libraries found.</p>
        )}
        {libraries.map(lib => (
          <ClusteringRunsTable key={lib.name} libraryName={lib.name} hdbscanParams={hdbscanParams} />
        ))}
      </section>
    </div>
  )
}
```

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors.

---

## Task 13: Restyle ImportProgress Panel

**Files:**
- Modify: `src/components/ImportProgress.tsx`

Read the existing file first to understand the current logic (the WebSocket hook and counter logic stay exactly the same — only the JSX and styles change).

The existing `ImportProgress.tsx` is a fixed-position slide-up panel. Replace the inline styles with Tailwind classes:

```tsx
import { useState } from 'react'
import { useTaskProgress } from '../hooks/useTaskProgress'
import { Badge } from './ui/Badge'

export default function ImportProgress() {
  const { events, counters, connected } = useTaskProgress()
  const [open, setOpen] = useState(false)

  const hasActivity = counters.active > 0 || counters.completed > 0 || counters.failed > 0

  return (
    <div className="fixed bottom-0 left-48 right-0 z-40 pointer-events-none">
      <div className="pointer-events-auto">
        {/* Toggle bar — always visible */}
        <button
          onClick={() => setOpen(v => !v)}
          className={[
            'w-full flex items-center gap-3 px-4 py-2 text-xs transition-colors border-t',
            hasActivity
              ? 'bg-surface-2 border-surface-3/80 text-primary'
              : 'bg-surface-2/60 border-surface-3/40 text-muted',
          ].join(' ')}
          aria-expanded={open}
        >
          {/* Connection indicator */}
          <span
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted/40'}`}
            title={connected ? 'Connected' : 'Disconnected'}
          />

          <span className="flex items-center gap-2 flex-1">
            Tasks:
            {counters.active > 0 && <Badge variant="accent">{counters.active} active</Badge>}
            {counters.completed > 0 && <Badge variant="success">{counters.completed} done</Badge>}
            {counters.failed > 0 && <Badge variant="danger">{counters.failed} failed</Badge>}
            {!hasActivity && <span className="text-muted/60">idle</span>}
          </span>

          <span className="text-muted/60">{open ? '▼' : '▲'}</span>
        </button>

        {/* Slide-up event log */}
        <div
          className={[
            'overflow-hidden transition-all duration-200 bg-surface-2 border-t border-surface-3/80',
            open ? 'max-h-52' : 'max-h-0',
          ].join(' ')}
        >
          <div className="overflow-y-auto max-h-52 p-2 space-y-0.5">
            {events.slice(0, 20).map(ev => (
              <div
                key={ev.seq}
                className={[
                  'flex items-center gap-2 px-2 py-1 rounded text-xs',
                  ev.status === 'failed' ? 'text-danger' : ev.status === 'completed' ? 'text-success/80' : 'text-muted',
                ].join(' ')}
              >
                <span className="shrink-0">
                  {ev.status === 'completed' ? '✓' : ev.status === 'failed' ? '✗' : '…'}
                </span>
                <span className="truncate">{ev.task_type} — {ev.status}</span>
                {ev.media_item_id && (
                  <span className="text-muted/50 ml-auto shrink-0">#{ev.media_item_id}</span>
                )}
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-xs text-muted/50 px-2 py-1">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Note:** The `useTaskProgress` hook interface needs to match. Check `src/hooks/useTaskProgress.ts` — the hook must expose `{ events, counters, connected }`. If the property names differ, adjust the destructuring to match.

**Step: Verify**

```bash
npm run typecheck
```

Expected: zero errors. All 14 tasks complete.

---

## Final Verification

After all tasks, run a full typecheck:

```bash
npm run typecheck
```

Expected: zero errors across all files.

Then start the dev server to do a visual walkthrough:

```bash
npm run dev
```

Verify:
1. Dark sidebar appears on all pages except Setup
2. Library page shows "Import Media ▾" button — clicking shows "Import files…" / "Import folder…"
3. Importing files triggers tasks visible in the ImportProgress panel at the bottom
4. Clicking a media card opens the two-column MediaDetail view
5. Face boxes appear as interactive borders — clicking shows the reassign dropdown
6. People page shows cards with ⋮ menus — Rename and Merge into… both work
7. Settings page shows styled sections with working sliders

---

## Known Limitations

- **Sort direction:** The backend media endpoint may not yet support `sort_dir=asc`. If "Oldest first" doesn't work, extend the backend `GET /libraries/{name}/media/` query param to accept `sort_dir: Literal['asc', 'desc'] = 'desc'` and apply it to the SQLAlchemy `order_by`.
- **⋮ menu visibility:** The ⋮ button on PersonRow uses `group-hover:opacity-100` but the `group` class is on the wrapping div in People.tsx. Verify the hover works; if not, change the button to `opacity-100` (always visible).
- **Radix animation classes:** `animate-in`, `fade-in-0`, `zoom-in-95` in `dropdownContentClass` require the `tailwindcss-animate` plugin. If those classes produce no effect, remove them from the content class string — the dropdown works without animation.
