import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSetting, setSetting,
  fetchLibraries, fetchClusteringRuns, triggerClusteringRun, activateClusteringRun,
} from '../api/client'
import type { HdbscanParams } from '../api/client'
import type { ClusteringRun } from '../api/types'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'

const DEFAULT_HDBSCAN: HdbscanParams = {
  min_cluster_size: 5,
  min_samples: 1,
  cluster_selection_epsilon: 0.0,
}

function parseHdbscanParams(raw: string | null | undefined): HdbscanParams {
  if (!raw) return { ...DEFAULT_HDBSCAN }
  try {
    const parsed = JSON.parse(raw) as Partial<HdbscanParams>
    return {
      min_cluster_size: parsed.min_cluster_size ?? DEFAULT_HDBSCAN.min_cluster_size,
      min_samples: parsed.min_samples ?? DEFAULT_HDBSCAN.min_samples,
      cluster_selection_epsilon: parsed.cluster_selection_epsilon ?? DEFAULT_HDBSCAN.cluster_selection_epsilon,
    }
  } catch {
    return { ...DEFAULT_HDBSCAN }
  }
}

// ── SliderRow ─────────────────────────────────────────────────────────────────
interface SliderRowProps {
  label: string
  id: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  hint?: string
}

function SliderRow({ label, id, min, max, step, value, onChange, hint }: SliderRowProps) {
  return (
    <div className="flex items-center gap-4">
      <label htmlFor={id} className="text-sm text-muted w-52 shrink-0">
        {label}: <span className="text-primary font-mono">{step < 1 ? value.toFixed(2) : value}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(step < 1 ? parseFloat(e.target.value) : parseInt(e.target.value, 10))}
        className="w-48 accent-accent"
      />
      {hint && <span className="text-xs text-muted/60">{hint}</span>}
    </div>
  )
}

// ── ClusteringRunsTable ───────────────────────────────────────────────────────
interface ClusteringRunsTableProps {
  libraryName: string
  hdbscanParams: HdbscanParams
}

