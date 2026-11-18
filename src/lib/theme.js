// Thème de l'app : 'system' (suit le téléphone), 'light' ou 'dark'. Mémorisé sur l'appareil.
import { useEffect, useState } from 'react'

const KEY = 'sirac-theme'
const listeners = new Set()

export function getThemePref() {
  try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' }
}

function systemIsDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(pref = getThemePref()) {
  return pref === 'system' ? (systemIsDark() ? 'dark' : 'light') : pref
}

export function applyTheme(pref = getThemePref()) {
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#f2f2f7')
  listeners.forEach(fn => fn(pref, resolved))
}

export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* stockage indisponible : thème non mémorisé */ }
  applyTheme(pref)
}

export function initTheme() {
  applyTheme()
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getThemePref() === 'system') applyTheme('system')
  })
}

export function useTheme() {
  const [state, setState] = useState(() => ({ pref: getThemePref(), resolved: resolveTheme() }))
  useEffect(() => {
    const fn = (pref, resolved) => setState({ pref, resolved })
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  return { ...state, setPref: setThemePref }
}
