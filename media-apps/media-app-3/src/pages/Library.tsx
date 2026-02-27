import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { importMedia, reprocessLibrary, openLibrary } from '../api/client'
import MediaGrid from '../components/MediaGrid'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

type SortBy = 'newest' | 'oldest'

const dropdownItemClass =
  'flex items-center px-3 py-2 text-sm text-primary cursor-pointer rounded ' +
  'hover:bg-surface-3 focus:outline-none focus:bg-surface-3 select-none data-[disabled]:opacity-40'

const dropdownContentClass =
  'bg-surface-2 border border-surface-3 rounded-md shadow-xl py-1 min-w-[160px] z-50'

export default function Library() {
  const { name } = useParams<{ name: string }>()
  const qc = useQueryClient()
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [importError, setImportError] = useState<string | null>(null)

  const libraryName = name ? decodeURIComponent(name) : ''

  useEffect(() => {
    if (!libraryName) return
    openLibrary(libraryName)
      .then(() => qc.invalidateQueries({ queryKey: ['media', libraryName] }))
      .catch(() => {})
  }, [libraryName])

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

  const { mutate: doReprocess, isPending: isReprocessing } = useMutation({
    mutationFn: () => reprocessLibrary(libraryName),
    onSuccess: (result) => {
      setImportError(result.task_count === 0 ? 'All media already processed.' : null)
    },
    onError: () => setImportError('Reprocess failed. Is the backend running?'),
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

        {/* Reprocess button */}
        <Button
          variant="ghost"
          size="sm"
          disabled={isReprocessing}
          onClick={() => doReprocess()}
          title="Queue pipeline tasks for any media missing thumbnails or descriptions"
        >
          {isReprocessing ? <><Spinner className="w-3 h-3" /> Processing…</> : 'Reprocess'}
        </Button>

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