function ClusteringRunsTable({ libraryName, hdbscanParams }: ClusteringRunsTableProps) {
  const qc = useQueryClient()
  const [triggerError, setTriggerError] = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)

  const { data: runs = [], isLoading } = useQuery<ClusteringRun[]>({
    queryKey: ['clusteringRuns', libraryName],
    queryFn: () => fetchClusteringRuns(libraryName),
  })

  const { mutate: doTrigger, isPending: isTriggering } = useMutation({
    mutationFn: () => triggerClusteringRun(libraryName, hdbscanParams),
    onSuccess: () => {
      setTriggerError(null)
      qc.invalidateQueries({ queryKey: ['clusteringRuns', libraryName] })
    },
    onError: () => setTriggerError('Failed to start clustering run.'),
  })

  const { mutate: doActivate } = useMutation({
    mutationFn: (runId: number) => activateClusteringRun(libraryName, runId),
    onSuccess: () => {
      setActivateError(null)
      qc.invalidateQueries({ queryKey: ['clusteringRuns', libraryName] })
    },
    onError: () => setActivateError('Failed to activate run.'),
  })

  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-primary mb-2">{libraryName}</h4>
      {isLoading && <Spinner className="w-4 h-4 text-muted" />}
      {!isLoading && runs.length === 0 && (
        <p className="text-xs text-muted mb-2">No clustering runs yet.</p>
      )}
      {runs.length > 0 && (
        <div className="overflow-x-auto rounded border border-surface-3 mb-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-3 bg-surface-3/50">
                {['#', 'Created', 'Status', 'min_cluster', 'min_samples', 'epsilon', ''].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-muted font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id} className="border-b border-surface-3/50 hover:bg-surface-3/30">
                  <td className="px-3 py-2 text-muted">{run.run_number}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(run.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {run.is_active
                      ? <Badge variant="accent">Active</Badge>
                      : <Badge variant="muted">Inactive</Badge>}
                  </td>
                  <td className="px-3 py-2 text-center">{run.parameters.min_cluster_size}</td>
                  <td className="px-3 py-2 text-center">{run.parameters.min_samples}</td>
                  <td className="px-3 py-2 text-center">{run.parameters.cluster_selection_epsilon.toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {!run.is_active && (
                      <Button size="sm" variant="ghost" onClick={() => doActivate(run.id)}>
                        Activate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {activateError && <p className="text-danger text-xs mb-1">{activateError}</p>}
      <Button size="sm" variant="default" onClick={() => doTrigger()} disabled={isTriggering}>
        {isTriggering ? <><Spinner className="w-3 h-3" /> Starting…</> : '+ New Clustering Run'}
      </Button>
      {triggerError && <p className="text-danger text-xs mt-1">{triggerError}</p>}
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────
export default function Settings() {
  const qc = useQueryClient()
  const sectionClass = 'border-b border-surface-3/50 pb-8 mb-8'
  const headingClass = 'text-[10px] font-semibold text-muted uppercase tracking-widest mb-4'

  // Data root
  const { data: dataRootSetting } = useQuery({
    queryKey: ['setting', 'data_root'],
    queryFn: () => getSetting('data_root'),
  })
  const currentDataRoot = dataRootSetting?.value ?? null
  const [dataRootSaving, setDataRootSaving] = useState(false)
  const [dataRootError, setDataRootError] = useState<string | null>(null)

  const handleChooseDataRoot = async () => {
    const path = await window.electronAPI.selectFolder()
    if (!path) return
    setDataRootSaving(true)
    setDataRootError(null)
    try {
      await setSetting('data_root', path)
      qc.invalidateQueries({ queryKey: ['setting', 'data_root'] })
    } catch {
      setDataRootError('Failed to save data root.')
    } finally {
      setDataRootSaving(false)
    }
  }

  // HDBSCAN params
  const { data: hdbscanSetting } = useQuery({
    queryKey: ['setting', 'hdbscan_params'],
    queryFn: () => getSetting('hdbscan_params'),
  })
  const [hdbscanParams, setHdbscanParams] = useState<HdbscanParams>(DEFAULT_HDBSCAN)
  const [hdbscanSaving, setHdbscanSaving] = useState(false)
  const [hdbscanError, setHdbscanError] = useState<string | null>(null)
  const [hdbscanSaved, setHdbscanSaved] = useState(false)

  useEffect(() => {
    if (hdbscanSetting !== undefined) setHdbscanParams(parseHdbscanParams(hdbscanSetting.value))
  }, [hdbscanSetting])

  useEffect(() => { setHdbscanSaved(false) }, [hdbscanParams])

  const handleHdbscanSave = async () => {
    setHdbscanSaving(true)
    setHdbscanError(null)
    setHdbscanSaved(false)
    try {
      await setSetting('hdbscan_params', JSON.stringify(hdbscanParams))
      setHdbscanSaved(true)
    } catch {
      setHdbscanError('Failed to save HDBSCAN parameters.')
    } finally {
      setHdbscanSaving(false)
    }
  }

  // Libraries for clustering run tables
  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries'],
    queryFn: fetchLibraries,
  })

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-lg font-semibold text-primary mb-8">Settings</h1>

      {/* Data Root */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Data Root Directory</h2>
        <p className="text-xs text-muted mb-3">
          Where thumbnails, face crops, and the database are stored. Not your original photos.
        </p>
        {currentDataRoot && (
          <div className="bg-surface-3/50 rounded px-3 py-2 mb-3 font-mono text-xs text-primary break-all">
            {currentDataRoot}
          </div>
        )}
        <Button variant="default" onClick={handleChooseDataRoot} disabled={dataRootSaving}>
          {dataRootSaving ? <><Spinner className="w-3 h-3" /> Saving…</> : 'Change folder…'}
        </Button>
        {dataRootError && <p className="text-danger text-xs mt-2">{dataRootError}</p>}
      </section>

      {/* HDBSCAN */}
      <section className={sectionClass}>
        <h2 className={headingClass}>Default HDBSCAN Parameters</h2>
        <p className="text-xs text-muted mb-4">
          Used when creating a new clustering run. Affects how faces are grouped into people.
        </p>
        <div className="space-y-3 mb-4">
          <SliderRow
            label="min_cluster_size" id="min_cluster_size"
            min={2} max={50} step={1}
            value={hdbscanParams.min_cluster_size}
            onChange={v => setHdbscanParams(p => ({ ...p, min_cluster_size: v }))}
            hint="2–50"
          />
          <SliderRow
            label="min_samples" id="min_samples"
            min={1} max={10} step={1}
            value={hdbscanParams.min_samples}
            onChange={v => setHdbscanParams(p => ({ ...p, min_samples: v }))}
            hint="1–10"
          />
          <SliderRow
            label="cluster_selection_epsilon" id="epsilon"
            min={0} max={1} step={0.01}
            value={hdbscanParams.cluster_selection_epsilon}
            onChange={v => setHdbscanParams(p => ({ ...p, cluster_selection_epsilon: v }))}
            hint="0–1.0"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button variant="default" onClick={handleHdbscanSave} disabled={hdbscanSaving}>
            {hdbscanSaving ? <><Spinner className="w-3 h-3" /> Saving…</> : 'Save Parameters'}
          </Button>
          {hdbscanSaved && <span className="text-success text-sm">Saved.</span>}
          {hdbscanError && <span className="text-danger text-sm">{hdbscanError}</span>}
        </div>
      </section>

      {/* Clustering Runs */}
      <section>
        <h2 className={headingClass}>Clustering Runs</h2>
        {libraries.length === 0 && (
          <p className="text-xs text-muted">No libraries found.</p>
        )}
        {libraries.map(lib => (
          <ClusteringRunsTable
            key={lib.name}
            libraryName={lib.name}
            hdbscanParams={hdbscanParams}
          />
        ))}
      </section>
    </div>
  )
}
