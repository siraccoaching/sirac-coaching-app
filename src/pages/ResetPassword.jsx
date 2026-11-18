import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Page ouverte depuis le lien « mot de passe oublié » (ou d'invitation) reçu par email.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_description')
      || new URLSearchParams(window.location.search).get('error_description')
    if (linkError) { setError(linkError.replace(/\+/g, ' ')); setChecking(false); return }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setReady(true); setChecking(false)
      }
    })
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
      setTimeout(() => setChecking(false), 1500)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return }
    if (password !== confirm) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setError('Erreur : ' + error.message); return }
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1800)
  }

  const input = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(var(--contrast),0.12)', background: 'rgba(var(--contrast),0.05)', color: 'var(--label)', fontSize: 15, boxSizing: 'border-box', WebkitTextFillColor: 'var(--label)' }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, background: 'var(--card)', borderRadius: 24, border: '1px solid rgba(var(--contrast),0.08)', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--label)', margin: '0 0 6px' }}>Nouveau mot de passe</h2>
        {done ? (
          <p style={{ color: 'var(--green-text)', fontSize: 14 }}>Mot de passe enregistré ✓ Redirection vers ton espace…</p>
        ) : checking && !ready ? (
          <p style={{ color: 'var(--label2)', fontSize: 14 }}>Vérification du lien…</p>
        ) : !ready ? (
          <>
            <p style={{ color: 'var(--red-text)', fontSize: 14 }}>{error || 'Ce lien est invalide ou a expiré.'}</p>
            <button onClick={() => navigate('/login')} style={{ marginTop: 8, width: '100%', padding: '12px 0', background: '#6366f1', border: 'none', borderRadius: 12, color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              Redemander un lien
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            <p style={{ color: 'var(--label2)', fontSize: 13, margin: 0 }}>Choisis ton nouveau mot de passe (8 caractères minimum).</p>
            <input type="password" autoComplete="new-password" placeholder="Nouveau mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={input} />
            <input type="password" autoComplete="new-password" placeholder="Confirme le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} style={input} />
            {error && <p style={{ color: 'var(--red-text)', fontSize: 13, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={saving} style={{ padding: '13px 0', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
