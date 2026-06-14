import { useState, useRef } from 'react'
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

  const { mutate: doMerge, isPending } = useMutation({
    mutationFn: () => mergePeople(libraryName, sourcePerson.id, target!.id),
    onSuccess: () => {
      // onMerged calls onUpdated which invalidates ['people', libraryName] — no need to do it here too
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
  const [showMerge, setShowMerge] = useState(false)
  const renameFiredRef = useRef(false)
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
    // Guard against double-fire from Enter (onKeyDown) immediately triggering onBlur
    if (renameFiredRef.current) return
    renameFiredRef.current = true
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== person.name) {
      doRename(trimmed)
    }
    setIsRenaming(false)
  }

  const startRenaming = () => {
    renameFiredRef.current = false
    setRenameValue(person.name ?? '')
    setIsRenaming(true)
  }

  return (
    <div className="relative flex flex-col items-center group">
      <PersonCard
        person={person}
        onClick={() => !isRenaming && onNavigate(person)}
      />

      {/* Inline rename input — overlays the name area */}
      {isRenaming && (
        <div className="absolute bottom-8 left-0 right-0 px-1">
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

      {/* ⋮ context menu — visible on group hover */}
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
              onSelect={startRenaming}
            >
              Rename
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={dropdownItemClass}
              onSelect={() => setShowMerge(true)}
            >
              Merge into…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {showMerge && (
        <MergeDialog
          sourcePerson={person}
          allPeople={allPeople}
          libraryName={libraryName}
          onClose={() => setShowMerge(false)}
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
      <p className="text-xs text-muted mb-6">
        {people.length} {people.length === 1 ? 'person' : 'people'} · Click to browse their photos
      </p>

      <div className="flex flex-wrap gap-6">
        {people.map(person => (
          <PersonRow
            key={person.id}
            person={person}
            allPeople={people}
            libraryName={libraryName}
            onNavigate={p => navigate(`/library/${encodeURIComponent(libraryName)}?personId=${p.id}`)}
            onUpdated={() => qc.invalidateQueries({ queryKey: ['people', libraryName] })}
          />
        ))}
      </div>
    </div>
  )
}
