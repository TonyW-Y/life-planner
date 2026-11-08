import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** Bottom sheet on phones, soft centered dialog on bigger screens. */
export function Sheet({ open, onClose, title, children, footer, wide }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/25 backdrop-blur-[2px] md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal
            className={`flex max-h-[92dvh] w-full flex-col rounded-t-[2rem] border border-line bg-surface shadow-soft md:rounded-[2rem] ${wide ? 'md:max-w-3xl' : 'md:max-w-lg'}`}
            initial={{ y: 60, opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-line md:hidden" />
            {title && (
              <div className="flex items-center justify-between px-5 pb-1 pt-3">
                <h2 className="h2">{title}</h2>
                <button className="icon-btn" aria-label="Close" onClick={onClose}>
                  ✕
                </button>
              </div>
            )}
            <div className="overflow-y-auto px-5 pb-4 pt-2">{children}</div>
            {footer && <div className="flex flex-wrap gap-2 border-t border-line px-5 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] pt-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** A small choose-one dialog, e.g. "Just this one / This and following / All". */
export function ChoiceSheet<T extends string>({
  open,
  title,
  options,
  onPick,
  onClose,
}: {
  open: boolean
  title: string
  options: { id: T; label: string; hint?: string }[]
  onPick: (id: T) => void
  onClose: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2 pb-2">
        {options.map((o) => (
          <button key={o.id} className="rounded-2xl border-2 border-line bg-surface-2 p-3 text-left font-bold hover:border-primary" onClick={() => onPick(o.id)}>
            {o.label}
            {o.hint && <div className="text-sm font-semibold text-muted">{o.hint}</div>}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
