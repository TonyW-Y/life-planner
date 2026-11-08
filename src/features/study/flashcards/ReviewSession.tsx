import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Grade } from 'ts-fsrs'
import { db, save } from '../../../data/db'
import type { FlashCard, StudySession } from '../../../data/types'
import { previewIntervals, RATINGS } from '../../../lib/srs'
import { pupsReact } from '../../../lib/pupBus'
import { confetti } from '../../../lib/confetti'
import { toast } from '../../../lib/toast'
import { PomPals } from '../../pups/PomPals'
import { CardFace } from './CardFace'
import { buildQueue, descendants, recordReview } from './cardActions'

const ENCOURAGE = ['You got this 💪', 'One card at a time 🐾', 'Your future patients thank you 🩺', 'Brain getting stronger 🧠', 'So proud of you 💕']

export function ReviewSession() {
  const { id } = useParams()
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const deck = decks?.find((d) => d.id === id)
  const [queue, setQueue] = useState<FlashCard[] | null>(null)
  const [i, setI] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [stats, setStats] = useState({ done: 0, again: 0 })
  const undoRef = useRef<null | (() => Promise<void>)>(null)
  const started = useRef(Date.now())

  useEffect(() => {
    if (!decks) return
    void buildQueue(id ? descendants(decks, id) : null).then(setQueue)
    // build once per deck
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!decks])

  const card = queue?.[i]
  const finished = queue !== null && i >= queue.length

  // log study time once at the end
  useEffect(() => {
    if (!finished || !stats.done) return
    const mins = Math.round((Date.now() - started.current) / 60000)
    if (mins >= 1) void save<StudySession>('sessions', { technique: 'custom', subject: `Flashcards${deck ? ` · ${deck.name}` : ''}`, start: started.current, end: Date.now(), focusMins: mins })
    pupsReact('cheer', 4000)
    confetti()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const rate = useCallback(
    async (g: Grade) => {
      if (!card || !reveal) return
      const { srs, undo } = await recordReview(card, g)
      undoRef.current = async () => {
        await undo()
        setQueue((q) => (q ? q.filter((_, idx) => idx <= i || q[idx].id !== card.id) : q))
        setI((x) => Math.max(0, x - 1))
        setReveal(true)
        setStats((s) => ({ done: s.done - 1, again: s.again - (g === 1 ? 1 : 0) }))
      }
      setStats((s) => ({ done: s.done + 1, again: s.again + (g === 1 ? 1 : 0) }))
      // still learning (due within 20 min) → see it again later this session
      if (new Date(srs.due).getTime() - Date.now() < 20 * 60000) setQueue((q) => (q ? [...q, { ...card, srs }] : q))
      if (g >= 3) pupsReact('happy', 1200)
      setReveal(false)
      setI((x) => x + 1)
    },
    [card, reveal, i],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea')) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!reveal) setReveal(true)
        else void rate(3)
      } else if (reveal && ['1', '2', '3', '4'].includes(e.key)) void rate(+e.key as Grade)
      else if (e.key.toLowerCase() === 'z' && undoRef.current) {
        void undoRef.current()
        undoRef.current = null
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, rate])

  if (!queue) return <div className="card py-10 text-center text-muted">Shuffling your cards… 🃏</div>

  if (finished || !queue.length)
    return (
      <div className="card flex flex-col items-center gap-3 py-8 text-center">
        <PomPals />
        <div className="h1">{stats.done ? 'All done! 🎉' : 'Nothing due right now 🌸'}</div>
        {stats.done > 0 && (
          <div className="text-muted">
            You reviewed <b>{stats.done}</b> card{stats.done === 1 ? '' : 's'}
            {stats.again ? ` and re-learned ${stats.again}` : ''}. Rest is part of memorizing too 💤
          </div>
        )}
        <Link to="/study/cards" className="btn-primary">Back to decks</Link>
      </div>
    )

  const iv = previewIntervals(card!.srs)
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to={id ? `/study/cards/deck/${id}` : '/study/cards'} className="icon-btn" aria-label="Back">←</Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(i / queue.length) * 100}%` }} />
        </div>
        <span className="text-sm font-extrabold text-muted">{queue.length - i} left</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.button
          key={card!.id + i}
          initial={{ opacity: 0, y: 16, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, x: -40, rotate: -3 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          onClick={() => setReveal(true)}
          className="card min-h-72 w-full cursor-default !p-6 text-left"
        >
          <CardFace card={card!} reveal={reveal} />
        </motion.button>
      </AnimatePresence>

      {!reveal ? (
        <button className="btn-primary !min-h-14 text-lg" onClick={() => setReveal(true)}>Show answer <span className="text-xs opacity-70">(space)</span></button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.grade}
              onClick={() => rate(r.grade)}
              className="flex min-h-16 flex-col items-center justify-center rounded-3xl font-extrabold text-ink shadow-soft transition active:scale-95"
              style={{ background: `color-mix(in srgb, ${r.color} 55%, var(--surface))` }}
            >
              {r.label}
              <span className="text-xs font-bold opacity-70">{iv[r.grade]}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between text-xs font-bold text-muted">
        <span>{ENCOURAGE[i % ENCOURAGE.length]}</span>
        {undoRef.current && (
          <button
            className="chip !min-h-8"
            onClick={async () => {
              await undoRef.current?.()
              undoRef.current = null
              toast('Undid last answer', { emoji: '↩' })
            }}
          >
            ↩ Undo (Z)
          </button>
        )}
      </div>
    </div>
  )
}
