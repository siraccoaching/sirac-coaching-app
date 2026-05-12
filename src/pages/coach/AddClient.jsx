import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { UserPlus, CheckCircle } from 'lucide-react'

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
    const [form, setForm] = useState({ name: '', email: '', sport: 'Football US', position: '', phase: 'Hors-Saison' })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

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
              setSuccess('')

      const { data: { session } } = await supabase.auth.getSession()
              if (!session) { setError('Session expirée, reconnecte-toi.'); setLoading(false); return }

      const res = await fetch('/api/create-client', {
              method: 'POST',
              headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                        email: form.email,
                        name: form.name,
                        sport: form.sport,
                        position: form.position,
                        phase: form.phase,
              }),
      })

      const data = await res.json()
              if (!res.ok) { setError(data.error || 'Erreur lors de la création du compte.'); setLoading(false); return }

      setSuccess(`Invitation envoyée à ${form.email} ! Le client recevra un email pour créer son mot de passe et accéder à son espace.`)
              setForm({ name: '', email: '', sport: 'Football US', position: '', phase: 'Hors-Saison' })
              setLoading(false)
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

  if (success) {
        return (
                <PageLayout title="Nouveau client" back="/coach">
                        <div className="p-4 flex flex-col items-center justify-center min-h-[60vh] text-center">
                                  <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mb-4">
                                              <CheckCircle size={32} className="text-green-400" />
                                  </div>
                                  <h2 className="text-white font-bold text-lg mb-2">Invitation envoyée !</h2>
                                  <p className="text-gray-400 text-sm mb-6 max-w-xs">{success}</p>
                                  <div className="flex gap-3">
                                              <button
                                                              onClick={() => setSuccess('')}
                                                              className="px-4 py-2.5 bg-dark-800 border border-white/10 text-white text-sm font-medium rounded-xl"
                                                            >
                                                            Ajouter un autre client
                                              </button>
                                              <button
                                                              onClick={() => navigate('/coach/clients')}
                                                              className="px-4 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-xl"
                                                            >
                                                            Voir mes clients
                                              </button>
                                  </div>
                        </div>
                </PageLayout>
              )
          }
          
            return (
                  <PageLayout title="Nouveau client" back="/coach">
                        <div className="p-4 pb-8 space-y-5">
                          {error && (
                              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
                                )}
                        
                                <form onSubmit={handleSubmit} className="space-y-5">
                                          <Card className="p-4 space-y-4">
                                                      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Informations personnelles</h3>
                                                      <p className="text-xs text-gray-500">Le client recevra un email d'invitation pour créer son mot de passe.</p>
                                          
                                            {[
                    { label: 'Nom complet', key: 'name', type: 'text', placeholder: 'Prénom Nom' },
                    { label: 'Email', key: 'email', type: 'email', placeholder: 'client@email.com' },
                                ].map(({ label, key, type, placeholder }) => (
                                                <div key={key}>
                                                                <label className="block text-sm text-gray-400 mb-1.5">{label} *</label>
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
                                                                    <select
                                                                                      value={form.sport}
                                                                                      onChange={e => update('sport', e.target.value)}
                                                                                      className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500"
                                                                                    >
                                                                      {SPORTS.map(s => <option key={s}>{s}</option>)}
                                                                    </select>
                                                      </div>
                                          
                                            {positions.length > 0 && (
                                  <div>
                                                  <label className="block text-sm text-gray-400 mb-1.5">Poste</label>
                                                  <div className="flex flex-wrap gap-2">
                                                    {positions.map(p => (
                                                        <button
                                                                                key={p}
                                                                                type="button"
                                                                                onClick={() => update('position', p)}
                                                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${form.position === p ? 'bg-brand-600 border-brand-600 text-white' : 'bg-dark-900 border-white/10 text-gray-400'}`}
                                                                              >
                                                          {p}
                                                        </button>
                                                      ))}
                                                  </div>
                                  </div>
                                                      )}
                                          
                                                      <div>
                                                                    <label className="block text-sm text-gray-400 mb-1.5">Phase actuelle</label>
                                                                    <input
                                                                                      type="text"
                                                                                      value={form.phase}
                                                                                      onChange={e => update('phase', e.target.value)}
                                                                                      placeholder="Ex: Pré-saison, Compétition..."
                                                                                      className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors"
                                                                                    />
                                                      </div>
                                          </Card>
                                
                                          <button
                                                        type="submit"
                                                        disabled={loading}
                                                        className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
                                                      >
                                                      <UserPlus size={17} />
                                            {loading ? 'Envoi de l\'invitation...' : 'Envoyer l\'invitation'}
                                          </button>
                                </form>
                        
                          {/* Rattacher un client existant */}
                                <Card className="p-4 space-y-3">
                                          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Rattacher un client existant</h3>
                                          <p className="text-xs text-gray-500">Si le client a déjà un compte sans coach assigné.</p>
                                          <input
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={e => searchClients(e.target.value)}
                                                        placeholder="Rechercher par nom ou email..."
                                                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors text-sm"
                                                      />
                                  {relinkMsg && <p className="text-green-400 text-xs">{relinkMsg}</p>}
                                  {searching && <p className="text-gray-500 text-xs">Recherche...</p>}
                                  {searchResults.map(r => (
                                <div key={r.id} className="flex items-center justify-between bg-dark-900 rounded-xl px-3 py-2.5">
                                              <div>
                                                              <p className="text-white text-sm font-medium">{r.name}</p>
                                                              <p className="text-gray-500 text-xs">{r.email}</p>
                                              </div>
                                              <button
                                                                onClick={() => relinkClient(r.id, r.name)}
                                                                className="text-brand-400 text-xs font-medium hover:text-brand-300 px-2 py-1 bg-brand-600/10 rounded-lg"
                                                              >
                                                              Rattacher
                                              </button>
                                </div>
                              ))}
                                </Card>
                        </div>
                  </PageLayout>
                )
              }
