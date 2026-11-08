import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from '../quickAdd'

// Saturday Nov 7 2026, 10:00
const NOW = new Date(2026, 10, 7, 10, 0)

describe('parseQuickAdd', () => {
  it('Anki 8pm daily until Dec 20', () => {
    const p = parseQuickAdd('Anki 8pm daily until Dec 20', NOW)
    expect(p.title).toBe('Anki')
    expect(p.hasTime).toBe(true)
    expect(p.start?.getHours()).toBe(20)
    expect(p.repeat).toMatchObject({ freq: 'daily', until: '2026-12-20' })
    expect(p.category).toBe('study')
  })

  it('Pharm exam Friday 9am', () => {
    const p = parseQuickAdd('Pharm exam Friday 9am', NOW)
    expect(p.title).toBe('Pharm exam')
    expect(p.start?.getDay()).toBe(5)
    expect(p.start?.getHours()).toBe(9)
    expect(p.category).toBe('exam')
    expect(p.repeat).toBeNull()
  })

  it('gym every mon wed fri 7am for 1h', () => {
    const p = parseQuickAdd('gym every mon wed fri 7am for 1h', NOW)
    expect(p.title).toBe('gym')
    expect(p.repeat).toMatchObject({ freq: 'weekly', byweekday: [0, 2, 4] })
    expect(p.start?.getDay()).toBe(1) // next Monday
    expect(p.start?.getHours()).toBe(7)
    expect((p.end!.getTime() - p.start!.getTime()) / 60000).toBe(60)
  })

  it('priority and tags', () => {
    const p = parseQuickAdd('Finish cardio notes tomorrow !must #cardio', NOW)
    expect(p.title).toBe('Finish cardio notes')
    expect(p.priority).toBe('must')
    expect(p.tags).toEqual(['cardio'])
    expect(p.start?.getDate()).toBe(8)
    expect(p.hasTime).toBe(false)
  })

  it('birthday every year', () => {
    const p = parseQuickAdd("Mom's birthday May 3 every year", NOW)
    expect(p.repeat?.freq).toBe('yearly')
    expect(p.start?.getMonth()).toBe(4)
    expect(p.title).toBe("Mom's birthday")
  })

  it('plain text is just a title', () => {
    const p = parseQuickAdd('buy coffee beans', NOW)
    expect(p.title).toBe('buy coffee beans')
    expect(p.start).toBeNull()
  })
})
