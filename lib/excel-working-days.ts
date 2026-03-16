import ExcelJS from 'exceljs'
import {
  titleStyle, headerStyle, sectionStyle,
  dataStyleEven, dataStyleOdd, totalStyle, nilStyle, projectedStyle,
} from './excel-styles'

const HALF_DAY_PATTERNS = [
  /^NL 1/i, /^NL 2/i, /^NL 3/i,
  /^Nursery 1/i, /^Nursery 2/i,
  /^Nursery L1/i, /^Nursery L2/i, /^Nursery L3/i,
]

function isHalfDay(contractType: string): boolean {
  return HALF_DAY_PATTERNS.some((p) => p.test(contractType))
}

interface Row {
  HrCode: string; Name: string; Year: number; Week: number
  WeekStart: string; WeekEnd: string; Source: string
  ContractType: string; ShiftCount: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateWorkingDaysExcel(data: any): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Working Days', { views: [{ state: 'frozen', ySplit: 4 }] })
  ws.properties.showGridLines = false

  const { contractor, currentEpoch, approved, projected } = data
  const name = contractor ? `${contractor.HrCode} — ${contractor.FirstName} ${contractor.LastName}` : 'Unknown'

  // Title
  const titleRow = ws.addRow([`Working Day Count Report: ${name}`])
  titleRow.eachCell((c) => { c.style = titleStyle })
  ws.mergeCells(titleRow.number, 1, titleRow.number, 7)
  titleRow.height = 30

  const epochRow = ws.addRow([`Current epoch: Year ${currentEpoch.year}, Week ${currentEpoch.week}`])
  epochRow.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF666666' } }

  // Merge and calculate
  const allRows = [
    ...approved.map((r: Row) => ({ ...r, DayCount: r.ShiftCount * (isHalfDay(r.ContractType) ? 0.5 : 1.0) })),
    ...projected.map((r: Row) => ({ ...r, DayCount: r.ShiftCount * (isHalfDay(r.ContractType) ? 0.5 : 1.0) })),
  ]

  // Weekly summary
  const weekMap = new Map<string, { year: number; week: number; weekStart: string; weekEnd: string; approvedDays: number; projectedDays: number }>()
  for (const row of allRows) {
    const key = `${row.Year}-${row.Week}`
    const existing = weekMap.get(key) ?? { year: row.Year, week: row.Week, weekStart: row.WeekStart, weekEnd: row.WeekEnd, approvedDays: 0, projectedDays: 0 }
    if (row.Source === 'Approved') existing.approvedDays += row.DayCount
    else existing.projectedDays += row.DayCount
    weekMap.set(key, existing)
  }
  const summaryRows = Array.from(weekMap.values()).sort((a, b) => b.year - a.year || b.week - a.week)

  // ── Section 1: Weekly Summary ──
  const s1 = ws.addRow(['Weekly Summary'])
  s1.eachCell((c) => { c.style = sectionStyle })
  ws.mergeCells(s1.number, 1, s1.number, 6)

  const h1 = ws.addRow(['Year', 'Week', 'Period', 'Approved Days', 'Projected Days', 'Total'])
  h1.eachCell((c) => { c.style = headerStyle })

  if (summaryRows.length === 0) {
    const nr = ws.addRow(['No working day records found.'])
    nr.eachCell((c) => { c.style = nilStyle })
    ws.mergeCells(nr.number, 1, nr.number, 6)
  } else {
    summaryRows.forEach((r, i) => {
      const hasProjected = r.projectedDays > 0
      const style = hasProjected ? projectedStyle : i % 2 === 0 ? dataStyleEven : dataStyleOdd
      const row = ws.addRow([
        r.year, r.week,
        `${r.weekStart} — ${r.weekEnd}`,
        r.approvedDays,
        r.projectedDays > 0 ? r.projectedDays : '—',
        r.approvedDays + r.projectedDays,
      ])
      row.eachCell((c) => { c.style = style })
    })

    const totApproved = summaryRows.reduce((s, r) => s + r.approvedDays, 0)
    const totProjected = summaryRows.reduce((s, r) => s + r.projectedDays, 0)
    const tr = ws.addRow(['', '', 'Totals', totApproved, totProjected > 0 ? totProjected : '—', totApproved + totProjected])
    tr.eachCell((c) => { c.style = totalStyle })
  }

  ws.addRow([])

  // ── Section 2: Detail by Contract Type ──
  const s2 = ws.addRow(['Detail by Contract Type'])
  s2.eachCell((c) => { c.style = sectionStyle })
  ws.mergeCells(s2.number, 1, s2.number, 7)

  const h2 = ws.addRow(['Year', 'Week', 'Period', 'Source', 'Contract Type', 'Shifts', 'Days'])
  h2.eachCell((c) => { c.style = headerStyle })

  if (allRows.length === 0) {
    const nr = ws.addRow(['No records.'])
    nr.eachCell((c) => { c.style = nilStyle })
    ws.mergeCells(nr.number, 1, nr.number, 7)
  } else {
    const sorted = allRows.sort((a: Row & { DayCount: number }, b: Row & { DayCount: number }) => b.Year - a.Year || b.Week - a.Week || a.Source.localeCompare(b.Source))
    sorted.forEach((r: Row & { DayCount: number }, i: number) => {
      const isProj = r.Source !== 'Approved'
      const style = isProj ? projectedStyle : i % 2 === 0 ? dataStyleEven : dataStyleOdd
      const row = ws.addRow([
        r.Year, r.Week,
        `${r.WeekStart} — ${r.WeekEnd}`,
        r.Source, r.ContractType,
        r.ShiftCount, r.DayCount,
      ])
      row.eachCell((c) => { c.style = style })
    })
  }

  // Column widths
  ws.getColumn(1).width = 10
  ws.getColumn(2).width = 10
  ws.getColumn(3).width = 28
  ws.getColumn(4).width = 18
  ws.getColumn(5).width = 22
  ws.getColumn(6).width = 12
  ws.getColumn(7).width = 12

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
