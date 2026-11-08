import { describe, expect, it } from 'vitest'
import { retention, streak } from '../stats'

const T = new Date(2026, 10, 20)
const set = (...d: number[]) => new Set(d.map((x) => `2026-11-${String(x).padStart(2, '0')}`))

describe('streak', () => {
  it('counts consecutive days including today', () => expect(streak(set(18, 19, 20), T).days).toBe(3))
  it("today not done yet doesn't break it", () => expect(streak(set(17, 18, 19), T).days).toBe(3))
  it('one missed day is frozen', () => {
    const s = streak(set(15, 16, 17, 19, 20), T)
    expect(s.days).toBe(5)
    expect(s.frozeDays).toEqual(['2026-11-18'])
  })
  it('two misses in a week break it', () => expect(streak(set(13, 14, 16, 18, 19, 20), T).days).toBe(4))
  it('zero when nothing', () => expect(streak(new Set(), T).days).toBe(0))
})

describe('retention', () => {
  it('counts hard/good/easy as remembered', () => expect(retention([1, 2, 3, 4])).toBe(0.75))
  it('null without data', () => expect(retention([])).toBeNull())
})
