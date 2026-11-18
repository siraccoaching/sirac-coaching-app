import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function JoinCoach() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const code = params.get('code') || ''

  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', email: '', password: '', sport: '', position: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!code) { setLoading(false); return }
    supabase.rpc('get_coach_by_invite', { code })
      .then(({ data, error }) => {
        if (!error && data?.length) setCoach(data[0])
        setLoading(false)
      })
  }, [code])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        // Le profil (et le rattachement au coach via le code) est créé côté base par un trigger.
        options: {
          data: { name: form.name, sport: form.sport, position: form.position, invite_code: code || undefined },
          emailRedirectTo: window.location.origin + '/login',
        }
      })
      if (signUpError) throw signUpError
      if (!authData.user?.id) throw new Error('Erreur lors de la création du compte')
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Une erreur est survenue')
    }
    setSubmitting(false)
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(var(--contrast),0.13)',
    background: 'rgba(var(--contrast),0.05)', color: 'var(--label)', fontSize: 15, outline: 'none', boxSizing: 'border-box',
    WebkitTextFillColor: 'var(--label)',
  }
  const labelStyle = { display: 'block', fontSize: 12, color: 'var(--label2)', marginBottom: 6, fontWeight: 600 }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--label2)', fontSize: 14 }}>Chargement...</div>
    </div>
  )

  if (!code || !coach) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <p style={{ fontSize: 40, marginBottom: 16 }}>❌</p>
        <p style={{ color: 'var(--label)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Lien invalide</p>
        <p style={{ color: 'var(--label2)', fontSize: 14 }}>Ce lien d'invitation est invalide ou a expiré.</p>
      </div>
    </div>
  )

  if (success) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 340 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>✅</p>
        <p style={{ color: 'var(--label)', fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Compte créé !</p>
        <p style={{ color: 'var(--accent-text)', fontSize: 14, marginBottom: 8 }}>Bienvenue dans l'équipe de {coach.name}.</p>
        <p style={{ color: 'var(--label2)', fontSize: 13 }}>Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.</p>
        <button onClick={() => navigate('/login')} style={{ marginTop: 24, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: 'white', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Se connecter
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28 }}>
            💪
          </div>
          <p style={{ color: 'var(--label)', fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Rejoindre {coach.name}</p>
          <p style={{ color: 'var(--label2)', fontSize: 13, margin: 0 }}>Crée ton compte athlète pour accéder à ton programme</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Prenom et nom</label>
            <input style={inputStyle} placeholder="Jean Dupont" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" placeholder="jean@email.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label style={labelStyle}>Mot de passe</label>
            <input style={inputStyle} type="password" placeholder="Min. 8 caracteres" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Sport</label>
              <input style={inputStyle} placeholder="Rugby, Foot..." value={form.sport}
                onChange={e => setForm(f => ({ ...f, sport: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Poste</label>
              <input style={inputStyle} placeholder="Ailier, Pivot..." value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value }))} />
            </div>
          </div>

          {error && <p style={{ color: 'var(--red-text)', fontSize: 13, margin: 0, textAlign: 'center' }}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ marginTop: 6, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: 'white', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Creation...' : 'Creer mon compte'}
          </button>

          <p style={{ textAlign: 'center', color: 'var(--label3)', fontSize: 12, margin: 0 }}>
            Deja un compte ? <span onClick={() => navigate('/login')} style={{ color: 'var(--accent-text)', cursor: 'pointer' }}>Se connecter</span>
          </p>
        </form>
      </div>
    </div>
  )
}
