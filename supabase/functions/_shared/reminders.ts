// Self-contained copy of the app's reminder logic for the server (Deno).
// Kept in sync with src/lib/reminders.ts by src/lib/__tests__/serverReminders.test.ts.
// The server runs in UTC, so "wall-clock" times are represented as UTC instants.
import { RRule, type Options, type Weekday } from 'rrule'

interface Repeat {
  freq: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'
  interval: number
  byweekday?: number[]
  monthlyMode?: 'date' | 'nth'
  until?: string | null
  count?: number | null
}
export interface Ev {
  id: string
  title: string
  start: string
  end: string
  allDay?: boolean
  emoji?: string
  deleted?: boolean
  repeat?: Repeat | null
  exdates?: string[]
  reminderMins?: number | null
}
export interface Tk {
  id: string
  title: string
  emoji?: string
  done?: boolean
  deleted?: boolean
  reminderAt?: string | null
}
export interface Due {
  key: string
  at: number
  title: string
  body: string
  url: string
}

const WD: Weekday[] = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU]
/** "yyyy-MM-ddTHH:mm" → UTC instant with the same wall-clock digits */
const wall = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +(s.slice(11, 13) || 0), +(s.slice(14, 16) || 0))
const key = (ms: number) => new Date(ms).toISOString().slice(0, 16)
const mon = (d: Date) => (d.getUTCDay() + 6) % 7

function rule(r: Repeat, startMs: number) {
  const d = new Date(startMs)
  const o: Partial<Options> = { dtstart: d, interval: Math.max(1, r.interval || 1) }
  if (r.freq === 'daily') o.freq = RRule.DAILY
  else if (r.freq === 'weekdays') {
    o.freq = RRule.WEEKLY
    o.byweekday = WD.slice(0, 5)
  } else if (r.freq === 'weekly') {
    o.freq = RRule.WEEKLY
    o.byweekday = (r.byweekday?.length ? r.byweekday : [mon(d)]).map((i) => WD[i])
  } else if (r.freq === 'monthly') {
    o.freq = RRule.MONTHLY
    if (r.monthlyMode === 'nth') {
      const nth = Math.ceil(d.getUTCDate() / 7)
      o.byweekday = [WD[mon(d)].nth(nth >= 5 ? -1 : nth)]
    } else o.bymonthday = [d.getUTCDate()]
  } else o.freq = RRule.YEARLY
  if (r.until) o.until = new Date(wall(r.until + 'T23:59') + 59000)
  if (r.count) o.count = r.count
  return new RRule(o)
}

function occurrences(e: Ev, from: number, to: number): number[] {
  const s = wall(e.start)
  if (!e.repeat) return s >= from && s < to ? [s] : []
  const ex = new Set(e.exdates ?? [])
  return rule(e.repeat, s)
    .between(new Date(from), new Date(to), true)
    .map((d) => d.getTime())
    .filter((t) => t < to && !ex.has(key(t)))
}

const hm = (ms: number) => {
  const d = new Date(ms)
  const h = d.getUTCHours()
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** Reminders whose wall-clock fire time is in [from, to). */
export function dueReminders(events: Ev[], tasks: Tk[], from: number, to: number): Due[] {
  const out: Due[] = []
  for (const e of events) {
    if (e.deleted || e.reminderMins === null || e.reminderMins === undefined) continue
    const mins = e.reminderMins
    for (const start of occurrences(e, from + mins * 60000, to + mins * 60000)) {
      const at = start - mins * 60000
      if (at < from || at >= to) continue
      const when = mins === 0 ? 'now' : mins >= 1440 ? 'tomorrow' : `in ${mins} min`
      out.push({
        key: `e:${e.id}:${key(start)}:${mins}`,
        at,
        title: `${e.emoji ?? '📅'} ${e.title}`,
        body: e.allDay ? (mins >= 1440 ? 'Tomorrow' : 'Today') : `Starts ${when} · ${hm(start)}`,
        url: `/calendar?v=day&d=${key(start).slice(0, 10)}`,
      })
    }
  }
  for (const t of tasks) {
    if (t.deleted || t.done || !t.reminderAt) continue
    const at = wall(t.reminderAt)
    if (at >= from && at < to) out.push({ key: `t:${t.id}:${t.reminderAt}`, at, title: `${t.emoji ?? '✅'} ${t.title}`, body: 'Gentle reminder from your to-do list 🐾', url: '/tasks' })
  }
  return out.sort((a, b) => a.at - b.at)
}

/** Current wall-clock time in a time zone, as a UTC instant with those digits. */
export function wallNow(tz: string, now = Date.now()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(now))
      .map((x) => [x.type, x.value]),
  )
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
}
