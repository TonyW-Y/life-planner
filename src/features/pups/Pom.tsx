import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import type { PupMood } from '../../lib/pupBus'

export type PomColor = 'brown' | 'white'

const PALETTE: Record<PomColor, { fur: string; fur2: string; face: string; ear: string; ink: string }> = {
  brown: { fur: '#d68d52', fur2: '#c47a40', face: '#efb47c', ear: '#b86d36', ink: '#3b2418' },
  white: { fur: '#fbf7f2', fur2: '#ece4da', face: '#ffffff', ear: '#efd9cf', ink: '#3b2a26' },
}

// Points around a circle, used to make fluffy outlines out of little puffs.
function puffs(cx: number, cy: number, r: number, n: number, pr: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r: pr }
  })
}

interface Props {
  color: PomColor
  mood: PupMood
  bow?: boolean
  flip?: boolean
  size?: number
  onPet?: () => void
  name?: string
}

export function Pom({ color, mood, bow, flip, size = 120, onPet, name }: Props) {
  const c = PALETTE[color]
  const [blink, setBlink] = useState(false)

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true)
        setTimeout(() => setBlink(false), 160)
        loop()
      }, 2500 + Math.random() * 3500)
    }
    loop()
    return () => clearTimeout(t)
  }, [])

  const sleepy = mood === 'sleepy'
  const happy = mood === 'happy' || mood === 'cheer'
  const eyesClosed = sleepy || blink

  const bodyAnim =
    mood === 'cheer'
      ? { y: [0, -26, 0, -14, 0], rotate: [0, -8, 8, -4, 0] }
      : happy
        ? { y: [0, -10, 0, -6, 0] }
        : mood === 'stretch'
          ? { scaleX: [1, 1.12, 1], scaleY: [1, 0.9, 1], y: [0, 6, 0] }
          : sleepy
            ? { scaleY: [1, 0.96, 1], y: [4, 6, 4] }
            : { scaleY: [1, 0.975, 1] }

  const bodyTransition =
    mood === 'idle' || sleepy
      ? { duration: sleepy ? 4 : 3, repeat: Infinity, ease: 'easeInOut' as const }
      : { duration: mood === 'stretch' ? 2 : 0.9, ease: 'easeOut' as const }

  const tailSpeed = happy ? 0.25 : sleepy ? 3 : 0.9

  return (
    <motion.button
      type="button"
      aria-label={name ? `Pet ${name}` : 'Pet the pup'}
      onClick={onPet}
      className="relative select-none rounded-full outline-none"
      style={{ width: size, height: size * 0.92, transform: flip ? 'scaleX(-1)' : undefined }}
      whileTap={{ scale: 0.92 }}
    >
      <motion.svg
        viewBox="0 0 120 110"
        width={size}
        height={size * 0.92}
        animate={bodyAnim}
        transition={bodyTransition}
        key={mood}
        style={{ originY: 1, overflow: 'visible', filter: color === 'white' ? 'drop-shadow(0 0 1.2px rgba(120,90,70,.45))' : 'drop-shadow(0 0 1px rgba(90,50,20,.25))' }}
      >
        {/* shadow */}
        <ellipse cx="60" cy="104" rx="38" ry="5" fill="#000" opacity="0.08" />

        {/* tail */}
        <motion.g
          style={{ originX: '88px', originY: '72px' }}
          animate={{ rotate: [-12, 14, -12] }}
          transition={{ duration: tailSpeed, repeat: Infinity, ease: 'easeInOut' }}
        >
          {puffs(98, 58, 9, 7, 8).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={i % 2 ? c.fur2 : c.fur} />
          ))}
          <circle cx="98" cy="58" r="10" fill={c.fur} />
        </motion.g>

        {/* body */}
        {puffs(60, 82, 24, 12, 11).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={i % 3 ? c.fur : c.fur2} />
        ))}
        <ellipse cx="60" cy="84" rx="28" ry="20" fill={c.fur} />
        {/* paws */}
        <ellipse cx="46" cy="101" rx="8" ry="5" fill={c.face} />
        <ellipse cx="74" cy="101" rx="8" ry="5" fill={c.face} />

        {/* ears */}
        <path d="M33 28 L36 6 L52 22Z" fill={c.fur2} />
        <path d="M87 28 L84 6 L68 22Z" fill={c.fur2} />
        <path d="M37 24 L38 12 L47 21Z" fill={c.ear} />
        <path d="M83 24 L82 12 L73 21Z" fill={c.ear} />

        {/* mane */}
        {puffs(60, 44, 28, 16, 10).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={i % 2 ? c.fur : c.fur2} />
        ))}
        <circle cx="60" cy="44" r="29" fill={c.fur} />
        {/* face */}
        <ellipse cx="60" cy="48" rx="21" ry="18" fill={c.face} />

        {/* eyes */}
        {eyesClosed || happy ? (
          <g stroke={c.ink} strokeWidth="2.6" strokeLinecap="round" fill="none">
            {happy && !sleepy ? (
              <>
                <path d="M46 44 Q50 39 54 44" />
                <path d="M66 44 Q70 39 74 44" />
              </>
            ) : (
              <>
                <path d="M46 43 Q50 47 54 43" />
                <path d="M66 43 Q70 47 74 43" />
              </>
            )}
          </g>
        ) : (
          <g>
            <circle cx="50" cy="43" r="4.2" fill={c.ink} />
            <circle cx="70" cy="43" r="4.2" fill={c.ink} />
            <circle cx="51.5" cy="41.5" r="1.5" fill="#fff" />
            <circle cx="71.5" cy="41.5" r="1.5" fill="#fff" />
          </g>
        )}

        {/* blush */}
        <ellipse cx="42" cy="53" rx="5" ry="3" fill="#f6a2b5" opacity="0.6" />
        <ellipse cx="78" cy="53" rx="5" ry="3" fill="#f6a2b5" opacity="0.6" />

        {/* nose + mouth */}
        <ellipse cx="60" cy="51" rx="3.6" ry="2.6" fill={c.ink} />
        <path d="M55 55 Q57.5 58 60 55 Q62.5 58 65 55" stroke={c.ink} strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {happy && <path d="M57.5 57 Q60 64 62.5 57Z" fill="#f47c96" />}

        {/* bow (Joey mode) */}
        {bow && (
          <g transform="translate(78 18) rotate(18)">
            <path d="M0 0 L-11 -7 L-11 7Z" fill="#ff86b0" />
            <path d="M0 0 L11 -7 L11 7Z" fill="#ff86b0" />
            <circle r="3.2" fill="#ff5c95" />
          </g>
        )}
      </motion.svg>

      {/* Zzz */}
      {sleepy && (
        <motion.span
          className="pointer-events-none absolute -top-2 right-1 text-sm font-extrabold text-muted"
          style={{ transform: flip ? 'scaleX(-1)' : undefined }}
          animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          z<sup>z</sup>
        </motion.span>
      )}
    </motion.button>
  )
}
