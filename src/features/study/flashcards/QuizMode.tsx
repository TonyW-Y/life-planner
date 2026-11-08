import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { db } from '../../../data/db'
import { pupsReact } from '../../../lib/pupBus'
import { confetti } from '../../../lib/confetti'
import { descendants } from './cardActions'

interface Q {
  q: string
  answer: string
  options: string[]
}

const shuffle = <T,>(a: T[]) => {
  const x = [...a]
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[x[i], x[j]] = [x[j], x[i]]
  }
  return x
}

/** Multiple choice from her own cards — active recall without touching the review schedule. */
export function QuizMode() {
  const { id } = useParams()
  const data = useLiveQuery(async () => {
    const decks = await db.decks.toArray()
    const ids = descendants(decks, id!)
    const cards = await db.cards.filter((c) => !c.deleted && ids.includes(c.deckId) && (c.type === 'basic' || c.type === 'reversed') && c.sub === 0).toArray()
    return { deck: decks.find((d) => d.id === id), cards }
  }, [id])
  const [seed, setSeed] = useState(0)
  const questions = useMemo<Q[]>(() => {
    if (!data) return []
    const backs = [...new Set(data.cards.map((c) => c.back.trim()))]
    return shuffle(data.cards)
      .slice(0, 10)
      .map((c) => ({ q: c.front, answer: c.back.trim(), options: shuffle([c.back.trim(), ...shuffle(backs.filter((b) => b !== c.back.trim())).slice(0, 3)]) }))
  }, [data, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [score, setScore] = useState(0)

  if (!data) return null
  if (questions.length < 2) return <div className="card text-center">Add at least 4 basic cards to this deck to make a quiz 🐾</div>
  if (i >= questions.length)
    return (
      <div className="card flex flex-col items-center gap-3 py-10 text-center">
        <div className="text-6xl">{score / questions.length >= 0.8 ? '🏆' : score / questions.length >= 0.5 ? '🌟' : '🌱'}</div>
        <div className="h1">{score} / {questions.length}</div>
        <div className="text-muted">{score / questions.length >= 0.8 ? 'Amazing!!' : 'Every miss is a memory getting stronger.'}</div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => { setSeed(seed + 1); setI(0); setScore(0); setPicked(null) }}>Again</button>
          <Link to={`/study/cards/deck/${id}`} className="btn-soft">Back to deck</Link>
        </div>
      </div>
    )
  const q = questions[i]
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between font-bold text-muted">
        <Link to={`/study/cards/deck/${id}`}>← {data.deck?.name}</Link>
        <span>🎯 {i + 1} / {questions.length} · {score} right</span>
      </div>
      <div className="card min-h-32 whitespace-pre-wrap !p-6 text-center text-xl font-bold">{q.q}</div>
      <div className="grid gap-2">
        {q.options.map((o) => {
          const state = picked ? (o === q.answer ? 'right' : o === picked ? 'wrong' : 'idle') : 'idle'
          return (
            <button
              key={o}
              disabled={!!picked}
              onClick={() => {
                setPicked(o)
                if (o === q.answer) {
                  setScore(score + 1)
                  pupsReact('happy', 1200)
                  if (i === questions.length - 1) confetti()
                }
              }}
              className={`min-h-14 whitespace-pre-wrap rounded-3xl border-2 p-3 text-left font-bold transition ${state === 'right' ? 'border-accent bg-accent-soft' : state === 'wrong' ? 'border-warn bg-warn-soft' : 'border-line bg-surface hover:border-primary'}`}
            >
              {state === 'right' ? '✅ ' : state === 'wrong' ? '💛 ' : ''}
              {o}
            </button>
          )
        })}
      </div>
      {picked && (
        <button className="btn-primary" onClick={() => { setI(i + 1); setPicked(null) }}>
          {i === questions.length - 1 ? 'See score' : 'Next →'}
        </button>
      )}
    </div>
  )
}
