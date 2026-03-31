import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { CheckCircle } from 'lucide-react'

const inputStyle = {
  WebkitTextFillColor: 'white',
  WebkitBoxShadow: '0 0 0px 1000px #1e1e2e inset',
  colorScheme: 'dark',
}

const RATINGS = [
  { key: 'training_rating', label: '🏋️ Qualité des entraînements', desc: ['Très mauvaise', 'Mauvaise', 'Correcte', 'Bonne', 'Excellente'] },
  { key: 'energy_level', label: '⚡ Niveau d\'\u00e9nergie', desc: ['Épuisé', 'Fatigué', 'Normal', 'Bien', 'En pleine forme'] },
  { key: 'sleep_quality', label: '😴 Qualité du sommeil', desc: ['Très mauvais', 'Mauvais', 'Correct', 'Bon', 'Excellent'] },
  { key: 'stress_level', label: '🧘 Niveau de stress', desc: ['Très stressé', 'Stressé', 'Modéré', 'Calme', 'Très serein'] },
]

function getMonday(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export default function WeeklyCheckin() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [thisWeek, setThisWeek] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ training_rating: 0, energy_level: 0, sleep_quality: 0, stress_level: 0, notes: '' })

  const weekStart = getMonday()

  useEffect(() => {
    if (!profile?.id) return
    loadCheckins()
  }, [profile?.id])

  async function loadCheckins() {
    const { data } = await supabase
      .from('weekly_checkins')
      .select('*')
      .eq('client_id', profile.id)
      .order('week_start', { ascending: false })
    setHistory(data || [])
    const current = data?.find(c => c.week_start === weekStart)
    setThisWeek(current || null)
    if (current) setForm({ training_rating: current.training_rating || 0, energy_level: current.energy_level || 0, sleep_quality: current.sleep_quality || 0, stress_level: current.stress_level || 0, notes: current.notes || '' })
    setLoading(false)
  }

  async function handleSave() {
    if (!form.training_rating) { alert('Note au moins un critère.'); return }
    setSaving(true)
    const payload = { client_id: profile.id, week_start: weekStart, training_rating: form.training_rating || null, energy_level: form.energy_level || null, sleep_quality: form.sleep_quality || null, stress_level: form.stress_level || null, notes: form.notes || null }
    if (thisWeek) { await supabase.from('weekly_checkins').update(payload).eq('id', thisWeek.id) }
    else { await supabase.from('weekly_checkins').insert(payload) }
    await loadCheckins()
    setSaving(false)
  }

  const weekLabel = (ws) => { if (!ws) return ''; const d = new Date(ws + 'T12:00:00'); const end = new Date(d); end.setDate(d.getDate() + 6); return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` }
  const avgScore = (c) => { const vals = [c.training_rating, c.energy_level, c.sleep_quality, c.stress_level].filter(Boolean); if (!vals.length) return null; return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) }

  return (
    <PageLayout title="Bilan hebdomadaire" back="/client">
      <div className="p-4 pb-10 space-y-4">
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-white text-sm font-semibold">Cette semaine</h3><span className="text-gray-500 text-xs">{weekLabel(weekStart)}</span></div>
          {thisWeek && (<div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2"><CheckCircle size={14} className="text-green-400" /><p className="text-green-400 text-xs">Bilan déjà soumis — tu peux modifier</p></div>)}
          {RATINGS.map(r => (
            <div key={r.key} className="space-y-2">
              <p className="text-white text-sm">{r.label}</p>
              <div className="flex gap-1.5">{[1,2,3,4,5].map(n => (<button key={n} type="button" onClick={() => setForm(f => ({...f, [r.key]: n}))} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all border ${form[r.key]===n?'bg-brand-600 border-brand-600 text-white':'bg-dark-900 border-white/10 text-gray-500'}`}>{n}</button>))}</div>
              {form[r.key] > 0 && <p className="text-brand-400 text-xs text-center">{r.desc[form[r.key]-1]}</p>}
            </div>
          ))}
          <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Commentaires libres..." rows={3} style={inputStyle} className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 resize-none" />
          <button onClick={handleSave} disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"><CheckCircle size={17} />{saving ? 'Enregistrement...' : thisWeek ? 'Mettre à jour' : 'Soumettre le bilan'}</button>
        </Card>
        {history.filter(c => c.week_start !== weekStart).length > 0 && (<div className="space-y-2"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Historique</h3>{history.filter(c => c.week_start !== weekStart).map(c => (<Card key={c.id} className="p-3"><div className="flex items-center justify-between"><span className="text-white text-sm font-medium">{weekLabel(c.week_start)}</span>{avgScore(c) && <span className="bg-brand-600/20 border border-brand-500/30 text-brand-300 text-xs px-2 py-0.5 rounded-full">{avgScore(c)} / 5</span>}</div><div className="flex flex-wrap gap-1.5 mt-2">{RATINGS.map(r => c[r.key] ? (<span key={r.key} className="bg-dark-900 px-2 py-0.5 rounded-lg text-xs text-gray-400">{r.label.split(' ').slice(1).join(' ')}: <span className="text-white">{c[r.key]}/5</span></span>) : null)}</div>{c.notes && <p className="text-gray-500 text-xs mt-2 italic">"{c.notes}"</p>}</Card>))}</div>)}
      </div>
    </PageLayout>
  )
}
