import { describe, expect, it } from 'vitest'
import { describeRepeat, expandEvents, fmtDT, nextRepeatDate, repeatDates, splitSeries } from '../recurrence'
import type { CalEvent } from '../../data/types'

const ev = (over: Partial<CalEvent> = {}): CalEvent => ({
  id: 'e1',
  updatedAt: 0,
  title: 'Anki',
  start: '2026-11-02T20:00',
  end: '2026-11-02T21:00',
  category: 'study',
  ...over,
})

describe('repeat until a date', () => {
  it('daily until Dec 20 gives exactly the right number of days', () => {
    const dates = repeatDates(
      { freq: 'daily', interval: 1, until: '2026-12-20' },
      new Date(2026, 10, 2, 20, 0),
      new Date(2026, 0, 1),
      new Date(2027, 11, 31),
    )
    // Nov 2 .. Dec 20 inclusive = 29 + 20 = 49 days
    expect(dates).toHaveLength(49)
    expect(fmtDT(dates[0])).toBe('2026-11-02T20:00')
    expect(fmtDT(dates.at(-1)!)).toBe('2026-12-20T20:00')
  })

  it('weekly on Mon/Wed/Fri', () => {
    const dates = repeatDates(
      { freq: 'weekly', interval: 1, byweekday: [0, 2, 4], until: '2026-11-15' },
      new Date(2026, 10, 2, 9, 0),
      new Date(2026, 10, 1),
      new Date(2026, 11, 31),
    )
    expect(dates.map((d) => d.getDate())).toEqual([2, 4, 6, 9, 11, 13])
  })

  it('weekdays only skips weekends', () => {
    const dates = repeatDates({ freq: 'weekdays', interval: 1, count: 7 }, new Date(2026, 10, 6, 8), new Date(2026, 10, 1), new Date(2026, 11, 31))
    expect(dates.map((d) => d.getDay()).every((d) => d !== 0 && d !== 6)).toBe(true)
    expect(dates).toHaveLength(7)
  })

  it('yearly until a date', () => {
    const dates = repeatDates({ freq: 'yearly', interval: 1, until: '2029-06-01' }, new Date(2026, 4, 3, 0, 0), new Date(2026, 0, 1), new Date(2035, 0, 1))
    expect(dates.map((d) => d.getFullYear())).toEqual([2026, 2027, 2028, 2029])
  })

  it('monthly on the 2nd Tuesday', () => {
    // Nov 10 2026 is the 2nd Tuesday
    const dates = repeatDates({ freq: 'monthly', interval: 1, monthlyMode: 'nth', count: 3 }, new Date(2026, 10, 10, 12), new Date(2026, 0, 1), new Date(2027, 11, 1))
    expect(dates.map((d) => [d.getMonth(), d.getDate(), d.getDay()])).toEqual([
      [10, 10, 2],
      [11, 8, 2],
      [0, 12, 2],
    ])
  })

  it('keeps wall-clock time across DST change', () => {
    const dates = repeatDates({ freq: 'daily', interval: 1, count: 5 }, new Date(2026, 10, 30, 8, 0), new Date(2026, 0, 1), new Date(2027, 0, 1))
    expect(dates.every((d) => d.getHours() === 8)).toBe(true)
  })
})

describe('expandEvents', () => {
  it('skips exdates and deleted events', () => {
    const series = ev({ repeat: { freq: 'daily', interval: 1, until: '2026-11-06' }, exdates: ['2026-11-04T20:00'] })
    const occ = expandEvents([series, ev({ id: 'x', deleted: true })], new Date(2026, 10, 1), new Date(2026, 10, 30))
    expect(occ.map((o) => o.key)).toEqual(['2026-11-02T20:00', '2026-11-03T20:00', '2026-11-05T20:00', '2026-11-06T20:00'])
  })

  it('includes one-off events overlapping the window', () => {
    const occ = expandEvents([ev()], new Date(2026, 10, 2, 20, 30), new Date(2026, 10, 3))
    expect(occ).toHaveLength(1)
  })
})

describe('splitSeries (this and following)', () => {
  it('ends the original the day before and starts a new series', () => {
    const series = ev({ repeat: { freq: 'daily', interval: 1, until: '2026-11-30' } })
    const { originalPatch, following } = splitSeries(series, '2026-11-10T20:00')
    expect(originalPatch.repeat?.until).toBe('2026-11-09')
    expect(following.start).toBe('2026-11-10T20:00')
    expect(following.end).toBe('2026-11-10T21:00')
    expect(following.repeat?.until).toBe('2026-11-30')
    const a = expandEvents([{ ...series, ...originalPatch } as CalEvent], new Date(2026, 10, 1), new Date(2026, 11, 31))
    const b = expandEvents([{ ...following, id: 'e2', updatedAt: 0 } as CalEvent], new Date(2026, 10, 1), new Date(2026, 11, 31))
    expect(a.length + b.length).toBe(29)
  })
})

describe('tasks + labels', () => {
  it('next date for repeating task respects until', () => {
    const r = { freq: 'weekly' as const, interval: 1, until: '2026-11-20' }
    expect(nextRepeatDate(r, '2026-11-02', '2026-11-02')).toBe('2026-11-09')
    expect(nextRepeatDate(r, '2026-11-02', '2026-11-16')).toBeNull()
  })
  it('describes repeats nicely', () => {
    expect(describeRepeat({ freq: 'daily', interval: 1, until: '2026-12-20' })).toBe('Every day until Dec 20, 2026')
    expect(describeRepeat(null)).toBe('Does not repeat')
  })
})
