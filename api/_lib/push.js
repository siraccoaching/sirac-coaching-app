import * as webpushNs from 'web-push'
const webpush = webpushNs.default || webpushNs
import { createClient } from '@supabase/supabase-js'

// Outils partagés par /api/push et /api/reminders (le dossier _lib n'est pas exposé comme route).
export function adminClient() {
  const url = process.env.VITE_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server configuration error')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

let configured = false
function configure() {
  if (configured) return true
  const pub = process.env.VITE_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://sirac-coaching-app.vercel.app', pub, priv)
  configured = true
  return true
}

// Envoie une notification à tous les appareils d'un utilisateur. Supprime les abonnements expirés.
export async function sendToUser(admin, userId, payload) {
  if (!configure()) return { sent: 0, reason: 'vapid-missing' }
  const { data: subs } = await admin.from('push_subscriptions').select('id, subscription').eq('user_id', userId)
  let sent = 0
  for (const s of subs || []) {
    try {
      await webpush.sendNotification(JSON.parse(s.subscription), JSON.stringify(payload), { TTL: 3600, urgency: 'high' })
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
    }
  }
  return { sent }
}
