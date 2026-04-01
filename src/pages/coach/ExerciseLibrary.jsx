import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { ArrowLeft, Plus, Pencil, Trash2, Search, X } from 'lucide-react'

const CATEGORIES = ['Force', 'Cardio', 'Mobilité', 'Technique', 'Explosivité', 'Gainage', 'Récupération']
const MUSCLES = ['Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Abdominaux', 'Mollets', 'Corps entier']

function ExerciseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', category: '', muscles: '', description: '', video_url: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{background:'#1e1e2e', borderRadius:16, padding:20, marginBottom:16}}>
      <p style={{margin:'0 0 14px', fontWeight:700, color:'white', fontSize:16}}>{initial?.id ? 'Modifier' : 'Nouvel exercice'}</p>
      <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nom de l'exercice *"
        style={{width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 14px',
          color:'white', fontSize:14, boxSizing:'border-box', marginBottom:10,
          WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}}/>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10}}>
        <select value={form.category} onChange={e => set('category', e.target.value)}
          style={{background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 12px', color: form.category ? 'white' : '#666', fontSize:13}}>
          <option value="">Catégorie</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={form.muscles} onChange={e => set('muscles', e.target.value)}
          style={{background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 12px', color: form.muscles ? 'white' : '#666', fontSize:13}}>
          <option value="">Muscles ciblés</option>
          {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <input value={form.video_url} onChange={e => set('video_url', e.target.value)} placeholder="URL vidéo (YouTube/Vimeo)"
        style={{width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 14px',
          color:'white', fontSize:13, boxSizing:'border-box', marginBottom:10,
          WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}}/>
      <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description / consignes (optionnel)" rows={2}
        style={{width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 14px',
          color:'white', fontSize:13, resize:'none', boxSizing:'border-box', marginBottom:14,
          WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}}/>
      <div style={{display:'flex', gap:10}}>
        <button onClick={onCancel} style={{flex:1, padding:'10px 0', background:'#2a2a3e', border:'none', borderRadius:10, color:'#aaa', cursor:'pointer', fontSize:14}}>Annuler</button>
        <button onClick={() => onSave(form)} disabled={!form.name.trim()}
          style={{flex:2, padding:'10px 0', background: form.name.trim() ? '#6366f1' : '#3a3a4e', border:'none', borderRadius:10, color:'white', cursor: form.name.trim() ? 'pointer' : 'default', fontSize:14, fontWeight:600}}>
          {initial?.id ? 'Enregistrer' : 'Ajouter'}
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
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => { loadExercises() }, [])

  async function loadExercises() {
    setLoading(true)
    const { data } = await supabase.from('exercises').select('*').eq('coach_id', profile.id).order('name')
    setExercises(data || [])
    setLoading(false)
  }

  async function saveExercise(form) {
    if (editing?.id) {
      await supabase.from('exercises').update({ name: form.name, category: form.category, muscles: form.muscles, description: form.description, video_url: form.video_url }).eq('id', editing.id)
    } else {
      await supabase.from('exercises').insert({ ...form, coach_id: profile.id })
    }
    setShowForm(false)
    setEditing(null)
    loadExercises()
  }

  async function deleteExercise(id) {
    if (!confirm('Supprimer cet exercice ?')) return
    await supabase.from('exercises').delete().eq('id', id)
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  const filtered = exercises.filter(e => {
    const q = search.toLowerCase()
    return (!q || e.name.toLowerCase().includes(q) || (e.muscles||'').toLowerCase().includes(q)) &&
           (!filterCat || e.category === filterCat)
  })

  const catColors = { Force:'#6366f1', Cardio:'#ef4444', Mobilité:'#22c55e', Technique:'#f59e0b', Explosivité:'#f97316', Gainage:'#06b6d4', Récupération:'#8b5cf6' }

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:80}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10}}>
        <button onClick={() => navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:4}}>
          <ArrowLeft size={20}/>
        </button>
        <h2 style={{margin:0, flex:1, fontSize:18}}>Bibliothèque d'exercices</h2>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          style={{background:'#6366f1', border:'none', borderRadius:10, padding:'8px 14px', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontWeight:600, fontSize:14}}>
          <Plus size={16}/> Ajouter
        </button>
      </div>

      <div style={{padding:'12px 16px 0'}}>
        {(showForm || editing) && (
          <ExerciseForm initial={editing} onSave={saveExercise} onCancel={() => { setShowForm(false); setEditing(null) }}/>
        )}

        <div style={{display:'flex', gap:8, marginBottom:10}}>
          <div style={{flex:1, display:'flex', alignItems:'center', gap:8, background:'#1e1e2e', borderRadius:10, padding:'8px 12px'}}>
            <Search size={14} color="#888"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
              style={{background:'none', border:'none', color:'white', fontSize:14, outline:'none', flex:1, WebkitTextFillColor:'white'}}/>
            {search && <button onClick={() => setSearch('')} style={{background:'none', border:'none', color:'#888', cursor:'pointer', padding:0}}><X size={14}/></button>}
          </div>
        </div>

        <div style={{display:'flex', gap:6, overflowX:'auto', paddingBottom:8, marginBottom:8}}>
          <button onClick={() => setFilterCat('')}
            style={{flexShrink:0, padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer',
              background: !filterCat ? '#6366f1' : '#1e1e2e', color: !filterCat ? 'white' : '#888', fontSize:12, fontWeight:600}}>
            Tous ({exercises.length})
          </button>
          {CATEGORIES.map(c => {
            const count = exercises.filter(e => e.category === c).length
            if (count === 0) return null
            return (
              <button key={c} onClick={() => setFilterCat(filterCat === c ? '' : c)}
                style={{flexShrink:0, padding:'4px 12px', borderRadius:20, border:'none', cursor:'pointer',
                  background: filterCat === c ? (catColors[c] || '#6366f1') : '#1e1e2e',
                  color: filterCat === c ? 'white' : '#888', fontSize:12, fontWeight:600}}>
                {c} ({count})
              </button>
            )
          })}
        </div>

        {loading ? <p style={{color:'#888', textAlign:'center', marginTop:40}}>Chargement...</p> : filtered.length === 0 ? (
          <div style={{textAlign:'center', marginTop:60, color:'#888'}}>
            <p style={{fontSize:15}}>{exercises.length === 0 ? 'Aucun exercice dans ta bibliothèque' : 'Aucun résultat'}</p>
            {exercises.length === 0 && <p style={{fontSize:12}}>Ajoute tes exercices pour les réutiliser dans tes programmes.</p>}
          </div>
        ) : (
          filtered.map(ex => (
            <div key={ex.id} style={{background:'#1e1e2e', borderRadius:12, padding:'12px 14px', marginBottom:10, display:'flex', alignItems:'center', gap:10}}>
              <div style={{flex:1}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:3}}>
                  <p style={{margin:0, fontWeight:600, fontSize:15, color:'white'}}>{ex.name}</p>
                  {ex.category && <span style={{fontSize:11, padding:'2px 8px', borderRadius:20, background:(catColors[ex.category]||'#6366f1') + '22', color:catColors[ex.category]||'#6366f1', fontWeight:600}}>{ex.category}</span>}
                </div>
                {ex.muscles && <p style={{margin:0, fontSize:12, color:'#888'}}>{ex.muscles}</p>}
                {ex.description && <p style={{margin:'3px 0 0', fontSize:12, color:'#666', fontStyle:'italic'}}>{ex.description}</p>}
              </div>
              <button onClick={() => { setEditing(ex); setShowForm(true) }} style={{background:'none', border:'none', color:'#888', cursor:'pointer', padding:4}}><Pencil size={15}/></button>
              <button onClick={() => deleteExercise(ex.id)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:4}}><Trash2 size={15}/></button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
