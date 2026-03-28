'use client'

import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface DataRow {
  EpochYear: number
  EpochWeek: number
  ClientName: string
  BranchName: string
  BranchAlias: string | null
  ContractTypeName: string
  ShiftCount: number
  WeightedDays: number
}

interface Week {
  year: number
  week: number
}

interface BranchPerformanceData {
  weeks: Week[]
  rows: DataRow[]
}

function branchDisplay(row: { BranchName: string; BranchAlias: string | null }): string {
  return row.BranchAlias ? `${row.BranchName} (${row.BranchAlias})` : row.BranchName
}

function isZeroWeightStrict(contractType: string): boolean {
  return contractType === 'OSM' || contractType === 'Support'
}

function weekLabel(w: Week): string {
  return `Wk ${w.week}`
}

function weekKey(w: Week): string {
  return `${w.year}-${w.week}`
}

const CHART_COLOURS = [
  '#2E75B6', '#E67E22', '#27AE60', '#8E44AD', '#E74C3C',
  '#16A085', '#2C3E50', '#F39C12', '#1ABC9C', '#C0392B',
]

const sectionHeading = 'text-sm font-semibold text-white bg-[#2E75B6] px-4 py-2 rounded-t-lg'
const tableHeader = 'text-xs font-medium text-slate-500 uppercase tracking-wide'
const cellClass = 'py-2.5 px-4 text-sm text-slate-700'
const selectClasses = 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white'

