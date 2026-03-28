'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SyncLogEntry } from '@/lib/types'

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export default function SyncStatusBanner({ lastSync }: { lastSync: SyncLogEntry | null }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<{ records_synced: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runSync() {
    setSyncing(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/referrals/admin/run-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Sync failed')
      }
      const data = await res.json()
      setResult(data)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const syncButton = (
    <button
      onClick={runSync}
      disabled={syncing}
      className={`ml-auto shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
        syncing
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {syncing ? 'Syncing...' : 'Run Sync'}
    </button>
  )

  let banner: React.ReactNode

  if (!lastSync) {
    banner = (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
        <span>No sync has ever run.</span>
        {syncButton}
      </div>
    )
  } else if (isToday(lastSync.ran_at)) {
    banner = (
      <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
        <span>Contractor sync completed today at {new Date(lastSync.ran_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.</span>
        {syncButton}
      </div>
    )
  } else {
    const dateStr = new Date(lastSync.ran_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = new Date(lastSync.ran_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    banner = (
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0" />
        <span>Last sync: {dateStr} {timeStr} — contractors table may be stale.</span>
        {syncButton}
      </div>
    )
  }

  return (
    <>
      {banner}
      {result && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-500 rounded-full shrink-0" />
          Sync complete — {result.records_synced.toLocaleString()} contractors updated.
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
          Sync failed: {error}
        </div>
      )}
    </>
  )
}
