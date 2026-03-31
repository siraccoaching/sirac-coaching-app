import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Plus, TrendingUp, TrendingDown, Minus, Camera } from 'lucide-react'

const inputStyle = { WebkitTextFillColor: 'white', WebkitBoxShadow: '0 0 0px 1000px #1e1e2e inset', colorScheme: 'dark' }

const FIELDS = [
  { key: 'weight', label: 'Poids', unit: 'kg', placeholder: '75.0' },
  { key: 'body_fat', label: 'Masse grasse', unit: '%', placeholder: '18.0' },
  { key: 'muscle_mass', label: 'Masse musculaire', unit: '%', placeholder: '40.0' },
  { key: 'waist', label: 'Tour de taille', unit: 'cm', placeholder: '80.0' },
  { key: 'hips', label: 'Tour de hanches', unit: 'cm', placeholder: '95.0' },
  { key: 'chest', label: 'Tour de poitrine', unit: 'cm', placeholder: '100.0' },
  { key: 'arms', label: 'Tour de bras', unit: 'cm', placeholder: '35.0' },
  { key: 'thighs', label: 'Tour de cuisse', unit: 'cm', placeholder: '55.0' },
]

export default function Measurements() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const [form, setForm] = useState({ measured_at: new Date().toISOString().split('T')[0], weight: '', body_fat: '', muscle_mass: '', waist: '', hips: '', chest: '', arms: '', thighs: '', notes: '', photo_before_url: '', photo_after_url: '' })

  useEffect(() => { if (!profile?.id) return; loadHistory() }, [profile?.id])

  async function loadHistory() {
    const { data } = await supabase.from('client_measurements').select('*').eq('client_id', profile.id).order('measured_at', { ascending: false })
    setHistory(data || [])
    setLoading(false)
  }

  async function handlePhotoUpload(e, type) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(type)
    const ext = file.name.split('.').pop()
    const path = `${profile.id}/${Date.now()}_${type}.${ext}`
    const { data, error } = await supabase.storage.from('client-photos').upload(path, file, { upsert: true })
    if (error) { alert('Erreur upload: ' + error.message) } else {
      const { data: urlData } = supabase.storage.from('client-photos').getPublicUrl(path)
      setForm(f => ({ ...f, [`photo_${type}_url`]: urlData.publicUrl }))
    }
    setUploadingPhoto(null)
  }

  async function handleSave() {
    setSaving(true)
    const payload = { client_id: profile.id, measured_at: form.measured_at, notes: form.notes || null, photo_before_url: form.photo_before_url || null, photo_after_url: form.photo_after_url || null }
    FIELDS.forEach(f => { payload[f.key] = form[f.key] ? parseFloat(form[f.key]) : null })
    const { error } = await supabase.from('client_measurements').insert(payload)
    if (error) { alert('Erreur: ' + error.message); setSaving(false); return }
    setShowForm(false)
    setForm({ measured_at: new Date().toISOString().split('T')[0], weight: '', body_fat: '', muscle_mass: '', waist: '', hips: '', chest: '', arms: '', thighs: '', notes: '', photo_before_url: '', photo_after_url: '' })
    await loadHistory()
    setSaving(false)
  }

  function getDelta(key) {
    if (history.length < 2) return null
    const last = history[0][key]; const prev = history[1][key]
    if (!last || !prev) return null
    return last - prev
  }

  const latest = history[0]

  return (
    <PageLayout title="Mensurations" back="/client">
      <div className="p-4 pb-10 space-y-4">
        {latest && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-white text-sm font-semibold">Dernière mesure</h3><span className="text-gray-500 text-xs">{formatDate(latest.measured_at)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.filter(f => latest[f.key] != null).map(f => {
                const delta = getDelta(f.key)
                return (<div key={f.key} className="bg-dark-900 rounded-xl px-3 py-2"><p className="text-gray-500 text-xs">{f.label}</p><div className="flex items-end gap-1.5 mt-0.5"><span className="text-white font-semibold">{latest[f.key]}</span><span className="text-gray-600 text-xs mb-0.5">{f.unit}</span>{delta !== null && (<span className={`text-xs mb-0.5 flex items-center gap-0.5 ${delta < 0 ? 'text-green-400' : delta > 0 ? 'text-red-400' : 'text-gray-500'}`}>{delta < 0 ? <TrendingDown size={10} /> : delta > 0 ? <TrendingUp size={10} /> : <Minus size={10} />}{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span>)}</div></div>)
              })}
            </div>
            {(latest.photo_before_url || latest.photo_after_url) && (<div className="flex gap-2">{latest.photo_before_url && <div className="flex-1"><p className="text-gray-500 text-xs mb-1">Avant</p><img src={latest.photo_before_url} className="w-full aspect-[3/4] object-cover rounded-xl" /></div>}{latest.photo_after_url && <div className="flex-1"><p className="text-gray-500 text-xs mb-1">Après</p><img src={latest.photo_after_url} className="w-full aspect-[3/4] object-cover rounded-xl" /></div>}</div>)}
          </Card>
        )}
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"><Plus size={17} />Nouvelle mesure</button>
        ) : (
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-white text-sm font-semibold">Nouvelle mesure</h3><button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-xs">Annuler</button></div>
            <input type="date" value={form.measured_at} onChange={e => setForm(f => ({...f, measured_at: e.target.value}))} style={inputStyle} className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              {FIELDS.map(f => (<div key={f.key} className="bg-dark-900 rounded-xl px-3 py-2"><p className="text-gray-500 text-xs mb-1">{f.label} ({f.unit})</p><input type="number" step="0.1" min="0" value={form[f.key]} onChange={e => setForm(ff => ({...ff, [f.key]: e.target.value}))} placeholder={f.placeholder} style={inputStyle} className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-gray-700" /></div>))}
            </div>
            <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Notes (optionnel)" style={inputStyle} className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500" />
            <div className="space-y-2">
              <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">Photos avant / après</p>
              <div className="flex gap-2">
                {['before', 'after'].map(type => (<label key={type} className="flex-1 cursor-pointer"><div className={`border border-dashed rounded-xl p-3 text-center transition-colors ${form[`photo_${type}_url`] ? 'border-brand-500/50 bg-brand-600/10' : 'border-white/15 hover:border-white/30'}`}>{form[`photo_${type}_url`] ? (<img src={form[`photo_${type}_url`]} className="w-full aspect-[3/4] object-cover rounded-lg" />) : (<div className="py-4"><Camera size={20} className="text-gray-500 mx-auto mb-1" /><p className="text-gray-500 text-xs">{type === 'before' ? 'Avant' : 'Après'}</p>{uploadingPhoto === type && <p className="text-brand-400 text-xs mt-1">Upload...</p>}</div>)}</div><input type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, type)} /></label>))}
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-2xl transition-colors">{saving ? 'Enregistrement...' : 'Sauvegarder'}</button>
          </Card>
        )}
        {history.length > 1 && (<div className="space-y-2"><h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Historique</h3>{history.slice(1).map(m => (<Card key={m.id} className="p-3"><div className="flex items-center justify-between mb-2"><span className="text-white text-sm font-medium">{formatDate(m.measured_at)}</span>{m.weight && <span className="text-gray-400 text-sm">{m.weight} kg</span>}</div><div className="flex flex-wrap gap-1.5">{FIELDS.filter(f => m[f.key] != null).map(f => (<span key={f.key} className="bg-dark-900 px-2 py-0.5 rounded-lg text-xs text-gray-400">{f.label}: <span className="text-white">{m[f.key]}{f.unit}</span></span>))}</div>{(m.photo_before_url || m.photo_after_url) && <div className="flex gap-2 mt-2">{m.photo_before_url && <img src={m.photo_before_url} className="w-16 h-20 object-cover rounded-lg" />}{m.photo_after_url && <img src={m.photo_after_url} className="w-16 h-20 object-cover rounded-lg" />}</div>}</Card>))}</div>)}
        {!loading && history.length === 0 && (<div className="text-center py-10 text-gray-500 text-sm"><p>Aucune mesure enregistrée.</p><p className="text-xs mt-1">Commence à suivre ta progression !</p></div>)}
      </div>
    </PageLayout>
  )
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
