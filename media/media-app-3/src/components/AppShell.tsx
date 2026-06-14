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
      <aside className="w-[200px] bg-surface-2 flex flex-col shrink-0 border-r border-surface-3/50">
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
