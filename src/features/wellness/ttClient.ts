import { supabase } from '../../data/supabase'
import type { ChatMsg } from '../../data/types'

/**
 * Ask the free AI (Groq free tier via our Supabase Edge Function).
 * Returns null whenever it isn't available — the caller then uses TT's offline engine.
 */
export async function askAI(history: ChatMsg[], context: { mood?: number; name?: string }): Promise<string | null> {
  if (!supabase || !navigator.onLine) return null
  const { data: session } = await supabase.auth.getSession()
  if (!session.session) return null
  try {
    const res = await Promise.race([
      supabase.functions.invoke<{ text?: string }>('tt-chat', {
        body: { messages: history.slice(-16).map((m) => ({ role: m.role === 'tt' ? 'assistant' : 'user', content: m.text })), ...context },
      }),
      new Promise<null>((r) => setTimeout(() => r(null), 15000)),
    ])
    if (!res || res.error || !res.data?.text) return null
    return res.data.text.trim()
  } catch {
    return null
  }
}
