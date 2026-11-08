import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { db, save } from '../../../data/db'
import type { Deck, FlashCard } from '../../../data/types'
import { parseCardsText } from '../../../lib/cards'
import { toast } from '../../../lib/toast'
import { useSetting } from '../../../lib/useSetting'
import { Sheet } from '../../../ui/Sheet'
import { CardEditor, type CardEditorTarget } from './CardEditor'
import { countCards, deleteDeck, deleteNote, descendants, saveNote } from './cardActions'
import { ReviewSession } from './ReviewSession'
import { QuizMode } from './QuizMode'

const DECK_EMOJI = ['🫀', '🧠', '🫁', '🦴', '💊', '🧬', '🦠', '🩸', '👶', '🧪', '🩺', '📖']

export function FlashcardsPage() {
  return (
    <Routes>
      <Route index element={<DecksHome />} />
      <Route path="deck/:id" element={<DeckView />} />
      <Route path="review" element={<ReviewSession />} />
      <Route path="review/:id" element={<ReviewSession />} />
      <Route path="quiz/:id" element={<QuizMode />} />
    </Routes>
  )
}

function useDecksWithCounts() {
  const decks = useLiveQuery(() => db.decks.filter((d) => !d.deleted).toArray(), [], [] as Deck[])
  const cards = useLiveQuery(() => db.cards.filter((c) => !c.deleted).toArray(), [], [] as FlashCard[])
  return useMemo(() => {
    const byDeck = (ids: string[]) => cards.filter((c) => ids.includes(c.deckId))
    return { decks, cards, counts: (id: string) => countCards(byDeck(descendants(decks, id))), all: countCards(cards) }
  }, [decks, cards])
}

function DeckForm({ deck, parentId, onDone }: { deck?: Deck; parentId?: string | null; onDone: () => void }) {
  const [name, setName] = useState(deck?.name ?? '')
  const [emoji, setEmoji] = useState(deck?.emoji ?? '🫀')
  return (
    <form
      className="flex flex-col gap-3 pb-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        await save<Deck>('decks', { id: deck?.id, name: name.trim(), emoji, parentId: deck ? deck.parentId : (parentId ?? null) })
        onDone()
      }}
    >
      <input className="input text-lg font-bold" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cardio, Renal pharm, Micro bugs" />
      <div className="flex flex-wrap gap-1">
        {DECK_EMOJI.map((x) => (
          <button type="button" key={x} onClick={() => setEmoji(x)} className={`h-11 w-11 rounded-full text-xl ${emoji === x ? 'bg-primary-soft ring-2 ring-primary' : 'bg-surface-2'}`}>
            {x}
          </button>
        ))}
      </div>
      <button className="btn-primary">{deck ? 'Save' : 'Create deck'}</button>
    </form>
  )
}

