# Fleet Filter Bar Redesign — Design Spec

**Date:** 2026-04-04
**Scope:** Restructure the Fleet dashboard filter bar from a single flex-wrap row into two distinct visual zones (filter strip + action bar).

---

## Context

The current filter bar crams 8 dropdowns, 2 text inputs, 2 action buttons, a clear link, and a vehicle count into a single `flex-wrap` row. On most screens this creates a dense wall of near-identical grey rectangles where filters and actions compete for attention.

This spec splits it into two zones with clear purpose: one for narrowing data, one for acting on it.

---

## 1. Filter Strip

The existing white card container with `border-t-2 border-t-gt-blue` accent.

### Row 1 — Dropdown filters

Layout: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3`

Six dropdowns in order:
1. Branch
2. Ownership
3. Status
4. Assignment
5. Type
6. Model

Each dropdown retains its current label + select pattern:
```tsx
<div>
  <label className="block text-xs font-medium text-gt-mid mb-1">Branch</label>
  <select ... className={selectClasses}>...</select>
</div>
```

### Row 2 — Text inputs and meta

Layout: `flex flex-wrap items-end justify-between gap-3 mt-3`

- **Left side:** VRM text input, HR Code text input (same styling as current)
- **Right side:** Clear filters link (only visible when `hasFilters` is true)

### Select classes

No change to `selectClasses` — already rebranded. Add `w-full` to make selects fill their grid cell:

Current: `"rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-gt-dark ..."`

Add `w-full` to the select elements inside the grid (not to `selectClasses` itself, since text inputs also use `selectClasses` and should keep their fixed `w-28` width). Apply `w-full` directly on each `<select>` element via `className={`${selectClasses} w-full`}`.

---

## 2. Action Bar

A separate element below the filter strip. No card, no border — a lightweight utility row.

Layout: `flex items-center justify-between py-3`

- **Left side:** Vehicle count — `{filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}{hasFilters ? ' (filtered)' : ''}`
  - Styling: `text-sm text-gt-mid` (promoted from `text-xs` for better visibility)

- **Right side:** `flex items-center gap-2`
  - Download Excel button (current styling: `bg-gt-blue text-white ...`)
  - Email to Me button (current styling: `bg-slate-100 text-gt-dark ...`)
  - Action error message (`text-sm text-red-600`)
  - Email success message (`text-sm text-emerald-600`)

---

## 3. What Changes

| Element | Before | After |
|---|---|---|
| Filter layout | `flex flex-wrap items-end gap-3` | CSS grid (dropdowns) + flex (text inputs) |
| Dropdown sizing | Auto-width | `w-full` filling grid cells |
| Text inputs | Mixed in with dropdowns | Separate row below dropdowns |
| Actions | `ml-auto` in same flex row | Separate action bar below filter strip |
| Vehicle count | `text-xs text-gt-mid` at bottom of filter card | `text-sm text-gt-mid` in action bar left side |
| Clear filters | Inline with filters | Right side of text input row |

## 4. What Doesn't Change

- Filter state management (all useState hooks unchanged)
- Filter logic (the `filtered` useMemo unchanged)
- Download/email handler functions
- Select/input styling classes (already rebranded)
- Action button styling
- Any other panel content

---

## 5. File Touched

| File | Change |
|---|---|
| `components/fleet/VehicleStatusDashboard.tsx:~537-637` | Restructure filter bar JSX into filter strip + action bar |
