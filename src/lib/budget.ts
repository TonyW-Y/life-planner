import type { Category } from '../data/types'
import type { Awake } from './slots'

export const BUDGET_CATS = [
  { id: 'study', label: 'Study', emoji: '📚', hint: 'beyond lectures' },
  { id: 'exercise', label: 'Move', emoji: '🏃‍♀️', hint: 'gym, walks, yoga' },
  { id: 'social', label: 'Friends & family', emoji: '💬', hint: 'calls, hangouts' },
  { id: 'date', label: 'Date night', emoji: '💕', hint: 'just you two' },
  { id: 'rest', label: 'Rest & fun', emoji: '☁️', hint: 'shows, naps, hobbies' },
  { id: 'errands', label: 'Errands', emoji: '🧺', hint: 'laundry, groceries' },
] as const
export type BudgetCat = (typeof BUDGET_CATS)[number]['id']

export interface Fixed {
  commuteDaily: number
  mealsDaily: number
  selfCareDaily: number
}
export const DEFAULT_FIXED: Fixed = { commuteDaily: 1, mealsDaily: 1.5, selfCareDaily: 1 }
export const DEFAULT_ALLOC: Record<BudgetCat, number> = { study: 20, exercise: 3, social: 3, date: 4, rest: 7, errands: 3 }

/** Hours asleep per night from the wake/bed times. */
export function sleepHours(awake: Awake) {
  const [wh, wm] = awake.wake.split(':').map(Number)
  const [bh, bm] = awake.bed.split(':').map(Number)
  const mins = (wh * 60 + wm - (bh * 60 + bm) + 1440) % 1440
  return mins / 60
}

export interface WeekBreakdown {
  sleep: number
  scheduled: number
  living: number
  fixed: number
  free: number
}

/**
 * 168 hours minus sleep, daily living, and fixed commitments (lectures, clinicals, exams)
 * = the hours she actually gets to decide about.
 */
export function weekBreakdown(awake: Awake, fixed: Fixed, fixedEventHours: number): WeekBreakdown {
  const sleep = sleepHours(awake) * 7
  const living = (fixed.commuteDaily + fixed.mealsDaily + fixed.selfCareDaily) * 7
  const total = sleep + living + fixedEventHours
  return { sleep, scheduled: fixedEventHours, living, fixed: total, free: Math.max(0, 168 - total) }
}

export const FIXED_CATEGORIES: Category[] = ['lecture', 'clinical', 'exam']

/** Which budget bucket a calendar event counts toward (null = fixed / not budgeted). */
export function bucketFor(category: Category, title: string): BudgetCat | null {
  if (FIXED_CATEGORIES.includes(category)) return null
  if (category === 'study') return 'study'
  if (category === 'rest') return 'rest'
  const t = title.toLowerCase()
  if (/\b(gym|workout|run|yoga|pilates|walk|swim|hike|climb|bike|exercise|class ?pass)\b/.test(t)) return 'exercise'
  if (/\b(date|dinner with|boyfriend|bf|us two|anniversary)\b/.test(t)) return 'date'
  if (/\b(groceries|grocery|laundry|errand|clean|bank|pharmacy|dmv|pick ?up|appointment)\b/.test(t)) return 'errands'
  if (category === 'personal') return 'social'
  return null
}

/** Over-commit check: positive = hours over. */
export const overBy = (alloc: Record<string, number>, free: number) => Object.values(alloc).reduce((a, b) => a + b, 0) - free

/** "I need 3h for pharm review" / "90 min anki" → minutes + what for */
export function parseNeed(text: string): { mins: number; what: string } | null {
  const m = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?)\b/i)
  if (!m) return null
  const mins = Math.round(parseFloat(m[1]) * (/^h/i.test(m[2]) ? 60 : 1))
  const what = text
    .replace(m[0], ' ')
    .replace(/\b(i need|need|for|to|of|time|find)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return { mins, what: what || 'Focus time' }
}
