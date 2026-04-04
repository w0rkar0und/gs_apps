'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
  Legend,
} from 'recharts'

// ── Types ──

interface Vehicle {
  VehicleId: number
  RegistrationNumber: string
  IsActive: string
  IsSorn: string
  Mileage: number | null
  Year: number | null
  NextMotDue: string | null
  RoadTaxDue: string | null
  PurchaseDate: string | null
  Value: number | null
  Payload: number | null
  BranchName: string | null
  BranchAlias: string | null
  OwnershipType: string | null
  IsOwnedByContractor: string | null
  ModelName: string | null
  TypeName: string | null
  CategoryName: string | null
  ColorName: string | null
  SupplierName: string | null
  InsuranceProvider: string | null
  InsuranceRenewalDate: string | null
  TrackerProvider: string | null
  BreakdownProvider: string | null
  ContractorHrCode: string | null
  ContractorName: string | null
  ContractorBranch: string | null
  AttachedSince: string | null
  AssignmentCount: number | null
}

interface AssignmentHistory {
  ContractorVehicleId: number
  HrCode: string
  ContractorName: string
  ContractorBranch: string | null
  FromDate: string
  ToDate: string | null
  IsCurrent: number
}

type Panel = 'overview' | 'assignment' | 'composition' | 'compliance'

// ── Helpers ──

function toBool(val: string | null | undefined): boolean {
  return val === '1' || val === 'true' || val === 'True'
}

function isDA(v: Vehicle): boolean {
  return v.OwnershipType === 'DA Supplied Vehicle'
}

function ownershipLabel(v: Vehicle): string {
  return isDA(v) ? 'DA Supplied' : 'Greythorn'
}

function attachmentLabel(v: Vehicle): string {
  return v.ContractorHrCode ? 'Attached' : 'Unattached'
}

function complianceStatus(dateStr: string | null): 'overdue' | 'due-soon' | 'valid' | 'unknown' {
  if (!dateStr) return 'unknown'
  const date = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return 'overdue'
  if (diff <= 30) return 'due-soon'
  return 'valid'
}

function formatDateUK(dateStr: string | null): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function distinct(arr: (string | null | undefined)[]): string[] {
  return [...new Set(arr.filter((x): x is string => !!x))].sort()
}

const CHART_COLOURS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
const PIE_COLOURS = ['#3b82f6', '#10b981']

// ── Stat Card ──

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Compliance Badge ──

