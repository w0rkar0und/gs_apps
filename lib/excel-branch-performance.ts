import ExcelJS from 'exceljs'
import {
  titleStyle, headerStyle, sectionStyle,
  dataStyleEven, dataStyleOdd, totalStyle,
  greyItalicStyle,
} from './excel-styles'

interface Row {
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

function weekKey(w: Week): string {
  return `${w.year}-${w.week}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateBranchPerformanceExcel(data: any): Promise<Buffer> {
  const { weeks, rows } = data as { weeks: Week[]; rows: Row[] }
  const totalCols = 3 + weeks.length + 1 // Client, Branch, ContractType, weeks..., Total

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Branch Performance', { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.properties.showGridLines = false

  const firstWeek = weeks[0]
  const lastWeek = weeks[weeks.length - 1]

  // Title
  const titleRow = ws.addRow([`Branch/Client Performance — Weeks ${firstWeek?.week ?? 0}–${lastWeek?.week ?? 0}, ${lastWeek?.year ?? 0}`])
  titleRow.eachCell((c) => { c.style = titleStyle })
  ws.mergeCells(titleRow.number, 1, titleRow.number, totalCols)
  titleRow.height = 30

  ws.addRow([])

  // Headers
  const headerValues = ['Client', 'Branch', 'Contract Type', ...weeks.map(w => `Wk ${w.week}`), 'Total']
  const hdr = ws.addRow(headerValues)
  hdr.eachCell((c) => { c.style = headerStyle })

  // Build grouped data: client+branch → contractType → week values
  interface CTEntry {
    name: string
    weekValues: Map<string, number>
    total: number
  }
  interface Group {
    client: string
    branch: string
    branchAlias: string | null
    contractTypes: CTEntry[]
    weekTotals: Map<string, number>
    total: number
  }

  const ctMap = new Map<string, { weekValues: Map<string, number>; total: number; client: string; branch: string; branchAlias: string | null; contractType: string }>()

  for (const r of rows) {
    const ctKey = `${r.ClientName}|${r.BranchName}|${r.ContractTypeName}`
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

  const sorted = Array.from(ctMap.values()).sort((a, b) => {
    const cmp = a.client.localeCompare(b.client)
    if (cmp !== 0) return cmp
    const bCmp = a.branch.localeCompare(b.branch)
    if (bCmp !== 0) return bCmp
    return a.contractType.localeCompare(b.contractType)
  })

  const groups: Group[] = []
  let currentKey = ''
  let currentGroup: Group | null = null

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

  let dataIdx = 0

  for (const group of groups) {
    // Section banner
    const bannerText = group.branchAlias
      ? `${group.client} — ${group.branch} (${group.branchAlias})`
      : `${group.client} — ${group.branch}`
    const banner = ws.addRow([bannerText])
    banner.eachCell((c) => { c.style = sectionStyle })
    ws.mergeCells(banner.number, 1, banner.number, totalCols)

    for (const ct of group.contractTypes) {
      const isZero = ct.name === 'OSM' || ct.name === 'Support'
      const style = isZero ? greyItalicStyle : dataIdx % 2 === 0 ? dataStyleEven : dataStyleOdd

      const values = [
        group.client,
        group.branch,
        ct.name,
        ...weeks.map(w => ct.weekValues.get(weekKey(w)) ?? 0),
        ct.total,
      ]
      const row = ws.addRow(values)
      row.eachCell((c) => { c.style = style })
      // Number format for week columns and total
      for (let i = 4; i <= 3 + weeks.length + 1; i++) {
        row.getCell(i).numFmt = '#,##0.0'
      }
      dataIdx++
    }

    // Site total row
    const siteValues = [
      '', '', 'Site Total',
      ...weeks.map(w => group.weekTotals.get(weekKey(w)) ?? 0),
      group.total,
    ]
    const siteRow = ws.addRow(siteValues)
    siteRow.eachCell((c) => { c.style = totalStyle })
    for (let i = 4; i <= 3 + weeks.length + 1; i++) {
      siteRow.getCell(i).numFmt = '#,##0.0'
    }
  }

  // Grand total
  ws.addRow([])
  const grandWeekTotals = new Map<string, number>()
  let grandTotal = 0
  for (const r of rows) {
    const wk = weekKey({ year: r.EpochYear, week: r.EpochWeek })
    grandWeekTotals.set(wk, (grandWeekTotals.get(wk) ?? 0) + r.WeightedDays)
    grandTotal += r.WeightedDays
  }
  const grandValues = [
    '', '', 'Grand Total',
    ...weeks.map(w => grandWeekTotals.get(weekKey(w)) ?? 0),
    grandTotal,
  ]
  const grandRow = ws.addRow(grandValues)
  grandRow.eachCell((c) => { c.style = totalStyle })
  for (let i = 4; i <= 3 + weeks.length + 1; i++) {
    grandRow.getCell(i).numFmt = '#,##0.0'
  }

  // Column widths
  ws.getColumn(1).width = 22
  ws.getColumn(2).width = 22
  ws.getColumn(3).width = 30
  for (let i = 4; i <= 3 + weeks.length; i++) {
    ws.getColumn(i).width = 12
  }
  ws.getColumn(3 + weeks.length + 1).width = 14

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
