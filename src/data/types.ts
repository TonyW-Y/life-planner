export type ID = string

/** Fields every synced record has. */
export interface Base {
  id: ID
  updatedAt: number
  /** per-field last-modified timestamps used to merge edits from multiple devices */
  _fts?: Record<string, number>
  deleted?: boolean
  deletedAt?: number
}

export type Category = 'lecture' | 'clinical' | 'study' | 'exam' | 'personal' | 'rest' | 'other'

export type Freq = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly'

export interface Repeat {
  freq: Freq
  interval: number
  /** 0 = Monday … 6 = Sunday (used for weekly) */
  byweekday?: number[]
  /** monthly: same date, or "2nd Tuesday" style */
  monthlyMode?: 'date' | 'nth'
  /** yyyy-MM-dd inclusive */
  until?: string | null
  count?: number | null
}

export interface CalEvent extends Base {
  title: string
  /** ISO local datetime yyyy-MM-ddTHH:mm */
  start: string
  end: string
  allDay?: boolean
  category: Category
  emoji?: string
  notes?: string
  repeat?: Repeat | null
  /** occurrence start strings (yyyy-MM-ddTHH:mm) skipped in a series */
  exdates?: string[]
  /** set on a one-off edited copy of a series occurrence */
  overrideOf?: { seriesId: ID; occurrence: string }
  taskId?: ID
  reminderMins?: number | null
}

export type Priority = 'must' | 'should' | 'nice'

export interface Subtask {
  id: ID
  title: string
  done: boolean
}

export interface Task extends Base {
  title: string
  notes?: string
  priority: Priority
  /** yyyy-MM-dd */
  due?: string | null
  done: boolean
  doneAt?: number | null
  subtasks: Subtask[]
  tags: string[]
  urgent?: boolean
  important?: boolean
  estimateMins?: number
  repeat?: Repeat | null
  order: number
  emoji?: string
  reminderAt?: string | null
}

export interface Deck extends Base {
  name: string
  parentId?: ID | null
  emoji?: string
}

export type CardType = 'basic' | 'reversed' | 'cloze' | 'occlusion'

export interface Mask {
  id: ID
  x: number
  y: number
  w: number
  h: number
  label?: string
}

export interface SrsState {
  due: string
  stability: number
  difficulty: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string | null
}

export interface FlashCard extends Base {
  deckId: ID
  /** cards generated from one note (reversed pair, cloze numbers, occlusion masks) share a noteId */
  noteId: ID
  type: CardType
  /** which cloze number / mask index / direction this card tests */
  sub: number
  front: string
  back: string
  /** id of a Media record (stored once, shared by sibling cards) */
  image?: string
  masks?: Mask[]
  srs: SrsState
  suspended?: boolean
}

export interface ReviewLog extends Base {
  cardId: ID
  rating: number
  at: number
}

export type Technique = 'pomodoro' | '5217' | 'ultradian' | 'flowtime' | 'custom'

export interface StudySession extends Base {
  technique: Technique
  subject: string
  start: number
  end: number
  focusMins: number
  taskId?: ID | null
}

export interface Exam extends Base {
  name: string
  /** yyyy-MM-dd */
  date: string
  emoji?: string
}

export interface Mood extends Base {
  /** yyyy-MM-dd */
  date: string
  at: number
  mood: 1 | 2 | 3 | 4 | 5
  note?: string
}

export interface ChatMsg extends Base {
  role: 'user' | 'tt'
  text: string
  at: number
  crisis?: boolean
}

export interface BudgetFixed {
  sleepHours: number
  wake: string
  bed: string
  commuteDaily: number
  mealsDaily: number
  selfCareDaily: number
}

export interface Budget extends Base {
  /** id = week start yyyy-MM-dd (Monday) */
  fixed: BudgetFixed
  alloc: Record<string, number>
  review?: { wins?: string; hard?: string; next?: string }
}

export interface TemplateItem {
  /** day offset from template start (0 for day templates) */
  dayOffset: number
  title: string
  startTime: string
  endTime: string
  category: Category
  emoji?: string
  allDay?: boolean
}

export interface Template extends Base {
  name: string
  kind: 'day' | 'week'
  items: TemplateItem[]
}

export interface Media extends Base {
  /** compressed image as a data URL */
  data: string
}

export interface Setting extends Base {
  value: unknown
}

export type TableName =
  | 'events'
  | 'tasks'
  | 'decks'
  | 'cards'
  | 'reviews'
  | 'sessions'
  | 'exams'
  | 'moods'
  | 'chats'
  | 'budgets'
  | 'templates'
  | 'settings'
  | 'media'

export const SYNCED_TABLES: TableName[] = [
  'events',
  'tasks',
  'decks',
  'cards',
  'reviews',
  'sessions',
  'exams',
  'moods',
  'chats',
  'budgets',
  'templates',
  'settings',
  'media',
]