export default function BranchPerformanceReport({ data }: { data: BranchPerformanceData }) {
  const { weeks, rows } = data

  const [clientFilter, setClientFilter] = useState<string>('All')
  const [branchFilter, setBranchFilter] = useState<string>('All')
  const [contractTypeFilter, setContractTypeFilter] = useState<string>('All')

  // Derive filter options
  const clients = useMemo(() => {
    const set = new Set(rows.map((r) => r.ClientName))
    return Array.from(set).sort()
  }, [rows])

  const branches = useMemo(() => {
    const filtered = clientFilter === 'All' ? rows : rows.filter((r) => r.ClientName === clientFilter)
    const map = new Map<string, string>()
    for (const r of filtered) {
      if (!map.has(r.BranchName)) map.set(r.BranchName, branchDisplay(r))
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows, clientFilter])

  const contractTypes = useMemo(() => {
    let filtered = rows
    if (clientFilter !== 'All') filtered = filtered.filter((r) => r.ClientName === clientFilter)
    if (branchFilter !== 'All') filtered = filtered.filter((r) => r.BranchName === branchFilter)
    const set = new Set(filtered.map((r) => r.ContractTypeName))
    return Array.from(set).sort()
  }, [rows, clientFilter, branchFilter])

  function handleClientChange(val: string) {
    setClientFilter(val)
    setBranchFilter('All')
    setContractTypeFilter('All')
  }

  function handleBranchChange(val: string) {
    setBranchFilter(val)
    setContractTypeFilter('All')
  }

  // Filtered rows
  const filteredRows = useMemo(() => {
    let result = rows
    if (clientFilter !== 'All') result = result.filter((r) => r.ClientName === clientFilter)
    if (branchFilter !== 'All') result = result.filter((r) => r.BranchName === branchFilter)
    if (contractTypeFilter !== 'All') result = result.filter((r) => r.ContractTypeName === contractTypeFilter)
    return result
  }, [rows, clientFilter, branchFilter, contractTypeFilter])

  // Chart data — lines over weeks, drill-down based on filter level
  const { chartData, lineKeys } = useMemo(() => {
    // Determine grouping key based on filter depth
    type GroupFn = (r: DataRow) => string
    let groupFn: GroupFn

    if (branchFilter !== 'All') {
      groupFn = (r) => r.ContractTypeName
    } else if (clientFilter !== 'All') {
      groupFn = (r) => branchDisplay(r)
    } else {
      groupFn = (r) => r.ClientName
    }

    // Build per-week totals per group
    const groupWeekMap = new Map<string, Map<string, number>>()

    for (const r of filteredRows) {
      const group = groupFn(r)
      const wk = weekKey({ year: r.EpochYear, week: r.EpochWeek })
      if (!groupWeekMap.has(group)) groupWeekMap.set(group, new Map())
      const weekMap = groupWeekMap.get(group)!
      weekMap.set(wk, (weekMap.get(wk) ?? 0) + r.WeightedDays)
    }

    // Sort groups by total descending, take top 10
    const groupTotals = Array.from(groupWeekMap.entries()).map(([group, weekMap]) => {
      const total = Array.from(weekMap.values()).reduce((a, b) => a + b, 0)
      return { group, total, weekMap }
    }).sort((a, b) => b.total - a.total)

    const topGroups = groupTotals.slice(0, 10)
    const keys = topGroups.map((g) => g.group)

    // Build chart data array — one entry per week
    const chart = weeks.map((w) => {
      const wk = weekKey(w)
      const entry: Record<string, string | number> = { name: weekLabel(w) }
      for (const g of topGroups) {
        entry[g.group] = Math.round((g.weekMap.get(wk) ?? 0) * 10) / 10
      }
      return entry
    })

    return { chartData: chart, lineKeys: keys }
  }, [filteredRows, weeks, clientFilter, branchFilter])

  // Grouped table data — pivot by week
  const tableGroups = useMemo(() => {
    // Group by client + branch
    const groups: {
      client: string
      branch: string
      branchAlias: string | null
      contractTypes: {
        name: string
        weekValues: Map<string, number>
        total: number
      }[]
      weekTotals: Map<string, number>
      total: number
    }[] = []

    let currentKey = ''
    let currentGroup: (typeof groups)[0] | null = null

    // Collect all unique rows per client+branch+contractType, summing per week
    const ctMap = new Map<string, { weekValues: Map<string, number>; total: number; client: string; branch: string; branchAlias: string | null; contractType: string }>()

    for (const r of filteredRows) {
      const groupKey = `${r.ClientName}|${r.BranchName}`
      const ctKey = `${groupKey}|${r.ContractTypeName}`
      const wk = weekKey({ year: r.EpochYear, week: r.EpochWeek })

      if (!ctMap.has(ctKey)) {
        ctMap.set(ctKey, {
          weekValues: new Map(),
          total: 0,
          client: r.ClientName,
          branch: r.BranchName,
          branchAlias: r.BranchAlias,
          contractType: r.ContractTypeName,
        })
      }
      const ct = ctMap.get(ctKey)!
      ct.weekValues.set(wk, (ct.weekValues.get(wk) ?? 0) + r.WeightedDays)
      ct.total += r.WeightedDays
    }

    // Organise into groups
    const sorted = Array.from(ctMap.values()).sort((a, b) => {
      const cmp = a.client.localeCompare(b.client)
      if (cmp !== 0) return cmp
      const bCmp = a.branch.localeCompare(b.branch)
      if (bCmp !== 0) return bCmp
      return a.contractType.localeCompare(b.contractType)
    })

    for (const entry of sorted) {
      const key = `${entry.client}|${entry.branch}`
      if (key !== currentKey) {
        currentGroup = {
          client: entry.client,
          branch: entry.branch,
          branchAlias: entry.branchAlias,
          contractTypes: [],
          weekTotals: new Map(),
          total: 0,
        }
        groups.push(currentGroup)
        currentKey = key
      }
      currentGroup!.contractTypes.push({
        name: entry.contractType,
        weekValues: entry.weekValues,
        total: entry.total,
      })
      currentGroup!.total += entry.total
      for (const [wk, val] of entry.weekValues) {
        currentGroup!.weekTotals.set(wk, (currentGroup!.weekTotals.get(wk) ?? 0) + val)
      }
    }

    return groups
  }, [filteredRows, weeks])

  const grandTotals = useMemo(() => {
    const weekTotals = new Map<string, number>()
    let total = 0
    for (const r of filteredRows) {
      const wk = weekKey({ year: r.EpochYear, week: r.EpochWeek })
      weekTotals.set(wk, (weekTotals.get(wk) ?? 0) + r.WeightedDays)
      total += r.WeightedDays
    }
    return { weekTotals, total }
  }, [filteredRows])

  const firstWeek = weeks[0]
  const lastWeek = weeks[weeks.length - 1]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#1F3864] rounded-lg px-5 py-4 text-white">
        <h2 className="text-lg font-semibold">Branch/Client Performance</h2>
        <p className="text-blue-200 text-sm mt-1">
          Weeks {firstWeek?.week}–{lastWeek?.week}, {lastWeek?.year}
          <span className="ml-3 text-blue-300">{weeks.length} week{weeks.length !== 1 ? 's' : ''}</span>
          <span className="ml-3 text-blue-300">{filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}</span>
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
            <label htmlFor="bpClientFilter" className="block text-sm font-medium text-slate-700 mb-1.5">
              Client
            </label>
            <select
              id="bpClientFilter"
              value={clientFilter}
              onChange={(e) => handleClientChange(e.target.value)}
              className={selectClasses + ' w-full'}
            >
              <option value="All">All</option>
              {clients.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="bpBranchFilter" className="block text-sm font-medium text-slate-700 mb-1.5">
              Branch
            </label>
            <select
              id="bpBranchFilter"
              value={branchFilter}
              onChange={(e) => handleBranchChange(e.target.value)}
              className={selectClasses + ' w-full'}
            >
              <option value="All">All</option>
              {branches.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
          </div>
          <div className="w-full sm:w-52">
            <label htmlFor="bpContractTypeFilter" className="block text-sm font-medium text-slate-700 mb-1.5">
              Contract Type
            </label>
            <select
              id="bpContractTypeFilter"
              value={contractTypeFilter}
              onChange={(e) => setContractTypeFilter(e.target.value)}
              className={selectClasses + ' w-full'}
            >
              <option value="All">All</option>
              {contractTypes.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Trend chart */}
      {chartData.length > 0 && lineKeys.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Weighted Days Trend — {branchFilter !== 'All' ? 'by Contract Type' : clientFilter !== 'All' ? 'by Branch' : 'by Client'}
            {lineKeys.length >= 10 && <span className="font-normal text-slate-400 ml-2">(top 10)</span>}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => [Number(value).toFixed(1), 'Weighted Days']}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {lineKeys.map((key, i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLOURS[i % CHART_COLOURS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Data table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={sectionHeading}>Data Breakdown</div>
        {tableGroups.length === 0 ? (
          <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800 italic">No data found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Client</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Branch</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Contract Type</th>
                  {weeks.map((w) => (
                    <th key={weekKey(w)} className={`${tableHeader} py-2.5 px-3 text-right whitespace-nowrap`}>
                      {weekLabel(w)}
                    </th>
                  ))}
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {tableGroups.map((group, gi) => (
                  <>{/* Group header */}
                    <tr key={`header-${gi}`} className="bg-[#2E75B6]/10 border-b border-slate-200">
                      <td colSpan={3} className="py-2 px-4 text-sm font-semibold text-[#1F3864]">
                        {group.client} — {group.branch}{group.branchAlias ? ` (${group.branchAlias})` : ''}
                      </td>
                      {weeks.map((w) => (
                        <td key={weekKey(w)} className="py-2 px-3 text-sm font-semibold text-[#1F3864] text-right">
                          {(group.weekTotals.get(weekKey(w)) ?? 0).toFixed(1)}
                        </td>
                      ))}
                      <td className="py-2 px-4 text-sm font-semibold text-[#1F3864] text-right">
                        {group.total.toFixed(1)}
                      </td>
                    </tr>
                    {/* Data rows */}
                    {group.contractTypes.map((ct, ri) => {
                      const zeroWeight = isZeroWeightStrict(ct.name)
                      return (
                        <tr
                          key={`row-${gi}-${ri}`}
                          className={`border-b border-slate-100 ${zeroWeight ? '' : ri % 2 === 1 ? 'bg-[#DEEAF1]/30' : ''}`}
                        >
                          <td className={`${cellClass} ${zeroWeight ? 'italic text-slate-400' : ''}`}>{group.client}</td>
                          <td className={`${cellClass} ${zeroWeight ? 'italic text-slate-400' : ''}`}>{group.branch}</td>
                          <td className={`${cellClass} ${zeroWeight ? 'italic text-slate-400' : ''}`}>{ct.name}</td>
                          {weeks.map((w) => (
                            <td key={weekKey(w)} className={`py-2.5 px-3 text-sm text-right ${zeroWeight ? 'italic text-slate-400' : 'text-slate-700'}`}>
                              {(ct.weekValues.get(weekKey(w)) ?? 0).toFixed(1)}
                            </td>
                          ))}
                          <td className={`${cellClass} text-right font-medium ${zeroWeight ? 'italic text-slate-400' : ''}`}>
                            {ct.total.toFixed(1)}
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))}
                {/* Grand total row */}
                <tr className="bg-[#E2EFDA]/50">
                  <td colSpan={3} className={`${cellClass} font-semibold`}>Grand Total</td>
                  {weeks.map((w) => (
                    <td key={weekKey(w)} className={`py-2.5 px-3 text-sm text-right font-semibold`}>
                      {(grandTotals.weekTotals.get(weekKey(w)) ?? 0).toFixed(1)}
                    </td>
                  ))}
                  <td className={`${cellClass} text-right font-semibold`}>{grandTotals.total.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
