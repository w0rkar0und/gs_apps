# Fleet Mobile Tables + Assignment Alignment Fix — Design Spec

**Date:** 2026-04-04
**Scope:** Fix assignment table column alignment, add mobile card layouts for assignment and compliance tables.

---

## Context

The Fleet dashboard has two main data tables (Assignment panel, Compliance panel) that are unusable on mobile — 9-10 columns with `overflow-x-auto` is not a solution. The Referrals app already uses a `sm:hidden` card / `hidden sm:block` table pattern that works well.

Additionally, the assignment table has a column alignment bug: vehicle data rows use a CSS grid (`grid-cols-[20px_1fr_1fr_1fr_1fr_0.8fr_0.8fr_1fr_1fr_1fr]`) inside `<td colSpan={10}>`, while headers use standard `<th>` elements. The two systems distribute space differently, causing misalignment.

---

## 1. Assignment Table — Desktop Fix

Replace the CSS grid hack with proper `<tr>/<td>` table rows.

**Current (broken):** Each vehicle row is a single `<td colSpan={10}>` containing a CSS grid div. The grid fractions don't match the `<th>` column widths.

**New:** Each vehicle row is a standard `<tr>` with 10 `<td>` cells matching the 10 `<th>` headers. The expand chevron is in the first `<td>`. The row has `cursor-pointer` and `onClick` for expand/collapse.

The expanded assignment history renders as a separate `<tr>` below the vehicle row with a single `<td colSpan={10}>` containing the history sub-table. This is the standard collapsible-row pattern.

---

## 2. Assignment Table — Mobile Cards

Breakpoint: below `sm` (640px).

**Pattern:** `sm:hidden` card list + `hidden sm:block` table (matches Referrals app).

**Card layout per vehicle:**
```
┌──────────────────────────────────┐
│ AB12 CDE          [Greythorn]    │  ← Registration + ownership badge
│                                  │
│ Branch        Milton Keynes      │
│ Model         Ford Transit       │
│ Type          Van                │
│ Status        [Attached]         │  ← attachment badge
│ Contractor    X003663 J. Smith   │
│ Cont. Branch  Milton Keynes      │
│ Attached Since 01/04/2026        │
│                                  │
│ ▼ Assignment History             │  ← tap to expand
└──────────────────────────────────┘
```

- Registration bold, ownership badge right-aligned in header
- Key-value pairs as `flex justify-between` rows
- Contractor shows HR code (mono) + name
- If unattached, contractor/branch/since rows show "-"
- Expand chevron + "Assignment History" text at bottom — tap loads history
- History renders as mini cards (not a sub-table): each assignment shows HR Code, Name, From, To, Current/Past badge

---

## 3. Compliance Table — Mobile Cards

Breakpoint: below `sm` (640px).

**Pattern:** Same `sm:hidden` / `hidden sm:block` split.

**Card layout per vehicle:**
```
┌──────────────────────────────────┐
│ AB12 CDE                         │  ← Registration bold
│ Milton Keynes · Ford Transit     │  ← Branch + Model secondary
│                                  │
│ MOT        01/05/2026  [Due soon]│
│ Road Tax   15/03/2026  [Overdue] │
│ Insurance  20/12/2026  [Valid]   │
└──────────────────────────────────┘
```

- Registration bold as header
- Branch and Model as secondary text, dot-separated
- Three rows: label, date, ComplianceBadge — each as `flex items-center justify-between`
- Sorted by urgency (same as desktop)

---

## 4. What Changes

| Element | Before | After |
|---|---|---|
| Assignment table rows | CSS grid in `<td colSpan={10}>` | Proper `<tr>/<td>` rows |
| Assignment history | Rendered inside the grid td | Separate `<tr>` with `<td colSpan={10}>` |
| Assignment mobile | `overflow-x-auto` table | Card list below `sm` breakpoint |
| Compliance mobile | `overflow-x-auto` table | Card list below `sm` breakpoint |

## 5. What Doesn't Change

- Filter bar, stat cards, overview panel, composition panel — untouched
- Assignment lookup results (smaller tables, tolerable on mobile)
- All data, state management, expand/collapse logic
- Desktop table appearance (beyond the alignment fix)

---

## 6. File Touched

| File | Change |
|---|---|
| `components/fleet/VehicleStatusDashboard.tsx` | Assignment table restructure, mobile card layouts for assignment + compliance |
