import { adminClient, sendToUser } from './_lib/push.js'

// Appelée par la base de données (déclencheurs) à chaque événement : nouveau message, séance terminée,
// programme ou plan nutritionnel mis à jour. Envoie la notification au téléphone, même app fermée.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const admin = adminClient()
  // Le secret est généré et gardé par la base (private.settings) : on le vérifie auprès d'elle
  const given = String(req.headers['x-push-secret'] || '')
  const { data: valid } = given ? await admin.rpc('push_secret_check', { s: given }) : { data: false }
  if (!valid) return res.status(401).json({ error: 'Unauthorized' })
  const { table, record: r } = req.body || {}
  if (!r) return res.status(400).json({ error: 'Missing record' })
  const nameOf = async id => (await admin.from('profiles').select('name').eq('id', id).maybeSingle()).data?.name || ''

  let to = null, payload = null
  if (table === 'messages') {
    const [who, { data: rec }] = await Promise.all([nameOf(r.sender_id), admin.from('profiles').select('role').eq('id', r.receiver_id).maybeSingle()])
    const body = r.attachment_type === 'image' ? '📷 Photo' : r.attachment_type === 'video' ? '🎬 Vidéo' : r.attachment_type === 'audio' ? '🎤 Message vocal' : (r.content || '').slice(0, 140)
    to = r.receiver_id
    payload = { title: 'Nouveau message' + (who ? ' de ' + who : ''), body, url: rec?.role === 'coach' ? `/coach/messages/${r.sender_id}` : '/client/messages', tag: 'msg-' + r.sender_id }
  } else if (table === 'session_completions') {
    const { data: c } = await admin.from('profiles').select('name, coach_id').eq('id', r.client_id).maybeSingle()
    if (c?.coach_id) { to = c.coach_id; payload = { title: 'Séance terminée 💪', body: (c.name || 'Un client') + ' vient de terminer sa séance', url: `/coach/client/${r.client_id}`, tag: 'done-' + r.id } }
  } else if (table === 'program_assignments') {
    to = r.client_id
    payload = { title: 'Programme mis à jour', body: 'Ton coach a publié ton programme. Ouvre-le pour voir tes séances.', url: '/client/program', tag: 'prog-' + r.client_id }
  } else if (table === 'nutrition_plans' && r.client_id) {
    to = r.client_id
    payload = { title: 'Plan nutritionnel', body: 'Ton coach a mis à jour ton plan nutritionnel.', url: '/client/nutrition', tag: 'nutri-' + r.client_id }
  }
  if (!to || !payload) return res.status(200).json({ skipped: true })
  const out = await sendToUser(admin, to, payload)
  return res.status(200).json(out)
}
