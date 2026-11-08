import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { DEFAULT_PUP_NAMES, PomPals, type PupNames } from '../pups/PomPals'
import { ThemePicker } from '../../app/pages/SettingsPage'
import { DEFAULT_AWAKE, type Awake } from '../../lib/slots'
import { askNotificationPermission } from '../../lib/notify'
import { confetti } from '../../lib/confetti'
import { pupsReact } from '../../lib/pupBus'
import { useSetting } from '../../lib/useSetting'

/** A 60-second welcome where the pups show her around. */
export function Onboarding() {
  const [done, setDone, loaded] = useSetting('onboarded', false)
  const [name, setName] = useSetting('userName', '')
  const [pups, setPups] = useSetting<PupNames>('pupNames', DEFAULT_PUP_NAMES)
  const [awake, setAwake] = useSetting<Awake>('awake', DEFAULT_AWAKE)
  const [step, setStep] = useState(0)
  if (!loaded || done) return null

  const steps = [
    {
      title: `Hi! We're ${pups.brown} & ${pups.white} 🐾`,
      body: (
        <div className="flex flex-col gap-3">
          <p className="text-muted">We'll keep you company while you plan, study, and rest. Want to give us different names?</p>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" value={pups.brown} onChange={(e) => setPups({ ...pups, brown: e.target.value })} aria-label="Brown pup name" />
            <input className="input" value={pups.white} onChange={(e) => setPups({ ...pups, white: e.target.value })} aria-label="White pup name" />
          </div>
        </div>
      ),
    },
    {
      title: 'What should we call you? 💕',
      body: <input className="input text-lg font-bold" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />,
    },
    { title: 'Pick your cozy look ✨', body: <ThemePicker /> },
    {
      title: 'When are you usually awake? ☀️🌙',
      body: (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">So we only suggest study time while you're awake — and can show how much free time you really have.</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="time" className="input" value={awake.wake} onChange={(e) => setAwake({ ...awake, wake: e.target.value })} aria-label="Wake up" />
            <input type="time" className="input" value={awake.bed} onChange={(e) => setAwake({ ...awake, bed: e.target.value })} aria-label="Bedtime" />
          </div>
        </div>
      ),
    },
    {
      title: 'Last thing — gentle reminders? 🔔',
      body: (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">We'll nudge you before classes and when focus sessions end. Never spammy, promise.</p>
          <button className="btn-soft" onClick={() => askNotificationPermission()}>Yes, turn on reminders</button>
          <div className="rounded-2xl bg-surface-2 p-3 text-sm font-semibold">
            💡 Tips: type things like <b>“Anki 8pm daily until Dec 20”</b> anywhere you see the add box. Press <b>⌘K</b> (or 🔍) to find anything. Swipe to-dos right to finish them. Tap us for love. 🐾
          </div>
        </div>
      ),
    },
  ]
  const last = step === steps.length - 1
  const finish = async () => {
    await setDone(true)
    pupsReact('cheer', 3000)
    confetti()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm md:items-center md:p-6">
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="safe-bottom flex max-h-[95dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-[2rem] border border-line bg-surface p-6 shadow-soft md:rounded-[2rem]">
        <div className="flex justify-center">
          <PomPals size={100} speech={false} />
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col gap-3">
            <h2 className="text-2xl font-extrabold">{steps[step].title}</h2>
            {steps[step].body}
          </motion.div>
        </AnimatePresence>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-2 bg-line'}`} />
            ))}
          </div>
          <button className="btn-ghost ml-auto" onClick={finish}>Skip</button>
          {step > 0 && <button className="btn-soft" onClick={() => setStep(step - 1)}>Back</button>}
          <button className="btn-primary" onClick={() => (last ? finish() : setStep(step + 1))}>{last ? "Let's go! 🎉" : 'Next'}</button>
        </div>
      </motion.div>
    </div>
  )
}
