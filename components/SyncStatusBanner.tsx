'use client'

import type { SyncLogEntry } from '@/lib/types'

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.toDateString() === now.toDateString()
}

export default function SyncStatusBanner({ lastSync }: { lastSync: SyncLogEntry | null }) {
  if (!lastSync) {
    return (
      <div className="rounded bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 mb-6">
        No sync has ever run.
      </div>
    )
  }

  if (isToday(lastSync.ran_at)) {
    return (
      <div className="rounded bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 mb-6">
        Contractor sync completed today at {new Date(lastSync.ran_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.
      </div>
    )
  }

  return (
    <div className="rounded bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-6">
      Last sync: {formatDateTime(lastSync.ran_at)} — contractors table may be stale.
    </div>
  )
}
