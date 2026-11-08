import Dexie, { type Table } from 'dexie'
import type {
  Base,
  Budget,
  CalEvent,
  ChatMsg,
  Deck,
  Exam,
  FlashCard,
  Mood,
  ReviewLog,
  Setting,
  StudySession,
  TableName,
  Task,
  Template,
} from './types'

export interface OutboxRow {
  seq?: number
  table: TableName
  id: string
  at: number
}

export interface Draft {
  key: string
  value: unknown
  at: number
}

export interface Snapshot {
  id?: number
  at: number
  json: string
}

export class CozyDB extends Dexie {
  events!: Table<CalEvent, string>
  tasks!: Table<Task, string>
  decks!: Table<Deck, string>
  cards!: Table<FlashCard, string>
  reviews!: Table<ReviewLog, string>
  sessions!: Table<StudySession, string>
  exams!: Table<Exam, string>
  moods!: Table<Mood, string>
  chats!: Table<ChatMsg, string>
  budgets!: Table<Budget, string>
  templates!: Table<Template, string>
  settings!: Table<Setting, string>
  outbox!: Table<OutboxRow, number>
  drafts!: Table<Draft, string>
  snapshots!: Table<Snapshot, number>

  constructor(name = 'cozy-planner') {
    super(name)
    this.version(1).stores({
      events: 'id, start, category, updatedAt, deleted',
      tasks: 'id, due, done, updatedAt, deleted',
      decks: 'id, parentId, updatedAt, deleted',
      cards: 'id, deckId, noteId, srs.due, updatedAt, deleted',
      reviews: 'id, cardId, at, updatedAt',
      sessions: 'id, start, subject, updatedAt, deleted',
      exams: 'id, date, updatedAt, deleted',
      moods: 'id, date, at, updatedAt, deleted',
      chats: 'id, at, updatedAt, deleted',
      budgets: 'id, updatedAt',
      templates: 'id, updatedAt, deleted',
      settings: 'id, updatedAt',
      outbox: '++seq, [table+id]',
      drafts: 'key',
      snapshots: '++id, at',
    })
  }
}

export const db = new CozyDB()

export const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(
    /-/g,
    '',
  )

type Listener = () => void
const changeListeners = new Set<Listener>()
/** The sync engine subscribes here so it can push right after a local write. */
export function onLocalChange(fn: Listener) {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}
const notify = () => changeListeners.forEach((fn) => fn())

function tableOf(name: TableName): Table<Base, string> {
  return db.table(name) as Table<Base, string>
}

const isEqual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Save (insert or patch) a record. Resolves only after the write is durable in IndexedDB,
 * and queues it for cloud sync in the same transaction, so nothing is ever lost.
 */
export async function save<T extends Base>(
  table: TableName,
  record: Partial<T> & { id?: string },
): Promise<T> {
  const t = tableOf(table)
  const now = Date.now()
  let result!: T
  await db.transaction('rw', t, db.outbox, async () => {
    const id = record.id ?? uid()
    const prev = (await t.get(id)) as T | undefined
    const fts: Record<string, number> = { ...(prev?._fts ?? {}) }
    for (const [k, v] of Object.entries(record)) {
      if (k === '_fts' || k === 'updatedAt' || k === 'id') continue
      if (!prev || !isEqual((prev as Record<string, unknown>)[k], v)) fts[k] = now
    }
    result = { ...(prev ?? {}), ...record, id, updatedAt: now, _fts: fts } as T
    await t.put(result)
    await db.outbox.add({ table, id, at: now })
  })
  notify()
  return result
}

export async function saveMany<T extends Base>(table: TableName, records: Array<Partial<T>>) {
  const out: T[] = []
  for (const r of records) out.push(await save<T>(table, r))
  return out
}

/** Soft-delete: goes to Trash for 30 days, can be undone. */
export async function remove(table: TableName, id: string) {
  await save(table, { id, deleted: true, deletedAt: Date.now() })
}

