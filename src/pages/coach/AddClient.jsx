import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'

const SPORTS = ['Football US','Rugby','Basketball','Athlétisme','Football','Handball','Tennis','Fitness','Autre']
const POSITIONS_BY_SPORT = {
  'Football US': ['QB','WR','RB','TE','OL','DL','LB','CB','S'],
  'Rugby': ['Pilier','Talonneur','Troisième ligne','Demi de mêlée','Centre','Ailier','Arrière'],
  'Basketball': ['Meneur','Arrière','Ailier','Ailier fort','Pivot'],
  'Athlétisme': ['Sprint','Demi-fond','Fond','Saut','Lancer'],
  'Football': ['Gardien','Léfenseur','Milieu','Attaquant'],
  'Handball': ['Gardien','Ailier','Arrière','Pivot','Demi-centre'],
}

export default function AddClient() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', email:'', password:'', sport:'Football US', position:'', phase:'Hors-Saison' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const positions = POSITIONS_BY_SPORT[form.sport] || []

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Create auth user via admin (or invite)
    const { data: authData, error: authErr } = await supabase.auth.admin?.createUser({
      email: form.email,
      password: form.password,
      email_confirm: true
    }).catch(() => ({ data: null, error: null }))

    // Fallback: signup
    let userId
    if (!authData?.user) {
      const { data, error: signupErr } = await supabase.auth.signUp({ email: form.email, password: form.password })
      if (signupErr) { setError('Erreur lors de la création du compte.'); setLoading(false); return }
      userId = data.user?.id
    } else {
      userId = authData.user.id
    }

    if (!userId) { setError('Impossible de créer le compte client.'); setLoading(false); return }

    const { error: profileErr } = await supabase.from('profiles').insert({
      id: userId,
      name: form.name,
      email: form.email,
      role: 'client',
      sport: form.sport,
      position: form.position,
      coach_id: profile.id,
      current_phase: form.phase,
    })

    if (profileErr) { setError(profileErr.message); setLoading(false); return }
    navigate('/coach')
  }

  return (
    <PageLayout title="Nouveau client" back="/coach">
      <div className="p-4 pb-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Informations personnelles</h3>
            {[
              { label: 'Nom complet', key: 'name', type: 'text', placeholder: 'Prénom Nom' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'client@email.com' },
              { label: 'Mot de passe temporaire', key: 'password', type: 'password', placeholder: 'Min. 8 caractères' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={e => update(key, e.target.value)}
                  required
                  placeholder={placeholder}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            ))}
          </Card>

          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Sport & Profil</h3>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Sport</label>
              <select value={form.sport} onChange={e => update('sport', e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500">
                {SPORTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            {positions.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-1.5">Poste</label>
                <div className="flex flex-wrap gap-2">
                  {positions.map(p => (
                    <button key={p} type="button" onClick={() => update('position', p)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        form.position === p ? 'bg-brand-600 border-brand-600 text-white' : 'bg-transparent border-white/20 text-gray-400'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Phase actuelle</label>
              <select value={form.phase} onChange={e => update('phase', e.target.value)}
                className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500">
                {['Hors-Saison','Pré-Saison','Saison Compétitive','Post-Saison'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </Card>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors text-base">
            {loading ? 'Création…' : 'Créer le client'}
          </button>
        </form>
      </div>
    </PageLayout>
  )
}
