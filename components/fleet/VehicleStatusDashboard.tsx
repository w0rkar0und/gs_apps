'use client'

import { useState, useEffect, useMemo, Fragment } from 'react'
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

interface ContractorVehicleHistory {
  ContractorVehicleId: number
  VehicleId: number
  RegistrationNumber: string
  VehicleBranch: string | null
  ModelName: string | null
  OwnershipType: string | null
  VehicleIsActive: string
  FromDate: string
  ToDate: string | null
  IsCurrent: number
}

interface ContractorLookup {
  HrCode: string
  ContractorName: string
  ContractorBranch: string | null
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

const CHART_COLOURS = ['#3B6E8F', '#58595B', '#A7A9AC', '#2D5670', '#7BA4BC', '#3B6E8F', '#58595B', '#A7A9AC']
const PIE_COLOURS = ['#3B6E8F', '#58595B']

// ── Stat Card ──

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-gt-blue p-4">
      <div className="text-xs text-gt-mid font-medium">{label}</div>
      <div className="text-2xl font-semibold text-gt-dark mt-1">{value}</div>
      {sub && <div className="text-xs text-gt-mid mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Compliance Badge ──

function ComplianceBadge({ status }: { status: ReturnType<typeof complianceStatus> }) {
  const styles = {
    overdue: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
    'due-soon': 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
    valid: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
    unknown: 'bg-slate-50 text-gt-mid ring-1 ring-inset ring-slate-200',
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
  const [filterVrm, setFilterVrm] = useState('')
  const [filterHrCode, setFilterHrCode] = useState('')

  // Assignment lookup
  const [lookupVrm, setLookupVrm] = useState('')
  const [lookupHrCode, setLookupHrCode] = useState('')
  const [lookupVehicleHistory, setLookupVehicleHistory] = useState<AssignmentHistory[] | null>(null)
  const [lookupContractorHistory, setLookupContractorHistory] = useState<ContractorVehicleHistory[] | null>(null)
  const [lookupContractor, setLookupContractor] = useState<ContractorLookup | null>(null)
  const [lookupVehicle, setLookupVehicle] = useState<Vehicle | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

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
      if (filterVrm && !v.RegistrationNumber?.toLowerCase().includes(filterVrm.toLowerCase())) return false
      if (filterHrCode && !v.ContractorHrCode?.toLowerCase().includes(filterHrCode.toLowerCase())) return false
      return true
    })
  }, [vehicles, filterBranch, filterOwnership, filterActive, filterAttachment, filterType, filterModel, filterVrm, filterHrCode])

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

  async function lookupByVrm() {
    const vrm = lookupVrm.trim().toUpperCase()
    if (!vrm) return
    setLookupLoading(true)
    setLookupContractorHistory(null)
    setLookupContractor(null)
    setLookupVehicleHistory(null)
    setLookupVehicle(null)
    setLookupError(null)

    // Find the vehicle in the full dataset (ignoring active filter)
    const match = vehicles.find((v) => v.RegistrationNumber?.toUpperCase() === vrm)
    if (!match) {
      setLookupVehicle(null)
      setLookupVehicleHistory([])
      setLookupLoading(false)
      return
    }
    setLookupVehicle(match)

    try {
      const res = await fetch('/api/fleet/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'history', vehicleId: match.VehicleId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error || 'Lookup failed.')
        return
      }
      setLookupVehicleHistory(data.history)
    } catch {
      setLookupError('Failed to connect to fleet service.')
    } finally {
      setLookupLoading(false)
    }
  }

  async function lookupByHrCode() {
    const code = lookupHrCode.trim().toUpperCase()
    if (!code) return
    setLookupLoading(true)
    setLookupVehicleHistory(null)
    setLookupVehicle(null)
    setLookupContractorHistory(null)
    setLookupContractor(null)
    setLookupError(null)

    try {
      const res = await fetch('/api/fleet/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'contractor-history', hrCode: code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error || 'Lookup failed.')
        return
      }
      setLookupContractor(data.contractor)
      setLookupContractorHistory(data.history)
    } catch {
      setLookupError('Failed to connect to fleet service.')
    } finally {
      setLookupLoading(false)
    }
  }

  function clearLookup() {
    setLookupVrm('')
    setLookupHrCode('')
    setLookupVehicleHistory(null)
    setLookupContractorHistory(null)
    setLookupContractor(null)
    setLookupVehicle(null)
    setLookupError(null)
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
    setFilterVrm('')
    setFilterHrCode('')
  }

  const hasFilters = filterBranch || filterOwnership || (filterActive && filterActive !== 'active') || filterAttachment || filterType || filterModel || filterVrm || filterHrCode

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-sm text-gt-mid">
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

  const selectClasses = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-gt-dark focus:outline-none focus:ring-2 focus:ring-gt-blue/40 focus:border-gt-blue focus:bg-white"

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
                ? 'bg-gt-blue text-white'
                : 'bg-white border border-slate-200 text-gt-dark hover:bg-gt-blue/5'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filter strip */}
      <div className="bg-white rounded-2xl border border-slate-200 border-t-2 border-t-gt-blue p-4 mb-3">
        {/* Row 1: Dropdown filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gt-mid mb-1">Branch</label>
            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className={`${selectClasses} w-full`}>
              <option value="">All</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gt-mid mb-1">Ownership</label>
            <select value={filterOwnership} onChange={(e) => setFilterOwnership(e.target.value)} className={`${selectClasses} w-full`}>
              <option value="">All</option>
              <option value="greythorn">Greythorn</option>
              <option value="da">DA Supplied</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gt-mid mb-1">Status</label>
            <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className={`${selectClasses} w-full`}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gt-mid mb-1">Assignment</label>
            <select value={filterAttachment} onChange={(e) => setFilterAttachment(e.target.value)} className={`${selectClasses} w-full`}>
              <option value="">All</option>
              <option value="attached">Attached</option>
              <option value="unattached">Unattached</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gt-mid mb-1">Type</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={`${selectClasses} w-full`}>
              <option value="">All</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gt-mid mb-1">Model</label>
            <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className={`${selectClasses} w-full`}>
              <option value="">All</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {/* Row 2: Text inputs + clear */}
        <div className="flex flex-wrap items-end justify-between gap-3 mt-3">
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gt-mid mb-1">VRM</label>
              <input
                type="text"
                value={filterVrm}
                onChange={(e) => setFilterVrm(e.target.value)}
                placeholder="Search..."
                className={`${selectClasses} w-28 uppercase`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gt-mid mb-1">HR Code</label>
              <input
                type="text"
                value={filterHrCode}
                onChange={(e) => setFilterHrCode(e.target.value)}
                placeholder="Search..."
                className={`${selectClasses} w-28 uppercase`}
              />
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gt-mid hover:text-gt-dark px-2 py-2">
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between py-3 mb-6">
        <div className="text-sm text-gt-mid">
          {filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 bg-gt-blue text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gt-blue-dark disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {downloading ? 'Downloading...' : 'Download Excel'}
          </button>
          <button
            onClick={handleEmail}
            disabled={emailing}
            className="inline-flex items-center gap-2 bg-slate-100 text-gt-dark rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
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
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-gt-dark mb-4">Vehicles by Branch</h3>
              {byBranch.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(byBranch.length * 36, 200)}>
                  <BarChart data={byBranch} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="greythorn" stackId="a" name="Greythorn" fill="#3B6E8F" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="da" stackId="a" name="DA Supplied" fill="#58595B" radius={[0, 4, 4, 0]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gt-mid">No data</p>
              )}
            </div>

            {/* Ownership split */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-base font-semibold text-gt-dark mb-6">Ownership Split</h3>
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
              <div className="flex justify-center gap-6 mt-4 text-sm text-gt-dark">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: '#3B6E8F' }} />
                  Greythorn <span className="font-semibold">{greythornCount}</span>
                  <span className="text-gt-mid text-xs">({filtered.length > 0 ? ((greythornCount / filtered.length) * 100).toFixed(0) : 0}%)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: '#58595B' }} />
                  DA Supplied <span className="font-semibold">{daCount}</span>
                  <span className="text-gt-mid text-xs">({filtered.length > 0 ? ((daCount / filtered.length) * 100).toFixed(0) : 0}%)</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PANEL 2: ASSIGNMENT ═══════════ */}
      {activePanel === 'assignment' && (
        <div className="space-y-6">
          {/* Assignment Lookup */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <h3 className="text-base font-semibold text-gt-dark mb-3">Assignment Lookup</h3>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gt-mid mb-1">Search by VRM</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupVrm}
                    onChange={(e) => setLookupVrm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lookupByVrm()}
                    placeholder="e.g. AB12 CDE"
                    className={`${selectClasses} w-36 uppercase`}
                  />
                  <button onClick={lookupByVrm} disabled={lookupLoading || !lookupVrm.trim()} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Search
                  </button>
                </div>
              </div>
              <div className="text-xs text-gt-mid self-center pb-2">or</div>
              <div>
                <label className="block text-xs font-medium text-gt-mid mb-1">Search by HR Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={lookupHrCode}
                    onChange={(e) => setLookupHrCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lookupByHrCode()}
                    placeholder="e.g. X003663"
                    className={`${selectClasses} w-36 uppercase`}
                  />
                  <button onClick={lookupByHrCode} disabled={lookupLoading || !lookupHrCode.trim()} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    Search
                  </button>
                </div>
              </div>
              {(lookupVehicleHistory || lookupContractorHistory) && (
                <button onClick={clearLookup} className="text-xs text-gt-mid hover:text-gt-dark px-2 py-2">
                  Clear
                </button>
              )}
            </div>

            {/* Lookup results */}
            {lookupLoading && <p className="text-sm text-gt-mid mt-4">Loading...</p>}
            {lookupError && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{lookupError}</div>
            )}

            {/* VRM lookup results */}
            {lookupVehicleHistory !== null && !lookupLoading && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                {lookupVehicle ? (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-base font-semibold text-gt-dark">{lookupVehicle.RegistrationNumber}</span>
                      <span className="text-xs text-gt-mid">{lookupVehicle.ModelName ?? ''}</span>
                      <span className="text-xs text-gt-mid">{lookupVehicle.BranchName ?? ''}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toBool(lookupVehicle.IsActive) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-gt-mid'}`}>
                        {toBool(lookupVehicle.IsActive) ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {lookupVehicleHistory.length === 0 ? (
                      <p className="text-sm text-gt-mid">No assignment history for this vehicle.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-gt-mid">
                            <th className="pb-2 pr-4 font-medium">HR Code</th>
                            <th className="pb-2 pr-4 font-medium">Name</th>
                            <th className="pb-2 pr-4 font-medium">Branch</th>
                            <th className="pb-2 pr-4 font-medium">From</th>
                            <th className="pb-2 pr-4 font-medium">To</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lookupVehicleHistory.map((h) => (
                            <tr key={h.ContractorVehicleId} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 pr-4 font-mono text-gt-dark">{h.HrCode}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.ContractorName}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.ContractorBranch || '-'}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.FromDate}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.ToDate || '-'}</td>
                              <td className="py-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${h.IsCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-gt-mid'}`}>
                                  {h.IsCurrent ? 'Current' : 'Past'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gt-mid">No vehicle found with registration &quot;{lookupVrm.toUpperCase()}&quot;.</p>
                )}
              </div>
            )}

            {/* HR Code lookup results */}
            {lookupContractorHistory !== null && !lookupLoading && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                {lookupContractor || lookupContractorHistory.length > 0 ? (
                  <>
                    {lookupContractor && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-base font-semibold text-gt-dark font-mono">{lookupContractor.HrCode}</span>
                        <span className="text-sm text-gt-dark">{lookupContractor.ContractorName}</span>
                        <span className="text-xs text-gt-mid">{lookupContractor.ContractorBranch ?? ''}</span>
                      </div>
                    )}
                    {lookupContractorHistory.length === 0 ? (
                      <p className="text-sm text-gt-mid">No vehicle assignments found for this contractor.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-gt-mid">
                            <th className="pb-2 pr-4 font-medium">Registration</th>
                            <th className="pb-2 pr-4 font-medium">Model</th>
                            <th className="pb-2 pr-4 font-medium">Branch</th>
                            <th className="pb-2 pr-4 font-medium">Ownership</th>
                            <th className="pb-2 pr-4 font-medium">Vehicle Active</th>
                            <th className="pb-2 pr-4 font-medium">From</th>
                            <th className="pb-2 pr-4 font-medium">To</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lookupContractorHistory.map((h) => (
                            <tr key={h.ContractorVehicleId} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 pr-4 text-gt-dark font-medium">{h.RegistrationNumber}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.ModelName || '-'}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.VehicleBranch || '-'}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.OwnershipType || '-'}</td>
                              <td className="py-2 pr-4">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toBool(h.VehicleIsActive) ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-gt-mid'}`}>
                                  {toBool(h.VehicleIsActive) ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-2 pr-4 text-gt-dark">{h.FromDate}</td>
                              <td className="py-2 pr-4 text-gt-dark">{h.ToDate || '-'}</td>
                              <td className="py-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${h.IsCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-gt-mid'}`}>
                                  {h.IsCurrent ? 'Current' : 'Past'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gt-mid">No contractor found with HR code &quot;{lookupHrCode.toUpperCase()}&quot;.</p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Attached" value={attachedCount} />
            <StatCard label="Unattached" value={unattachedCount} />
            <StatCard label="Greythorn Unattached" value={filtered.filter((v) => !v.ContractorHrCode && !isDA(v)).length} />
            <StatCard label="Total Assignments" value={filtered.reduce((sum, v) => sum + (v.AssignmentCount || 0), 0)} sub="all-time across fleet" />
          </div>

          {/* Mobile: card layout */}
          <div className="sm:hidden space-y-3">
            {filtered.map((v) => {
              const isExpanded = historyVehicleId === v.VehicleId
              return (
                <div key={v.VehicleId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gt-dark font-semibold">{v.RegistrationNumber}</span>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        isDA(v)
                          ? 'bg-gray-100 text-gt-dark ring-1 ring-inset ring-gray-200'
                          : 'bg-gt-blue/10 text-gt-blue ring-1 ring-inset ring-gt-blue/20'
                      }`}>
                        {ownershipLabel(v)}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-gt-mid">Branch</span><span className="text-gt-dark">{v.BranchName || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gt-mid">Model</span><span className="text-gt-dark">{v.ModelName || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gt-mid">Type</span><span className="text-gt-dark">{v.TypeName || '-'}</span></div>
                      <div className="flex justify-between items-center">
                        <span className="text-gt-mid">Status</span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          v.ContractorHrCode
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                            : 'bg-slate-50 text-gt-dark ring-1 ring-inset ring-slate-200'
                        }`}>
                          {attachmentLabel(v)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gt-mid">Contractor</span>
                        <span className="text-gt-dark">
                          {v.ContractorHrCode ? (
                            <><span className="font-mono text-xs">{v.ContractorHrCode}</span>{v.ContractorName && <span className="ml-1.5">{v.ContractorName}</span>}</>
                          ) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-gt-mid">Cont. Branch</span><span className="text-gt-dark">{v.ContractorBranch || '-'}</span></div>
                      <div className="flex justify-between"><span className="text-gt-mid">Attached Since</span><span className="text-gt-dark">{v.AttachedSince || '-'}</span></div>
                    </div>
                  </div>
                  <button
                    onClick={() => loadHistory(v.VehicleId)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-t border-slate-200 text-xs font-medium text-gt-mid hover:bg-slate-50"
                  >
                    <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                    Assignment History
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3">
                      {historyLoading ? (
                        <p className="text-sm text-gt-mid">Loading...</p>
                      ) : historyData.length === 0 ? (
                        <p className="text-sm text-gt-mid">No assignment history.</p>
                      ) : (
                        <div className="space-y-2">
                          {historyData.map((h) => (
                            <div key={h.ContractorVehicleId} className="bg-white rounded-lg border border-slate-200 p-3 text-xs">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-gt-dark font-medium">{h.HrCode}</span>
                                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                  h.IsCurrent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-gt-mid'
                                }`}>
                                  {h.IsCurrent ? 'Current' : 'Past'}
                                </span>
                              </div>
                              <div className="text-gt-dark">{h.ContractorName}</div>
                              <div className="text-gt-mid mt-1">{h.ContractorBranch || '-'}</div>
                              <div className="text-gt-mid mt-1">{h.FromDate} → {h.ToDate || 'Present'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-gt-mid">
                    <th className="px-4 py-3 font-medium w-8" />
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
                      <Fragment key={v.VehicleId}>
                        <tr
                          className={`border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : ''}`}
                          onClick={() => loadHistory(v.VehicleId)}
                        >
                          <td className="px-4 py-3">
                            <svg className={`w-4 h-4 text-gt-mid transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </td>
                          <td className="px-4 py-3 text-gt-dark font-medium">{v.RegistrationNumber}</td>
                          <td className="px-4 py-3 text-gt-dark">{v.BranchName || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              isDA(v)
                                ? 'bg-gray-100 text-gt-dark ring-1 ring-inset ring-gray-200'
                                : 'bg-gt-blue/10 text-gt-blue ring-1 ring-inset ring-gt-blue/20'
                            }`}>
                              {ownershipLabel(v)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gt-dark">{v.ModelName || '-'}</td>
                          <td className="px-4 py-3 text-gt-dark">{v.TypeName || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              v.ContractorHrCode
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                                : 'bg-slate-50 text-gt-dark ring-1 ring-inset ring-slate-200'
                            }`}>
                              {attachmentLabel(v)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gt-dark">
                            {v.ContractorHrCode ? (
                              <div>
                                <span className="font-mono text-xs">{v.ContractorHrCode}</span>
                                {v.ContractorName && <span className="ml-1.5">{v.ContractorName}</span>}
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 text-gt-dark">{v.ContractorBranch || '-'}</td>
                          <td className="px-4 py-3 text-gt-dark">{v.AttachedSince || '-'}</td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={10} className="p-0">
                              <div className="border-b border-slate-200 bg-slate-50/50 px-8 py-4">
                                <h4 className="text-xs font-medium text-gt-mid uppercase tracking-wider mb-2">Assignment History</h4>
                                {historyLoading ? (
                                  <p className="text-sm text-gt-mid">Loading...</p>
                                ) : historyData.length === 0 ? (
                                  <p className="text-sm text-gt-mid">No assignment history.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-slate-200 text-left text-gt-mid">
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
                                          <td className="py-2 pr-4 font-mono text-gt-dark">{h.HrCode}</td>
                                          <td className="py-2 pr-4 text-gt-dark">{h.ContractorName}</td>
                                          <td className="py-2 pr-4 text-gt-dark">{h.ContractorBranch || '-'}</td>
                                          <td className="py-2 pr-4 text-gt-dark">{h.FromDate}</td>
                                          <td className="py-2 pr-4 text-gt-dark">{h.ToDate || '-'}</td>
                                          <td className="py-2">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                              h.IsCurrent
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-slate-100 text-gt-mid'
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
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-gt-dark mb-4">Vehicles by Model (top 15)</h3>
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
              <p className="text-sm text-gt-mid">No data</p>
            )}
          </div>

          {/* By type */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-base font-semibold text-gt-dark mb-4">Vehicles by Type</h3>
            {byType.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {byType.map((t) => (
                  <div key={t.name} className="bg-gt-bg rounded-xl p-4 text-center">
                    <div className="text-2xl font-semibold text-gt-dark">{t.count}</div>
                    <div className="text-xs text-gt-mid mt-1">{t.name}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gt-mid">No data</p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ PANEL 4: COMPLIANCE ═══════════ */}
      {activePanel === 'compliance' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gt-mid">Show:</label>
            {(['all', 'overdue', '30', '60', '90'] as const).map((opt) => {
              const labels = { all: 'All issues', overdue: 'Overdue only', '30': 'Due within 30 days', '60': '60 days', '90': '90 days' }
              return (
                <button
                  key={opt}
                  onClick={() => setComplianceFilter(opt)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors duration-150 ${
                    complianceFilter === opt
                      ? 'bg-gt-blue text-white'
                      : 'bg-white border border-slate-200 text-gt-dark hover:bg-gt-blue/5'
                  }`}
                >
                  {labels[opt]}
                </button>
              )
            })}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {complianceVehicles.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gt-mid">
                No compliance issues found for the selected filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-gt-mid">
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
                        <td className="px-4 py-3 text-gt-dark font-medium">{v.RegistrationNumber}</td>
                        <td className="px-4 py-3 text-gt-dark">{v.BranchName || '-'}</td>
                        <td className="px-4 py-3 text-gt-dark">{v.ModelName || '-'}</td>
                        <td className="px-4 py-3 text-gt-dark">{formatDateUK(v.NextMotDue)}</td>
                        <td className="px-4 py-3"><ComplianceBadge status={v.motStatus} /></td>
                        <td className="px-4 py-3 text-gt-dark">{formatDateUK(v.RoadTaxDue)}</td>
                        <td className="px-4 py-3"><ComplianceBadge status={v.taxStatus} /></td>
                        <td className="px-4 py-3 text-gt-dark">{formatDateUK(v.InsuranceRenewalDate)}</td>
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
