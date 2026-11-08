import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'
import { fmtD } from './recurrence'

/**
 * Study streak with gentle "freezes": one missed day per rolling 7 days doesn't break it.
 * `activeDays` = set of yyyy-MM-dd with any study. Today not done yet doesn't break it either.
 */
export function streak(activeDays: Set<string>, today = new Date()): { days: number; frozeDays: string[] } {
  let d = activeDays.has(fmtD(today)) ? today : addDays(today, -1)
  let days = 0
  const frozeDays: string[] = []
  for (let guard = 0; guard < 3650; guard++) {
    const k = fmtD(d)
    if (activeDays.has(k)) days++
    else {
      const recentFreeze = frozeDays.some((f) => Math.abs(differenceInCalendarDays(parseISO(f), d)) < 7)
      const prevActive = activeDays.has(fmtD(addDays(d, -1)))
      if (!recentFreeze && prevActive && days > 0) frozeDays.push(k)
      else break
    }
    d = addDays(d, -1)
  }
  return { days, frozeDays }
}

/** Share of reviews that were remembered (Hard/Good/Easy), 0..1, or null if no data. */
export function retention(ratings: number[]) {
  if (!ratings.length) return null
  return ratings.filter((r) => r >= 2).length / ratings.length
}
