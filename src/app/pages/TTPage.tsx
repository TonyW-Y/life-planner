import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { db, remove, save } from '../../data/db'
import type { ChatMsg, Mood } from '../../data/types'
import { askAI } from '../../features/wellness/ttClient'
import { Breathing } from '../../features/wellness/Breathing'
import { PomPals } from '../../features/pups/PomPals'
import { AFFIRMATIONS, QUICK_PROMPTS, fallbackReply, isCrisis } from '../../lib/tt'
import { fmtD } from '../../lib/recurrence'
import { pupsReact } from '../../lib/pupBus'
import { useDraft } from '../../lib/useDraft'
import { useSetting } from '../../lib/useSetting'
import { toast } from '../../lib/toast'
import { Sheet } from '../../ui/Sheet'

export const MOODS = [
  { v: 1, e: '😢', l: 'Rough' },
  { v: 2, e: '😕', l: 'Meh' },
  { v: 3, e: '😐', l: 'Okay' },
  { v: 4, e: '🙂', l: 'Good' },
  { v: 5, e: '🥰', l: 'Great' },
] as const

const MOOD_REPLY: Record<number, string> = {
  1: "I'm sorry today is rough. 💛 I'm right here. Want to tell me about it, or try breathing together first?",
  2: "Meh days are valid. Want to talk about what's weighing on you, or should I tell you something nice?",
  3: "Okay is okay! 🌷 Anything on your mind?",
  4: "Yay, glad you're feeling good! 🐾 What's making today nice?",
  5: "Eee I love that for you!! 🥰 Tell me the good stuff!",
}

export async function checkInMood(v: 1 | 2 | 3 | 4 | 5) {
  await save<Mood>('moods', { date: fmtD(new Date()), at: Date.now(), mood: v })
  pupsReact(v <= 2 ? 'cuddle' : v >= 4 ? 'happy' : 'idle', v <= 2 ? 6000 : 2000)
}

