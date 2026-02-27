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
    // sortBy is included in the query key so changing sort order invalidates the cache.
    // Note: the backend does not support sort_dir — always sorts ascending by imported_at.
    queryKey: ['media', libraryName, personId, sortBy] as const,
    queryFn: ({ pageParam }: { pageParam: number | undefined }) =>
      fetchMediaPage(libraryName, pageParam, 100, personId),
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
