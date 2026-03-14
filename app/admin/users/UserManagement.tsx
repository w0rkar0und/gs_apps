'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/types'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export default function UserManagement({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState(initialProfiles)
  const [displayId, setDisplayId] = useState('')
  const [password, setPassword] = useState('')
  const [isInternal, setIsInternal] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setSuccess(null)

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_id: displayId.trim(),
        password,
        is_internal: isInternal,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to create user.')
      setCreating(false)
      return
    }

    setSuccess(`User "${displayId.trim()}" created successfully.`)
    setProfiles((prev) => [data.profile, ...prev])
    setDisplayId('')
    setPassword('')
    setCreating(false)
  }

  return (
    <>
      {/* Create user form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New User</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="display_id" className="block text-sm font-medium text-gray-700 mb-1">
                Display ID
              </label>
              <input
                id="display_id"
                type="text"
                value={displayId}
                onChange={(e) => setDisplayId(e.target.value)}
                required
                placeholder="e.g. X123456 or j.smith"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
              </label>
              <input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <div className="flex items-center gap-4 pt-1.5">
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="user_type"
                    checked={isInternal}
                    onChange={() => setIsInternal(true)}
                  />
                  Internal
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="user_type"
                    checked={!isInternal}
                    onChange={() => setIsInternal(false)}
                  />
                  External
                </label>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>

      {/* User list */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">All Users</h2>
        {profiles.length === 0 ? (
          <p className="text-gray-500 text-sm">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-3 pr-4 font-medium">Display ID</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Admin</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-3 pr-4 text-gray-900">{p.display_id}</td>
                    <td className="py-3 pr-4 text-gray-900">{p.is_internal ? 'Internal' : 'External'}</td>
                    <td className="py-3 pr-4">
                      {p.is_admin ? (
                        <span className="inline-block rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-xs font-medium">Admin</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 text-gray-900">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
