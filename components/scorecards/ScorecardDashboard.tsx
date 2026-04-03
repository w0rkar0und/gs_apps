'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { ScorecardRun } from '@/lib/types'

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

export default function ScorecardDashboard({ initialRuns }: { initialRuns: ScorecardRun[] }) {
  const router = useRouter()
  const [runs, setRuns] = useState(initialRuns)
  const [triggering, setTriggering] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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

  // Start polling if latest run is already running on mount
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
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Triggered By</th>
                    <th className="px-6 py-3">Started</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Week</th>
                    <th className="px-6 py-3">Files</th>
                    <th className="px-6 py-3">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-6 py-3 text-slate-600 capitalize">{run.triggered_by}</td>
                      <td className="px-6 py-3 text-slate-600">{formatDateTime(run.started_at)}</td>
                      <td className="px-6 py-3 text-slate-600">{formatDuration(run.started_at, run.completed_at)}</td>
                      <td className="px-6 py-3 text-slate-600">{run.week ?? '-'}</td>
                      <td className="px-6 py-3 text-slate-600">{run.files_processed ?? '-'}</td>
                      <td className="px-6 py-3 text-slate-600">
                        {run.email_sent === true ? (
                          <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-slate-100">
              {runs.map((run) => (
                <div key={run.id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <StatusBadge status={run.status} />
                    <span className="text-xs text-slate-500 capitalize">{run.triggered_by}</span>
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
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
