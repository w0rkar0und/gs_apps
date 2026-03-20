'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SuccessToast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000)
    // Clean the URL so the toast doesn't reappear on refresh
    window.history.replaceState(null, '', '/referrals')
    return () => clearTimeout(timer)
  }, [router])

  if (!visible) return null

  return (
    <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between animate-fade-in">
      <span>{message}</span>
      <button
        onClick={() => setVisible(false)}
        className="ml-4 text-emerald-600 hover:text-emerald-800"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
