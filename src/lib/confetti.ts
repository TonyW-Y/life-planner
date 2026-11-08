/** Tiny dependency-free confetti burst. Hearts in Joey mode, paws/sparkles otherwise. */
export function confetti(x = window.innerWidth / 2, y = window.innerHeight / 2) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const joey = document.documentElement.dataset.theme === 'joey'
  const glyphs = joey ? ['💗', '🎀', '💖', '🧸', '✨'] : ['✨', '🐾', '💛', '🌸', '⭐']
  const layer = document.createElement('div')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden'
  document.body.appendChild(layer)
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('span')
    s.textContent = glyphs[i % glyphs.length]
    const a = Math.random() * Math.PI * 2
    const d = 60 + Math.random() * 110
    s.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-size:${14 + Math.random() * 12}px;transition:transform .9s cubic-bezier(.2,.8,.3,1),opacity .9s;`
    layer.appendChild(s)
    requestAnimationFrame(() => {
      s.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 40}px) rotate(${Math.random() * 360}deg)`
      s.style.opacity = '0'
    })
  }
  setTimeout(() => layer.remove(), 1000)
}
