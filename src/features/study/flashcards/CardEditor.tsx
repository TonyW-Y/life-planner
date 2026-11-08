import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import { db, uid } from '../../../data/db'
import type { CardType, Deck, Mask } from '../../../data/types'
import { clozeNumbers } from '../../../lib/cards'
import { compressImage } from '../../../lib/image'
import { useDraft } from '../../../lib/useDraft'
import { toast } from '../../../lib/toast'
import { Sheet } from '../../../ui/Sheet'
import { Segmented } from '../../../ui/Segmented'
import { OcclusionImage, useMedia } from './CardFace'
import { saveImage, saveNote } from './cardActions'

interface Form {
  deckId: string
  type: CardType
  front: string
  back: string
  image?: string
  masks: Mask[]
}

export type CardEditorTarget = { deckId: string; noteId?: string } | null

export function CardEditor({ target, onClose }: { target: CardEditorTarget; onClose: () => void }) {
  if (!target) return null
  return <Inner key={target.noteId ?? `new:${target.deckId}`} target={target} onClose={onClose} />
}

function Inner({ target, onClose }: { target: Exclude<CardEditorTarget, null>; onClose: () => void }) {
  const decks = useLiveQuery(() => db.decks.filter((d) => !d.deleted).toArray(), [], [] as Deck[])
  const existing = useLiveQuery(async () => (target.noteId ? (await db.cards.where('noteId').equals(target.noteId).filter((c) => !c.deleted).toArray())[0] ?? null : null), [target.noteId])
  const blank: Form = { deckId: target.deckId, type: 'basic', front: '', back: '', masks: [] }
  const { value: f, setValue, discard, restored } = useDraft<Form>(`card:${target.noteId ?? 'new:' + target.deckId}`, blank)
  const [loadedExisting, setLoadedExisting] = useState(false)
  const frontRef = useRef<HTMLTextAreaElement>(null)
  const set = (p: Partial<Form>) => setValue((prev) => ({ ...prev, ...p }))

  // load the card being edited (only if there's no newer unsaved draft)
  useEffect(() => {
    if (existing && restored && !loadedExisting) {
      setLoadedExisting(true)
      if (!f.front && !f.masks.length) setValue({ deckId: existing.deckId, type: existing.type, front: existing.front, back: existing.back, image: existing.image, masks: existing.masks ?? [] })
    }
  }, [existing, restored, loadedExisting, f.front, f.masks.length, setValue])

  const valid =
    f.type === 'occlusion' ? !!f.image && f.masks.length > 0 : f.type === 'cloze' ? clozeNumbers(f.front).length > 0 : f.front.trim() && f.back.trim()

  const submit = async (again: boolean) => {
    if (!valid) return
    const { count } = await saveNote(f.deckId, target.noteId ?? null, f)
    toast(target.noteId ? 'Card updated ✨' : `Added ${count} card${count === 1 ? '' : 's'} 🃏`, { emoji: '🐾' })
    await discard()
    if (again && !target.noteId) {
      setValue({ ...blank, deckId: f.deckId, type: f.type })
      frontRef.current?.focus()
    } else onClose()
  }

  const makeCloze = () => {
    const el = frontRef.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value } = el
    if (a === b) return toast('Select the words to hide first', { emoji: '👆' })
    const n = Math.max(0, ...clozeNumbers(value)) + 1
    set({ front: `${value.slice(0, a)}{{c${n}::${value.slice(a, b)}}}${value.slice(b)}` })
  }

  const pickImage = async (file?: File) => {
    if (!file) return
    const data = await compressImage(file)
    set({ image: await saveImage(data) })
  }

  return (
    <Sheet
      open
      wide={f.type === 'occlusion'}
      onClose={onClose}
      title={target.noteId ? 'Edit card' : 'New card'}
      footer={
        <>
          {!target.noteId && (
            <button className="btn-soft" disabled={!valid} onClick={() => submit(true)}>
              Save & add another
            </button>
          )}
          <button className="btn-primary ml-auto" disabled={!valid} onClick={() => submit(false)}>
            {target.noteId ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={f.type}
            onChange={(type) => set({ type })}
            options={[
              { id: 'basic', label: 'Basic' },
              { id: 'reversed', label: '↔ Both ways' },
              { id: 'cloze', label: 'Fill-in' },
              { id: 'occlusion', label: '🖼️ Image' },
            ]}
          />
          <select className="input !min-h-9 !w-auto" value={f.deckId} onChange={(e) => set({ deckId: e.target.value })} aria-label="Deck">
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.emoji} {d.name}
              </option>
            ))}
          </select>
        </div>

        {f.type === 'occlusion' ? (
          <OcclusionMaker form={f} set={set} pickImage={pickImage} />
        ) : (
          <>
            <label>
              <span className="label">{f.type === 'cloze' ? 'Text — select words and tap “Hide”' : 'Front (question)'}</span>
              <textarea
                ref={frontRef}
                autoFocus
                className="input min-h-28 text-lg"
                value={f.front}
                onChange={(e) => set({ front: e.target.value })}
                placeholder={f.type === 'cloze' ? 'e.g. Aspirin irreversibly inhibits COX-1 and COX-2' : 'e.g. First-line treatment for status epilepticus?'}
              />
            </label>
            {f.type === 'cloze' && (
              <div className="-mt-2 flex flex-wrap items-center gap-2">
                <button type="button" className="btn-soft !min-h-9" onClick={makeCloze}>🙈 Hide selected words</button>
                <span className="text-xs font-semibold text-muted">
                  {clozeNumbers(f.front).length ? `${clozeNumbers(f.front).length} card(s) will be made` : 'or type {{c1::answer}}'}
                </span>
              </div>
            )}
            <label>
              <span className="label">{f.type === 'cloze' ? 'Extra (optional)' : 'Back (answer)'}</span>
              <textarea className="input min-h-24" value={f.back} onChange={(e) => set({ back: e.target.value })} placeholder={f.type === 'cloze' ? 'Mnemonic, source, page…' : 'e.g. IV lorazepam'} />
            </label>
            <ImageAttach id={f.image} onPick={pickImage} onClear={() => set({ image: undefined })} />
          </>
        )}
        <p className="text-center text-xs font-semibold text-muted">✓ Draft saved as you type</p>
      </div>
    </Sheet>
  )
}

