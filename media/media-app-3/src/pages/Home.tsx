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
