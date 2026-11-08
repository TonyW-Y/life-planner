import { describe, expect, it } from 'vitest'
import { advance, endsAt, isOver, newTimer, pause, remaining, start } from '../timer'

const MIN = 60000

describe('timer survives closing the app', () => {
  it('reopening shows the correct remaining time', () => {
    let s = start(newTimer('pomodoro'), 0)
    // app closed and reopened 10 minutes later
    expect(remaining(s, 10 * MIN)).toBe(15 * MIN)
    s = pause(s, 10 * MIN)
    // paused for an hour — still 15 left
    expect(remaining(s, 70 * MIN)).toBe(15 * MIN)
    s = start(s, 70 * MIN)
    expect(endsAt(s)).toBe(85 * MIN)
  })

  it('if time ran out while closed, the break starts from when focus actually ended', () => {
    const s = start(newTimer('pomodoro'), 0)
    expect(isOver(s, 40 * MIN)).toBe(true)
    const r = advance(s, endsAt(s)!)
    expect(r.focusMins).toBe(25)
    expect(r.next.phase).toBe('break')
    expect(r.next.segStart).toBe(25 * MIN)
    // so at minute 28 the break shows 2 minutes left
    expect(remaining(r.next, 28 * MIN)).toBe(2 * MIN)
  })
})

describe('techniques', () => {
  it('pomodoro gives a long break every 4th round', () => {
    let s = newTimer('pomodoro')
    const phases: string[] = []
    let t = 0
    for (let i = 0; i < 8; i++) {
      s = start(s, t)
      t += s.durationMs
      s = advance(s, t, { autoStartBreak: false }).next
      phases.push(s.phase)
    }
    expect(phases).toEqual(['break', 'focus', 'break', 'focus', 'break', 'focus', 'long', 'focus'])
  })

  it('flowtime counts up and scales the break', () => {
    let s = start(newTimer('flowtime'), 0)
    expect(s.durationMs).toBe(0)
    const r = advance(s, 75 * MIN)
    expect(r.focusMins).toBe(75)
    expect(r.next.durationMs).toBe(15 * MIN)
    s = start(newTimer('flowtime'), 0)
    expect(advance(s, 10 * MIN).next.durationMs).toBe(5 * MIN)
  })

  it('52/17 and ultradian lengths', () => {
    expect(newTimer('5217').durationMs).toBe(52 * MIN)
    expect(newTimer('ultradian').durationMs).toBe(90 * MIN)
    expect(advance(start(newTimer('ultradian'), 0), 90 * MIN).next.durationMs).toBe(20 * MIN)
  })

  it('custom', () => {
    const s = newTimer('custom', 'Pharm', { focus: 40, brk: 8, long: 20, every: 3 })
    expect(s.durationMs).toBe(40 * MIN)
  })
})
