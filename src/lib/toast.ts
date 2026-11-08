import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  emoji?: string
  undo?: () => void | Promise<void>
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let n = 0
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++n
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), t.undo ? 6000 : 3500)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = (text: string, opts: Omit<Toast, 'id' | 'text'> = {}) =>
  useToasts.getState().push({ text, ...opts })
