# Fleet Filter Bar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Fleet dashboard filter bar from a single flex-wrap row into a two-zone layout (filter strip + action bar).

**Architecture:** Replace the single `flex-wrap` container (lines 537-637 of VehicleStatusDashboard.tsx) with a filter card containing a CSS grid of dropdowns + flex row of text inputs, followed by a separate action bar with vehicle count and download/email buttons.

**Tech Stack:** Next.js, Tailwind CSS v4, React

**Spec:** `docs/superpowers/specs/2026-04-04-fleet-filter-bar-redesign.md`

---

### Task 1: Replace filter bar with two-zone layout

**Files:**
- Modify: `components/fleet/VehicleStatusDashboard.tsx:508,537-637`

- [ ] **Step 1: Update selectClasses focus ring to use brand colour**

At line 508, replace:

```tsx
const selectClasses = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-gt-dark focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 focus:bg-white"
```

With:

```tsx
const selectClasses = "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-gt-dark focus:outline-none focus:ring-2 focus:ring-gt-blue/40 focus:border-gt-blue focus:bg-white"
```

- [ ] **Step 2: Replace the entire filter bar block**

Replace lines 536-637 (from `{/* Filter bar */}` through the closing `</div>` and the empty line before `{/* ═══════════ PANEL 1: OVERVIEW ═══════════ */}`) with:

```tsx
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | tail -10`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components/fleet/VehicleStatusDashboard.tsx
git commit -m "feat: redesign Fleet filter bar into two-zone layout"
```
