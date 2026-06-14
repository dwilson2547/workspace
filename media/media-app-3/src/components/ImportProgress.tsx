import { useState } from 'react'
import { useTaskProgress } from '../hooks/useTaskProgress'
import { Badge } from './ui/Badge'

export default function ImportProgress() {
  const { events, counters, connected } = useTaskProgress()
  const [open, setOpen] = useState(false)

  const hasActivity = counters.active > 0 || counters.completed > 0 || counters.failed > 0

  return (
    <div className="fixed bottom-0 left-[200px] right-0 z-40 pointer-events-none">
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
          {/* Connection indicator dot */}
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-success' : 'bg-muted/40'}`}
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
                  ev.type === 'task_failed'
                    ? 'text-danger'
                    : ev.type === 'task_completed'
                      ? 'text-success/80'
                      : 'text-muted',
                ].join(' ')}
              >
                <span className="shrink-0">
                  {ev.type === 'task_completed' ? '✓' : ev.type === 'task_failed' ? '✗' : '…'}
                </span>
                <span className="truncate">{ev.task_type ? `${ev.task_type} — ${ev.type}` : ev.type}</span>
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
