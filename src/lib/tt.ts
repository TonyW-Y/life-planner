/**
 * TT's safety layer + offline comfort engine.
 * The engine always works (no internet, no API key, $0). When the free AI is available,
 * it is used for richer replies, but crisis messages are ALWAYS handled here first.
 */

const CRISIS = [
  /\b(kill|killing|hurt|hurting|harm|harming|cut|cutting)\s*(my ?self|myself)\b/i,
  /\bsuicid/i,
  /\bwant(ed)?\s+to\s+die\b/i,
  /\b(end|take)\s+(my|it)\s*(own\s+)?life\b/i,
  /\bend\s+it\s+all\b/i,
  /\bno\s+reason\s+to\s+(live|be here|go on)\b/i,
  /\b(don'?t|do not)\s+want\s+to\s+(be alive|live|exist|wake up)\b/i,
  /\bbetter\s+off\s+(dead|without me)\b/i,
  /\boverdos/i,
  /\bself[-\s]?harm/i,
  /\bcan'?t\s+go\s+on\b/i,
  /\bnot\s+worth\s+living\b/i,
]

export function isCrisis(text: string) {
  return CRISIS.some((r) => r.test(text))
}

export const CRISIS_REPLY =
  "I'm really glad you told me, and I'm so sorry you're hurting this much. You deserve support from a real person right now. 💛\n\n" +
  'Please reach out to one of these — they are free, confidential, and there 24/7:\n' +
  '• Call or text **988** (Suicide & Crisis Lifeline, US)\n' +
  '• Text **HOME** to **741741** (Crisis Text Line)\n' +
  '• If you are in immediate danger, call **911** or go to the nearest ER\n\n' +
  "If you can, also tell someone you trust that you're not okay. I'm right here with you, and so are the pups. 🐾"

type Intent =
  | 'exam'
  | 'failed'
  | 'overwhelmed'
  | 'anxious'
  | 'sad'
  | 'tired'
  | 'lonely'
  | 'angry'
  | 'imposter'
  | 'focus'
  | 'sleep'
  | 'good'
  | 'thanks'
  | 'vent'
  | 'nice'
  | 'hello'
  | 'default'

const PATTERNS: [Intent, RegExp][] = [
  ['failed', /\b(fail(ed)?|flunk(ed)?|bombed|did badly|did bad|didn'?t pass|low score|bad grade|remediat)/i],
  ['imposter', /\b(imposter|impostor|not smart enough|don'?t belong|everyone else is (smarter|better)|stupid|dumb|not cut out)/i],
  ['exam', /\b(exam|test|quiz|shelf|step ?[123]|boards?|osce|midterm|final)\b/i],
  ['overwhelmed', /\b(overwhelm|too much|so much to do|drowning|behind|can'?t keep up|swamped|buried)/i],
  ['anxious', /\b(anxious|anxiety|panic|nervous|scared|worried|worry|stress(ed)?|freaking out|heart racing)/i],
  ['sleep', /\b(can'?t sleep|insomnia|awake at|not sleeping|no sleep)/i],
  ['tired', /\b(tired|exhausted|burn(ed|t)? ?out|drained|no energy|sleepy|fatigue)/i],
  ['focus', /\b(can'?t focus|distracted|procrastinat|unmotivated|no motivation|can'?t concentrate|can'?t start)/i],
  ['lonely', /\b(lonely|alone|isolated|no one|nobody|miss (him|her|you|home|my))/i],
  ['angry', /\b(angry|mad|furious|annoyed|frustrat|pissed|irritated|unfair)/i],
  ['sad', /\b(sad|cry(ing)?|cried|upset|down|depressed|hopeless|hurt|heartbroken|awful|terrible|bad day)/i],
  ['good', /\b(passed|i did it|good news|happy|great day|aced|proud|excited|matched|honored|nailed)/i],
  ['thanks', /\b(thank|thanks|ty|appreciate)\b/i],
  ['vent', /\b(vent|rant|need to talk|just listen)\b/i],
  ['nice', /\b(something nice|cheer me up|make me smile|compliment|affirmation)\b/i],
  ['hello', /^\s*(hi|hey|hello|hiya|yo|good (morning|evening|night))\b/i],
]

export function classify(text: string): Intent {
  for (const [intent, re] of PATTERNS) if (re.test(text)) return intent
  return 'default'
}

const REPLIES: Record<Intent, string[]> = {
  exam: [
    "Exams are SO much pressure, and it makes sense you feel it. You've been showing up and putting in the work — that counts for more than it feels like right now. What part feels scariest: the amount of material, the time left, or the exam day itself?",
    "Let's make it smaller together. Instead of 'the whole exam', what's one topic you could look at for just 25 minutes? The pups will nap next to you while you do it. 🐾",
    "You don't have to know everything — nobody does, not even the attendings. You just need to keep chipping away. Want me to help you make a plan in the Exam plan tab?",
  ],
  failed: [
    "Oh, I'm so sorry. That really hurts, especially after how hard you worked. One score does not decide what kind of doctor you'll be — lots of amazing physicians stumbled on an exam. Do you want to talk about how you're feeling, or think about next steps?",
    "It's okay to be sad about this. Let yourself feel it tonight. Tomorrow we can look at what to adjust — not because you weren't enough, but because you're learning how this particular test works. 💛",
  ],
  overwhelmed: [
    "That sounds like a lot to carry at once. Let's take one breath together first. 🌬️ Then, if you want, tell me the three things weighing on you most and we'll pick just ONE to start with.",
    "When everything feels urgent, nothing feels doable. Try this: write it all down in To-do, then pick only the 'must do' for today. Everything else can wait until tomorrow — and that's allowed.",
    "You don't have to finish everything to be doing enough. What would make today feel 'okay' — not perfect, just okay?",
  ],
  anxious: [
    "I hear you. Anxiety makes everything feel bigger and closer than it is. Let's slow your body down first: breathe in for 4… hold for 4… out for 4… hold for 4. Want to try the breathing bubble with me?",
    "That feeling is really uncomfortable, but it's not dangerous, and it will pass. Can you name 5 things you can see right now? It helps your brain come back to the present. 🌷",
    "Worry often tries to protect us by imagining the worst. What's one thing that's actually in your control in the next hour?",
  ],
  sad: [
    "I'm sorry you're feeling down. You don't have to fix it right now — it's okay to just feel it. Want to tell me what happened?",
    "Sending you the biggest, softest hug. 🧸 Some days are just heavy. Is there something small and kind you could do for yourself — tea, a shower, a cozy blanket?",
    "Thank you for telling me. Your feelings make sense. I'm here, and the pups are curled up right next to you. 🐾",
  ],
  tired: [
    "You've been running on empty, and your body is asking for care. Rest isn't wasted time — it's when your brain files away everything you studied. Could you take a real break, even 20 minutes?",
    "Burnout is your body saying 'too much for too long', not 'you're weak'. What's one thing you could take off your plate this week?",
    "Being tired makes everything harder, including being kind to yourself. Maybe tonight the goal is just: eat something warm, and sleep. 🌙",
  ],
  lonely: [
    "Feeling alone is so hard, especially when you're buried in studying. You matter, and people care about you — including whoever made this app for you. 💕 Is there someone you could text, even just a 'hi'?",
    "I'm here with you right now, and so are the pups. Would a quick call with someone you love help? Sometimes 5 minutes of a familiar voice changes the whole day.",
  ],
  angry: [
    "That sounds really frustrating, and you're allowed to be mad about it. Want to vent? I'm listening — no judgment.",
    "Anger usually means something important to you got stepped on. What feels most unfair about it?",
  ],
  imposter: [
    "So many med students feel this — it's one of the most common feelings in medicine, even among people who look totally confident. You were chosen for a reason. You belong there. 💛",
    "Feeling like you don't know enough is part of learning medicine, not proof that you can't do it. Look how far you've come already. What's something you understand now that you didn't a year ago?",
  ],
  focus: [
    "Starting is the hardest part. Let's make it tiny: just 10 minutes on the timer, on the easiest thing. If you want to stop after that, you can. Usually the brain warms up. ⏱️",
    "Maybe your brain needs a reset — water, a quick walk, or some brown noise in the timer tab. Then try a short Pomodoro. You've got this.",
    "Distraction often means tired or overwhelmed. Is it the material that's hard, or are you running low on energy today?",
  ],
  sleep: [
    "Not being able to sleep is the worst, especially with so much on your mind. Try putting the phone down, dimming the lights, and doing a few rounds of 4-7-8 breathing. Your to-do list will still be there tomorrow — you can let it go for tonight. 🌙",
    "If thoughts are racing, try writing them down in To-do so your brain knows they're saved. Then breathe slowly with me: in 4, hold 7, out 8.",
  ],
  good: [
    "YAY!! 🎉 That's amazing — I'm so proud of you! The pups are doing zoomies. Tell me everything!",
    "That's wonderful news! Take a moment to really let it sink in — you earned this. 🌟",
  ],
  thanks: ["Always. 💕 I'm here whenever you need me.", "Of course! You deserve all the support. 🧸", "Anytime, love. The pups say thank you too. 🐾"],
  vent: ["I'm all ears. Let it all out — I'm not going anywhere. 🧸", "Go ahead, I'm listening. You don't need to make it make sense."],
  nice: [
    "You're doing something incredibly hard, and you keep showing up. That's brave. 💕",
    "Someday someone will be scared and sick, and you'll be the one who makes them feel safe. That's who you're becoming. 🩺",
    "You're allowed to be a work in progress and a masterpiece at the same time. 🌸",
    "The pups think you're the best human in the whole world. They're right. 🐾",
    "You are so much more than your grades. You're kind, you're trying, and you're loved.",
  ],
  hello: ["Hi lovely! 🧸 How are you feeling today?", "Hey you! 💕 What's on your mind?", "Hiii! The pups and I are so happy to see you. How's your day going?"],
  default: [
    "Thank you for sharing that with me. How are you feeling about it?",
    "I'm listening. 🧸 Tell me more?",
    "That makes sense. What do you think you need most right now — a plan, a break, or just someone to listen?",
    "I hear you. Whatever you're feeling is okay. Want to keep talking about it?",
  ],
}

let lastReply = ''
/** Offline reply. `seed` lets tests pick deterministically. */
export function fallbackReply(text: string, seed = Math.random()): { text: string; intent: Intent; crisis: boolean } {
  if (isCrisis(text)) return { text: CRISIS_REPLY, intent: 'default', crisis: true }
  const intent = classify(text)
  const opts = REPLIES[intent]
  let pick = opts[Math.floor(seed * opts.length) % opts.length]
  if (pick === lastReply && opts.length > 1) pick = opts[(opts.indexOf(pick) + 1) % opts.length]
  lastReply = pick
  return { text: pick, intent, crisis: false }
}

export const AFFIRMATIONS = REPLIES.nice
export const QUICK_PROMPTS = [
  "I'm stressed about an exam",
  "I can't focus today",
  'I feel overwhelmed',
  'I just need to vent',
  'Tell me something nice',
  "I can't sleep",
]
