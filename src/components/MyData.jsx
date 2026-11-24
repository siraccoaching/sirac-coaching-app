import { useState } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const TABLES = [
  ['profil', 'profiles', 'id'], ['seances', 'session_completions', 'client_id'], ['mensurations', 'client_measurements', 'client_id'],
  ['bilans', 'weekly_checkins', 'client_id'], ['journal_alimentaire', 'nutrition_logs', 'client_id'],
]

// RGPD : export de toutes ses données + suppression définitive du compte.
export default function MyData({ userId }) {
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  async function exportData() {
    setBusy('export'); setMsg('')
    const out = { exporte_le: new Date().toISOString() }
    for (const [name, table, col] of TABLES) {
      const { data } = await supabase.from(table).select(table === 'session_completions' ? '*, exercise_logs(*)' : '*').eq(col, userId)
      out[name] = data || []
    }
    const { data: msgs } = await supabase.from('messages').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    out.messages = msgs || []
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mes-donnees-sirac-coaching.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setBusy(''); setMsg('Fichier téléchargé ✓')
  }

  async function deleteAccount() {
    const typed = prompt('Ton compte et toutes tes données (séances, mensurations, photos, nutrition, messages) seront supprimés définitivement.\n\nTape SUPPRIMER pour confirmer :')
    if (typed !== 'SUPPRIMER') return
    setBusy('delete'); setMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ confirm: 'SUPPRIMER' }) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setBusy(''); setMsg('Erreur : ' + (body.error || res.status)); return }
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  const row = { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 16 }
  return (
    <div>
      <p className="ios-section-title">Mes données</p>
      <div className="ios-group" style={{ overflow: 'hidden' }}>
        <button onClick={exportData} disabled={!!busy} style={{ ...row, color: 'var(--accent)', borderBottom: '0.5px solid var(--separator)' }}>
          <Download size={18} /> {busy === 'export' ? 'Préparation…' : 'Télécharger mes données'}
        </button>
        <button onClick={deleteAccount} disabled={!!busy} style={{ ...row, color: 'var(--red-text)' }}>
          <Trash2 size={18} /> {busy === 'delete' ? 'Suppression…' : 'Supprimer mon compte'}
        </button>
      </div>
      {msg && <p style={{ margin: '6px 16px 0', fontSize: 13, color: msg.startsWith('Erreur') ? 'var(--red-text)' : 'var(--green-text)' }}>{msg}</p>}
      <p style={{ margin: '6px 16px 0', fontSize: 12, color: 'var(--label2)' }}>Tes données ne sont visibles que par toi et ton coach. <a href="/legal/confidentialite" style={{ color: 'var(--accent-text)' }}>Confidentialité</a> · <a href="/legal/cgu" style={{ color: 'var(--accent-text)' }}>Conditions</a></p>
    </div>
  )
}
