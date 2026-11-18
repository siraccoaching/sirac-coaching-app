// Effets : confettis de fin de séance et petite vibration (Android ; l'iPhone n'autorise pas la vibration web).
export function haptic(pattern = 10) {
  try { if (navigator.vibrate) navigator.vibrate(pattern) } catch { /* non supporté */ }
}

export async function celebrate({ big = false } = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const { default: confetti } = await import('canvas-confetti')
  const colors = ['#5e5ce6', '#8b5cf6', '#34c759', '#ff9f0a', '#ff375f', '#64d2ff']
  const base = { colors, disableForReducedMotion: true, zIndex: 2000, ticks: 220 }
  confetti({ ...base, particleCount: big ? 140 : 90, spread: 80, startVelocity: 45, origin: { y: 0.35 } })
  if (big) {
    setTimeout(() => confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 } }), 250)
    setTimeout(() => confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 } }), 400)
  }
  haptic([20, 40, 20])
}
