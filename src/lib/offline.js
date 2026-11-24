// Mode hors ligne : la séance reste lisible sans réseau, et une séance terminée sans réseau
// est gardée sur le téléphone puis envoyée automatiquement dès le retour du réseau.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const QUEUE = 'arise-pending-sessions'
const listeners = new Set()

export function cacheSet(key, data) {
  try { localStorage.setItem('arise-cache:' + key, JSON.stringify({ t: Date.now(), data })) } catch { /* stockage plein ou indisponible */ }
}
export function cacheGet(key) {
  try { return JSON.parse(localStorage.getItem('arise-cache:' + key))?.data ?? null } catch { return null }
}

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false
// Erreur réseau (pas une erreur de droits ou de données)
export const isNetworkError = e => !!e && (isOffline() || /fetch|network|load failed|timed? ?out/i.test(e.message || String(e)))

function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE)) || [] } catch { return [] } }
function writeQueue(q) { try { localStorage.setItem(QUEUE, JSON.stringify(q)) } catch { /* stockage indisponible */ } listeners.forEach(fn => fn(q.length)) }

// item = { localId, completion: {...}, logs: [...], rating: {...} | null }
export function queueSession(item) {
  const q = readQueue(); q.push({ ...item, queued_at: new Date().toISOString() }); writeQueue(q)
}
export function updateQueued(localId, patch) {
  writeQueue(readQueue().map(i => i.localId === localId ? { ...i, ...patch } : i))
}
export const pendingCount = () => readQueue().length

let flushing = false
export async function flushQueue() {
  if (flushing || isOffline()) return 0
  flushing = true
  let sent = 0
  try {
    for (const item of readQueue()) {
      const created_at = item.queued_at
      const { data: comp, error } = await supabase.from('session_completions')
        .insert({ ...item.completion, ...(item.rating || {}), created_at, completed_at: created_at }).select().single()
      if (error) { if (isNetworkError(error)) break; else { writeQueue(readQueue().filter(i => i.localId !== item.localId)); continue } }
      if (item.logs?.length) await supabase.from('exercise_logs').insert(item.logs.map(l => ({ ...l, completion_id: comp.id })))
      writeQueue(readQueue().filter(i => i.localId !== item.localId))
      sent++
    }
  } finally { flushing = false }
  return sent
}

// Bandeau « hors ligne » + envoi automatique au retour du réseau
export function useOfflineSync(enabled) {
  const [offline, setOffline] = useState(isOffline())
  const [pending, setPending] = useState(pendingCount())
  const [justSynced, setJustSynced] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const sync = async () => { const n = await flushQueue(); if (n) { setJustSynced(n); setTimeout(() => setJustSynced(0), 4000) } }
    const on = () => { setOffline(false); sync() }
    const off = () => setOffline(true)
    listeners.add(setPending)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    sync()
    return () => { listeners.delete(setPending); window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [enabled])
  return { offline, pending, justSynced }
}
