const HALF_DAY_PATTERNS = [
  /^NL 1/i, /^NL 2/i, /^NL 3/i,
  /^Nursery 1/i, /^Nursery 2/i,
  /^Nursery L1/i, /^Nursery L2/i, /^Nursery L3/i,
]

export function isHalfDay(contractType: string): boolean {
  return HALF_DAY_PATTERNS.some((p) => p.test(contractType.trim()))
}

export function calcWorkingDays(shiftCount: number, contractType: string): number {
  return isHalfDay(contractType) ? shiftCount * 0.5 : shiftCount
}
