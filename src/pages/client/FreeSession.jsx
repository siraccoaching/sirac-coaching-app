import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout } from '../../components/Layout'
import { Plus, Trash2, Check, Search } from 'lucide-react'

export default function FreeSession() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [search, setSearch] = useState('')
  const [selectedExercises, setSelectedExercises] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!profile?.coach_id) return
    loadExercises()
  }, [profile])

  async function loadExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('id, name, category, muscles')
      .eq('coach_id', profile.coach_id)
      .order('name')
    setExercises(data || [])
  }

  function addExercise(ex) {
    setSelectedExercises(prev => [...prev, { id: ex.id, name: ex.name, sets: [{ reps: '', load: '', rpe: '' }] }])
    setShowPicker(false)
    setSearch('')
  }

  function removeExercise(idx) {
    setSelectedExercises(prev => prev.filter((_, i) => i !== idx))
  }

  function addSet(exIdx) {
    setSelectedExercises(prev => {
      const copy = [...prev]
      copy[exIdx] = { ...copy[exIdx], sets: [...copy[exIdx].sets, { reps: '', load: '', rpe: '' }] }
      return copy
    })
  }

  function removeSet(exIdx, setIdx) {
    setSelectedExercises(prev => {
      const copy = [...prev]
      const newSets = copy[exIdx].sets.filter((_, i) => i !== setIdx)
      copy[exIdx] = { ...copy[exIdx], sets: newSets.length ? newSets : [{ reps: '', load: '', rpe: '' }] }
      return copy
    })
  }

  function updateSet(exIdx, setIdx, field, value) {
    setSelectedExercises(prev => {
      const copy = [...prev]
      const newSets = [...copy[exIdx].sets]
      newSets[setIdx] = { ...newSets[setIdx], [field]: value }
      copy[exIdx] = { ...copy[exIdx], sets: newSets }
      return copy
    })
  }

  async function saveSession() {
    if (selectedExercises.length === 0) return
    setSaving(true)
    const { data: comp, error } = await supabase
      .from('session_completions')
      .insert({ client_id: profile.id, notes: sessionNotes || null })
      .select()
      .single()
    if (error || !comp) { setSaving(false); return }
    const logs = selectedExercises.map(ex => ({
      completion_id: comp.id,
      exercise_name: ex.name,
      set_data: ex.sets.map(s => ({ reps: s.reps, load: s.load, rpe: s.rpe, _done: true }))
    }))
    await supabase.from('exercise_logs').insert(logs)
    setDone(true)
    setTimeout(() => navigate('/client'), 1500)
  }

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.category || '').toLowerCase().includes(search.toLowerCase())
  )

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#22c55e22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={28} color="#22c55e" />
      </div>
      <p style={{ color: 'white', fontSize: 18, fontWeight: 700, margin: 0 }}>Séance enregistrée !</p>
    </div>
  )

  return (
    <PageLayout title="Séance libre" back="/client">
      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {selectedExercises.length === 0 ? (
          <div style={{ background: '#15152a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: 'rgba(255,255,255,0.4)' }}>Aucun exercice ajouté</p>
            <p style={{ margin: 0, fontSize: 12, color: '#818cf8' }}>Ajoute des exercices ci-dessous</p>
          </div>
        ) : (
          selectedExercises.map((ex, exIdx) => (
            <div key={exIdx} style={{ background: '#1e1e2e', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2a2a3e' }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#a78bfa' }}>{ex.name}</p>
                <button onClick={() => removeExercise(exIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 6, marginBottom: 6 }}>
                  {['Reps', 'Kg', 'RPE', ''].map((h, i) => (
                    <p key={i} style={{ margin: 0, fontSize: 10, color: '#555', textAlign: 'center', fontWeight: 600 }}>{h}</p>
                  ))}
                </div>
                {ex.sets.map((s, setIdx) => (
                  <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 6, marginBottom: 6 }}>
                    {['reps', 'load', 'rpe'].map(field => (
                      <input key={field} type="number" inputMode={field === 'rpe' ? 'decimal' : 'numeric'}
                        value={s[field]} placeholder=""
                        onChange={e => updateSet(exIdx, setIdx, field, e.target.value)}
                        style={{ background: '#12121f', border: '1px solid #2a2a3e', borderRadius: 8, padding: '7px 0', textAlign: 'center', color: 'white', fontSize: 14, width: '100%' }} />
                    ))}
                    <button onClick={() => removeSet(exIdx, setIdx)}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button onClick={() => addSet(exIdx)}
                  style={{ background: 'none', border: '1px dashed #2a2a3e', borderRadius: 8, color: '#6366f1', fontSize: 12, padding: '6px 0', width: '100%', cursor: 'pointer', marginTop: 4 }}>
                  + Série
                </button>
              </div>
            </div>
          ))
        )}

        <button onClick={() => setShowPicker(true)}
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 14, padding: '14px', color: '#818cf8', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Plus size={16} /> Ajouter un exercice
        </button>

        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Notes sur la séance (optionnel)..."
          style={{ background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 12, padding: '12px 14px', color: 'white', fontSize: 13, resize: 'none', minHeight: 72, fontFamily: 'inherit' }} />

        {selectedExercises.length > 0 && (
          <button onClick={saveSession} disabled={saving}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 14, padding: '16px', color: 'white', fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enregistrement...' : 'Terminer la séance'}
          </button>
        )}
      </div>

      {showPicker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowPicker(false)}>
          <div style={{ width: '100%', background: '#1e1e2e', borderRadius: '20px 20px 0 0', maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #2a2a3e' }}>
              <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 16, color: 'white' }}>Choisir un exercice</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#12121f', borderRadius: 10, padding: '8px 12px' }}>
                <Search size={15} color="#555" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  style={{ background: 'none', border: 'none', color: 'white', fontSize: 14, outline: 'none', flex: 1 }} />
              </div>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 12px 24px' }}>
              {filtered.length === 0 ? (
                <p style={{ color: '#555', textAlign: 'center', padding: '24px 0', fontSize: 14 }}>Aucun exercice trouvé</p>
              ) : (
                filtered.map(ex => (
                  <button key={ex.id} onClick={() => addExercise(ex)}
                    style={{ width: '100%', background: 'none', border: 'none', padding: '11px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: '1px solid #2a2a3e' }}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ margin: 0, color: 'white', fontSize: 14, fontWeight: 500 }}>{ex.name}</p>
                      {ex.category && <p style={{ margin: 0, fontSize: 11, color: '#555' }}>{ex.category}</p>}
                    </div>
                    <Plus size={16} color="#6366f1" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
