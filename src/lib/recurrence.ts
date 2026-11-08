import { RRule, type Options, type Weekday } from 'rrule'
import { addDays, format, parseISO } from 'date-fns'
import type { CalEvent, Repeat } from '../data/types'

export const DT = "yyyy-MM-dd'T'HH:mm"
export const D = 'yyyy-MM-dd'
export const fmtDT = (d: Date) => format(d, DT)
export const fmtD = (d: Date) => format(d, D)
export const parse = (s: string) => parseISO(s)

/* rrule works in UTC. We treat local wall-clock times as "floating" UTC so DST never shifts events. */
const toFloat = (d: Date) =>
  new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), 0))
const fromFloat = (u: Date) =>
  new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes())

const WD: Weekday[] = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]
/** JS getDay() (0=Sun) → our 0=Mon index */
export const monIndex = (d: Date) => (d.getDay() + 6) % 7

export function buildRule(repeat: Repeat, dtstart: Date): RRule {
  const opts: Partial<Options> = {
    dtstart: toFloat(dtstart),
    interval: Math.max(1, repeat.interval || 1),
  }
  switch (repeat.freq) {
    case 'daily':
      opts.freq = RRule.DAILY
      break
    case 'weekdays':
      opts.freq = RRule.WEEKLY
      opts.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR]
      break
    case 'weekly':
      opts.freq = RRule.WEEKLY
      opts.byweekday = (repeat.byweekday?.length ? repeat.byweekday : [monIndex(dtstart)]).map((i) => WD[i])
      break
    case 'monthly':
      opts.freq = RRule.MONTHLY
      if (repeat.monthlyMode === 'nth') {
        const nth = Math.ceil(dtstart.getDate() / 7)
        opts.byweekday = [WD[monIndex(dtstart)].nth(nth >= 5 ? -1 : nth)]
      } else {
        opts.bymonthday = [dtstart.getDate()]
      }
      break
    case 'yearly':
      opts.freq = RRule.YEARLY
      break
  }
  if (repeat.until) {
    const u = parseISO(repeat.until)
    opts.until = new Date(Date.UTC(u.getFullYear(), u.getMonth(), u.getDate(), 23, 59, 59))
  }
  if (repeat.count) opts.count = repeat.count
  return new RRule(opts)
}

/** All occurrence start times of a repeat between [from, to] (local dates). */
export function repeatDates(repeat: Repeat, dtstart: Date, from: Date, to: Date): Date[] {
  return buildRule(repeat, dtstart)
    .between(toFloat(from), toFloat(to), true)
    .map(fromFloat)
}

export interface Occurrence {
  event: CalEvent
  /** id of the event series this came from */
  seriesId: string
  /** occurrence key: original start string */
  key: string
  start: Date
  end: Date
  recurring: boolean
}

/** Expand events (incl. repeating ones) into concrete occurrences overlapping [from, to). */
export function expandEvents(events: CalEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = []
  for (const ev of events) {
    if (ev.deleted) continue
    const s = parseISO(ev.start)
    const e = parseISO(ev.end)
    const dur = Math.max(0, e.getTime() - s.getTime())
    if (!ev.repeat) {
      if (e > from && s < to || (dur === 0 && s >= from && s < to))
        out.push({ event: ev, seriesId: ev.id, key: ev.start, start: s, end: e, recurring: false })
      continue
    }
    const ex = new Set(ev.exdates ?? [])
    // widen the window backwards by the duration so multi-hour/day events that started earlier still show
    for (const occ of repeatDates(ev.repeat, s, new Date(from.getTime() - dur), to)) {
      const key = fmtDT(occ)
      if (ex.has(key)) continue
      const oe = new Date(occ.getTime() + dur)
      if (oe <= from && dur > 0) continue
      if (occ >= to) continue
      out.push({ event: ev, seriesId: ev.id, key, start: occ, end: oe, recurring: true })
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime() || +!!b.event.allDay - +!!a.event.allDay)
}

/**
 * "This and following": end the original series the day before `occurrence`
 * and return the patch for the original plus a fresh series starting at the occurrence.
 */
export function splitSeries(ev: CalEvent, occurrenceKey: string) {
  const occ = parseISO(occurrenceKey)
  const dur = parseISO(ev.end).getTime() - parseISO(ev.start).getTime()
  const untilPrev = fmtD(addDays(occ, -1))
  const originalPatch: Partial<CalEvent> = {
    id: ev.id,
    repeat: ev.repeat ? { ...ev.repeat, until: untilPrev, count: null } : null,
  }
  const following: Omit<CalEvent, 'id' | 'updatedAt'> = {
    ...ev,
    start: occurrenceKey,
    end: fmtDT(new Date(occ.getTime() + dur)),
    exdates: (ev.exdates ?? []).filter((x) => x > occurrenceKey),
    // `count` would restart, so convert it into an until when splitting
    repeat: ev.repeat ? { ...ev.repeat } : null,
  }
  delete (following as Partial<CalEvent>).id
  delete (following as Partial<CalEvent>)._fts
  return { originalPatch, following }
}

/** Next due date for a repeating task, after `afterDue`. Null if the series has ended. */
export function nextRepeatDate(repeat: Repeat, firstDue: string, afterDue: string): string | null {
  const start = parseISO(firstDue + 'T09:00')
  const after = parseISO(afterDue + 'T23:59')
  const next = buildRule(repeat, start).after(toFloat(after), false)
  return next ? fmtD(fromFloat(next)) : null
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function describeRepeat(r: Repeat | null | undefined, start?: Date): string {
  if (!r) return 'Does not repeat'
  const n = r.interval > 1 ? r.interval : 0
  let s = ''
  switch (r.freq) {
    case 'daily':
      s = n ? `Every ${n} days` : 'Every day'
      break
    case 'weekdays':
      s = 'Every weekday (Mon–Fri)'
      break
    case 'weekly': {
      const days = (r.byweekday?.length ? r.byweekday : start ? [monIndex(start)] : []).map((i) => DAY_NAMES[i]).join(', ')
      s = `${n ? `Every ${n} weeks` : 'Every week'}${days ? ` on ${days}` : ''}`
      break
    }
    case 'monthly':
      if (r.monthlyMode === 'nth' && start) {
        const nth = Math.ceil(start.getDate() / 7)
        const label = nth >= 5 ? 'last' : ['1st', '2nd', '3rd', '4th'][nth - 1]
        s = `${n ? `Every ${n} months` : 'Every month'} on the ${label} ${format(start, 'EEEE')}`
      } else s = `${n ? `Every ${n} months` : 'Every month'}${start ? ` on day ${start.getDate()}` : ''}`
      break
    case 'yearly':
      s = `${n ? `Every ${n} years` : 'Every year'}${start ? ` on ${format(start, 'MMM d')}` : ''}`
      break
  }
  if (r.until) s += ` until ${format(parseISO(r.until), 'MMM d, yyyy')}`
  else if (r.count) s += `, ${r.count} times`
  return s
}