/** Simple **bold** + line breaks, no HTML injection. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/).map((part, j) => (part.startsWith('**') ? <b key={j}>{part.slice(2, -2)}</b> : <span key={j}>{part}</span>))}
        </span>
      ))}
    </>
  )
}

export function TTPage() {
  const [params] = useSearchParams()
  const msgs = useLiveQuery(() => db.chats.orderBy('at').filter((m) => !m.deleted).toArray(), [], [] as ChatMsg[])
  const todayMood = useLiveQuery(() => db.moods.where('date').equals(fmtD(new Date())).filter((m) => !m.deleted).last(), [])
  const [name] = useSetting('userName', '')
  const { value: input, setValue: setInput, discard } = useDraft('tt:input', '')
  const [typing, setTyping] = useState(false)
  const [sheet, setSheet] = useState<null | 'breathe' | 'help'>(params.get('breathe') ? 'breathe' : null)
  const [aff, setAff] = useState(() => Math.floor(Math.random() * AFFIRMATIONS.length))
  const end = useRef<HTMLDivElement>(null)
  const anyCrisis = msgs.some((m) => m.crisis && Date.now() - m.at < 86400000)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [msgs.length, typing])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t) return
    setInput('')
    await discard()
    const crisis = isCrisis(t)
    const mine = await save<ChatMsg>('chats', { role: 'user', text: t, at: Date.now(), crisis })
    setTyping(true)
    let reply: string
    if (crisis) {
      // safety first: always the vetted response with real resources
      reply = fallbackReply(t).text
      pupsReact('cuddle', 15000)
      setSheet('help')
    } else {
      const history = [...msgs, mine]
      const ai = await askAI(history, { mood: todayMood?.mood, name: name || undefined })
      reply = ai ?? fallbackReply(t).text
      // small natural pause for the offline engine so it doesn't feel robotic
      if (!ai) await new Promise((r) => setTimeout(r, 600 + Math.random() * 600))
      if (/yay|amazing|proud|🎉/i.test(reply)) pupsReact('cheer')
    }
    await save<ChatMsg>('chats', { role: 'tt', text: reply, at: Date.now(), crisis })
    setTyping(false)
  }

  const greeting = name ? `Hi ${name}! 🧸` : 'Hi lovely! 🧸'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="h1 mr-auto">TT 🧸</h1>
        <button className="chip" onClick={() => setSheet('breathe')}>🌬️ Breathe with me</button>
        <button className="chip !border-warn" onClick={() => setSheet('help')}>🆘 Need help now?</button>
      </div>

      {/* mood check-in */}
      <div className="card flex flex-wrap items-center gap-3">
        <span className="font-extrabold">How are you feeling{todayMood ? ' now' : ' today'}?</span>
        <div className="flex gap-1">
          {MOODS.map((m) => (
            <button
              key={m.v}
              aria-label={m.l}
              title={m.l}
              onClick={async () => {
                await checkInMood(m.v)
                await save<ChatMsg>('chats', { role: 'tt', text: MOOD_REPLY[m.v], at: Date.now() })
              }}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition active:scale-90 ${todayMood?.mood === m.v ? 'bg-primary-soft ring-2 ring-primary' : 'bg-surface-2 hover:scale-110'}`}
            >
              {m.e}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* chat */}
        <div className="card flex min-h-[55dvh] flex-col !p-0">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: '60dvh' }}>
            <Bubble role="tt" text={`${greeting} I'm TT. I'm here to listen whenever you need — big feelings, small worries, or just a chat. What's on your mind?`} />
            {msgs.map((m) => (
              <Bubble key={m.id} role={m.role} text={m.text} crisis={m.crisis && m.role === 'tt'} />
            ))}
            <AnimatePresence>
              {typing && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 text-sm font-bold text-muted">
                  <span className="text-2xl">🧸</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span key={i} className="h-2 w-2 rounded-full bg-primary" animate={{ y: [0, -5, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }} />
                    ))}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={end} />
          </div>
          {msgs.length === 0 && (
            <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-2">
              {QUICK_PROMPTS.map((q) => (
                <button key={q} className="chip shrink-0" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <textarea
              className="input !min-h-12 max-h-32 resize-none !rounded-3xl"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              placeholder="Talk to TT…"
              aria-label="Message TT"
            />
            <button className="btn-primary !min-h-12 shrink-0" disabled={!input.trim() || typing}>Send</button>
          </form>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card flex flex-col items-center gap-2">
            <PomPals size={90} />
          </div>
          <button className="card text-left transition active:scale-[.98]" onClick={() => setAff((a) => (a + 1) % AFFIRMATIONS.length)}>
            <div className="mb-1 text-xs font-extrabold uppercase text-muted">A little reminder 💌</div>
            <div className="font-bold">{AFFIRMATIONS[aff]}</div>
            <div className="mt-1 text-xs text-muted">tap for another</div>
          </button>
          {anyCrisis && (
            <button className="card !bg-warn-soft text-left font-bold" onClick={() => setSheet('help')}>
              💛 Support is available any time — tap to see who you can reach right now.
            </button>
          )}
          {msgs.length > 0 && (
            <button
              className="btn-ghost text-sm"
              onClick={async () => {
                const ids = msgs.map((m) => m.id)
                for (const id of ids) await remove('chats', id)
                toast('Chat cleared', { emoji: '🧹', undo: async () => { for (const id of ids) await save('chats', { id, deleted: false }) } })
              }}
            >
              🧹 Clear chat
            </button>
          )}
          <p className="px-2 text-xs text-muted">
            TT is a caring companion, not a therapist or doctor. Your chats stay private to your account. If things feel heavy for a while, your school's counseling service is there for you too. 💛
          </p>
        </div>
      </div>

      <Sheet open={sheet === 'breathe'} onClose={() => setSheet(null)} title="Breathe with me 🌬️">
        <Breathing />
      </Sheet>
      <HelpSheet open={sheet === 'help'} onClose={() => setSheet(null)} />
    </div>
  )
}

function Bubble({ role, text, crisis }: { role: 'user' | 'tt'; text: string; crisis?: boolean }) {
  const me = role === 'user'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${me ? 'justify-end' : ''}`}>
      {!me && <span className="text-2xl">🧸</span>}
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-2.5 font-semibold leading-relaxed ${me ? 'rounded-br-lg bg-primary text-primary-ink' : crisis ? 'rounded-bl-lg border-2 border-warn bg-warn-soft' : 'rounded-bl-lg bg-surface-2'}`}>
        <Rich text={text} />
      </div>
    </motion.div>
  )
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [counselor, setCounselor] = useSetting('counselorContact', '')
  return (
    <Sheet open={open} onClose={onClose} title="You don't have to go through this alone 💛">
      <div className="flex flex-col gap-3 pb-2">
        <a href="tel:988" className="btn-primary !justify-start">📞 Call 988 — Suicide & Crisis Lifeline</a>
        <a href="sms:988" className="btn-soft !justify-start">💬 Text 988</a>
        <a href="sms:741741&body=HOME" className="btn-soft !justify-start">💬 Text HOME to 741741 — Crisis Text Line</a>
        <a href="tel:911" className="btn-soft !justify-start">🚑 Call 911 if you're in immediate danger</a>
        <div className="rounded-2xl bg-surface-2 p-3">
          <div className="label">Your school counseling / wellness contact</div>
          <input className="input" value={counselor} onChange={(e) => setCounselor(e.target.value)} placeholder="e.g. Student Wellness 555-123-4567" />
          {/^[\d\s()+-]{7,}$/.test(counselor.replace(/^[^\d+]*/, '')) && (
            <a className="mt-2 inline-block font-bold text-primary underline" href={`tel:${counselor.replace(/[^\d+]/g, '')}`}>Call them</a>
          )}
        </div>
        <p className="text-sm text-muted">All of these are free and confidential, 24/7 (US). Outside the US, find a local line at findahelpline.com.</p>
      </div>
    </Sheet>
  )
}
