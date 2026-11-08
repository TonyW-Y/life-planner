import { createEmptyCard, fsrs, Rating, type Card, type Grade } from 'ts-fsrs'
import type { SrsState } from '../data/types'

const scheduler = fsrs({ request_retention: 0.9, enable_fuzz: true })

export const RATINGS: { grade: Grade; label: string; key: string; color: string }[] = [
  { grade: Rating.Again, label: 'Again', key: '1', color: 'var(--warn)' },
  { grade: Rating.Hard, label: 'Hard', key: '2', color: 'var(--cat-exam)' },
  { grade: Rating.Good, label: 'Good', key: '3', color: 'var(--accent)' },
  { grade: Rating.Easy, label: 'Easy', key: '4', color: 'var(--primary)' },
]

export const State = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const

const toCard = (s: SrsState): Card => ({
  ...s,
  due: new Date(s.due),
  last_review: s.last_review ? new Date(s.last_review) : undefined,
}) as Card

const fromCard = (c: Card): SrsState => ({
  due: new Date(c.due).toISOString(),
  stability: c.stability,
  difficulty: c.difficulty,
  scheduled_days: c.scheduled_days,
  learning_steps: c.learning_steps,
  reps: c.reps,
  lapses: c.lapses,
  state: c.state as number,
  last_review: c.last_review ? new Date(c.last_review).toISOString() : null,
})

export const newSrs = (now = new Date()): SrsState => fromCard(createEmptyCard(now))

export function review(s: SrsState, grade: Grade, now = new Date()): SrsState {
  return fromCard(scheduler.next(toCard(s), now, grade).card)
}

/** Human interval for each button, e.g. "10m", "1d", "3.2mo" */
export function previewIntervals(s: SrsState, now = new Date()): Record<number, string> {
  const out: Record<number, string> = {}
  for (const r of RATINGS) out[r.grade] = humanInterval(new Date(review(s, r.grade, now).due).getTime() - now.getTime())
  return out
}

export function humanInterval(ms: number) {
  const m = ms / 60000
  if (m < 60) return `${Math.max(1, Math.round(m))}m`
  const h = m / 60
  if (h < 24) return `${Math.round(h)}h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)}d`
  const mo = d / 30
  if (mo < 12) return `${mo.toFixed(mo < 3 ? 1 : 0)}mo`
  return `${(d / 365).toFixed(1)}y`
}

export const isNew = (s: SrsState) => s.state === State.New
export const isDue = (s: SrsState, now = new Date()) => !isNew(s) && new Date(s.due) <= now
