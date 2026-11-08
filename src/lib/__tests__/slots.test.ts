import { describe, expect, it } from 'vitest'
import { autoFill, findTime, freeMinutesByDay, freeSlots, mergeBusy } from '../slots'

const d = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m)
const awake = { wake: '08:00', bed: '22:00' }

describe('slot finding', () => {
  it('merges overlapping busy blocks', () => {
    expect(mergeBusy([{ start: d(9, 9), end: d(9, 11) }, { start: d(9, 10), end: d(9, 12) }])).toEqual([{ start: d(9, 9), end: d(9, 12) }])
  })
  it('finds gaps between events', () => {
    const free = freeSlots(d(9, 8), d(9, 22), [{ start: d(9, 9), end: d(9, 12) }, { start: d(9, 13), end: d(9, 17) }])
    expect(free).toEqual([
      { start: d(9, 8), end: d(9, 9) },
      { start: d(9, 12), end: d(9, 13) },
      { start: d(9, 17), end: d(9, 22) },
    ])
  })
  it('counts free waking minutes per day', () => {
    const mins = freeMinutesByDay([new Date(2026, 10, 9), new Date(2026, 10, 10)], awake, [{ start: d(9, 9), end: d(9, 17) }])
    expect(mins).toEqual([6 * 60, 14 * 60])
  })
  it('finds 3h in chunks of max 90 min', () => {
    const plan = findTime(180, [new Date(2026, 10, 9)], awake, [{ start: d(9, 8), end: d(9, 17) }], { maxChunk: 90, buffer: 10 })
    expect(plan.map((p) => [p.start.getHours(), p.start.getMinutes(), (p.end.getTime() - p.start.getTime()) / 60000])).toEqual([
      [17, 15, 90],
      [19, 0, 90],
    ])
  })
  it('spills onto the next day when today is full', () => {
    const plan = findTime(60, [new Date(2026, 10, 9), new Date(2026, 10, 10)], awake, [{ start: d(9, 8), end: d(9, 22) }])
    expect(plan[0].start.getDate()).toBe(10)
  })
  it('never schedules in the past', () => {
    const plan = findTime(30, [new Date(2026, 10, 9)], awake, [], { now: d(9, 15, 7) })
    expect(plan[0].start).toEqual(d(9, 15, 15))
  })
  it('auto-fills tasks in priority order', () => {
    const { placed, unplaced } = autoFill(
      [{ id: 'a', mins: 60 }, { id: 'b', mins: 120 }, { id: 'c', mins: 600 }],
      [new Date(2026, 10, 9)],
      awake,
      [{ start: d(9, 9), end: d(9, 17) }],
      { buffer: 0 },
    )
    expect(placed.map((p) => [p.item.id, p.start.getHours()])).toEqual([
      ['a', 8],
      ['b', 17],
    ])
    expect(unplaced.map((u) => u.id)).toEqual(['c'])
  })
})
