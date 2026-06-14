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
      {item.media_type === 'video' && (
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
          ▶
        </div>
      )}
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />
    </div>
  )
}
