import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { usePups, type PupMood } from '../../lib/pupBus'
import { useSetting, type ThemeName } from '../../lib/useSetting'
import { Pom } from './Pom'

export interface PupNames {
  brown: string
  white: string
}
export const DEFAULT_PUP_NAMES: PupNames = { brown: 'Coco', white: 'Teddy' }

const SPEECH: Record<PupMood, string[]> = {
  idle: ['we believe in you!', 'snack break soon?', "you're doing amazing", 'drink some water 💧', 'proud of you'],
  happy: ['yay!!', 'woohoo!', 'you did it!', '🐾🐾'],
  cheer: ['SO proud!!', 'superstar ✨', 'best human ever'],
  sleepy: ['shh… focusing', 'zzz…', "we'll nap while you study"],
  stretch: ['stretch with us!', 'big stretchhh', 'wiggle break!'],
  cuddle: ["we're right here", 'cuddle time 🤎', "it's okay to rest"],
}

interface Props {
  size?: number
  speech?: boolean
  compact?: boolean
}

export function PomPals({ size = 110, speech = true, compact = false }: Props) {
  const { mood, pet } = usePups()
  const [names] = useSetting<PupNames>('pupNames', DEFAULT_PUP_NAMES)
  const [theme] = useSetting<ThemeName>('theme', 'light')
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  const [line, setLine] = useState<string | null>(null)
  const [idleTwist, setIdleTwist] = useState<{ brown: PupMood; white: PupMood }>({ brown: 'idle', white: 'idle' })

  // occasional naps / zoomies while idle
  useEffect(() => {
    if (mood !== 'idle') return
    const t = setInterval(() => {
      const r = Math.random()
      if (r < 0.25) setIdleTwist({ brown: 'sleepy', white: 'idle' })
      else if (r < 0.4) setIdleTwist({ brown: 'idle', white: 'happy' })
      else setIdleTwist({ brown: 'idle', white: 'idle' })
    }, 9000)
    return () => clearInterval(t)
  }, [mood])

  useEffect(() => {
    if (!speech) return
    const opts = SPEECH[mood]
    setLine(opts[Math.floor(Math.random() * opts.length)])
    const t = setTimeout(() => setLine(null), 3500)
    return () => clearTimeout(t)
  }, [mood, speech])

  const doPet = (which: 'brown' | 'white') => {
    pet()
    const id = Date.now() + Math.random()
    setHearts((h) => [...h, { id, x: which === 'brown' ? 25 : 70 }])
    setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 1100)
    if (speech) setLine(`${which === 'brown' ? names.brown : names.white} loves you 💕`)
  }

  const brownMood = mood === 'idle' ? idleTwist.brown : mood
  const whiteMood = mood === 'idle' ? idleTwist.white : mood
  const lean = mood === 'cuddle' ? 10 : 0
  const s = compact ? size * 0.6 : size

  return (
    <div className="relative inline-flex flex-col items-center">
      <AnimatePresence>
        {line && speech && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-1 rounded-2xl border border-line bg-surface px-3 py-1 text-sm font-bold shadow-soft"
          >
            {line}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative flex items-end">
        <motion.div animate={{ x: lean }} transition={{ type: 'spring', stiffness: 120 }}>
          <Pom color="brown" mood={brownMood} bow={theme === 'joey'} size={s} onPet={() => doPet('brown')} name={names.brown} />
        </motion.div>
        <motion.div animate={{ x: -lean }} transition={{ type: 'spring', stiffness: 120 }} className="-ml-4">
          <Pom color="white" mood={whiteMood} bow={theme === 'joey'} flip size={s * 0.95} onPet={() => doPet('white')} name={names.white} />
        </motion.div>
        {hearts.map((h) => (
          <span
            key={h.id}
            className="pointer-events-none absolute top-2 text-xl"
            style={{ left: `${h.x}%`, animation: 'float-up 1.1s ease-out forwards' }}
          >
            {theme === 'joey' ? '💗' : '❤️'}
          </span>
        ))}
      </div>
      {!compact && (
        <div className="mt-1 flex gap-6 text-xs font-bold text-muted">
          <span>{names.brown}</span>
          <span>{names.white}</span>
        </div>
      )}
    </div>
  )
}
