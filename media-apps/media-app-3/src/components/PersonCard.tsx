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