function ImageAttach({ id, onPick, onClear }: { id?: string; onPick: (f?: File) => void; onClear: () => void }) {
  const src = useMedia(id)
  return (
    <div className="flex items-center gap-3">
      {src ? (
        <>
          <img src={src} alt="" className="h-16 rounded-xl" />
          <button className="chip" onClick={onClear}>Remove image</button>
        </>
      ) : (
        <label className="chip cursor-pointer">
          🖼️ Add an image
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
        </label>
      )}
    </div>
  )
}

function OcclusionMaker({ form, set, pickImage }: { form: Form; set: (p: Partial<Form>) => void; pickImage: (f?: File) => void }) {
  const src = useMedia(form.image)
  const box = useRef<HTMLDivElement>(null)
  const [draw, setDraw] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null)
  const [sel, setSel] = useState<number | null>(null)

  const pt = (e: RPE) => {
    const r = box.current!.getBoundingClientRect()
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) }
  }

  if (!src)
    return (
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-4 border-dashed border-line bg-surface-2 p-6 text-center">
        <span className="text-5xl">🫀</span>
        <span className="font-extrabold">Upload a diagram</span>
        <span className="text-sm text-muted">Anatomy, histology, pathways… then draw boxes over the labels to hide them.</span>
        <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
      </label>
    )

  const rect = draw && { x: Math.min(draw.x0, draw.x), y: Math.min(draw.y0, draw.y), w: Math.abs(draw.x - draw.x0), h: Math.abs(draw.y - draw.y0) }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-muted">Drag on the image to cover each label. Each box becomes its own card. Tap a box to name or delete it.</p>
      <div
        ref={box}
        className="relative touch-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('[data-mask]')) return
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          const p = pt(e)
          setDraw({ x0: p.x, y0: p.y, ...p })
          setSel(null)
        }}
        onPointerMove={(e) => draw && setDraw({ ...draw, ...pt(e) })}
        onPointerUp={() => {
          if (rect && rect.w > 1.5 && rect.h > 1.5) set({ masks: [...form.masks, { id: uid(), ...rect }] })
          setDraw(null)
        }}
      >
        <OcclusionImage src={src} masks={form.masks} onMaskClick={setSel} selected={sel} />
        {rect && <div className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary bg-primary/40" style={{ left: `${rect.x}%`, top: `${rect.y}%`, width: `${rect.w}%`, height: `${rect.h}%` }} />}
      </div>
      {sel !== null && form.masks[sel] && (
        <div className="flex gap-2" data-mask>
          <input
            className="input"
            autoFocus
            placeholder={`Answer for box ${sel + 1} (e.g. "Left ventricle")`}
            value={form.masks[sel].label ?? ''}
            onChange={(e) => set({ masks: form.masks.map((m, i) => (i === sel ? { ...m, label: e.target.value } : m)) })}
          />
          <button className="btn-soft shrink-0" onClick={() => { set({ masks: form.masks.filter((_, i) => i !== sel) }); setSel(null) }}>
            🗑️
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <span className="chip">{form.masks.length} box{form.masks.length === 1 ? '' : 'es'}</span>
        {form.masks.length > 0 && <button className="chip" onClick={() => set({ masks: form.masks.slice(0, -1) })}>↩ Undo last box</button>}
        <button className="chip" onClick={() => set({ image: undefined, masks: [] })}>Change image</button>
      </div>
      <input className="input" placeholder="Question / title (optional) e.g. “Label the heart”" value={form.front} onChange={(e) => set({ front: e.target.value })} />
    </div>
  )
}
