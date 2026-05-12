import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [mode, setMode] = useState('login') // 'login' | 'reset'

  async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

      if (mode === 'reset') {
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: window.location.origin + '/reset-password',
              })
              if (error) {
                        setError('Erreur : ' + error.message)
              } else {
                        setSuccess('Un email de réinitialisation a été envoyé à ' + email + '. Vérifie ta boîte mail.')
              }
              setLoading(false)
              return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError('Email ou mot de passe incorrect.')
        setLoading(false)
  }

  return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '24px' }}>
                <div style={{ marginBottom: 32, textAlign: 'center' }}>
                          <div style={{ width: 72, height: 72, background: 'var(--accent)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>🏈</div>
                          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Sirac Coaching</h1>
                          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Plateforme de suivi athlètes</p>
                </div>

                <div style={{ width: '100%', maxWidth: 360, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
                          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }}>
                            {mode === 'login' ? 'Connexion à ton espace' : 'Réinitialiser le mot de passe'}
                          </h2>

                  {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#f87171', fontSize: 13 }}>
                      {error}
                    </div>
                  )}
                  {success && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, color: '#4ade80', fontSize: 13 }}>
                      {success}
                    </div>
                  )}

                          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                      <div>
                                                  <label style={{ display: 'block', fontSize: 13, color: 'var(--text-2)', marginBottom: 6 }}>Email</label>
                                                  <input
                                                                  type="email"
                                                                  value={email}
                                                                  onChange={e => setEmail(e.target.value)}
                                                                  required
                                                                  autoComplete="email"
                                                                  placeholder="ton@email.com"
                                                                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                                                                />
                                      </div>
                          
                            {mode === 'login' && (
                      <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <label style={{ fontSize: 13, color: 'var(--text-2)' }}>Mot de passe</label>
                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setMode('reset'); setError(''); setSuccess('') }}
                                                                        style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                                      >
                                                                      Mot de passe oublié ?
                                                    </button>
                                    </div>
                                    <input
                                                      type="password"
                                                      value={password}
                                                      onChange={e => setPassword(e.target.value)}
                                                      required
                                                      autoComplete="current-password"
                                                      placeholder="••••••••"
                                                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', color: 'var(--text)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                                                    />
                      </div>
                                    )}
                          
                                    <button
                                                  type="submit"
                                                  disabled={loading}
                                                  style={{ width: '100%', background: loading ? 'rgba(201,168,76,0.5)' : 'var(--accent)', border: 'none', borderRadius: 14, padding: '14px', color: '#000', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}
                                                >
                                      {loading ? (mode === 'reset' ? 'Envoi...' : 'Connexion...') : (mode === 'reset' ? 'Envoyer le lien' : 'Se connecter')}
                                    </button>
                          </form>
                
                  {mode === 'reset' && (
                    <button
                                  onClick={() => { setMode('login'); setError(''); setSuccess('') }}
                                  style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                ← Retour à la connexion
                    </button>
                        )}
                
                  {mode === 'login' && (
                    <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 20 }}>
                                Contacte ton coach pour obtenir ton accès.
                    </p>
                        )}
                </div>
        </div>
      )
}
