import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout } from '../../components/Layout'
import { Plus, Trash2, Check, Info } from 'lucide-react'
import { ExercisePicker, ExerciseThumb, ExerciseDetailModal } from '../../components/ExerciseDemo'

export default function FreeSession() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [selectedExercises, setSelectedExercises] = useState([])
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sessionNotes, setSessionNotes] = useState('')
  const [done, setDone] = useState(false)
  const [demo, setDemo] = useState(null)

  function addExercise(ex) {
    setSelectedExercises(prev => [...prev, { id: ex.id, name: ex.name, images: ex.images, video_url: ex.video_url, sets: [{ reps: '', load: '', rpe: '' }] }])
    setShowPicker(false)
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
      library_exercise_id: ex.id || null,
      set_data: ex.sets.map(s => ({ reps: s.reps, load: s.load, rpe: s.rpe, _done: true }))
    }))
    await supabase.from('exercise_logs').insert(logs)
    setDone(true)
    setTimeout(() => navigate('/client'), 1500)
  }

  if (done) return (
    <div style={{ minHeight: 'calc(100dvh - var(--sat))', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#22c55e22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Check size={28} color="#22c55e" />
      </div>
      <p style={{ color: 'var(--label)', fontSize: 18, fontWeight: 700, margin: 0 }}>Séance enregistrée !</p>
    </div>
  )

  return (
    <>
    <PageLayout title="Séance libre" back="/client">
      <div style={{ padding: '16px 16px 100px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {selectedExercises.length === 0 ? (
          <div style={{ background: 'var(--card)', border: '1px solid rgba(var(--contrast),0.07)', borderRadius: 16, padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: 'rgba(var(--contrast),0.4)' }}>Aucun exercice ajouté</p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--accent-text)' }}>Ajoute des exercices ci-dessous</p>
          </div>
        ) : (
          selectedExercises.map((ex, exIdx) => (
            <div key={exIdx} style={{ background: 'var(--card)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--fill)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {ex.images?.length > 0 && <ExerciseThumb exercise={ex} size={36} />}
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--accent-text)' }}>{ex.name}</p>
                  {ex.id && <button onClick={() => setDemo(ex)} aria-label="Voir la démo" style={{ background: 'none', border: 'none', color: 'var(--accent-text)', cursor: 'pointer', padding: 2, display: 'flex' }}><Info size={15} /></button>}
                </div>
                <button onClick={() => removeExercise(exIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}>
                  <Trash2 size={15} />
                </button>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 6, marginBottom: 6 }}>
                  {['Reps', 'Kg', 'RPE', ''].map((h, i) => (
                    <p key={i} style={{ margin: 0, fontSize: 10, color: 'var(--label3)', textAlign: 'center', fontWeight: 600 }}>{h}</p>
                  ))}
                </div>
                {ex.sets.map((s, setIdx) => (
                  <div key={setIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 28px', gap: 6, marginBottom: 6 }}>
                    {['reps', 'load', 'rpe'].map(field => (
                      <input key={field} type="number" inputMode={field === 'rpe' ? 'decimal' : 'numeric'}
                        value={s[field]} placeholder=""
                        onChange={e => updateSet(exIdx, setIdx, field, e.target.value)}
                        style={{ background: 'var(--fill)', border: '1px solid var(--fill)', borderRadius: 8, padding: '7px 0', textAlign: 'center', color: 'var(--label)', fontSize: 14, width: '100%' }} />
                    ))}
                    <button onClick={() => removeSet(exIdx, setIdx)}
                      style={{ background: 'none', border: 'none', color: 'var(--label3)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button onClick={() => addSet(exIdx)}
                  style={{ background: 'none', border: '1px dashed var(--fill)', borderRadius: 8, color: '#6366f1', fontSize: 12, padding: '6px 0', width: '100%', cursor: 'pointer', marginTop: 4 }}>
                  + Série
                </button>
              </div>
            </div>
          ))
        )}

        <button onClick={() => setShowPicker(true)}
          style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 14, padding: '14px', color: 'var(--accent-text)', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Plus size={16} /> Ajouter un exercice
        </button>

        <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
          placeholder="Notes sur la séance (optionnel)..."
          style={{ background: 'var(--card)', border: '1px solid var(--fill)', borderRadius: 12, padding: '12px 14px', color: 'var(--label)', fontSize: 13, resize: 'none', minHeight: 72, fontFamily: 'inherit' }} />

        {selectedExercises.length > 0 && (
          <button onClick={saveSession} disabled={saving}
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 14, padding: '16px', color: 'white', fontSize: 16, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Enregistrement...' : 'Terminer la séance'}
          </button>
        )}
      </div>
    </PageLayout>

    {showPicker && <ExercisePicker onPick={addExercise} onClose={() => setShowPicker(false)} />}
    {demo && <ExerciseDetailModal exercise={demo} onClose={() => setDemo(null)} />}
    </>
  )
}