export async function restore(table: TableName, id: string) {
  await save(table, { id, deleted: false, deletedAt: undefined })
}

/** Permanently drop items that have sat in the Trash for over 30 days. */
export async function purgeTrash(days = 30) {
  const cutoff = Date.now() - days * 86400000
  for (const name of ['events', 'tasks', 'decks', 'cards', 'exams', 'templates', 'moods', 'chats', 'sessions'] as TableName[]) {
    const t = tableOf(name)
    const old = await t.filter((r) => !!r.deleted && (r.deletedAt ?? 0) < cutoff).primaryKeys()
    if (old.length) await t.bulkDelete(old)
  }
}

/** Merge a remote record into the local one, field by field (latest edit of each field wins). */
export function mergeRecords<T extends Base>(local: T | undefined, remote: T): T {
  if (!local) return remote
  const lf = local._fts ?? {}
  const rf = remote._fts ?? {}
  const merged = { ...local } as Record<string, unknown>
  const fts: Record<string, number> = { ...lf }
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  for (const k of keys) {
    if (k === '_fts' || k === 'updatedAt' || k === 'id') continue
    const lt = lf[k] ?? local.updatedAt ?? 0
    const rt = rf[k] ?? remote.updatedAt ?? 0
    if (rt > lt) {
      merged[k] = (remote as Record<string, unknown>)[k]
      fts[k] = rt
    }
  }
  merged._fts = fts
  merged.updatedAt = Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0)
  return merged as T
}

/* ---------- Settings (key/value) ---------- */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key)
  return row ? (row.value as T) : fallback
}
export async function setSetting(key: string, value: unknown) {
  await save<Setting>('settings', { id: key, value })
}

/* ---------- Drafts: autosaved half-typed input ---------- */
export async function saveDraft(key: string, value: unknown) {
  await db.drafts.put({ key, value, at: Date.now() })
}
export async function loadDraft<T>(key: string): Promise<T | undefined> {
  return (await db.drafts.get(key))?.value as T | undefined
}
export async function clearDraft(key: string) {
  await db.drafts.delete(key)
}

/* ---------- Backup ---------- */
const BACKUP_TABLES: TableName[] = [
  'events', 'tasks', 'decks', 'cards', 'reviews', 'sessions', 'exams', 'moods', 'chats', 'budgets', 'templates', 'settings',
]

export async function exportAll(): Promise<string> {
  const data: Record<string, unknown[]> = {}
  for (const t of BACKUP_TABLES) data[t] = await tableOf(t).toArray()
  return JSON.stringify({ app: 'cozy-planner', version: 1, at: Date.now(), data })
}

export async function importAll(json: string) {
  const parsed = JSON.parse(json)
  if (parsed?.app !== 'cozy-planner') throw new Error('This file is not a Cozy Planner backup')
  for (const t of BACKUP_TABLES) {
    const rows = (parsed.data?.[t] ?? []) as Base[]
    const table = tableOf(t)
    await db.transaction('rw', table, db.outbox, async () => {
      for (const r of rows) {
        const local = await table.get(r.id)
        await table.put(mergeRecords(local, r))
        await db.outbox.add({ table: t, id: r.id, at: Date.now() })
      }
    })
  }
  notify()
}

/** Weekly automatic local snapshot, keeping the last 4. */
export async function maybeSnapshot() {
  const last = await db.snapshots.orderBy('at').last()
  if (last && Date.now() - last.at < 7 * 86400000) return
  await db.snapshots.add({ at: Date.now(), json: await exportAll() })
  const all = await db.snapshots.orderBy('at').primaryKeys()
  if (all.length > 4) await db.snapshots.bulkDelete(all.slice(0, all.length - 4))
}

/** Ask the browser to never evict our storage. */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
      await navigator.storage.persist()
    }
  } catch {
    /* ignore */
  }
}
