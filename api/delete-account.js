import { createClient } from '@supabase/supabase-js'

// Suppression définitive du compte client (droit à l'effacement, RGPD) :
// photos supprimées, puis compte supprimé (toutes ses données suivent en cascade).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) return res.status(500).json({ error: 'Server configuration error' })

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid session' })

  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'coach') return res.status(403).json({ error: 'Le compte coach se supprime depuis Supabase.' })
  if ((req.body || {}).confirm !== 'SUPPRIMER') return res.status(400).json({ error: 'Confirmation manquante.' })

  const { data: files } = await admin.storage.from('client-photos').list(user.id, { limit: 1000 })
  if (files?.length) await admin.storage.from('client-photos').remove(files.map(f => `${user.id}/${f.name}`))

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
  if (delErr) return res.status(400).json({ error: delErr.message })
  return res.status(200).json({ success: true })
}
