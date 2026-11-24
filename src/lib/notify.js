// Notifications : activation / désactivation par l'utilisateur, affichage compatible iPhone (app sur l'écran d'accueil).
import { useEffect, useState } from 'react'
import { supabase, subscribeToPush } from './supabase'

const KEY = 'sirac-notifs'
const listeners = new Set()

export function notifSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifState() {
  if (!notifSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  let pref = 'off'
  try { pref = localStorage.getItem(KEY) || 'off' } catch { /* stockage indisponible */ }
  return pref === 'on' && Notification.permission === 'granted' ? 'on' : 'off'
}

function emit() { const s = notifState(); listeners.forEach(fn => fn(s)) }

export async function enableNotifications(userId) {
  if (!notifSupported()) return 'unsupported'
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') { emit(); return notifState() }
  try { localStorage.setItem(KEY, 'on') } catch { /* stockage indisponible */ }
  // abonnement push (pour les notifications app fermée) : sans effet si le serveur d'envoi n'est pas configuré
  if (userId) Promise.race([subscribeToPush(userId), new Promise(r => setTimeout(r, 4000))]).catch(() => {})
  emit()
  return 'on'
}

export async function disableNotifications(userId) {
  try { localStorage.setItem(KEY, 'off') } catch { /* stockage indisponible */ }
  try {
    const reg = 'serviceWorker' in navigator ? await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 1500))]) : null
    const sub = reg && await reg.pushManager?.getSubscription()
    if (sub) {
      if (userId) await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch { /* rien à désabonner */ }
  emit()
  return 'off'
}

export async function notify(title, body, url, tag) {
  if (notifState() !== 'on') return
  const opts = { body, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png', tag: tag || title + body, data: { url } }
  try {
    const reg = 'serviceWorker' in navigator ? await Promise.race([navigator.serviceWorker.getRegistration(), new Promise(r => setTimeout(r, 800))]) : null
    if (reg?.showNotification) { await reg.showNotification(title, opts); return }
  } catch { /* on passe à l'API directe */ }
  try { new Notification(title, opts) } catch { /* navigateur sans notifications */ }
}

export function useNotifState() {
  const [state, setState] = useState(notifState)
  useEffect(() => { listeners.add(setState); return () => listeners.delete(setState) }, [])
  return state
}

// Au lancement : si les notifications sont activées, on (re)confirme l'abonnement push de cet appareil.
export function useEnsurePush(profile) {
  useEffect(() => {
    if (!profile?.id || notifState() !== 'on') return
    const t = setTimeout(() => subscribeToPush(profile.id), 1500)
    return () => clearTimeout(t)
  }, [profile?.id])
}

// Écoute en temps réel ce qui concerne l'utilisateur connecté et affiche une notification.
export function useRealtimeNotifications(profile) {
  useEffect(() => {
    if (!profile?.id) return
    const me = profile.id
    const nameOf = async id => (await supabase.from('profiles').select('name').eq('id', id).maybeSingle()).data?.name || ''
    const ch = supabase.channel('notifs-' + me)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me}` }, async ({ new: m }) => {
        if (location.pathname.includes('/messages')) return
        const who = await nameOf(m.sender_id)
        notify('Nouveau message' + (who ? ' de ' + who : ''), (m.content || '').slice(0, 120), profile.role === 'coach' ? `/coach/messages/${m.sender_id}` : '/client/messages', 'msg-' + m.sender_id)
      })
    if (profile.role === 'coach') {
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_completions' }, async ({ new: c }) => {
        const who = await nameOf(c.client_id)
        notify('Séance terminée 💪', (who || 'Un client') + ' vient de terminer sa séance', `/coach/client/${c.client_id}`, 'done-' + c.id)
      })
    } else {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'program_assignments', filter: `client_id=eq.${me}` }, ({ eventType }) => {
        if (eventType === 'DELETE') return
        notify('Programme mis à jour', 'Ton coach a publié ton programme. Ouvre-le pour voir tes séances.', '/client/program', 'prog-' + me)
      })
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'nutrition_plans', filter: `client_id=eq.${me}` }, ({ eventType }) => {
        if (eventType === 'DELETE') return
        notify('Plan nutritionnel', 'Ton coach a mis à jour ton plan nutritionnel.', '/client/nutrition', 'nutri-' + me)
      })
    }
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id, profile?.role])
}
