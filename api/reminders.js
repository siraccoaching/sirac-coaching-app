import { adminClient, sendToUser } from './_lib/push.js'

// Lancée chaque matin par Vercel (cron, voir vercel.json) :
// rappelle aux clients la séance prévue ce jour dans leur planning.
// Elle interroge aussi la base chaque jour, ce qui évite la mise en pause du projet Supabase gratuit.
export default async function handler(req, res) {
  const auth = req.headers.authorization || ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' })
  const admin = adminClient()
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date())
  const { data: rows, error } = await admin.from('scheduled_sessions')
    .select('client_id, program_session_id, program_sessions(name)').eq('date', today)
  if (error) return res.status(500).json({ error: error.message })
  const byClient = {}
  for (const r of rows || []) (byClient[r.client_id] = byClient[r.client_id] || []).push(r.program_sessions?.name || 'Séance')
  let sent = 0
  for (const [clientId, names] of Object.entries(byClient)) {
    const out = await sendToUser(admin, clientId, {
      title: names.length > 1 ? `${names.length} séances aujourd'hui 🏋️` : "Séance du jour 🏋️",
      body: names.join(' · ') + ' — à toi de jouer !', url: '/client/program', tag: 'reminder-' + today,
    })
    sent += out.sent || 0
  }
  return res.status(200).json({ date: today, clients: Object.keys(byClient).length, sent })
}
