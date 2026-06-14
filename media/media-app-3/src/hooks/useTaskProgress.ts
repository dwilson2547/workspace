import { useEffect, useRef, useState } from 'react'

interface TaskEvent {
  type: 'task_started' | 'task_completed' | 'task_failed'
  task_id: number
  task_type?: string
  media_item_id?: number
  error?: string
}

export interface StoredTaskEvent extends TaskEvent {
  seq: number
}

interface Counters {
  active: number
  completed: number
  failed: number
}

function updateCounters(prev: Counters, type: TaskEvent['type']): Counters {
  if (type === 'task_started') {
    return { ...prev, active: prev.active + 1 }
  } else if (type === 'task_completed') {
    return { ...prev, active: Math.max(0, prev.active - 1), completed: prev.completed + 1 }
  } else if (type === 'task_failed') {
    return { ...prev, active: Math.max(0, prev.active - 1), failed: prev.failed + 1 }
  }
  return prev
}

export function useTaskProgress() {
  const [events, setEvents] = useState<StoredTaskEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [counters, setCounters] = useState<Counters>({ active: 0, completed: 0, failed: 0 })
  const seqRef = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const delayRef = useRef(1000)
  const unmountedRef = useRef(false)

  useEffect(() => {
    unmountedRef.current = false

    function connect() {
      const ws = new WebSocket('ws://127.0.0.1:7899/ws/progress')
      wsRef.current = ws

      ws.onopen = () => {
        if (unmountedRef.current) return
        setConnected(true)
        delayRef.current = 1000
      }

      ws.onerror = () => {
        if (unmountedRef.current) return
        setConnected(false)
      }

      ws.onclose = () => {
        if (unmountedRef.current) return
        setConnected(false)
        timerRef.current = setTimeout(() => {
          if (!unmountedRef.current) connect()
        }, delayRef.current)
        delayRef.current = Math.min(delayRef.current * 2, 30000)
      }

      ws.onmessage = (e) => {
        if (unmountedRef.current) return
        if (typeof e.data !== 'string') return
        let event: TaskEvent
        try {
          event = JSON.parse(e.data) as TaskEvent
        } catch {
          return
        }
        const seq = ++seqRef.current
        const stored: StoredTaskEvent = { ...event, seq }
        const eventType = event.type
        setEvents(prev => [stored, ...prev].slice(0, 100))
        setCounters(prev => updateCounters(prev, eventType))
      }
    }

    connect()

    return () => {
      unmountedRef.current = true
      if (timerRef.current) clearTimeout(timerRef.current)
      const ws = wsRef.current
      if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
        ws.close()
      }
    }
  }, [])

  return { events, connected, counters }
}
