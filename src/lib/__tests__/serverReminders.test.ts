import { describe, expect, it } from 'vitest'
import { dueReminders, wallNow } from '../../../supabase/functions/_shared/reminders'
import { remindersBetween } from '../reminders'
import type { CalEvent } from '../../data/types'

const events: CalEvent[] = [
  { id: 'a', updatedAt: 0, title: 'Anki', start: '2026-11-02T20:00', end: '2026-11-02T21:00', category: 'study', reminderMins: 10, repeat: { freq: 'daily', interval: 1, until: '2026-11-20' }, exdates: ['2026-11-05T20:00'] },
  { id: 'b', updatedAt: 0, title: 'Lecture', start: '2026-11-09T09:00', end: '2026-11-09T11:00', category: 'lecture', reminderMins: 1440, repeat: { freq: 'weekly', interval: 1, byweekday: [0, 2, 4] } },
  { id: 'c', updatedAt: 0, title: 'Exam', start: '2026-11-12T13:00', end: '2026-11-12T16:00', category: 'exam', reminderMins: 0 },
]

describe('server reminders match the app', () => {
  it('same reminder keys over two weeks', () => {
    // client uses local wall-clock; server uses UTC digits — compare keys only
    const client = remindersBetween(events, [], new Date(2026, 10, 1).getTime(), new Date(2026, 10, 15).getTime()).map((r) => r.key)
    const server = dueReminders(events, [], Date.UTC(2026, 10, 1), Date.UTC(2026, 10, 15)).map((r) => r.key)
    expect(server).toEqual(client)
    expect(server).not.toContain('e:a:2026-11-05T20:00:10')
  })
  it('wall clock in a time zone', () => {
    // 2026-11-09 14:30 UTC is 09:30 in New York (EST, UTC-5)
    expect(new Date(wallNow('America/New_York', Date.UTC(2026, 10, 9, 14, 30))).toISOString().slice(0, 16)).toBe('2026-11-09T09:30')
  })
})
