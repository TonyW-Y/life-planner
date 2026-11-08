import { describe, expect, it } from 'vitest'
import { classify, fallbackReply, isCrisis } from '../tt'

describe('crisis detection', () => {
  it.each([
    'I want to die',
    "I don't want to be alive anymore",
    'thinking about killing myself',
    'I want to hurt myself',
    'everyone would be better off without me',
    "i can't go on like this",
    'thinking about suicide',
    'I might take my own life',
  ])('flags: %s', (t) => expect(isCrisis(t)).toBe(true))

  it.each(['this exam is killing me', 'I could die of embarrassment lol', 'I am so tired', 'pharm is the worst'])('does not flag everyday talk: %s', (t) =>
    expect(isCrisis(t)).toBe(false),
  )

  it('crisis always gets resources, never a casual reply', () => {
    const r = fallbackReply('honestly I want to die')
    expect(r.crisis).toBe(true)
    expect(r.text).toContain('988')
    expect(r.text).toContain('741741')
  })
})

describe('intent', () => {
  it('reads common feelings', () => {
    expect(classify('my shelf exam is friday and I am freaking out')).toBe('exam')
    expect(classify('I failed my cardio block')).toBe('failed')
    expect(classify('I feel like an imposter here')).toBe('imposter')
    expect(classify("I'm so burnt out")).toBe('tired')
    expect(classify('I passed!!!')).toBe('good')
    expect(classify('hi TT')).toBe('hello')
  })
  it('always has something kind to say', () => {
    expect(fallbackReply('blorp', 0).text.length).toBeGreaterThan(10)
  })
})
