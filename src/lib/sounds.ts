/** All sounds are generated live with the Web Audio API — free, offline, no files. */
let ctx: AudioContext | null = null
const ac = () => (ctx ??= new AudioContext())

export function chime() {
  try {
    const c = ac()
    const now = c.currentTime
    ;[523.25, 659.25, 783.99].forEach((f, i) => {
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0, now + i * 0.18)
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 1.4)
      o.connect(g).connect(c.destination)
      o.start(now + i * 0.18)
      o.stop(now + i * 0.18 + 1.5)
    })
  } catch {
    /* audio not available */
  }
}

export type Ambient = 'none' | 'rain' | 'brown' | 'ocean' | 'fire'
export const AMBIENTS: { id: Ambient; label: string; emoji: string }[] = [
  { id: 'none', label: 'Quiet', emoji: '🤫' },
  { id: 'rain', label: 'Rain', emoji: '🌧️' },
  { id: 'brown', label: 'Brown noise', emoji: '🟤' },
  { id: 'ocean', label: 'Ocean', emoji: '🌊' },
  { id: 'fire', label: 'Fireplace', emoji: '🔥' },
]

let current: { stop: () => void } | null = null

function noiseBuffer(c: AudioContext, kind: 'white' | 'brown' | 'pink') {
  const len = c.sampleRate * 4
  const buf = c.createBuffer(2, len, c.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let last = 0
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      } else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046
        b1 = 0.963 * b1 + w * 0.2965164
        b2 = 0.57 * b2 + w * 1.0526913
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11
      } else d[i] = w
    }
  }
  return buf
}

export function playAmbient(kind: Ambient, volume = 0.5) {
  stopAmbient()
  if (kind === 'none') return
  const c = ac()
  void c.resume()
  const master = c.createGain()
  master.gain.value = 0
  master.gain.linearRampToValueAtTime(volume * 0.6, c.currentTime + 1.5)
  master.connect(c.destination)
  const src = c.createBufferSource()
  src.loop = true
  const stops: (() => void)[] = []

  if (kind === 'brown') {
    src.buffer = noiseBuffer(c, 'brown')
    src.connect(master)
  } else if (kind === 'rain') {
    src.buffer = noiseBuffer(c, 'pink')
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 400
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 6000
    src.connect(hp).connect(lp).connect(master)
  } else if (kind === 'ocean') {
    src.buffer = noiseBuffer(c, 'brown')
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    const swell = c.createGain()
    swell.gain.value = 0.6
    const lfo = c.createOscillator()
    lfo.frequency.value = 0.09
    const lfoGain = c.createGain()
    lfoGain.gain.value = 0.45
    lfo.connect(lfoGain).connect(swell.gain)
    lfo.start()
    stops.push(() => lfo.stop())
    src.connect(lp).connect(swell).connect(master)
  } else if (kind === 'fire') {
    src.buffer = noiseBuffer(c, 'brown')
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    src.connect(lp).connect(master)
    // crackles
    const crackle = () => {
      const o = c.createBufferSource()
      o.buffer = noiseBuffer(c, 'white')
      const g = c.createGain()
      const t = c.currentTime
      g.gain.setValueAtTime(0.25 * Math.random(), t)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.05)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1500 + Math.random() * 3000
      o.connect(bp).connect(g).connect(master)
      o.start(t)
      o.stop(t + 0.1)
    }
    const iv = setInterval(() => Math.random() < 0.5 && crackle(), 180)
    stops.push(() => clearInterval(iv))
  }
  src.start()
  current = {
    stop: () => {
      const t = c.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 0.6)
      setTimeout(() => {
        src.stop()
        stops.forEach((s) => s())
        master.disconnect()
      }, 700)
    },
  }
}

export function stopAmbient() {
  current?.stop()
  current = null
}
