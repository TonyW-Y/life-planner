import { describe, expect, it } from 'vitest'
import { remindersBetween } from '../reminders'
import type { CalEvent, Task } from '../../data/types'

const ev = (o: Partial<CalEvent>): CalEvent => ({ id: 'e', updatedAt: 0, title: 'Lecture', start: '2026-11-09T09:00', end: '2026-11-09T10:00', category: 'lecture', reminderMins: 15, ...o })
const t = (d: Date) => d.getTime()

describe('reminders', () => {
  it('fires 15 min before', () => {
    const r = remindersBetween([ev({})], [], t(new Date(2026, 10, 9, 8, 44)), t(new Date(2026, 10, 9, 8, 46)))
    expect(r).toHaveLength(1)
    expect(r[0].body).toContain('in 15 min')
  })
  it('each occurrence of a repeating event gets its own reminder', () => {
    const e = ev({ repeat: { freq: 'daily', interval: 1 } })
    const r = remindersBetween([e], [], t(new Date(2026, 10, 9)), t(new Date(2026, 10, 12)))
    expect(r.map((x) => x.key)).toEqual(['e:e:2026-11-09T09:00:15', 'e:e:2026-11-10T09:00:15', 'e:e:2026-11-11T09:00:15'])
  })
  it('day-before reminders', () => {
    const r = remindersBetween([ev({ reminderMins: 1440 })], [], t(new Date(2026, 10, 8, 8, 59)), t(new Date(2026, 10, 8, 9, 1)))
    expect(r[0].body).toContain('tomorrow')
  })
  it('skips no-reminder events, done tasks; includes task reminders', () => {
    const tasks: Task[] = [
      { id: 'a', updatedAt: 0, title: 'Call clinic', priority: 'must', done: false, subtasks: [], tags: [], order: 0, reminderAt: '2026-11-09T12:00' },
      { id: 'b', updatedAt: 0, title: 'Done', priority: 'must', done: true, subtasks: [], tags: [], order: 0, reminderAt: '2026-11-09T12:00' },
    ]
    const r = remindersBetween([ev({ reminderMins: null })], tasks, t(new Date(2026, 10, 9, 11, 59)), t(new Date(2026, 10, 9, 12, 1)))
    expect(r.map((x) => x.key)).toEqual(['t:a:2026-11-09T12:00'])
  })
})
