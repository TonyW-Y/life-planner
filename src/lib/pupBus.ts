import { create } from 'zustand'

/** Things the pups react to around the app. */
export type PupMood = 'idle' | 'happy' | 'sleepy' | 'stretch' | 'cuddle' | 'cheer'

interface PupState {
  mood: PupMood
  hearts: number
  /** a long-running background mood (e.g. 'sleepy' while focusing) */
  base: PupMood
  react: (m: PupMood, ms?: number) => void
  setBase: (m: PupMood) => void
  pet: () => void
}

let timer: ReturnType<typeof setTimeout> | undefined
export const usePups = create<PupState>((set, get) => ({
  mood: 'idle',
  base: 'idle',
  hearts: 0,
  react: (m, ms = 2600) => {
    clearTimeout(timer)
    set({ mood: m })
    timer = setTimeout(() => set({ mood: get().base }), ms)
  },
  setBase: (m) => set((s) => ({ base: m, mood: s.mood === s.base ? m : s.mood })),
  pet: () => {
    set((s) => ({ hearts: s.hearts + 1 }))
    get().react('happy', 1800)
  },
}))

export const pupsReact = (m: PupMood, ms?: number) => usePups.getState().react(m, ms)
