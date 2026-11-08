import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Segmented } from '../../ui/Segmented'

const PATTERNS = {
  box: { name: 'Box 4-4-4-4', steps: [['Breathe in', 4, 1], ['Hold', 4, 1], ['Breathe out', 4, 0.55], ['Hold', 4, 0.55]] },
  '478': { name: '4-7-8 (sleepy)', steps: [['Breathe in', 4, 1], ['Hold', 7, 1], ['Breathe out', 8, 0.55]] },
  calm: { name: 'Calm 4-6', steps: [['Breathe in', 4, 1], ['Breathe out', 6, 0.55]] },
} as const
type P = keyof typeof PATTERNS

/** A soft bubble that grows and shrinks to pace your breathing. */
export function Breathing() {
  const [p, setP] = useState<P>('box')
  const [running, setRunning] = useState(false)
  const [i, setI] = useState(0)
  const [left, setLeft] = useState(0)
  const [rounds, setRounds] = useState(0)
  const steps = PATTERNS[p].steps
  const [label, secs, scale] = steps[i % steps.length]

  useEffect(() => {
    if (!running) return
    setLeft(secs)
    const tick = setInterval(() => setLeft((l) => l - 1), 1000)
    const next = setTimeout(() => {
      setI((x) => {
        if ((x + 1) % steps.length === 0) setRounds((r) => r + 1)
        return x + 1
      })
    }, secs * 1000)
    return () => {
      clearInterval(tick)
      clearTimeout(next)
    }
  }, [running, i, secs, steps.length])

  return (
    <div className="flex flex-col items-center gap-4">
      <Segmented size="sm" value={p} onChange={(v) => { setP(v); setI(0); setRounds(0) }} options={(Object.keys(PATTERNS) as P[]).map((k) => ({ id: k, label: PATTERNS[k].name }))} />
      <div className="relative flex h-64 w-64 items-center justify-center">
        <motion.div
          className="absolute h-56 w-56 rounded-full"
          style={{ background: 'radial-gradient(circle at 35% 30%, var(--surface), var(--primary-soft) 45%, var(--primary))', boxShadow: 'var(--shadow)' }}
          animate={{ scale: running ? scale : 0.7 }}
          transition={{ duration: running ? secs : 0.8, ease: 'easeInOut' }}
        />
        <div className="relative text-center">
          <div className="text-2xl font-extrabold">{running ? label : 'Ready?'}</div>
          {running && <div className="text-4xl font-extrabold tabular-nums">{Math.max(1, left)}</div>}
        </div>
      </div>
      <div className="text-sm font-bold text-muted">{rounds > 0 ? `${rounds} round${rounds === 1 ? '' : 's'} · ${rounds >= 4 ? 'beautiful 🌷' : 'keep going'}` : 'Follow the bubble — in as it grows, out as it shrinks'}</div>
      <button className={running ? 'btn-soft' : 'btn-primary'} onClick={() => { setRunning(!running); setI(0) }}>
        {running ? 'Stop' : 'Start breathing'}
      </button>
    </div>
  )
}
