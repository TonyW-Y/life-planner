import { describe, expect, it } from 'vitest'
import { bucketFor, overBy, parseNeed, sleepHours, weekBreakdown } from '../budget'

describe('budget math', () => {
  it('sleep from bed/wake', () => {
    expect(sleepHours({ wake: '07:00', bed: '23:00' })).toBe(8)
    expect(sleepHours({ wake: '06:30', bed: '00:30' })).toBe(6)
  })
  it('free hours = 168 - sleep - living - fixed events', () => {
    const b = weekBreakdown({ wake: '07:00', bed: '23:00' }, { commuteDaily: 1, mealsDaily: 1.5, selfCareDaily: 1 }, 40)
    expect(b.sleep).toBe(56)
    expect(b.living).toBe(24.5)
    expect(b.free).toBeCloseTo(47.5)
  })
  it('never negative', () => {
    expect(weekBreakdown({ wake: '07:00', bed: '23:00' }, { commuteDaily: 3, mealsDaily: 3, selfCareDaily: 3 }, 80).free).toBe(0)
  })
  it('flags over-commitment', () => {
    expect(overBy({ study: 30, rest: 10 }, 35)).toBe(5)
    expect(overBy({ study: 20 }, 35)).toBe(-15)
  })
  it('buckets events', () => {
    expect(bucketFor('lecture', 'Anatomy')).toBeNull()
    expect(bucketFor('study', 'Anki')).toBe('study')
    expect(bucketFor('personal', 'Gym')).toBe('exercise')
    expect(bucketFor('personal', 'Date night 💕')).toBe('date')
    expect(bucketFor('other', 'Laundry')).toBe('errands')
    expect(bucketFor('personal', 'Call mom')).toBe('social')
  })
  it('parses "find time" requests', () => {
    expect(parseNeed('I need 3h for pharm review')).toEqual({ mins: 180, what: 'pharm review' })
    expect(parseNeed('90 min anki')).toEqual({ mins: 90, what: 'anki' })
    expect(parseNeed('pharm')).toBeNull()
  })
})
