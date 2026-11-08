import { AnimatePresence, motion } from 'framer-motion'
import { useToasts } from '../lib/toast'

export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full border border-line bg-surface py-2 pl-4 pr-2 font-bold shadow-soft"
            role="status"
          >
            <span>{t.emoji ?? '🐾'}</span>
            <span className="text-sm">{t.text}</span>
            {t.undo ? (
              <button
                className="rounded-full bg-primary-soft px-3 py-1 text-sm"
                onClick={async () => {
                  await t.undo?.()
                  dismiss(t.id)
                }}
              >
                Undo
              </button>
            ) : (
              <button aria-label="Dismiss" className="px-2 text-muted" onClick={() => dismiss(t.id)}>
                ×
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
