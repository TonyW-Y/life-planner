import { addDays, startOfDay } from 'date-fns'

export interface Interval {
  start: Date
  end: Date
}
export const DEFAULT_AWAKE = { wake: '08:00', bed: '23:00' }

export interface Awake {
  /** "HH:mm" */
  wake: string
  bed: string
}

const at = (day: Date, hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  const d = startOfDay(day)
  d.setHours(h, m, 0, 0)
  return d
}
const ms = (m: number) => m * 60000
const roundUp = (d: Date, step = 15) => {
  const r = new Date(d)
  const mins = r.getMinutes()
  const add = (step - (mins % step)) % step
  r.setMinutes(mins + add, 0, 0)
  return r
}

/** The waking window for a day. Bed times after midnight (e.g. 01:00) roll to the next day. */
export function awakeWindow(day: Date, awake: Awake): Interval {
  const start = at(day, awake.wake)
  let end = at(day, awake.bed)
  if (end <= start) end = addDays(end, 1)
  return { start, end }
}

/** Merge overlapping busy intervals. */
export function mergeBusy(busy: Interval[]): Interval[] {
  const sorted = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime())
  const out: Interval[] = []
  for (const b of sorted) {
    const last = out.at(-1)
    if (last && b.start <= last.end) {
      if (b.end > last.end) last.end = new Date(b.end)
    } else out.push({ start: new Date(b.start), end: new Date(b.end) })
  }
  return out
}

/** Free gaps inside [from, to] not covered by busy, at least minMins long (with a small buffer around events). */
export function freeSlots(from: Date, to: Date, busy: Interval[], minMins = 15, bufferMins = 0): Interval[] {
  const merged = mergeBusy(busy.map((b) => ({ start: new Date(b.start.getTime() - ms(bufferMins)), end: new Date(b.end.getTime() + ms(bufferMins)) })))
  const out: Interval[] = []
  let cursor = roundUp(from)
  for (const b of merged) {
    if (b.end <= cursor) continue
    if (b.start >= to) break
    if (b.start > cursor && b.start.getTime() - cursor.getTime() >= ms(minMins)) out.push({ start: cursor, end: new Date(Math.min(b.start.getTime(), to.getTime())) })
    if (b.end > cursor) cursor = roundUp(b.end)
  }
  if (to.getTime() - cursor.getTime() >= ms(minMins)) out.push({ start: cursor, end: to })
  return out
}

/** Free waking minutes for each day. */
export function freeMinutesByDay(days: Date[], awake: Awake, busy: Interval[], now?: Date) {
  return days.map((d) => {
    const w = awakeWindow(d, awake)
    const from = now && now > w.start ? now : w.start
    if (from >= w.end) return 0
    return freeSlots(from, w.end, busy, 1).reduce((s, x) => s + (x.end.getTime() - x.start.getTime()) / 60000, 0)
  })
}

export interface FindTimeOpts {
  /** Split into chunks no longer than this (e.g. 60 or 90 minute study blocks) */
  maxChunk?: number
  /** Don't propose chunks shorter than this */
  minChunk?: number
  /** breathing room between blocks and events */
  buffer?: number
  now?: Date
}

/**
 * Find time for `needMins` across `days` while awake: earliest slots first, split into
 * comfortable chunks. Returns the proposed blocks (may total less than needed if the week is full).
 */
export function findTime(needMins: number, days: Date[], awake: Awake, busy: Interval[], opts: FindTimeOpts = {}): Interval[] {
  const { maxChunk = 90, minChunk = 25, buffer = 10, now } = opts
  const plan: Interval[] = []
  let left = needMins
  const taken: Interval[] = [...busy]
  for (const d of days) {
    if (left <= 0) break
    const w = awakeWindow(d, awake)
    const from = now && now > w.start ? now : w.start
    if (from >= w.end) continue
    for (const slot of freeSlots(from, w.end, taken, minChunk, buffer)) {
      let s = slot.start
      while (left > 0) {
        const room = (slot.end.getTime() - s.getTime()) / 60000
        const len = Math.min(left, maxChunk, room)
        if (len < Math.min(minChunk, left)) break
        const block = { start: s, end: new Date(s.getTime() + ms(len)) }
        plan.push(block)
        taken.push(block)
        left -= len
        s = roundUp(new Date(block.end.getTime() + ms(buffer)))
      }
      if (left <= 0) break
    }
  }
  return plan
}

export interface Placeable {
  id: string
  mins: number
}

/** Auto-fill: place each item (already priority-sorted) in the first free spot that fits. */
export function autoFill<T extends Placeable>(items: T[], days: Date[], awake: Awake, busy: Interval[], opts: { buffer?: number; now?: Date } = {}) {
  const { buffer = 10, now } = opts
  const taken: Interval[] = [...busy]
  const placed: { item: T; start: Date; end: Date }[] = []
  const unplaced: T[] = []
  for (const item of items) {
    let done = false
    for (const d of days) {
      const w = awakeWindow(d, awake)
      const from = now && now > w.start ? now : w.start
      if (from >= w.end) continue
      const slot = freeSlots(from, w.end, taken, item.mins, buffer)[0]
      if (slot) {
        const block = { start: slot.start, end: new Date(slot.start.getTime() + ms(item.mins)) }
        taken.push(block)
        placed.push({ item, ...block })
        done = true
        break
      }
    }
    if (!done) unplaced.push(item)
  }
  return { placed, unplaced }
}
