import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { db, setSetting } from '../../data/db'
import { createEvent, createTask } from '../../data/actions'
import { parseQuickAdd } from '../../lib/quickAdd'
import { fmtD, fmtDT } from '../../lib/recurrence'
import { toast } from '../../lib/toast'
import { startTimer } from '../study/useTimer'

interface Item {
  id: string
  icon: string
  label: string
  hint?: string
  run: () => void | Promise<void>
}

/** ⌘K / Ctrl+K (or the 🔍 button): search everything, jump anywhere, or add something. */
export function CommandBar() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const nav = useNavigate()
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === '/' && !(e.target as HTMLElement)?.closest('input,textarea,select')) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('cozy:command', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('cozy:command', onOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => input.current?.focus(), 30)
    }
  }, [open])

  const data = useLiveQuery(
    async () =>
      open
        ? {
            tasks: await db.tasks.filter((t) => !t.deleted && !t.done).toArray(),
            events: await db.events.filter((e) => !e.deleted).toArray(),
            decks: await db.decks.filter((d) => !d.deleted).toArray(),
            cards: await db.cards.filter((c) => !c.deleted).limit(3000).toArray(),
          }
        : null,
    [open],
  )

  const go = (path: string) => () => nav(path)
  const items = useMemo<Item[]>(() => {
    const s = q.trim().toLowerCase()
    const actions: Item[] = [
      { id: 'a-home', icon: '🏡', label: 'Home', run: go('/') },
      { id: 'a-today', icon: '📅', label: 'Today on the calendar', run: go(`/calendar?v=day&d=${fmtD(new Date())}`) },
      { id: 'a-week', icon: '🗓️', label: 'This week', run: go('/calendar?v=week') },
      { id: 'a-tasks', icon: '✅', label: 'To-do list', run: go('/tasks') },
      { id: 'a-timer', icon: '🍅', label: 'Start a Pomodoro', run: async () => { nav('/study/timer'); await startTimer() } },
      { id: 'a-review', icon: '🃏', label: 'Review flashcards', run: go('/study/cards/review') },
      { id: 'a-plan', icon: '🗺️', label: 'Exam plan', run: go('/study/plan') },
      { id: 'a-stats', icon: '🌱', label: 'Study progress', run: go('/study/stats') },
      { id: 'a-budget', icon: '⏳', label: 'How much time do I have? (My Time)', run: go('/budget') },
      { id: 'a-tt', icon: '🧸', label: 'Talk to TT', run: go('/tt') },
      { id: 'a-breathe', icon: '🌬️', label: 'Breathe with me', run: go('/tt?breathe=1') },
      { id: 'a-settings', icon: '⚙️', label: 'Settings', run: go('/settings') },
      ...(['light', 'dark', 'brown', 'joey'] as const).map((t) => ({
        id: `theme-${t}`,
        icon: t === 'joey' ? '🎀' : t === 'dark' ? '🌙' : t === 'brown' ? '🧋' : '☀️',
        label: `Theme: ${t === 'joey' ? 'Joey Mode' : t[0].toUpperCase() + t.slice(1)}`,
        run: () => setSetting('theme', t),
      })),
    ]
    if (!s) return actions.slice(0, 10)
    const out: Item[] = []
    const parsed = parseQuickAdd(q)
    out.push({
      id: 'add-task',
      icon: '➕',
      label: `Add to-do “${parsed.title}”`,
      hint: parsed.start ? format(parsed.start, 'EEE MMM d') : undefined,
      run: async () => {
        await createTask({ title: parsed.title, due: parsed.start ? fmtD(parsed.start) : null, priority: parsed.priority ?? 'should', tags: parsed.tags, repeat: parsed.repeat })
        toast(`Added “${parsed.title}”`, { emoji: '✅' })
      },
    })
    if (parsed.start && parsed.hasTime)
      out.unshift({
        id: 'add-event',
        icon: '📅',
        label: `Add event “${parsed.title}”`,
        hint: format(parsed.start, 'EEE h:mm a'),
        run: async () => {
          await createEvent({ title: parsed.title, start: fmtDT(parsed.start!), end: fmtDT(parsed.end ?? new Date(parsed.start!.getTime() + 3600000)), category: parsed.category, repeat: parsed.repeat, reminderMins: 15 })
          toast(`Added “${parsed.title}”`, { emoji: '📅' })
        },
      })
    out.push(...actions.filter((a) => a.label.toLowerCase().includes(s)))
    if (data) {
      for (const t of data.tasks.filter((t) => t.title.toLowerCase().includes(s)).slice(0, 5))
        out.push({ id: 't' + t.id, icon: '✅', label: t.title, hint: t.due ? format(parseISO(t.due), 'MMM d') : 'to-do', run: go('/tasks') })
      for (const e of data.events.filter((e) => e.title.toLowerCase().includes(s)).slice(0, 5))
        out.push({ id: 'e' + e.id, icon: e.emoji || '📅', label: e.title, hint: format(parseISO(e.start), 'MMM d, h:mm a'), run: go(`/calendar?v=day&d=${e.start.slice(0, 10)}`) })
      for (const d of data.decks.filter((d) => d.name.toLowerCase().includes(s)).slice(0, 3))
        out.push({ id: 'd' + d.id, icon: d.emoji || '📚', label: d.name, hint: 'deck', run: go(`/study/cards/deck/${d.id}`) })
      for (const c of data.cards.filter((c) => (c.front + ' ' + c.back).toLowerCase().includes(s)).slice(0, 5))
        out.push({ id: 'c' + c.id, icon: '🃏', label: c.front.replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, '$1') || 'Image card', hint: 'card', run: go(`/study/cards/deck/${c.deckId}`) })
    }
    return out
  }, [q, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async (it: Item) => {
    setOpen(false)
    await it.run()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/25 p-4 pt-[12vh] backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <motion.div initial={{ y: -10, scale: 0.97 }} animate={{ y: 0, scale: 1 }} className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-line bg-surface shadow-soft" role="dialog" aria-label="Search and commands">
            <input
              ref={input}
              className="w-full border-b border-line bg-transparent px-5 py-4 text-lg font-bold outline-none"
              placeholder="Search, jump, or add… (e.g. “pharm quiz friday 2pm”)"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setSel(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setSel((x) => Math.min(items.length - 1, x + 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setSel((x) => Math.max(0, x - 1))
                } else if (e.key === 'Enter' && items[sel]) {
                  e.preventDefault()
                  void choose(items[sel])
                } else if (e.key === 'Escape') setOpen(false)
              }}
            />
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {items.map((it, i) => (
                <button
                  key={it.id}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => choose(it)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-bold ${i === sel ? 'bg-primary-soft' : ''}`}
                >
                  <span className="text-xl">{it.icon}</span>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {it.hint && <span className="shrink-0 text-xs text-muted">{it.hint}</span>}
                </button>
              ))}
            </div>
            <div className="border-t border-line px-4 py-2 text-xs font-semibold text-muted">↑↓ to move · Enter to choose · Esc to close</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
