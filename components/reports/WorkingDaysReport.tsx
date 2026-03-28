'use client'

interface WorkingDayRow {
  HrCode: string
  Name: string
  Year: number
  Week: number
  WeekStart: string
  WeekEnd: string
  Source: string
  ContractType: string
  ShiftCount: number
  WeightedDays: number
}

interface Contractor {
  ContractorId: number
  HrCode: string
  FirstName: string
  LastName: string
}

interface WorkingDaysData {
  contractor: Contractor | null
  currentEpoch: { year: number; week: number }
  approved: WorkingDayRow[]
  projected: WorkingDayRow[]
}

function calculateDays(row: WorkingDayRow): number {
  return Number(row.WeightedDays)
}

const sectionHeading = "text-sm font-semibold text-white bg-[#2E75B6] px-4 py-2 rounded-t-lg"
const tableHeader = "text-xs font-medium text-slate-500 uppercase tracking-wide"
const cellClass = "py-2.5 px-4 text-sm text-slate-700"

export default function WorkingDaysReport({ data }: { data: WorkingDaysData }) {
  const { contractor, currentEpoch, approved, projected } = data

  if (!contractor) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
        Contractor not found. Please check the HR code and try again.
      </div>
    )
  }

  // Merge and calculate
  const allRows = [
    ...approved.map((r) => ({ ...r, DayCount: calculateDays(r) })),
    ...projected.map((r) => ({ ...r, DayCount: calculateDays(r) })),
  ]

  // Group by Year + Week for summary
  const weekSummary = new Map<string, { year: number; week: number; weekStart: string; weekEnd: string; approvedDays: number; projectedDays: number }>()

  for (const row of allRows) {
    const key = `${row.Year}-${row.Week}`
    const existing = weekSummary.get(key) ?? {
      year: row.Year,
      week: row.Week,
      weekStart: row.WeekStart,
      weekEnd: row.WeekEnd,
      approvedDays: 0,
      projectedDays: 0,
    }
    if (row.Source === 'Approved') {
      existing.approvedDays += row.DayCount
    } else {
      existing.projectedDays += row.DayCount
    }
    weekSummary.set(key, existing)
  }

  const summaryRows = Array.from(weekSummary.values())
    .sort((a, b) => b.year - a.year || b.week - a.week)

  const totalApproved = summaryRows.reduce((s, r) => s + r.approvedDays, 0)
  const totalProjected = summaryRows.reduce((s, r) => s + r.projectedDays, 0)

  return (
    <div className="space-y-6">
      {/* Contractor header */}
      <div className="bg-[#1F3864] rounded-lg px-5 py-4 text-white">
        <h2 className="text-lg font-semibold">Contractor - Working Day Count Report</h2>
        <p className="text-blue-200 text-sm mt-1">
          {contractor.HrCode} — {contractor.FirstName} {contractor.LastName}
          <span className="ml-3 text-blue-300">Current epoch: Year {currentEpoch.year}, Week {currentEpoch.week}</span>
        </p>
      </div>

      {/* Weekly Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={sectionHeading}>Weekly Summary</div>
        {summaryRows.length === 0 ? (
          <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800 italic">No working day records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Year</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Week</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Period</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Approved Days</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Projected Days</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((r, i) => {
                  const hasProjected = r.projectedDays > 0
                  return (
                    <tr key={`${r.year}-${r.week}`} className={`border-b border-slate-100 ${hasProjected ? 'bg-[#FFD966]/20' : i % 2 === 1 ? 'bg-[#DEEAF1]/30' : ''}`}>
                      <td className={cellClass}>{r.year}</td>
                      <td className={cellClass}>{r.week}</td>
                      <td className={cellClass}>{r.weekStart} — {r.weekEnd}</td>
                      <td className={`${cellClass} text-right`}>{r.approvedDays}</td>
                      <td className={`${cellClass} text-right ${hasProjected ? 'italic text-amber-700' : ''}`}>
                        {r.projectedDays > 0 ? r.projectedDays : '—'}
                      </td>
                      <td className={`${cellClass} text-right font-medium`}>{r.approvedDays + r.projectedDays}</td>
                    </tr>
                  )
                })}
                <tr className="bg-[#E2EFDA]/50">
                  <td colSpan={3} className={`${cellClass} font-semibold`}>Totals</td>
                  <td className={`${cellClass} text-right font-semibold`}>{totalApproved}</td>
                  <td className={`${cellClass} text-right font-semibold`}>{totalProjected > 0 ? totalProjected : '—'}</td>
                  <td className={`${cellClass} text-right font-semibold`}>{totalApproved + totalProjected}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Breakdown */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={sectionHeading}>Detail by Contract Type</div>
        {allRows.length === 0 ? (
          <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800 italic">No records.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Year</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Week</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Period</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Source</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Contract Type</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Shifts</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Days</th>
                </tr>
              </thead>
              <tbody>
                {allRows
                  .sort((a, b) => b.Year - a.Year || b.Week - a.Week || a.Source.localeCompare(b.Source))
                  .map((r, i) => {
                    const isProjected = r.Source !== 'Approved'
                    return (
                      <tr key={`${r.Year}-${r.Week}-${r.Source}-${r.ContractType}`} className={`border-b border-slate-100 ${isProjected ? 'bg-[#FFD966]/20 italic' : i % 2 === 1 ? 'bg-[#DEEAF1]/30' : ''}`}>
                        <td className={cellClass}>{r.Year}</td>
                        <td className={cellClass}>{r.Week}</td>
                        <td className={cellClass}>{r.WeekStart} — {r.WeekEnd}</td>
                        <td className={cellClass}>
                          {isProjected ? (
                            <span className="text-amber-700">Projected</span>
                          ) : (
                            <span className="text-emerald-700">Approved</span>
                          )}
                        </td>
                        <td className={cellClass}>{r.ContractType}</td>
                        <td className={`${cellClass} text-right`}>{r.ShiftCount}</td>
                        <td className={`${cellClass} text-right font-medium`}>{r.DayCount}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
