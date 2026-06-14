import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSetting, setSetting } from '../api/client'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function Setup() {
  const navigate = useNavigate()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getSetting('data_root').then(s => {
      if (s.value) navigate('/')
    }).catch(() => {
      // 404 means not set — stay on setup page
    })
  }, [navigate])

  const handleChooseFolder = async () => {
    const path = await window.electronAPI.selectFolder()
    if (path) { setSelectedPath(path); setError(null) }
  }

  const handleContinue = async () => {
    if (!selectedPath) return
    setError(null)
    setSaving(true)
    try {
      await setSetting('data_root', selectedPath)
      navigate('/')
    } catch {
      setError('Failed to save settings. Is the backend running?')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-8">
      <div className="bg-surface-2 rounded-xl p-8 w-full max-w-md border border-surface-3/50 shadow-2xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-primary mb-2">Welcome to Media Manager</h1>
          <p className="text-sm text-muted leading-relaxed">
            Choose a folder where your media library data will be stored. This is where
            thumbnails, face crops, and the database will live — not your photos themselves.
          </p>
        </div>

        <div className="space-y-4">
          <Button variant="default" onClick={handleChooseFolder} className="w-full justify-center">
            Choose data folder…
          </Button>

          {selectedPath && (
            <div className="bg-surface-3/50 rounded-md px-3 py-2">
              <p className="text-xs text-muted mb-0.5">Selected:</p>
              <p className="text-sm text-primary font-mono break-all">{selectedPath}</p>
            </div>
          )}

          {error && (
            <p className="text-danger text-sm">{error}</p>
          )}

          <Button
            variant="accent"
            onClick={handleContinue}
            disabled={!selectedPath || saving}
            className="w-full justify-center"
          >
            {saving ? <><Spinner className="w-3.5 h-3.5" /> Saving…</> : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