function DecksHome() {
  const { decks, counts, all } = useDecksWithCounts()
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const nav = useNavigate()
  const roots = decks.filter((d) => !d.parentId || !decks.some((p) => p.id === d.parentId)).sort((a, b) => a.name.localeCompare(b.name))
  const dueTotal = all.due + Math.min(all.fresh, 20)

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-wrap items-center gap-4 !bg-primary-soft">
        <div className="text-5xl">🃏</div>
        <div className="flex-1">
          <div className="text-2xl font-extrabold">{all.due} due · {all.fresh} new</div>
          <div className="text-sm font-semibold text-muted">Spaced repetition (FSRS) shows each card right before you'd forget it.</div>
        </div>
        <button className="btn-primary !min-h-12" disabled={!dueTotal} onClick={() => nav('review')}>
          {dueTotal ? 'Study now ✨' : 'All caught up 🎉'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-soft" onClick={() => setCreating(true)}>+ New deck</button>
        <button className="btn-soft" onClick={() => setImporting(true)} disabled={!decks.length}>📥 Import cards</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {roots.map((d) => (
          <DeckTile key={d.id} deck={d} decks={decks} counts={counts} />
        ))}
      </div>
      {!decks.length && (
        <div className="card flex flex-col items-center gap-2 py-10 text-center">
          <div className="text-5xl">🧸</div>
          <div className="h2">Make your first deck</div>
          <div className="max-w-sm text-muted">Group cards by system or class, like “Cardio” → “Cardio pharm”. You can also import an Anki export.</div>
          <button className="btn-primary mt-2" onClick={() => setCreating(true)}>+ New deck</button>
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="New deck">
        <DeckForm onDone={() => setCreating(false)} />
      </Sheet>
      <ImportSheet open={importing} onClose={() => setImporting(false)} decks={decks} />
    </div>
  )
}

function DeckTile({ deck, decks, counts }: { deck: Deck; decks: Deck[]; counts: (id: string) => { due: number; fresh: number; total: number } }) {
  const c = counts(deck.id)
  const kids = decks.filter((d) => d.parentId === deck.id)
  return (
    <div className="card flex flex-col gap-2">
      <Link to={`deck/${deck.id}`} className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-2 text-2xl">{deck.emoji ?? '📚'}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-extrabold">{deck.name}</div>
          <div className="text-sm font-bold text-muted">
            <span className="text-primary">{c.due} due</span> · {c.fresh} new · {c.total} total
          </div>
        </div>
      </Link>
      {kids.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-14">
          {kids.map((k) => (
            <Link key={k.id} to={`deck/${k.id}`} className="chip !min-h-8 text-xs">
              {k.emoji} {k.name} · {counts(k.id).due}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function DeckView() {
  const { id } = useParams()
  const { decks, cards, counts } = useDecksWithCounts()
  const deck = decks.find((d) => d.id === id)
  const nav = useNavigate()
  const [editor, setEditor] = useState<CardEditorTarget>(null)
  const [sheet, setSheet] = useState<null | 'edit' | 'sub' | 'import'>(null)
  const [q, setQ] = useState('')
  if (!deck) return <div className="card">Deck not found 🐾 <Link to=".." className="text-primary underline">Back</Link></div>
  const c = counts(deck.id)
  const ids = descendants(decks, deck.id)
  const notes = new Map<string, FlashCard>()
  for (const card of cards.filter((x) => ids.includes(x.deckId))) if (!notes.has(card.noteId)) notes.set(card.noteId, card)
  const list = [...notes.values()].filter((n) => !q || (n.front + ' ' + n.back).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.updatedAt - a.updatedAt)
  const parent = decks.find((d) => d.id === deck.parentId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
        <Link to="/study/cards">🃏 Decks</Link>
        {parent && (
          <>
            › <Link to={`/study/cards/deck/${parent.id}`}>{parent.name}</Link>
          </>
        )}
      </div>
      <div className="card flex flex-wrap items-center gap-3">
        <span className="text-4xl">{deck.emoji}</span>
        <div className="flex-1">
          <div className="h1">{deck.name}</div>
          <div className="font-bold text-muted">
            {c.due} due · {c.fresh} new · {c.total} cards
          </div>
        </div>
        <button className="btn-primary" disabled={!c.due && !c.fresh} onClick={() => nav(`/study/cards/review/${deck.id}`)}>Study ✨</button>
        <button className="btn-soft" disabled={c.total < 4} onClick={() => nav(`/study/cards/quiz/${deck.id}`)} title="Multiple-choice quiz from your cards">🎯 Quiz</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setEditor({ deckId: deck.id })}>+ Add card</button>
        <button className="btn-soft" onClick={() => setSheet('import')}>📥 Import</button>
        <button className="btn-soft" onClick={() => setSheet('sub')}>+ Sub-deck</button>
        <button className="btn-ghost" onClick={() => setSheet('edit')}>✏️ Rename</button>
        <button className="btn-ghost" onClick={async () => { await deleteDeck(deck); nav('/study/cards') }}>🗑️</button>
      </div>
      {notes.size > 6 && <input className="input" placeholder="🔍 Search cards" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="flex flex-col gap-2">
        {list.map((n) => (
          <div key={n.noteId} className="card flex items-center gap-3 !p-3">
            <span className="text-xs font-extrabold text-muted">{n.type === 'cloze' ? '🙈' : n.type === 'occlusion' ? '🖼️' : n.type === 'reversed' ? '↔' : '🃏'}</span>
            <button className="min-w-0 flex-1 text-left" onClick={() => setEditor({ deckId: n.deckId, noteId: n.noteId })}>
              <div className="truncate font-bold">{n.type === 'cloze' ? n.front.replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '[$1]') : n.front || `Image · ${n.masks?.length ?? 0} boxes`}</div>
              {n.back && <div className="truncate text-sm text-muted">{n.back}</div>}
            </button>
            <button className="icon-btn" aria-label="Delete card" onClick={() => deleteNote(n.noteId)}>🗑️</button>
          </div>
        ))}
        {!notes.size && <div className="card py-8 text-center text-muted">No cards yet — add one or import a list 🐾</div>}
      </div>

      <CardEditor target={editor} onClose={() => setEditor(null)} />
      <Sheet open={sheet === 'edit'} onClose={() => setSheet(null)} title="Rename deck">
        <DeckForm deck={deck} onDone={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === 'sub'} onClose={() => setSheet(null)} title={`New sub-deck in ${deck.name}`}>
        <DeckForm parentId={deck.id} onDone={() => setSheet(null)} />
      </Sheet>
      <ImportSheet open={sheet === 'import'} onClose={() => setSheet(null)} decks={decks} deckId={deck.id} />
    </div>
  )
}

function ImportSheet({ open, onClose, decks, deckId }: { open: boolean; onClose: () => void; decks: Deck[]; deckId?: string }) {
  const [text, setText] = useState('')
  const [target, setTarget] = useSetting('lastImportDeck', deckId ?? '')
  const deck = deckId ?? (decks.some((d) => d.id === target) ? target : decks[0]?.id)
  const pairs = useMemo(() => parseCardsText(text), [text])
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Import cards 📥"
      footer={
        <button
          className="btn-primary w-full"
          disabled={!pairs.length || !deck}
          onClick={async () => {
            for (const [f, b] of pairs) await saveNote(deck!, null, { type: /\{\{c\d+::/.test(f) ? 'cloze' : 'basic', front: f, back: b })
            toast(`Imported ${pairs.length} cards 🎉`, { emoji: '📥' })
            setText('')
            onClose()
          }}
        >
          Import {pairs.length || ''} card{pairs.length === 1 ? '' : 's'}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {!deckId && (
          <select className="input" value={deck} onChange={(e) => setTarget(e.target.value)}>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>{d.emoji} {d.name}</option>
            ))}
          </select>
        )}
        <p className="text-sm text-muted">
          Paste one card per line: <b>question [tab] answer</b> (Anki “Notes in Plain Text” export), <b>question, answer</b> (CSV), <b>question :: answer</b>, or <b>question? answer</b>. Lines with <code>{'{{c1::…}}'}</code> become fill-in cards.
        </p>
        <label className="chip w-fit cursor-pointer">
          📄 Choose a .txt / .csv file
          <input type="file" accept=".txt,.csv,.tsv,text/plain" className="hidden" onChange={async (e) => setText(await e.target.files?.[0]?.text() ?? '')} />
        </label>
        <textarea className="input min-h-40 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={'Normal K+ range\t3.5–5.0 mEq/L\nDrug of choice for absence seizures :: Ethosuximide'} />
        {pairs.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-2xl bg-surface-2 p-2 text-sm">
            {pairs.slice(0, 5).map(([f, b], i) => (
              <div key={i} className="border-b border-line py-1 last:border-0">
                <b>{f}</b> → {b}
              </div>
            ))}
            {pairs.length > 5 && <div className="pt-1 text-muted">…and {pairs.length - 5} more</div>}
          </div>
        )}
      </div>
    </Sheet>
  )
}
