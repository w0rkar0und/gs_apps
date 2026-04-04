# Fleet Mobile Tables + Assignment Alignment Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the assignment table column misalignment and add mobile card layouts for the assignment and compliance tables.

**Architecture:** Replace the CSS grid hack in the assignment table with proper `<tr>/<td>` rows. Add `sm:hidden` card lists alongside `hidden sm:block` tables for both panels (matching the Referrals app pattern).

**Tech Stack:** Next.js, Tailwind CSS v4, React

**Spec:** `docs/superpowers/specs/2026-04-04-fleet-mobile-tables-design.md`

---

### Task 1: Fix assignment table alignment + add mobile cards

**Files:**
- Modify: `components/fleet/VehicleStatusDashboard.tsx:890-1007`

- [ ] **Step 1: Replace the assignment table section**

In the assignment panel (Panel 2), find the block starting at line 890:
```tsx
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
```
...through to line 1007:
```tsx
          </div>
```

Replace this entire block with the following code. This does three things:
1. Adds mobile card layout (`sm:hidden`)
2. Hides the desktop table on mobile (`hidden sm:block`)
3. Fixes alignment by using proper `<tr>/<td>` instead of CSS grid

```tsx
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
```

**Important:** The desktop table now uses `Fragment` to wrap two sibling `<tr>` elements (data row + expanded history row). You must add `Fragment` to the existing react import at the top of the file: change `import { useState, useEffect, useMemo } from 'react'` to `import { useState, useEffect, useMemo, Fragment } from 'react'`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/fleet/VehicleStatusDashboard.tsx
git commit -m "feat: fix assignment table alignment, add mobile card layout"
```

---

### Task 2: Add compliance table mobile cards

**Files:**
- Modify: `components/fleet/VehicleStatusDashboard.tsx:1077-1116`

- [ ] **Step 1: Replace the compliance table section**

Find the compliance table container (inside the compliance panel, after the filter buttons). It starts with:
```tsx
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
```
and ends with its closing `</div>`.

Replace this entire block with:

```tsx
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {complianceVehicles.length === 0 ? (
              <div className="px-6 py-8 text-center text-sm text-gt-mid">
                No compliance issues found for the selected filter.
              </div>
            ) : (
              <>
                {/* Mobile: card layout */}
                <div className="sm:hidden divide-y divide-slate-200">
                  {complianceVehicles.map((v) => (
                    <div key={v.VehicleId} className="p-4">
                      <div className="mb-2">
                        <div className="text-gt-dark font-semibold">{v.RegistrationNumber}</div>
                        <div className="text-xs text-gt-mid">{v.BranchName || '-'} · {v.ModelName || '-'}</div>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gt-mid">MOT</span>
                          <span className="flex items-center gap-2">
                            <span className="text-gt-dark">{formatDateUK(v.NextMotDue)}</span>
                            <ComplianceBadge status={v.motStatus} />
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gt-mid">Road Tax</span>
                          <span className="flex items-center gap-2">
                            <span className="text-gt-dark">{formatDateUK(v.RoadTaxDue)}</span>
                            <ComplianceBadge status={v.taxStatus} />
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gt-mid">Insurance</span>
                          <span className="flex items-center gap-2">
                            <span className="text-gt-dark">{formatDateUK(v.InsuranceRenewalDate)}</span>
                            <ComplianceBadge status={v.insuranceStatus} />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: table layout */}
                <div className="hidden sm:block overflow-x-auto">
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
              </>
            )}
          </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/fleet/VehicleStatusDashboard.tsx
git commit -m "feat: add compliance table mobile card layout"
```
