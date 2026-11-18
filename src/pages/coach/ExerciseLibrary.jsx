import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout } from '../../components/Layout'
import { Plus, Pencil, Trash2, Search, X, Play, Star } from 'lucide-react'
import { ExerciseThumb, ExerciseDetailModal } from '../../components/ExerciseDemo'
import { CATEGORIES, MUSCLES, EQUIPMENT, CAT_COLORS, loadExerciseList, matchesSearch } from '../../lib/exercises'

const field = { width: '100%', background: 'var(--fill)', border: '1px solid var(--separator)', borderRadius: 10, padding: '10px 14px', color: 'var(--label)', fontSize: 14, boxSizing: 'border-box', marginBottom: 10, WebkitTextFillColor: 'var(--label)' }
const selectStyle = { background: 'var(--fill)', border: '1px solid var(--separator)', borderRadius: 10, padding: '10px 12px', color: 'var(--label)', fontSize: 13, width: '100%' }

function ExerciseForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    name: initial?.name || '', category: initial?.category || '', muscles: initial?.muscles || '',
    equipment: initial?.equipment || '', description: initial?.description || '', video_url: initial?.video_url || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const isCustomizing = initial && !initial.coach_id
  return (
    <div data-testid="exercise-form" style={{ background: 'var(--card)', borderRadius: 16, padding: 20, marginBottom: 16 }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--label)', fontSize: 16 }}>
        {isCustomizing ? 'Personnaliser l’exercice' : initial?.id ? 'Modifier' : 'Nouvel exercice'}
      </p>
      {isCustomizing && <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--label2)' }}>Ta version (vidéo, consignes) remplacera celle de la base pour toi et tes clients.</p>}
      <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nom de l'exercice *" style={{ ...field, marginTop: isCustomizing ? 0 : 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <select value={form.category} onChange={e => set('category', e.target.value)} style={selectStyle} aria-label="Catégorie">
          <option value="">Catégorie</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={MUSCLES.includes(form.muscles) ? form.muscles : (form.muscles ? '__custom' : '')} onChange={e => set('muscles', e.target.value === '__custom' ? form.muscles : e.target.value)} style={selectStyle} aria-label="Muscles">
          <option value="">Muscle principal</option>
          {form.muscles && !MUSCLES.includes(form.muscles) && <option value="__custom">{form.muscles}</option>}
          {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <select value={form.equipment} onChange={e => set('equipment', e.target.value)} style={{ ...selectStyle, marginBottom: 10 }} aria-label="Matériel">
        <option value="">Matériel</option>
        {EQUIPMENT.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <input value={form.video_url} onChange={e => set('video_url', e.target.value)} placeholder="Lien vidéo de démo (YouTube, Vimeo ou .mp4)" style={field} />
      <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Consignes d'exécution" rows={3}
        style={{ ...field, resize: 'none', marginBottom: 14 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px 0', background: 'var(--fill)', border: 'none', borderRadius: 10, color: 'var(--label2)', cursor: 'pointer', fontSize: 14 }}>Annuler</button>
        <button onClick={() => onSave(form)} disabled={!form.name.trim() || saving}
          style={{ flex: 2, padding: '10px 0', background: form.name.trim() ? '#6366f1' : 'var(--separator)', border: 'none', borderRadius: 10, color: 'white', cursor: form.name.trim() ? 'pointer' : 'default', fontSize: 14, fontWeight: 600 }}>
          {saving ? 'Enregistrement…' : initial?.coach_id ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

export default function ExerciseLibrary() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterMuscle, setFilterMuscle] = useState('')
  const [scope, setScope] = useState('featured') // featured | all | mine
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detail, setDetail] = useState(null)
  const [saving, setSaving] = useState(false)
  const [limit, setLimit] = useState(60)

  useEffect(() => { if (profile) loadExercises() }, [profile?.id])
  useEffect(() => { setLimit(60) }, [search, filterCat, filterMuscle, scope])

  async function loadExercises() {
    setLoading(true)
    try { setExercises(await loadExerciseList()) } catch (e) { setError(e.message) }
    setLoading(false)
  }

  async function saveExercise(form) {
    setSaving(true)
    const payload = {
      name: form.name.trim(), category: form.category || null, muscles: form.muscles || null,
      equipment: form.equipment || null, description: form.description || null, video_url: form.video_url || null,
    }
    let res
    if (editing?.coach_id) {
      res = await supabase.from('exercises').update(payload).eq('id', editing.id)
    } else if (editing) {
      // personnalisation d'un exercice de la base : copie perso qui garde les photos
      const { data: base } = await supabase.from('exercises').select('*').eq('id', editing.id).single()
      res = await supabase.from('exercises').insert({
        ...payload, coach_id: profile.id, slug: `${base.slug}__custom__${profile.id.slice(0, 8)}`,
        name_en: base.name_en, secondary_muscles: base.secondary_muscles, level: base.level,
        instructions: base.instructions, images: base.images, featured: true,
      })
    } else {
      res = await supabase.from('exercises').insert({ ...payload, coach_id: profile.id })
    }
    setSaving(false)
    if (res.error) { alert('Erreur : ' + res.error.message); return }
    setShowForm(false)
    setEditing(null)
    loadExercises()
  }

  async function deleteExercise(ex) {
    if (!confirm(ex.slug ? 'Supprimer ta personnalisation ? (la version de la base réapparaîtra)' : 'Supprimer cet exercice ?')) return
    await supabase.from('exercises').delete().eq('id', ex.id)
    loadExercises()
  }

  const inScope = e => scope === 'all' || (scope === 'mine' ? !!e.coach_id : (e.featured || !!e.coach_id))
  const base = exercises.filter(e => (scope === 'mine' ? !!e.coach_id : (search ? true : inScope(e))) && matchesSearch(e, search) && (!filterMuscle || (e.muscles || '').includes(filterMuscle)))
  const filtered = base.filter(e => !filterCat || e.category === filterCat)
  const mineCount = exercises.filter(e => e.coach_id).length

  return (
    <PageLayout title="Bibliothèque" subtitle={`${exercises.length} exercices avec démo`}
      action={<button onClick={() => { setEditing(null); setShowForm(true) }}
        style={{ background: 'var(--accent)', border: 'none', borderRadius: 18, padding: '7px 14px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14 }}>
        <Plus size={16} /> Ajouter
      </button>}>
      <div style={{ padding: '12px 16px 0', maxWidth: 720, margin: '0 auto' }}>
        {(showForm || editing) && (
          <ExerciseForm key={editing?.id || 'new'} initial={editing} saving={saving} onSave={saveExercise} onCancel={() => { setShowForm(false); setEditing(null) }} />
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {[['featured', 'Essentiels'], ['all', `Toute la base (${exercises.length})`], ['mine', `Mes exercices (${mineCount})`]].map(([k, l]) => (
            <button key={k} onClick={() => setScope(k)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: scope === k ? '#6366f1' : 'var(--card)', color: scope === k ? 'white' : 'var(--label2)' }}>
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card)', borderRadius: 10, padding: '8px 12px' }}>
            <Search size={14} color="var(--label2)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un exercice, un muscle…"
              style={{ background: 'none', border: 'none', color: 'var(--label)', outline: 'none', flex: 1, minWidth: 0, WebkitTextFillColor: 'var(--label)' }} />
            {search && <button onClick={() => setSearch('')} aria-label="Effacer" style={{ background: 'none', border: 'none', color: 'var(--label2)', cursor: 'pointer', padding: 0 }}><X size={14} /></button>}
          </div>
          <select value={filterMuscle} onChange={e => setFilterMuscle(e.target.value)} aria-label="Filtrer par muscle"
            style={{ background: 'var(--card)', border: 'none', borderRadius: 10, padding: '8px 6px', color: filterMuscle ? 'white' : 'var(--label2)', fontSize: 13, width: 110, flexShrink: 0 }}>
            <option value="">Muscle</option>
            {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div className="scrollbar-hide" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
          <button onClick={() => setFilterCat('')}
            style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', background: !filterCat ? '#6366f1' : 'var(--card)', color: !filterCat ? 'white' : 'var(--label2)', fontSize: 12, fontWeight: 600 }}>
            Tous ({base.length})
          </button>
          {CATEGORIES.map(c => {
            const count = base.filter(e => e.category === c).length
            if (count === 0) return null
            return (
              <button key={c} onClick={() => setFilterCat(filterCat === c ? '' : c)}
                style={{ flexShrink: 0, padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', background: filterCat === c ? (CAT_COLORS[c] || '#6366f1') : 'var(--card)', color: filterCat === c ? 'white' : 'var(--label2)', fontSize: 12, fontWeight: 600 }}>
                {c} ({count})
              </button>
            )
          })}
        </div>

        {loading ? (
          <p style={{ color: 'var(--label2)', textAlign: 'center', marginTop: 40 }}>Chargement…</p>
        ) : error ? (
          <p style={{ color: 'var(--red-text)', textAlign: 'center', marginTop: 40 }}>{error}</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60, color: 'var(--label2)' }}>
            <p style={{ fontSize: 15 }}>{scope === 'mine' && !search ? 'Tu n’as pas encore d’exercice perso' : 'Aucun résultat'}</p>
            {scope === 'mine' && <p style={{ fontSize: 12 }}>Ajoute les tiens ou personnalise ceux de la base (vidéo, consignes).</p>}
          </div>
        ) : (
          <>
            {filtered.slice(0, limit).map(ex => (
              <div key={ex.id} data-testid="exercise-row" style={{ background: 'var(--card)', borderRadius: 12, padding: 10, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setDetail(ex)} aria-label={'Démo ' + ex.name} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}>
                  <ExerciseThumb exercise={ex} size={56} />
                  {ex.video_url && <span style={{ position: 'absolute', bottom: 2, right: 2, background: '#22c55e', borderRadius: 6, padding: 2, display: 'flex' }}><Play size={9} color="white" fill="white" /></span>}
                </button>
                <button onClick={() => setDetail(ex)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, color: 'var(--label)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    {ex.coach_id && <Star size={12} color="#fbbf24" fill="#fbbf24" />}
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</span>
                    {ex.category && (
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: (CAT_COLORS[ex.category] || '#6366f1') + '22', color: CAT_COLORS[ex.category] || '#6366f1', fontWeight: 600 }}>{ex.category}</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[ex.muscles, ex.equipment].filter(Boolean).join(' · ')}</p>
                </button>
                <button onClick={() => { setEditing(ex); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} aria-label={'Modifier ' + ex.name}
                  style={{ background: 'none', border: 'none', color: 'var(--label2)', cursor: 'pointer', padding: 4 }}><Pencil size={15} /></button>
                {ex.coach_id && (
                  <button onClick={() => deleteExercise(ex)} aria-label={'Supprimer ' + ex.name}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }}><Trash2 size={15} /></button>
                )}
              </div>
            ))}
            {filtered.length > limit && (
              <button onClick={() => setLimit(l => l + 60)} style={{ width: '100%', padding: 12, background: 'var(--card)', border: 'none', borderRadius: 12, color: 'var(--accent-text)', cursor: 'pointer', fontSize: 13, marginBottom: 12 }}>
                Afficher plus ({filtered.length - limit} restants)
              </button>
            )}
          </>
        )}
      </div>

      {detail && <ExerciseDetailModal exercise={detail} onClose={() => setDetail(null)} />}
    </PageLayout>
  )
}
