import { describe, expect, it } from 'vitest'
import { generatePlan, groupByDate } from '../studyPlan'

describe('generatePlan', () => {
  const topics = ['Heart failure', 'Arrhythmias', 'Valvular disease', 'HTN', 'Ischemic heart disease', 'Cardiomyopathies']
  const plan = generatePlan({ topics, start: '2026-11-09', exam: '2026-11-30' })

  it('learns every topic once, before the buffer days', () => {
    const learns = plan.filter((p) => p.kind === 'learn')
    expect(learns.map((l) => l.topic)).toEqual(topics)
    expect(learns.every((l) => l.date < '2026-11-28')).toBe(true)
  })
  it('spaces reviews and never on/after exam day', () => {
    const hf = plan.filter((p) => p.topic === 'Heart failure')
    expect(hf.map((p) => p.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-16', '2026-11-23'])
    expect(plan.every((p) => p.date < '2026-11-30')).toBe(true)
  })
  it('final review the day before', () => {
    expect(plan.at(-1)).toMatchObject({ kind: 'final', date: '2026-11-29' })
  })
  it('short runway still works', () => {
    const p = generatePlan({ topics: ['A', 'B', 'C'], start: '2026-11-09', exam: '2026-11-11' })
    expect(p.filter((x) => x.kind === 'learn').length).toBe(3)
    expect(groupByDate(p).length).toBeGreaterThan(0)
  })
  it('empty when the exam has passed', () => {
    expect(generatePlan({ topics: ['A'], start: '2026-11-09', exam: '2026-11-09' })).toEqual([])
  })
})
