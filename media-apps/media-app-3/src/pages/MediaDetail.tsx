import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { fetchMediaItem, fetchMediaFaces, fetchPeople, reassignFace, API_BASE } from '../api/client'
import type { FaceWithPerson } from '../api/client'
import type { Person } from '../api/types'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'

const MAX_EXIF_ROWS = 20

const dropdownItemClass =
  'flex items-center px-3 py-1.5 text-sm text-primary cursor-pointer rounded ' +
  'hover:bg-surface-3 focus:outline-none focus:bg-surface-3 select-none'

// ── FaceBox ──────────────────────────────────────────────────────────────────
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
            'border-2 cursor-pointer transition-colors',
            isNamed ? 'border-accent/70 hover:border-accent' : 'border-yellow-500/70 hover:border-yellow-400',
          ].join(' ')}
          role="button"
          tabIndex={0}
          aria-label={`Face: ${currentName ?? 'Unidentified'}`}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-black/70 text-[10px] px-1 py-0.5 truncate leading-tight text-center"
            style={{ color: isNamed ? '#818cf8' : '#facc15' }}
          >
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

  const imgSrc = `${API_BASE}/thumbnail?path=${encodeURIComponent(item.thumbnail_path ?? item.file_path)}`

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
          <div className="relative inline-block max-w-full">
            <img
              src={imgSrc}
              alt={item.file_name}
              className="block max-w-full max-h-[calc(100vh-120px)] rounded"
            />
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
        <div className="w-72 shrink-0 border-l border-surface-3/50 overflow-y-auto flex flex-col divide-y divide-surface-3/30">

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
