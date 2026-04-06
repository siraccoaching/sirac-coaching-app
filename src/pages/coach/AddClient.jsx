import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'

const SPORTS = ['Football US','Rugby','Basketball','Athletisme','Football','Handball','Tennis','Fitness','Autre']
const POSITIONS_BY_SPORT = {
  'Football US': ['QB','WR','RB','TE','OL','DL','LB','CB','S'],
  'Rugby': ['Pilier','Talonneur','Troisieme ligne','Demi de melee','Centre','Ailier','Arriere'],
  'Basketball': ['Meneur','Arriere','Ailier','Ailier fort','Pivot'],
  'Athletisme': ['Sprint','Demi-fond','Fond','Saut','Lancer'],
  'Football': ['Gardien','Defenseur','Milieu','Attaquant'],
  'Handball': ['Gardien','Ailier','Arriere','Pivot','Demi-centre'],
}

export default function AddClient() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', email:'', password:'', sport:'Football US', position:'', phase:'Hors-Saison' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [relinkMsg, setRelinkMsg] = useState('')
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const positions = POSITIONS_BY_SPORT[form.sport] || []

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Session expiree, reconnecte-toi.'); setLoading(false); return }

    const res = await fetch('/api/create-client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        name: form.name,
        sport: form.sport,
        position: form.position,
        phase: form.phase,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erreur lors de la creation du compte.'); setLoading(false); return }
    navigate('/coach')
  }

  async function searchClients(q) {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, sport')
      .eq('role', 'client')
      .is('coach_id', null)
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(8)
    setSearchResults(data || [])
    setSearching(false)
  }

  async function relinkClient(clientId, clientName) {
    await supabase.from('profiles').update({ coach_id: profile.id }).eq('id', clientId)
    setSearchResults(prev => prev.filter(r => r.id !== clientId))
    setRelinkMsg(clientName + ' rattaché avec succès ✓')
    setTimeout(() => setRelinkMsg(''), 3000)
  }

  return (
    <PageLayout title="Nouveau client" back="/coach">
      <div className="p-4 pb-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <Card className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Informations personnelles</h3>
            {[
              { label: 'Nom complet', key: 'name', type: 'text', placeholder: 'Prenom Nom' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'client@email.com' },
              { label: 'Mot de passe temporaire', key: 'password', type: 'password', placeholder: 'Min. 8 caracteres' },
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
                {['Hors-Saison','Pre-Saison','Saison Competitive','Post-Saison'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          </Card>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors text-base">
            {loading ? 'Creation...' : 'Creer le client'}
          </button>
        </form>
      </div>

        {/* ── Rattacher un client existant ── */}
        <div style={{marginTop:24, borderTop:'1px solid #2a2a3e', paddingTop:20}}>
          <h3 style={{margin:'0 0 12px', fontSize:14, fontWeight:700, color:'#a78bfa', textTransform:'uppercase', letterSpacing:'0.5px'}}>
            Rattacher un client existant
          </h3>
          <p style={{margin:'0 0 12px', fontSize:12, color:'#888'}}>
            Recherche un compte client déjà créé pour le rattacher à ton coaching.
          </p>
          <input
            value={searchQuery}
            onChange={e => searchClients(e.target.value)}
            placeholder="Nom ou email du client..."
            style={{width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 14px', color:'white', fontSize:14, boxSizing:'border-box', outline:'none', marginBottom:10}}
          />
          {relinkMsg && (
            <p style={{color:'#22c55e', fontSize:13, margin:'0 0 10px', textAlign:'center'}}>{relinkMsg}</p>
          )}
          {searching && <p style={{color:'#888', fontSize:13, textAlign:'center'}}>Recherche...</p>}
          {searchResults.map(r => (
            <div key={r.id} style={{display:'flex', alignItems:'center', justifyContent:'space-between', background:'#1e1e2e', borderRadius:10, padding:'10px 14px', marginBottom:8}}>
              <div>
                <p style={{margin:0, fontWeight:600, fontSize:14, color:'white'}}>{r.name}</p>
                <p style={{margin:0, fontSize:12, color:'#888'}}>{r.email}{r.sport ? ' · ' + r.sport : ''}</p>
              </div>
              <button
                onClick={() => relinkClient(r.id, r.name)}
                style={{background:'#6366f1', border:'none', borderRadius:8, padding:'7px 14px', color:'white', cursor:'pointer', fontSize:13, fontWeight:600, flexShrink:0}}>
                Rattacher
              </button>
            </div>
          ))}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <p style={{color:'#666', fontSize:13, textAlign:'center'}}>Aucun client trouvé</p>
          )}
        </div>

        </PageLayout>
  )
}
