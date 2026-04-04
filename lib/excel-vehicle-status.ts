import ExcelJS from 'exceljs'
import {
  titleStyle, headerStyle,
  dataStyleEven, dataStyleOdd,
} from './excel-styles'

interface Filters {
  filterBranch?: string
  filterOwnership?: string
  filterActive?: string
  filterAttachment?: string
  filterType?: string
  filterModel?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateVehicleStatusExcel(vehicles: any[], filters?: Filters): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Vehicle Status', { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.properties.showGridLines = false

  const date = new Date().toLocaleDateString('en-GB')

  // Build filter summary
  const filterParts: string[] = []
  if (filters?.filterBranch) filterParts.push(`Branch: ${filters.filterBranch}`)
  if (filters?.filterOwnership) filterParts.push(`Ownership: ${filters.filterOwnership}`)
  if (filters?.filterActive) filterParts.push(`Status: ${filters.filterActive}`)
  if (filters?.filterAttachment) filterParts.push(`Assignment: ${filters.filterAttachment}`)
  if (filters?.filterType) filterParts.push(`Type: ${filters.filterType}`)
  if (filters?.filterModel) filterParts.push(`Model: ${filters.filterModel}`)
  const filterText = filterParts.length > 0 ? ` (${filterParts.join(', ')})` : ''

  // Title
  const titleRow = ws.addRow([`Vehicle Status Report — ${date}${filterText}`])
  titleRow.eachCell((c) => { c.style = titleStyle })
  ws.mergeCells(titleRow.number, 1, titleRow.number, 12)
  titleRow.height = 30

  ws.addRow([])

  // Headers
  const columns = [
    'Registration', 'Branch', 'Ownership', 'Model', 'Type', 'Category',
    'Active', 'Contractor HR Code', 'Contractor Name', 'Contractor Branch',
    'Attached Since', 'MOT Due', 'Road Tax Due', 'Insurance Renewal',
  ]
  const hdr = ws.addRow(columns)
  hdr.eachCell((c) => { c.style = headerStyle })

  // Data rows
  vehicles.forEach((v, i) => {
    const isOwned = v.IsOwnedByContractor === '1' || v.IsOwnedByContractor === 'true' || v.IsOwnedByContractor === 'True'
    const isActive = v.IsActive === '1' || v.IsActive === 'true' || v.IsActive === 'True'
    const style = i % 2 === 0 ? dataStyleEven : dataStyleOdd

    const row = ws.addRow([
      v.RegistrationNumber ?? '',
      v.BranchName ?? '',
      isOwned ? 'DA Supplied' : 'Greythorn',
      v.ModelName ?? '',
      v.TypeName ?? '',
      v.CategoryName ?? '',
      isActive ? 'Active' : 'Inactive',
      v.ContractorHrCode ?? '',
      v.ContractorName ?? '',
      v.ContractorBranch ?? '',
      v.AttachedSince ?? '',
      v.NextMotDue ? new Date(v.NextMotDue).toLocaleDateString('en-GB') : '',
      v.RoadTaxDue ? new Date(v.RoadTaxDue).toLocaleDateString('en-GB') : '',
      v.InsuranceRenewalDate ? new Date(v.InsuranceRenewalDate).toLocaleDateString('en-GB') : '',
    ])
    row.eachCell((c) => { c.style = style })
  })

  // Column widths
  ws.getColumn(1).width = 16   // Registration
  ws.getColumn(2).width = 18   // Branch
  ws.getColumn(3).width = 14   // Ownership
  ws.getColumn(4).width = 22   // Model
  ws.getColumn(5).width = 14   // Type
  ws.getColumn(6).width = 14   // Category
  ws.getColumn(7).width = 10   // Active
  ws.getColumn(8).width = 16   // HR Code
  ws.getColumn(9).width = 22   // Contractor Name
  ws.getColumn(10).width = 18  // Contractor Branch
  ws.getColumn(11).width = 14  // Attached Since
  ws.getColumn(12).width = 14  // MOT Due
  ws.getColumn(13).width = 14  // Road Tax Due
  ws.getColumn(14).width = 16  // Insurance Renewal

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
