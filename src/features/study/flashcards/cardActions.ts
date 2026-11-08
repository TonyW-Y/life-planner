import type { Grade } from 'ts-fsrs'
import { db, getSetting, remove, restore, save, setSetting, uid } from '../../../data/db'
import type { Deck, FlashCard, Media, ReviewLog } from '../../../data/types'
import { subsFor, type NoteInput } from '../../../lib/cards'
import { isDue, isNew, newSrs, review } from '../../../lib/srs'
import { fmtD } from '../../../lib/recurrence'
import { toast } from '../../../lib/toast'

export async function saveImage(dataUrl: string) {
  return (await save<Media>('media', { data: dataUrl })).id
}

/** Create or update a note; keeps each card's review history when editing. */
export async function saveNote(deckId: string, noteId: string | null, note: NoteInput & { image?: string }) {
  const nid = noteId ?? uid()
  const existing = noteId ? await db.cards.where('noteId').equals(noteId).filter((c) => !c.deleted).toArray() : []
  const subs = subsFor(note)
  for (const sub of subs) {
    const prev = existing.find((c) => c.sub === sub)
    const base = { deckId, noteId: nid, type: note.type, sub, front: note.front, back: note.back, masks: note.masks, image: note.image }
    if (prev) await save<FlashCard>('cards', { ...base, id: prev.id })
    else await save<FlashCard>('cards', { ...base, srs: newSrs() })
  }
  for (const c of existing) if (!subs.includes(c.sub)) await remove('cards', c.id)
  return { noteId: nid, count: subs.length }
}

export async function deleteNote(noteId: string) {
  const cards = await db.cards.where('noteId').equals(noteId).filter((c) => !c.deleted).toArray()
  for (const c of cards) await remove('cards', c.id)
  toast('Card deleted', { emoji: '🗑️', undo: async () => { for (const c of cards) await restore('cards', c.id) } })
}

export function descendants(decks: Deck[], id: string): string[] {
  const out = [id]
  for (const d of decks) if (d.parentId === id && !d.deleted) out.push(...descendants(decks, d.id))
  return out
}

export async function deleteDeck(deck: Deck) {
  const decks = await db.decks.toArray()
  const ids = descendants(decks, deck.id)
  const cards = await db.cards.filter((c) => ids.includes(c.deckId) && !c.deleted).toArray()
  for (const id of ids) await remove('decks', id)
  for (const c of cards) await remove('cards', c.id)
  toast(`Deleted “${deck.name}”`, {
    emoji: '🗑️',
    undo: async () => {
      for (const id of ids) await restore('decks', id)
      for (const c of cards) await restore('cards', c.id)
    },
  })
}

export interface DeckCounts {
  due: number
  fresh: number
  total: number
}

export function countCards(cards: FlashCard[], now = new Date()): DeckCounts {
  let due = 0
  let fresh = 0
  for (const c of cards) {
    if (c.deleted || c.suspended) continue
    if (isNew(c.srs)) fresh++
    else if (isDue(c.srs, now)) due++
  }
  return { due, fresh, total: cards.filter((c) => !c.deleted).length }
}

export async function newLeftToday() {
  const limit = await getSetting('newPerDay', 20)
  const log = await getSetting<{ date: string; count: number }>('newToday', { date: '', count: 0 })
  return Math.max(0, limit - (log.date === fmtD(new Date()) ? log.count : 0))
}

/** Today's review queue: everything due (oldest first), then a few new cards, siblings spread apart. */
export async function buildQueue(deckIds: string[] | null): Promise<FlashCard[]> {
  const now = new Date()
  const all = await db.cards.filter((c) => !c.deleted && !c.suspended && (!deckIds || deckIds.includes(c.deckId))).toArray()
  const due = all.filter((c) => isDue(c.srs, now)).sort((a, b) => a.srs.due.localeCompare(b.srs.due))
  const left = await newLeftToday()
  const seenNotes = new Set<string>()
  const fresh: FlashCard[] = []
  for (const c of all.filter((x) => isNew(x.srs)).sort((a, b) => a.updatedAt - b.updatedAt)) {
    if (fresh.length >= left) break
    if (seenNotes.has(c.noteId)) continue // bury siblings till tomorrow
    seenNotes.add(c.noteId)
    fresh.push(c)
  }
  // interleave new cards among reviews
  const q: FlashCard[] = []
  const step = fresh.length ? Math.max(1, Math.floor(due.length / fresh.length)) : 0
  let fi = 0
  due.forEach((c, i) => {
    q.push(c)
    if (step && (i + 1) % step === 0 && fi < fresh.length) q.push(fresh[fi++])
  })
  while (fi < fresh.length) q.push(fresh[fi++])
  return q
}

export async function recordReview(card: FlashCard, grade: Grade) {
  const wasNew = isNew(card.srs)
  const prev = card.srs
  const srs = review(card.srs, grade)
  await save<FlashCard>('cards', { id: card.id, srs })
  const log = await save<ReviewLog>('reviews', { cardId: card.id, rating: grade, at: Date.now() })
  if (wasNew) {
    const today = fmtD(new Date())
    const n = await getSetting<{ date: string; count: number }>('newToday', { date: '', count: 0 })
    await setSetting('newToday', { date: today, count: (n.date === today ? n.count : 0) + 1 })
  }
  return { srs, undo: async () => {
    await save<FlashCard>('cards', { id: card.id, srs: prev })
    await remove('reviews', log.id)
    if (wasNew) {
      const n = await getSetting<{ date: string; count: number }>('newToday', { date: '', count: 0 })
      await setSetting('newToday', { ...n, count: Math.max(0, n.count - 1) })
    }
  } }
}
