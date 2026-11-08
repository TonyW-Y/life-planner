import type { Category, Priority } from '../data/types'

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'lecture', label: 'Lecture', emoji: '🎓' },
  { id: 'clinical', label: 'Clinical', emoji: '🩺' },
  { id: 'study', label: 'Study', emoji: '📚' },
  { id: 'exam', label: 'Exam', emoji: '📝' },
  { id: 'personal', label: 'Personal', emoji: '🌷' },
  { id: 'rest', label: 'Rest', emoji: '☁️' },
  { id: 'other', label: 'Other', emoji: '✨' },
]
export const catColor = (c: Category) => `var(--cat-${c})`
export const catMeta = (c: Category) => CATEGORIES.find((x) => x.id === c) ?? CATEGORIES[6]

export const PRIORITIES: { id: Priority; label: string; emoji: string; color: string }[] = [
  { id: 'must', label: 'Must do', emoji: '🌟', color: 'var(--primary)' },
  { id: 'should', label: 'Should do', emoji: '🌼', color: 'var(--warn)' },
  { id: 'nice', label: 'Nice to do', emoji: '🍃', color: 'var(--accent)' },
]
