'use client'

interface Transaction {
  ContractorVehicleDepositTransactionId: number
  Amount: number
  IsDeleted: boolean
  Date: string
  CreatedBy: string | null
}

interface Deposit {
  ContractorVehicleDepositId: number
  DepositAmount: number
  DepositWeeks: number
  IsCancelled: boolean
  CreatedDate: string
  CreatedBy: string | null
  UpdatedDate: string | null
  UpdatedBy: string | null
  CancelledDate: string | null
  CancelledBy: string | null
  transactions: Transaction[]
}

interface Vehicle {
  VRM: string
  Model: string | null
  Make: string | null
  Supplier: string
  VehicleSupplierId: number | null
  FromDate: string
  ToDate: string | null
}

interface Charge {
  VRM: string
  Reason: string
  Reference: string | null
  IssueDate: string
  Charged: number
  Paid: number
  Outstanding: number
}

interface DepositReturn {
  Amount: number
  Date: string
  IsDeleted: boolean
  CreatedBy: string | null
  CreatedDate: string
}

interface Contractor {
  ContractorId: number
  HrCode: string
  FirstName: string
  LastName: string
  Email: string | null
  PhoneNumber: string | null
}

interface DepositReportData {
  contractor: Contractor | null
  deposits: Deposit[]
  vehicles: Vehicle[]
  charges: Charge[]
  depositReturns: DepositReturn[]
}

const sectionHeading = "text-sm font-semibold text-white bg-[#2E75B6] px-4 py-2 rounded-t-lg"
const tableHeader = "text-xs font-medium text-slate-500 uppercase tracking-wide"
const cellClass = "py-2.5 px-4 text-sm text-slate-700"

function currency(val: number): string {
  return val.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
}

