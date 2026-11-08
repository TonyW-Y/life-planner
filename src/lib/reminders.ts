import { parseISO } from 'date-fns'
import type { CalEvent, Task } from '../data/types'
import { expandEvents } from './recurrence'

export interface DueReminder {
  key: string
  at: number
  title: string
  body: string
  url: string
}

/** Every reminder that should fire between `from` and `to` (ms). Pure, so it's easy to test. */
export function remindersBetween(events: CalEvent[], tasks: Task[], from: number, to: number): DueReminder[] {
  const out: DueReminder[] = []
  // look a day ahead so "1 day before" reminders are found
  const occ = expandEvents(events, new Date(from - 60000), new Date(to + 2 * 86400000))
  for (const o of occ) {
    const mins = o.event.reminderMins
    if (mins === null || mins === undefined) continue
    const at = o.start.getTime() - mins * 60000
    if (at < from || at >= to) continue
    const when = mins === 0 ? 'now' : mins >= 1440 ? 'tomorrow' : `in ${mins} min`
    out.push({
      key: `e:${o.event.id}:${o.key}:${mins}`,
      at,
      title: `${o.event.emoji ?? '📅'} ${o.event.title}`,
      body: o.event.allDay ? (mins >= 1440 ? 'Tomorrow' : 'Today') : `Starts ${when} · ${o.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
      url: `/calendar?v=day&d=${o.key.slice(0, 10)}`,
    })
  }
  for (const t of tasks) {
    if (t.deleted || t.done || !t.reminderAt) continue
    const at = parseISO(t.reminderAt).getTime()
    if (at < from || at >= to) continue
    out.push({ key: `t:${t.id}:${t.reminderAt}`, at, title: `${t.emoji ?? '✅'} ${t.title}`, body: 'Gentle reminder from your to-do list 🐾', url: '/tasks' })
  }
  return out.sort((a, b) => a.at - b.at)
}
