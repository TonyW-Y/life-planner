import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../data/db'
import type { FlashCard, Mask } from '../../../data/types'
import { renderCloze } from '../../../lib/cards'

export function useMedia(id?: string) {
  return useLiveQuery(async () => (id ? (await db.media.get(id))?.data : undefined), [id])
}

export function OcclusionImage({ src, masks, target, reveal, onMaskClick, selected }: { src: string; masks: Mask[]; target?: number; reveal?: boolean; onMaskClick?: (i: number) => void; selected?: number | null }) {
  return (
    <div className="relative mx-auto w-full max-w-xl select-none">
      <img src={src} alt="" className="w-full rounded-2xl" draggable={false} />
      {masks.map((m, i) => {
        const isTarget = i === target
        if (isTarget && reveal) {
          return <div key={m.id} className="absolute rounded-md border-[3px] border-accent" style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }} />
        }
        return (
          <div
            key={m.id}
            onClick={onMaskClick ? (e) => { e.stopPropagation(); onMaskClick(i) } : undefined}
            className={`absolute flex items-center justify-center rounded-md text-sm font-extrabold ${onMaskClick ? 'cursor-pointer' : ''}`}
            style={{
              left: `${m.x}%`,
              top: `${m.y}%`,
              width: `${m.w}%`,
              height: `${m.h}%`,
              background: isTarget || selected === i ? 'var(--primary)' : target === undefined ? 'color-mix(in srgb, var(--primary) 70%, white)' : '#f3e6d9',
              border: selected === i ? '3px solid var(--text)' : '2px solid rgba(255,255,255,.8)',
              color: 'white',
            }}
          >
            {isTarget ? '?' : onMaskClick ? (m.label || i + 1) : ''}
          </div>
        )
      })}
    </div>
  )
}

/** The question or answer side of any card type. */
export function CardFace({ card, reveal }: { card: FlashCard; reveal: boolean }) {
  const img = useMedia(card.image)
  if (card.type === 'cloze') {
    return (
      <div className="flex flex-col gap-4">
        <p className="whitespace-pre-wrap text-center text-xl font-bold leading-relaxed">
          {renderCloze(card.front, card.sub, reveal).map((s, i) => (
            <span key={i} className={s.kind === 'blank' ? 'rounded-lg bg-primary-soft px-2 text-primary' : s.kind === 'answer' ? 'rounded-lg bg-accent-soft px-1 text-ink underline decoration-accent decoration-4' : ''}>
              {s.text}
            </span>
          ))}
        </p>
        {img && <img src={img} alt="" className="mx-auto max-h-72 rounded-2xl" />}
        {reveal && card.back && <p className="whitespace-pre-wrap border-t-2 border-dashed border-line pt-3 text-center text-muted">{card.back}</p>}
      </div>
    )
  }
  if (card.type === 'occlusion') {
    const m = card.masks?.[card.sub]
    return (
      <div className="flex flex-col gap-3">
        {card.front && <p className="text-center font-bold">{card.front}</p>}
        {img ? <OcclusionImage src={img} masks={card.masks ?? []} target={card.sub} reveal={reveal} /> : <p className="text-center text-muted">Loading image…</p>}
        {reveal && m?.label && <p className="text-center text-2xl font-extrabold">{m.label}</p>}
        {reveal && card.back && <p className="text-center text-muted">{card.back}</p>}
      </div>
    )
  }
  const reversed = card.type === 'reversed' && card.sub === 1
  const q = reversed ? card.back : card.front
  const a = reversed ? card.front : card.back
  return (
    <div className="flex flex-col gap-4">
      <p className="whitespace-pre-wrap text-center text-xl font-bold leading-relaxed">{q}</p>
      {img && !reversed && <img src={img} alt="" className="mx-auto max-h-72 rounded-2xl" />}
      {reveal && (
        <>
          <div className="border-t-2 border-dashed border-line" />
          <p className="whitespace-pre-wrap text-center text-lg">{a}</p>
          {img && reversed && <img src={img} alt="" className="mx-auto max-h-72 rounded-2xl" />}
        </>
      )}
    </div>
  )
}