export default function DepositReport({ data }: { data: DepositReportData }) {
  const { contractor, deposits, vehicles, charges, depositReturns } = data

  if (!contractor) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
        Contractor not found. Please check the HR code and try again.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Contractor header */}
      <div className="bg-[#1F3864] rounded-lg px-5 py-4 text-white">
        <h2 className="text-lg font-semibold">Deposit Report</h2>
        <p className="text-blue-200 text-sm mt-1">
          {contractor.HrCode} — {contractor.FirstName} {contractor.LastName}
          {contractor.Email && <span className="ml-3 text-blue-300">{contractor.Email}</span>}
        </p>
      </div>

      {/* Section 1: Deposit Details */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={sectionHeading}>Deposit Details</div>
        {deposits.length === 0 ? (
          <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800 italic">No deposit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Amount</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Weeks</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Status</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Created</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Created By</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Updated</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Updated By</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Cancelled</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Cancelled By</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d, i) => (
                  <>
                    <tr key={d.ContractorVehicleDepositId} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-[#DEEAF1]/30' : ''} ${d.IsCancelled ? 'opacity-60' : ''}`}>
                      <td className={cellClass}>{currency(d.DepositAmount)}</td>
                      <td className={cellClass}>{d.DepositWeeks}</td>
                      <td className={cellClass}>
                        {d.IsCancelled ? (
                          <span className="inline-block rounded-full bg-red-50 text-red-600 px-2.5 py-0.5 text-xs font-medium">Cancelled</span>
                        ) : (
                          <span className="inline-block rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-medium">Active</span>
                        )}
                      </td>
                      <td className={cellClass}>{d.CreatedDate}</td>
                      <td className={cellClass}>{d.CreatedBy ?? '—'}</td>
                      <td className={cellClass}>{d.UpdatedDate ?? '—'}</td>
                      <td className={cellClass}>{d.UpdatedBy ?? '—'}</td>
                      <td className={cellClass}>{d.CancelledDate ?? '—'}</td>
                      <td className={cellClass}>{d.CancelledBy ?? '—'}</td>
                    </tr>
                    {d.transactions.length > 0 && d.transactions.map((t) => (
                      <tr key={t.ContractorVehicleDepositTransactionId} className="bg-slate-50/50 border-b border-slate-100">
                        <td className={`${cellClass} pl-8 text-slate-500`}>{currency(t.Amount)}</td>
                        <td className={cellClass} />
                        <td className={cellClass}>
                          {t.IsDeleted ? (
                            <span className="text-xs text-red-400 italic">Deleted</span>
                          ) : (
                            <span className="text-xs text-slate-400">Transaction</span>
                          )}
                        </td>
                        <td className={`${cellClass} text-slate-500`}>{t.Date}</td>
                        <td className={`${cellClass} text-slate-500`}>{t.CreatedBy ?? '—'}</td>
                        <td colSpan={4} />
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Vehicle Usage History */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={sectionHeading}>Vehicle Usage History</div>
        {vehicles.length === 0 ? (
          <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800 italic">No vehicle records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>VRM</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Make</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Model</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Supplier</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>From</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>To</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v, i) => {
                  const isNonGreythorn = v.VehicleSupplierId !== 2
                  return (
                    <tr key={`${v.VRM}-${v.FromDate}`} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-[#DEEAF1]/30' : ''} ${isNonGreythorn ? 'italic text-gray-400' : ''}`}>
                      <td className={cellClass}>{v.VRM}</td>
                      <td className={cellClass}>{v.Make ?? '—'}</td>
                      <td className={cellClass}>{v.Model ?? '—'}</td>
                      <td className={cellClass}>{v.Supplier}</td>
                      <td className={cellClass}>{v.FromDate}</td>
                      <td className={cellClass}>{v.ToDate ?? 'Current'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Vehicle Charges */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={sectionHeading}>Vehicle Charges</div>
        {charges.length === 0 ? (
          <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800 italic">No vehicle charges found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>VRM</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Reason</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Reference</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Issue Date</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Charged</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Paid</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-right`}>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((ch, i) => (
                  <tr key={`${ch.VRM}-${ch.IssueDate}-${ch.Reference}`} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-[#DEEAF1]/30' : ''}`}>
                    <td className={cellClass}>{ch.VRM}</td>
                    <td className={cellClass}>{ch.Reason}</td>
                    <td className={cellClass}>{ch.Reference ?? '—'}</td>
                    <td className={cellClass}>{ch.IssueDate}</td>
                    <td className={`${cellClass} text-right`}>{currency(ch.Charged)}</td>
                    <td className={`${cellClass} text-right`}>{currency(ch.Paid)}</td>
                    <td className={`${cellClass} text-right font-medium ${ch.Outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {currency(ch.Outstanding)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#E2EFDA]/50">
                  <td colSpan={4} className={`${cellClass} font-semibold`}>Totals</td>
                  <td className={`${cellClass} text-right font-semibold`}>{currency(charges.reduce((s, c) => s + c.Charged, 0))}</td>
                  <td className={`${cellClass} text-right font-semibold`}>{currency(charges.reduce((s, c) => s + c.Paid, 0))}</td>
                  <td className={`${cellClass} text-right font-semibold`}>{currency(charges.reduce((s, c) => s + c.Outstanding, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4: Deposit Return Audit */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className={sectionHeading}>Deposit Return Audit</div>
        {depositReturns.length === 0 ? (
          <div className="bg-amber-50 px-4 py-3 text-sm text-amber-800 italic">No Deposit Return record found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Amount</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Date</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Created By</th>
                  <th className={`${tableHeader} py-2.5 px-4 text-left`}>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {depositReturns.map((dr, i) => (
                  <tr key={`${dr.Date}-${dr.Amount}`} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-[#DEEAF1]/30' : ''}`}>
                    <td className={cellClass}>{currency(dr.Amount)}</td>
                    <td className={cellClass}>{dr.Date}</td>
                    <td className={cellClass}>{dr.CreatedBy ?? '—'}</td>
                    <td className={cellClass}>{dr.CreatedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
