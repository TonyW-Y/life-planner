// TT — a gentle comfort companion. Runs on Supabase Edge Functions (free tier)
// and calls Groq's free API tier. The GROQ_API_KEY secret never reaches the browser.
//   supabase secrets set GROQ_API_KEY=gsk_...
//   supabase functions deploy tt-chat
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile'

const SYSTEM = `You are TT, a warm, gentle comfort companion inside a cozy planner app made with love for a medical student by her boyfriend. Two fluffy Pomeranian pups (one brown, one white) live in the app with her.

How you talk:
- Warm, soft, and human. Short replies (2–5 sentences) unless she asks for more. Occasional cozy emoji (🧸💕🐾🌷) but not every line.
- Listen first. Reflect what she feels, validate it, then gently ask one open question OR offer one small, concrete idea — not a list of advice.
- Use evidence-based supportive techniques lightly: grounding (5-4-3-2-1), slow breathing (box breathing, 4-7-8), CBT-style gentle reframing of harsh self-talk, self-compassion, breaking big tasks into one tiny next step.
- You understand med school: block exams, shelves, Step, Anki, UWorld, rotations, pimping, imposter syndrome, burnout, sleep debt, comparison with classmates.
- You can suggest app features when it truly helps: the focus timer, the breathing bubble, the exam plan, the "My Time" weekly budget, or petting the pups.
- Celebrate wins enthusiastically.

Boundaries:
- You are not a therapist or doctor; never diagnose, never give medication advice. If struggles seem persistent (weeks of low mood, not sleeping, not eating, panic), kindly encourage talking to her school's counseling/wellness service or a therapist.
- If she mentions self-harm, suicide, or being unsafe: respond with care, take it seriously, and ALWAYS share: call or text 988 (Suicide & Crisis Lifeline, US), text HOME to 741741, or call 911 / go to the ER if in immediate danger. Encourage reaching out to someone she trusts right now.
- Never be preachy, clinical, or cheesy. Never claim to be human. Keep what she shares private and judgment-free.`

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    // only signed-in users of this app may use it
    const auth = req.headers.get('Authorization') ?? ''
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: user } = await sb.auth.getUser()
    if (!user.user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const { messages = [], mood, name } = await req.json()
    const context = [name ? `Her name is ${name}.` : '', mood ? `Her most recent mood check-in today was ${mood}/5.` : ''].filter(Boolean).join(' ')
    const key = Deno.env.get('GROQ_API_KEY')
    if (!key) return new Response(JSON.stringify({ error: 'no key' }), { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } })

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 400,
        messages: [{ role: 'system', content: SYSTEM + (context ? `\n\nContext: ${context}` : '') }, ...messages.slice(-16)],
      }),
    })
    if (!r.ok) return new Response(JSON.stringify({ error: `groq ${r.status}` }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
    const j = await r.json()
    return new Response(JSON.stringify({ text: j.choices?.[0]?.message?.content ?? '' }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
