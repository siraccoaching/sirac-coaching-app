import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Consentement obligatoire (CGU + données de santé) pour les clients qui ne l'ont pas encore donné.
export default function ConsentGate({ profile, children }) {
  const location = useLocation()
  const [ok, setOk] = useState(false)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!profile || profile.role !== 'client' || profile.terms_accepted_at || ok || location.pathname.startsWith('/legal')) return children
  async function accept() {
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString() }).eq('id', profile.id)
    setBusy(false)
    if (error) { alert('Erreur : ' + error.message); return }
    setOk(true)
  }
  return (
    <div data-testid="consent" style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
      <div className="ios-group" style={{ maxWidth: 440, width: '100%', padding: 22 }}>
        <p style={{ margin: 0, fontSize: 34 }}>🔒</p>
        <h1 style={{ margin: '6px 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--label)' }}>Tes données, ton choix</h1>
        <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.5, color: 'var(--label1b)' }}>
          Pour ton suivi, ARISE enregistre des données de santé (poids, mensurations, photos, allergies). Seuls toi et ton coach y avez accès. Tu peux tout télécharger ou supprimer à tout moment depuis ton Profil.
        </p>
        <ConsentCheckbox checked={checked} onChange={setChecked} />
        <button onClick={accept} disabled={!checked || busy} data-testid="consent-accept"
          style={{ width: '100%', marginTop: 16, padding: '14px 0', border: 'none', borderRadius: 14, background: 'var(--accent)', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: !checked || busy ? .5 : 1 }}>
          Continuer
        </button>
      </div>
    </div>
  )
}

export function ConsentCheckbox({ checked, onChange }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.45, color: 'var(--label)', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} data-testid="consent-check" style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, accentColor: '#5e5ce6' }} />
      <span>J’accepte les <a href="/legal/cgu" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>conditions d’utilisation</a> et la <a href="/legal/confidentialite" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-text)' }}>politique de confidentialité</a>, et j’autorise le traitement de mes données de santé pour mon suivi sportif.</span>
    </label>
  )
}