function ComplianceBadge({ status }: { status: ReturnType<typeof complianceStatus> }) {
  const styles = {
    overdue: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    'due-soon': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    valid: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    unknown: 'bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200',
  }
  const labels = { overdue: 'Overdue', 'due-soon': 'Due soon', valid: 'Valid', unknown: '-' }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

// ── Main Dashboard ──

export default function VehicleStatusDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<Panel>('overview')

  // Filters
  const [filterBranch, setFilterBranch] = useState('')
  const [filterOwnership, setFilterOwnership] = useState('')
  const [filterActive, setFilterActive] = useState('active')
  const [filterAttachment, setFilterAttachment] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterModel, setFilterModel] = useState('')

  // Assignment history
  const [historyVehicleId, setHistoryVehicleId] = useState<number | null>(null)
  const [historyData, setHistoryData] = useState<AssignmentHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Download/email
  const [downloading, setDownloading] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Compliance filter
  const [complianceFilter, setComplianceFilter] = useState<'all' | 'overdue' | '30' | '60' | '90'>('all')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/fleet/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'snapshot' }),
        })
        if (!res.ok) {
          const err = await res.json()
          setError(err.error || 'Failed to load fleet data.')
          return
        }
        const data = await res.json()
        setVehicles(data.vehicles)
      } catch {
        setError('Failed to connect to fleet service.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Filter options
  const branches = useMemo(() => distinct(vehicles.map((v) => v.BranchName)), [vehicles])
  const types = useMemo(() => distinct(vehicles.map((v) => v.TypeName)), [vehicles])
  const models = useMemo(() => distinct(vehicles.map((v) => v.ModelName)), [vehicles])

  // Filtered vehicles
  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (filterBranch && v.BranchName !== filterBranch) return false
      if (filterOwnership === 'greythorn' && isDA(v)) return false
      if (filterOwnership === 'da' && !isDA(v)) return false
      if (filterActive === 'active' && !toBool(v.IsActive)) return false
      if (filterActive === 'inactive' && toBool(v.IsActive)) return false
      if (filterAttachment === 'attached' && !v.ContractorHrCode) return false
      if (filterAttachment === 'unattached' && v.ContractorHrCode) return false
      if (filterType && v.TypeName !== filterType) return false
      if (filterModel && v.ModelName !== filterModel) return false
      return true
    })
  }, [vehicles, filterBranch, filterOwnership, filterActive, filterAttachment, filterType, filterModel])

  // Load assignment history
  async function loadHistory(vehicleId: number) {
    if (historyVehicleId === vehicleId) {
      setHistoryVehicleId(null)
      return
    }
    setHistoryVehicleId(vehicleId)
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/fleet/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'history', vehicleId }),
      })
      if (res.ok) {
        const data = await res.json()
        setHistoryData(data.history)
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false)
    }
  }

  async function handleDownload() {
    setDownloading(true)
    setActionError(null)
    try {
      const res = await fetch('/api/fleet/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles: filtered,
          filters: { filterBranch, filterOwnership, filterActive, filterAttachment, filterType, filterModel },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        setActionError(err.error || 'Failed to download.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'report.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setActionError('Failed to download report.')
    } finally {
      setDownloading(false)
    }
  }

  async function handleEmail() {
    setEmailing(true)
    setActionError(null)
    setEmailSuccess(null)
    try {
      const res = await fetch('/api/fleet/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicles: filtered,
          filters: { filterBranch, filterOwnership, filterActive, filterAttachment, filterType, filterModel },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setActionError(data.error || 'Failed to send email.')
        return
      }
      setEmailSuccess('Report sent to your email.')
    } catch {
      setActionError('Failed to send email.')
    } finally {
      setEmailing(false)
    }
  }

  function clearFilters() {
    setFilterBranch('')
    setFilterOwnership('')
    setFilterActive('')
    setFilterAttachment('')
    setFilterType('')
    setFilterModel('')
  }

  const hasFilters = filterBranch || filterOwnership || filterActive || filterAttachment || filterType || filterModel

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center text-sm text-slate-500">
        Loading fleet data...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    )
  }

  // ── Panel data computations ──

  const activeCount = filtered.filter((v) => toBool(v.IsActive)).length
  const inactiveCount = filtered.length - activeCount
  const sornCount = filtered.filter((v) => toBool(v.IsSorn)).length
  const attachedCount = filtered.filter((v) => v.ContractorHrCode).length
  const unattachedCount = filtered.length - attachedCount

  // Branch breakdown — DA supplied only counted if attached to a contractor
  const byBranch = Object.entries(
    filtered.reduce((acc, v) => {
      // Skip DA supplied vehicles with no current contractor
      if (isDA(v) && !v.ContractorHrCode) return acc
      const b = v.BranchName || 'Unassigned'
      if (!acc[b]) acc[b] = { greythorn: 0, da: 0 }
      if (isDA(v)) acc[b].da++
      else acc[b].greythorn++
      return acc
    }, {} as Record<string, { greythorn: number; da: number }>)
  )
    .map(([name, counts]) => ({ name, ...counts, total: counts.greythorn + counts.da }))
    .sort((a, b) => b.total - a.total)

  // Ownership split
  const greythornCount = filtered.filter((v) => !isDA(v)).length
  const daCount = filtered.length - greythornCount
  const ownershipPie = [
    { name: 'Greythorn', value: greythornCount },
    { name: 'DA Supplied', value: daCount },
  ]

  // Model breakdown (top 15)
  const byModel = Object.entries(
    filtered.reduce((acc, v) => {
      const m = v.ModelName || 'Unknown'
      acc[m] = (acc[m] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)

  // Type breakdown
  const byType = Object.entries(
    filtered.reduce((acc, v) => {
      const t = v.TypeName || 'Unknown'
      acc[t] = (acc[t] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Compliance items
  const complianceVehicles = filtered
    .map((v) => ({
      ...v,
      motStatus: complianceStatus(v.NextMotDue),
      taxStatus: complianceStatus(v.RoadTaxDue),
      insuranceStatus: complianceStatus(v.InsuranceRenewalDate),
    }))
    .filter((v) => {
      if (complianceFilter === 'all') return v.motStatus !== 'valid' || v.taxStatus !== 'valid' || v.insuranceStatus !== 'valid'
      if (complianceFilter === 'overdue') return v.motStatus === 'overdue' || v.taxStatus === 'overdue' || v.insuranceStatus === 'overdue'
      const days = parseInt(complianceFilter)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + days)
      const inRange = (d: string | null) => {
        if (!d) return false
        const date = new Date(d)
        return date <= cutoff
      }
      return inRange(v.NextMotDue) || inRange(v.RoadTaxDue) || inRange(v.InsuranceRenewalDate)
    })
    .sort((a, b) => {
      // Sort by most urgent first
      const urgency = (s: string) => s === 'overdue' ? 0 : s === 'due-soon' ? 1 : 2
      const aMin = Math.min(urgency(a.motStatus), urgency(a.taxStatus), urgency(a.insuranceStatus))
      const bMin = Math.min(urgency(b.motStatus), urgency(b.taxStatus), urgency(b.insuranceStatus))
      return aMin - bMin
    })

  const selectClasses = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white"

  const panels: { key: Panel; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'assignment', label: 'Assignment' },
    { key: 'composition', label: 'Composition' },
    { key: 'compliance', label: 'Compliance' },
  ]

  return (
    <>
      {/* Panel tabs */}
      <div className="flex gap-1 mb-6">
        {panels.map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePanel(p.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
              activePanel === p.key
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className={selectClasses}>
              <option value="">All</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ownership</label>
            <select value={filterOwnership} onChange={(e) => setFilterOwnership(e.target.value)} className={selectClasses}>
              <option value="">All</option>
              <option value="greythorn">Greythorn</option>
              <option value="da">DA Supplied</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className={selectClasses}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Assignment</label>
            <select value={filterAttachment} onChange={(e) => setFilterAttachment(e.target.value)} className={selectClasses}>
              <option value="">All</option>
              <option value="attached">Attached</option>
              <option value="unattached">Unattached</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={selectClasses}>
              <option value="">All</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Model</label>
            <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className={selectClasses}>
              <option value="">All</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-2">
              Clear filters
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {downloading ? 'Downloading...' : 'Download Excel'}
            </button>
            <button
              onClick={handleEmail}
              disabled={emailing}
              className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              {emailing ? 'Sending...' : 'Email to Me'}
            </button>
            {actionError && <span className="text-sm text-red-600">{actionError}</span>}
            {emailSuccess && <span className="text-sm text-emerald-600">{emailSuccess}</span>}
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          {filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
        </div>
      </div>

      {/* ═══════════ PANEL 1: OVERVIEW ═══════════ */}
      {activePanel === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Vehicles" value={filtered.length} />
            <StatCard label="Active" value={activeCount} sub={`${inactiveCount} inactive`} />
            <StatCard label="SORN" value={sornCount} />
            <StatCard label="Attached" value={attachedCount} sub={`${unattachedCount} unattached`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Vehicles by branch */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Vehicles by Branch</h3>
              {byBranch.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(byBranch.length * 36, 200)}>
                  <BarChart data={byBranch} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="greythorn" stackId="a" name="Greythorn" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="da" stackId="a" name="DA Supplied" fill="#10b981" radius={[0, 4, 4, 0]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400">No data</p>
              )}
            </div>

            {/* Ownership split */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900 mb-6">Ownership Split</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={ownershipPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={42}
                  >
                    {ownershipPie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLOURS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 mt-4 text-sm text-slate-700">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                  Greythorn <span className="font-semibold">{greythornCount}</span>
                  <span className="text-slate-400 text-xs">({filtered.length > 0 ? ((greythornCount / filtered.length) * 100).toFixed(0) : 0}%)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  DA Supplied <span className="font-semibold">{daCount}</span>
                  <span className="text-slate-400 text-xs">({filtered.length > 0 ? ((daCount / filtered.length) * 100).toFixed(0) : 0}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PANEL 2: ASSIGNMENT ═══════════ */}
      {activePanel === 'assignment' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Attached" value={attachedCount} />
            <StatCard label="Unattached" value={unattachedCount} />
            <StatCard label="Greythorn Unattached" value={filtered.filter((v) => !v.ContractorHrCode && !isDA(v)).length} />
            <StatCard label="Total Assignments" value={filtered.reduce((sum, v) => sum + (v.AssignmentCount || 0), 0)} sub="all-time across fleet" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-4 py-3 font-medium w-5" />
                    <th className="px-4 py-3 font-medium">Registration</th>
                    <th className="px-4 py-3 font-medium">Branch</th>
                    <th className="px-4 py-3 font-medium">Ownership</th>
                    <th className="px-4 py-3 font-medium">Model</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Contractor</th>
                    <th className="px-4 py-3 font-medium">Contractor Branch</th>
                    <th className="px-4 py-3 font-medium">Attached Since</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const isExpanded = historyVehicleId === v.VehicleId
                    return (
                      <tr key={v.VehicleId} className="group">
                        <td colSpan={10} className="p-0">
                          <div
                            className={`grid grid-cols-[20px_1fr_1fr_1fr_1fr_0.8fr_0.8fr_1fr_1fr_1fr] items-center border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : ''}`}
                            onClick={() => loadHistory(v.VehicleId)}
                          >
                            <div className="px-4 py-3">
                              <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                              </svg>
                            </div>
                            <div className="px-4 py-3 text-slate-900 font-medium">{v.RegistrationNumber}</div>
                            <div className="px-4 py-3 text-slate-600">{v.BranchName || '-'}</div>
                            <div className="px-4 py-3">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                isDA(v)
                                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                                  : 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200'
                              }`}>
                                {ownershipLabel(v)}
                              </span>
                            </div>
                            <div className="px-4 py-3 text-slate-600">{v.ModelName || '-'}</div>
                            <div className="px-4 py-3 text-slate-600">{v.TypeName || '-'}</div>
                            <div className="px-4 py-3">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                v.ContractorHrCode
                                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                                  : 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200'
                              }`}>
                                {attachmentLabel(v)}
                              </span>
                            </div>
                            <div className="px-4 py-3 text-slate-600">
                              {v.ContractorHrCode ? (
                                <div>
                                  <span className="font-mono text-xs">{v.ContractorHrCode}</span>
                                  {v.ContractorName && <span className="ml-1.5">{v.ContractorName}</span>}
                                </div>
                              ) : '-'}
                            </div>
                            <div className="px-4 py-3 text-slate-600">{v.ContractorBranch || '-'}</div>
                            <div className="px-4 py-3 text-slate-600">{v.AttachedSince || '-'}</div>
                          </div>

                          {/* Assignment history */}
                          {isExpanded && (
                            <div className="border-b border-slate-200 bg-slate-50/50 px-8 py-4">
                              <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Assignment History</h4>
                              {historyLoading ? (
                                <p className="text-sm text-slate-400">Loading...</p>
                              ) : historyData.length === 0 ? (
                                <p className="text-sm text-slate-400">No assignment history.</p>
                              ) : (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-left text-slate-500">
                                      <th className="pb-2 pr-4 font-medium">HR Code</th>
                                      <th className="pb-2 pr-4 font-medium">Name</th>
                                      <th className="pb-2 pr-4 font-medium">Branch</th>
                                      <th className="pb-2 pr-4 font-medium">From</th>
                                      <th className="pb-2 pr-4 font-medium">To</th>
                                      <th className="pb-2 font-medium">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {historyData.map((h) => (
                                      <tr key={h.ContractorVehicleId} className="border-b border-slate-100 last:border-0">
                                        <td className="py-2 pr-4 font-mono text-slate-900">{h.HrCode}</td>
                                        <td className="py-2 pr-4 text-slate-600">{h.ContractorName}</td>
                                        <td className="py-2 pr-4 text-slate-600">{h.ContractorBranch || '-'}</td>
                                        <td className="py-2 pr-4 text-slate-600">{h.FromDate}</td>
                                        <td className="py-2 pr-4 text-slate-600">{h.ToDate || '-'}</td>
                                        <td className="py-2">
                                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                            h.IsCurrent
                                              ? 'bg-emerald-50 text-emerald-700'
                                              : 'bg-slate-100 text-slate-500'
                                          }`}>
                                            {h.IsCurrent ? 'Current' : 'Past'}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PANEL 3: COMPOSITION ═══════════ */}
      {activePanel === 'composition' && (
        <div className="space-y-6">
          {/* By model */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Vehicles by Model (top 15)</h3>
            {byModel.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(byModel.length * 32, 200)}>
                <BarChart data={byModel} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
                  <Tooltip />
                  <Bar dataKey="count" name="Vehicles" radius={[0, 4, 4, 0]}>
                    {byModel.map((_, i) => (
                      <Cell key={i} fill={CHART_COLOURS[i % CHART_COLOURS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No data</p>
            )}
          </div>

          {/* By type */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Vehicles by Type</h3>
            {byType.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {byType.map((t) => (
                  <div key={t.name} className="bg-slate-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-semibold text-slate-900">{t.count}</div>
                    <div className="text-xs text-slate-500 mt-1">{t.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No data</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ PANEL 4: COMPLIANCE ═══════════ */}
      {activePanel === 'compliance' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Show:</label>
            {(['all', 'overdue', '30', '60', '90'] as const).map((opt) => {
              const labels = { all: 'All issues', overdue: 'Overdue only', '30': 'Due within 30 days', '60': '60 days', '90': '90 days' }
              return (
                <button
                  key={opt}
                  onClick={() => setComplianceFilter(opt)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors duration-150 ${
                    complianceFilter === opt
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {labels[opt]}
                </button>
              )
            })}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {complianceVehicles.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-slate-500">
                No compliance issues found for the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-slate-500">
                      <th className="px-4 py-3 font-medium">Registration</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                      <th className="px-4 py-3 font-medium">Model</th>
                      <th className="px-4 py-3 font-medium">MOT Due</th>
                      <th className="px-4 py-3 font-medium">MOT Status</th>
                      <th className="px-4 py-3 font-medium">Road Tax Due</th>
                      <th className="px-4 py-3 font-medium">Tax Status</th>
                      <th className="px-4 py-3 font-medium">Insurance Renewal</th>
                      <th className="px-4 py-3 font-medium">Insurance Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceVehicles.map((v) => (
                      <tr key={v.VehicleId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-900 font-medium">{v.RegistrationNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{v.BranchName || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{v.ModelName || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDateUK(v.NextMotDue)}</td>
                        <td className="px-4 py-3"><ComplianceBadge status={v.motStatus} /></td>
                        <td className="px-4 py-3 text-slate-600">{formatDateUK(v.RoadTaxDue)}</td>
                        <td className="px-4 py-3"><ComplianceBadge status={v.taxStatus} /></td>
                        <td className="px-4 py-3 text-slate-600">{formatDateUK(v.InsuranceRenewalDate)}</td>
                        <td className="px-4 py-3"><ComplianceBadge status={v.insuranceStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
