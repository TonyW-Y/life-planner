import { addDays, differenceInCalendarDays, parseISO } from 'date-fns'
import { fmtD } from './recurrence'

export interface PlanItem {
  topic: string
  date: string
  kind: 'learn' | 'review' | 'final'
  /** review number (1 = first review) */
  n: number
}

export interface PlanOpts {
  topics: string[]
  /** yyyy-MM-dd */
  start: string
  exam: string
  /** days after first pass to review (spaced repetition) */
  offsets?: number[]
  /** leave the last N days before the exam for reviews only */
  bufferDays?: number
}

/**
 * Spread first passes evenly from `start` until a few days before the exam,
 * then schedule spaced reviews (+1, +3, +7, +14 days) that land before exam day,
 * and a final mixed review the day before.
 */
export function generatePlan({ topics, start, exam, offsets = [1, 3, 7, 14], bufferDays = 2 }: PlanOpts): PlanItem[] {
  const list = topics.map((t) => t.trim()).filter(Boolean)
  const s = parseISO(start)
  const e = parseISO(exam)
  const totalDays = differenceInCalendarDays(e, s)
  if (!list.length || totalDays < 1) return []
  const learnDays = Math.max(1, totalDays - Math.min(bufferDays, totalDays - 1))
  const items: PlanItem[] = []
  list.forEach((topic, i) => {
    const dayIdx = Math.floor((i * learnDays) / list.length)
    const learn = addDays(s, dayIdx)
    items.push({ topic, date: fmtD(learn), kind: 'learn', n: 0 })
    offsets.forEach((o, k) => {
      const r = addDays(learn, o)
      // the day before the exam is kept for the final mixed review
      if (differenceInCalendarDays(e, r) >= 2) items.push({ topic, date: fmtD(r), kind: 'review', n: k + 1 })
    })
  })
  if (totalDays >= 2) items.push({ topic: 'Final mixed review — all topics', date: fmtD(addDays(e, -1)), kind: 'final', n: 0 })
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'learn' ? -1 : 1))
}

export function groupByDate(items: PlanItem[]) {
  const m = new Map<string, PlanItem[]>()
  for (const it of items) m.set(it.date, [...(m.get(it.date) ?? []), it])
  return [...m.entries()]
}
