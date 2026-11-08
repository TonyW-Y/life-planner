import { describe, expect, it } from 'vitest'
import { clozeNumbers, parseCardsText, renderCloze, subsFor } from '../cards'
import { humanInterval, isDue, newSrs, review } from '../srs'
import { Rating } from 'ts-fsrs'

describe('cloze', () => {
  const t = '{{c1::Aspirin}} irreversibly inhibits {{c2::COX-1::enzyme}} and COX-2'
  it('finds numbers', () => expect(clozeNumbers(t)).toEqual([1, 2]))
  it('blanks the tested one and shows hints', () => {
    expect(renderCloze(t, 2, false).map((s) => s.text).join('')).toBe('Aspirin irreversibly inhibits [enzyme] and COX-2')
    expect(renderCloze(t, 1, false).map((s) => s.text).join('')).toBe('[ … ] irreversibly inhibits COX-1 and COX-2')
    expect(renderCloze(t, 1, true).find((s) => s.kind === 'answer')?.text).toBe('Aspirin')
  })
  it('makes one card per cloze / mask / direction', () => {
    expect(subsFor({ type: 'cloze', front: t, back: '' })).toEqual([1, 2])
    expect(subsFor({ type: 'reversed', front: 'a', back: 'b' })).toEqual([0, 1])
    expect(subsFor({ type: 'occlusion', front: '', back: '', masks: [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }, { id: 'b', x: 0, y: 0, w: 1, h: 1 }] })).toEqual([0, 1])
  })
})

describe('import', () => {
  it('Anki tab-separated export', () => {
    expect(parseCardsText('#separator:tab\nWhat is the MOA of metformin?\tDecreases hepatic gluconeogenesis\nNormal K+\t3.5-5.0 mEq/L')).toEqual([
      ['What is the MOA of metformin?', 'Decreases hepatic gluconeogenesis'],
      ['Normal K+', '3.5-5.0 mEq/L'],
    ])
  })
  it('CSV with quotes', () => {
    expect(parseCardsText('"Beck triad, signs","Hypotension, JVD, muffled heart sounds"')).toEqual([['Beck triad, signs', 'Hypotension, JVD, muffled heart sounds']])
  })
  it('Q :: A and Q? A styles', () => {
    expect(parseCardsText('Rate-limiting enzyme of glycolysis :: PFK-1')).toEqual([['Rate-limiting enzyme of glycolysis', 'PFK-1']])
    expect(parseCardsText('Most common cause of SAH? Trauma')).toEqual([['Most common cause of SAH?', 'Trauma']])
  })
  it('keeps cloze lines with no back', () => {
    expect(parseCardsText('{{c1::Warfarin}} inhibits vitamin K epoxide reductase')).toHaveLength(1)
  })
})

describe('FSRS', () => {
  it('new card → good pushes it out, again keeps it close', () => {
    const now = new Date(2026, 10, 7, 10)
    const s = newSrs(now)
    const good = review(s, Rating.Good, now)
    const again = review(s, Rating.Again, now)
    expect(new Date(good.due) > new Date(again.due)).toBe(true)
    expect(good.reps).toBe(1)
    // after several "good" reviews the interval grows to days
    let c = good
    let t = new Date(c.due)
    for (let i = 0; i < 3; i++) {
      c = review(c, Rating.Good, t)
      t = new Date(c.due)
    }
    expect(new Date(c.due).getTime() - now.getTime()).toBeGreaterThan(3 * 86400000)
    expect(isDue(c, new Date(t.getTime() + 1))).toBe(true)
  })
  it('formats intervals', () => {
    expect(humanInterval(10 * 60000)).toBe('10m')
    expect(humanInterval(3 * 86400000)).toBe('3d')
  })
})

describe('mixed import', () => {
  it('handles a different separator on each line', () => {
    expect(parseCardsText('Drug for torsades\tMagnesium sulfate\nDigoxin antidote :: Digibind\nFirst-line for stable angina? Nitrates\nBB suffix - olol')).toEqual([
      ['Drug for torsades', 'Magnesium sulfate'],
      ['Digoxin antidote', 'Digibind'],
      ['First-line for stable angina?', 'Nitrates'],
      ['BB suffix', 'olol'],
    ])
  })
  it('cloze with hint and back after tab', () => {
    expect(parseCardsText('{{c1::Warfarin::drug}} needs INR checks\tmonitor 2-3')).toEqual([['{{c1::Warfarin::drug}} needs INR checks', 'monitor 2-3']])
  })
})
