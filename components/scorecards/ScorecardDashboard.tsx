'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ScorecardRun, ScorecardResult } from '@/lib/types'

function StatusBadge({ status }: { status: ScorecardRun['status'] }) {
  const styles: Record<string, string> = {
    success: 'bg-emerald-100 text-emerald-800',
    no_files: 'bg-slate-100 text-slate-600',
    running: 'bg-blue-100 text-blue-800',
    error: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    success: 'Success',
    no_files: 'No files',
    running: 'Running',
    error: 'Error',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] ?? styles.error}`}>
      {status === 'running' && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
      {labels[status] ?? status}
    </span>
  )
}

function PredictionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    FANTASTIC_PLUS: 'bg-emerald-100 text-emerald-800',
    FANTASTIC: 'bg-green-100 text-green-800',
    GREAT: 'bg-blue-100 text-blue-800',
    FAIR: 'bg-amber-100 text-amber-800',
    POOR: 'bg-red-100 text-red-800',
  }
  const labels: Record<string, string> = {
    FANTASTIC_PLUS: 'F+',
    FANTASTIC: 'Fantastic',
    GREAT: 'Great',
    FAIR: 'Fair',
    POOR: 'Poor',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {labels[status] ?? status}
    </span>
  )
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '-'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 1000) return '<1s'
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  return `${mins}m ${rem}s`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function isToday(dateStr: string): boolean {
  return new Date(dateStr).toDateString() === new Date().toDateString()
}

const STATUS_ORDER = ['FANTASTIC_PLUS', 'FANTASTIC', 'GREAT', 'FAIR', 'POOR'] as const

function ResultsDetail({ results }: { results: ScorecardResult[] }) {
  const [activeTab, setActiveTab] = useState(0)
  const [view, setView] = useState<'summary' | 'predictions'>('summary')

  const result = results[activeTab]
  if (!result) return null

  return (
    <div className="border-t border-slate-100 bg-slate-50/50">
      {/* Calibration offset tabs */}
      {results.length > 1 && (
        <div className="px-4 sm:px-6 pt-3 flex gap-2">
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setActiveTab(i)}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                i === activeTab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Cal {r.calibration_offset > 0 ? '+' : ''}{r.calibration_offset.toFixed(1)}
            </button>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="px-4 sm:px-6 pt-3 flex gap-2">
        <button
          onClick={() => setView('summary')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            view === 'summary'
              ? 'bg-slate-800 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Summary
        </button>
        <button
          onClick={() => setView('predictions')}
          className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
            view === 'predictions'
              ? 'bg-slate-800 text-white'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          All Predictions ({result.prediction_count})
        </button>
      </div>

      <div className="px-4 sm:px-6 py-4">
        {view === 'summary' ? (
          <div className="space-y-4">
            {/* Score overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Mean Score', value: result.mean_score?.toFixed(1) },
                { label: 'Median Score', value: result.median_score?.toFixed(1) },
                { label: 'Min Score', value: result.min_score?.toFixed(1) },
                { label: 'Max Score', value: result.max_score?.toFixed(1) },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">{stat.label}</div>
                  <div className="text-lg font-semibold text-slate-900">{stat.value ?? '-'}</div>
                </div>
              ))}
            </div>

            {/* Status distribution */}
            {result.status_counts && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Status Distribution</h4>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {STATUS_ORDER.map((status) => {
                    const count = result.status_counts?.[status] ?? 0
                    const pct = result.prediction_count > 0
                      ? ((count / result.prediction_count) * 100).toFixed(1)
                      : '0'
                    return (
                      <div key={status}>
                        <div className="text-lg font-semibold text-slate-900">{count}</div>
                        <div className="text-xs text-slate-500">{pct}%</div>
                        <PredictionStatusBadge status={status} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Site summary */}
            {result.site_summary && result.site_summary.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 border-b border-slate-100">By Site</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-slate-500">
                        <th className="px-4 py-2 font-medium">Site</th>
                        <th className="px-4 py-2 font-medium text-right">Count</th>
                        <th className="px-4 py-2 font-medium text-right">Mean</th>
                        <th className="px-4 py-2 font-medium text-right">Median</th>
                        <th className="px-4 py-2 font-medium text-center">F+</th>
                        <th className="px-4 py-2 font-medium text-center">Fan</th>
                        <th className="px-4 py-2 font-medium text-center">Great</th>
                        <th className="px-4 py-2 font-medium text-center">Fair</th>
                        <th className="px-4 py-2 font-medium text-center">Poor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {result.site_summary.map((site) => (
                        <tr key={site.site} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">{site.site}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{site.records}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{site.mean_score.toFixed(1)}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{site.median_score.toFixed(1)}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{site.fantastic_plus}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{site.fantastic}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{site.great}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{site.fair}</td>
                          <td className="px-4 py-2 text-center text-slate-600">{site.poor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Full predictions table */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-4 py-2 font-medium">Site</th>
                    <th className="px-4 py-2 font-medium">Transporter ID</th>
                    <th className="px-4 py-2 font-medium text-right">Score</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {result.predictions.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-1.5 text-slate-900">{p.site}</td>
                      <td className="px-4 py-1.5 text-slate-600 font-mono">{p.transporter_id}</td>
                      <td className="px-4 py-1.5 text-right text-slate-900 font-medium">
                        {p.predicted_score?.toFixed(1) ?? '-'}
                      </td>
                      <td className="px-4 py-1.5">
                        <PredictionStatusBadge status={p.predicted_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ScorecardDashboard({ initialRuns }: { initialRuns: ScorecardRun[] }) {
  const router = useRouter()
  const [runs, setRuns] = useState(initialRuns)
  const [triggering, setTriggering] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null)
  const [loadingResults, setLoadingResults] = useState<string | null>(null)
  const [resultsCache, setResultsCache] = useState<Record<string, ScorecardResult[]>>({})

  const lastRun = runs[0] ?? null
  const isRunning = lastRun?.status === 'running'

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setPolling(false)
  }, [])

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/scorecards/history')
      if (res.ok) {
        const data = await res.json()
        setRuns(data.runs)
      }
    } catch {
      // silent
    }
  }, [])

  const startPolling = useCallback(() => {
    setPolling(true)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/scorecards/status')
        if (!res.ok) return
        const data = await res.json()
        if (data.status && data.status !== 'running') {
          stopPolling()
          await refreshHistory()
          router.refresh()
        }
      } catch {
        // keep polling
      }
    }, 3000)
  }, [stopPolling, refreshHistory, router])

  useEffect(() => {
    if (isRunning && !polling) {
      startPolling()
    }
    return () => stopPolling()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function triggerRun() {
    setTriggering(true)
    setError(null)
    try {
      const res = await fetch('/api/scorecards/run', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setError('Pipeline is already running')
        } else {
          throw new Error(data.error || 'Failed to start')
        }
        return
      }
      await refreshHistory()
      startPolling()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start pipeline')
    } finally {
      setTriggering(false)
    }
  }

  async function toggleResults(runId: string) {
    if (expandedRunId === runId) {
      setExpandedRunId(null)
      return
    }

    setExpandedRunId(runId)

    if (resultsCache[runId]) return

    setLoadingResults(runId)
    try {
      const res = await fetch(`/api/scorecards/results?run_id=${runId}`)
      if (res.ok) {
        const data = await res.json()
        setResultsCache((prev) => ({ ...prev, [runId]: data.results }))
      }
    } catch {
      // silent
    } finally {
      setLoadingResults(null)
    }
  }

  // Status banner
  const bannerRunning = isRunning || polling
  let bannerColour: string
  let bannerDot: string
  let bannerText: string

  if (bannerRunning) {
    bannerColour = 'bg-blue-50 border-blue-200 text-blue-800'
    bannerDot = 'bg-blue-500 animate-pulse'
    bannerText = 'Pipeline is running...'
  } else if (!lastRun) {
    bannerColour = 'bg-slate-50 border-slate-200 text-slate-600'
    bannerDot = 'bg-slate-400'
    bannerText = 'No runs recorded yet.'
  } else if (lastRun.status === 'error') {
    bannerColour = 'bg-red-50 border-red-200 text-red-800'
    bannerDot = 'bg-red-500'
    bannerText = `Last run failed: ${lastRun.error ?? 'Unknown error'}`
  } else if (isToday(lastRun.started_at)) {
    bannerColour = 'bg-emerald-50 border-emerald-200 text-emerald-800'
    bannerDot = 'bg-emerald-500'
    const status = lastRun.status === 'no_files' ? 'No files to process' : 'Completed successfully'
    bannerText = `${status} — today at ${new Date(lastRun.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    bannerColour = 'bg-amber-50 border-amber-200 text-amber-800'
    bannerDot = 'bg-amber-500'
    bannerText = `Last run: ${formatDateTime(lastRun.started_at)}`
  }

  return (
    <>
      {/* Status banner */}
      <div className={`rounded-xl border px-4 py-3 text-sm mb-6 flex items-center gap-2 ${bannerColour}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${bannerDot}`} />
        <span className="flex-1">{bannerText}</span>
        <button
          onClick={triggerRun}
          disabled={triggering || bannerRunning}
          className={`ml-auto shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
            triggering || bannerRunning
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {triggering ? 'Starting...' : bannerRunning ? 'Running...' : 'Run Scorecard'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
          {error}
        </div>
      )}

      {/* Run history */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Run History</h2>
        </div>

        {runs.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 text-center text-sm text-slate-500">
            No runs recorded yet. Click &quot;Run Scorecard&quot; to trigger the pipeline.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Column headers — desktop */}
            <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_0.5fr_0.5fr_0.5fr_auto] gap-1 px-6 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <div>Status</div>
              <div>Triggered By</div>
              <div>Started</div>
              <div>Duration</div>
              <div>Week</div>
              <div>Files</div>
              <div>Email</div>
              <div className="w-5" />
            </div>

            {runs.map((run) => {
              const isExpanded = expandedRunId === run.id
              const hasResults = run.status === 'success' && run.files_processed && run.files_processed > 0

              return (
                <div key={run.id}>
                  {/* Run row — desktop */}
                  <div
                    className={`hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_0.5fr_0.5fr_0.5fr_auto] items-center gap-1 px-6 py-3 text-sm ${
                      hasResults ? 'cursor-pointer hover:bg-slate-50' : ''
                    } ${isExpanded ? 'bg-slate-50' : ''}`}
                    onClick={() => hasResults && toggleResults(run.id)}
                  >
                    <div><StatusBadge status={run.status} /></div>
                    <div className="text-slate-600 capitalize">{run.triggered_by}</div>
                    <div className="text-slate-600">{formatDateTime(run.started_at)}</div>
                    <div className="text-slate-600">{formatDuration(run.started_at, run.completed_at)}</div>
                    <div className="text-slate-600">{run.week ?? '-'}</div>
                    <div className="text-slate-600">{run.files_processed ?? '-'}</div>
                    <div className="text-slate-600">
                      {run.email_sent === true ? (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : '-'}
                    </div>
                    <div className="w-5">
                      {hasResults && (
                        <svg
                          className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Run row — mobile */}
                  <div
                    className={`sm:hidden px-4 py-3 space-y-1 ${hasResults ? 'cursor-pointer' : ''} ${isExpanded ? 'bg-slate-50' : ''}`}
                    onClick={() => hasResults && toggleResults(run.id)}
                  >
                    <div className="flex items-center justify-between">
                      <StatusBadge status={run.status} />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 capitalize">{run.triggered_by}</span>
                        {hasResults && (
                          <svg
                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-600">
                      {formatDateTime(run.started_at)} &middot; {formatDuration(run.started_at, run.completed_at)}
                    </div>
                    {(run.week || run.files_processed) && (
                      <div className="text-xs text-slate-500">
                        {run.week ? `Week ${run.week}` : ''}
                        {run.week && run.files_processed ? ' · ' : ''}
                        {run.files_processed ? `${run.files_processed} file(s)` : ''}
                        {run.email_sent ? ' · Email sent' : ''}
                      </div>
                    )}
                    {run.status === 'error' && run.error && (
                      <div className="text-xs text-red-600 truncate">{run.error}</div>
                    )}
                  </div>

                  {/* Expanded results */}
                  {isExpanded && (
                    loadingResults === run.id ? (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-6 text-center text-sm text-slate-500">
                        Loading results...
                      </div>
                    ) : resultsCache[run.id] && resultsCache[run.id].length > 0 ? (
                      <ResultsDetail results={resultsCache[run.id]} />
                    ) : (
                      <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-6 text-center text-sm text-slate-500">
                        No prediction results stored for this run.
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </>
  )
}
