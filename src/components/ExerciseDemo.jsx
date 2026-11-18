import { useEffect, useState } from 'react'
import { X, ExternalLink, Search, Plus, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  exerciseImageUrl, getEmbedUrl, isDirectVideo, loadExerciseList, matchesSearch,
  MUSCLES, EQUIPMENT, CAT_COLORS,
} from '../lib/exercises'

// Animation début/fin du mouvement à partir des 2 photos de la base.
export function ExerciseAnimation({ images, alt = '', height = 220, rounded = 12 }) {
  const [frame, setFrame] = useState(0)
  const [failed, setFailed] = useState(false)
  const list = (images || []).map(exerciseImageUrl).filter(Boolean)
  useEffect(() => {
    if (list.length < 2) return
    const t = setInterval(() => setFrame(f => (f + 1) % list.length), 900)
    return () => clearInterval(t)
  }, [list.length])
  if (!list.length || failed) return null
  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#fff', borderRadius: rounded, overflow: 'hidden' }}>
      {list.map((src, i) => (
        <img key={src} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
            opacity: i === frame ? 1 : 0, transition: 'opacity 0.25s' }} />
      ))}
    </div>
  )
}

export function ExerciseThumb({ exercise, size = 48 }) {
  const src = exerciseImageUrl(exercise?.images?.[0])
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: 10, background: 'var(--fill)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontWeight: 700, fontSize: size / 2.6 }}>
        {(exercise?.name || '?').slice(0, 1).toUpperCase()}
      </div>
    )
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)}
    style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', background: '#fff', flexShrink: 0 }} />
}

// Vidéo (YouTube / Vimeo / mp4) si dispo, sinon animation photos.
export function ExerciseMedia({ exercise, height = 220 }) {
  if (!exercise) return null
  const embed = getEmbedUrl(exercise.video_url)
  if (embed) {
    return (
      <div style={{ aspectRatio: '16/9', background: '#000', borderRadius: 12, overflow: 'hidden' }}>
        <iframe src={embed} title={exercise.name} style={{ width: '100%', height: '100%', border: 'none' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
      </div>
    )
  }
  if (isDirectVideo(exercise.video_url)) {
    return <video src={exercise.video_url} controls playsInline loop muted style={{ width: '100%', borderRadius: 12, background: '#000' }} />
  }
  return <ExerciseAnimation images={exercise.images} alt={exercise.name} height={height} />
}

// Fiche complète d'un exercice (charge les consignes à l'ouverture).
export function ExerciseDetailModal({ exercise, onClose, footer }) {
  const [full, setFull] = useState(exercise)
  useEffect(() => {
    setFull(exercise)
    if (!exercise?.id || exercise.instructions !== undefined) return
    supabase.from('exercises').select('*').eq('id', exercise.id).maybeSingle()
      .then(({ data }) => { if (data) setFull(f => ({ ...f, ...data })) })
  }, [exercise?.id])
  if (!exercise) return null
  const ex = full || exercise
  const color = CAT_COLORS[ex.category] || '#6366f1'
  return (
    <div data-testid="exercise-detail" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', padding: '16px 16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 17, color: 'var(--label)' }}>{ex.name}</p>
            {ex.name_en && ex.name_en !== ex.name && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--label3)' }}>{ex.name_en}</p>}
          </div>
          {ex.video_url && !getEmbedUrl(ex.video_url) && !isDirectVideo(ex.video_url) && (
            <a href={ex.video_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--label2)', padding: 4 }} title="Ouvrir la vidéo"><ExternalLink size={18} /></a>
          )}
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: 'var(--label2)', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
        </div>
        <ExerciseMedia exercise={ex} height={240} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0' }}>
          {ex.category && <Chip color={color}>{ex.category}</Chip>}
          {ex.muscles && <Chip color="#94a3b8">{ex.muscles}</Chip>}
          {ex.equipment && <Chip color="#94a3b8">{ex.equipment}</Chip>}
          {ex.level && <Chip color="#94a3b8">{ex.level}</Chip>}
        </div>
        {ex.secondary_muscles && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--label2)' }}>Muscles secondaires : {ex.secondary_muscles}</p>}
        {ex.description && (
          <div style={{ background: 'var(--fill)', borderRadius: 12, padding: '10px 12px', marginBottom: 10 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Consignes</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label1b)', lineHeight: 1.5 }}>{ex.description}</p>
          </div>
        )}
        {ex.instructions?.length > 0 && (
          <details open={!ex.description} style={{ background: 'var(--fill)', borderRadius: 12, padding: '10px 12px' }}>
            <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--label2)', cursor: 'pointer' }}>Instructions détaillées (anglais)</summary>
            <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--label2)', lineHeight: 1.5 }}>
              {ex.instructions.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
            </ol>
          </details>
        )}
        {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
      </div>
    </div>
  )
}

function Chip({ color, children }) {
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: color + '22', color, fontWeight: 600 }}>{children}</span>
}

// Sélecteur d'exercice (base commune + exercices perso) avec recherche et filtres.
export function ExercisePicker({ onPick, onClose, title = 'Choisir un exercice', allowCustom = true }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState('')
  const [equipment, setEquipment] = useState('')
  const [onlyFeatured, setOnlyFeatured] = useState(true)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    loadExerciseList().then(setList).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  const filtered = list.filter(e =>
    matchesSearch(e, q)
    && (!muscle || (e.muscles || '').includes(muscle))
    && (!equipment || e.equipment === equipment)
    && (!onlyFeatured || q || e.featured || e.coach_id)
  ).slice(0, 120)

  const sel = { background: 'var(--fill)', border: '1px solid var(--separator)', borderRadius: 10, padding: '8px 10px', color: 'var(--label)', fontSize: 13, minWidth: 0 }
  return (
    <div data-testid="exercise-picker" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '18px 16px 28px', width: '100%', maxWidth: 520, height: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--label)' }}>{title}</p>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: 'var(--label2)', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--fill)', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
          <Search size={14} color="var(--label2)" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher (squat, pompes, dos…)"
            style={{ background: 'none', border: 'none', color: 'var(--label)', outline: 'none', flex: 1, WebkitTextFillColor: 'var(--label)' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <select value={muscle} onChange={e => setMuscle(e.target.value)} style={sel} aria-label="Muscle">
            <option value="">Tous muscles</option>
            {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={equipment} onChange={e => setEquipment(e.target.value)} style={sel} aria-label="Matériel">
            <option value="">Tout matériel</option>
            {EQUIPMENT.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--label2)', marginBottom: 8 }}>
          <input type="checkbox" checked={onlyFeatured} onChange={e => setOnlyFeatured(e.target.checked)} />
          Essentiels uniquement (la recherche couvre toute la base)
        </label>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? <p style={{ color: 'var(--label2)', textAlign: 'center', marginTop: 20 }}>Chargement…</p>
            : error ? <p style={{ color: 'var(--red-text)', textAlign: 'center', marginTop: 20 }}>{error}</p>
            : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <p style={{ color: 'var(--label2)', margin: '0 0 10px' }}>Aucun exercice trouvé</p>
                {allowCustom && q.trim() && (
                  <button onClick={() => onPick({ id: null, name: q.trim(), images: null, video_url: null })}
                    style={{ background: 'none', border: '1px dashed #6366f1', borderRadius: 10, padding: '10px 16px', color: 'var(--accent-text)', cursor: 'pointer', fontSize: 14 }}>
                    + Ajouter « {q.trim()} » (sans démo)
                  </button>
                )}
              </div>
            )
            : filtered.map(ex => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--fill)', borderRadius: 12, padding: 8, marginBottom: 6 }}>
                <button onClick={() => setPreview(ex)} aria-label={'Voir ' + ex.name} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <ExerciseThumb exercise={ex} size={46} />
                </button>
                <button onClick={() => onPick(ex)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--label)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {ex.coach_id && <Star size={11} color="#fbbf24" fill="#fbbf24" />}{ex.name}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--label2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {[ex.muscles, ex.equipment].filter(Boolean).join(' · ')}
                  </p>
                </button>
                <button onClick={() => onPick(ex)} aria-label={'Ajouter ' + ex.name}
                  style={{ background: '#6366f1', border: 'none', borderRadius: 8, width: 30, height: 30, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={16} />
                </button>
              </div>
            ))}
        </div>
      </div>
      {preview && (
        <ExerciseDetailModal exercise={preview} onClose={() => setPreview(null)}
          footer={<button onClick={() => { onPick(preview); setPreview(null) }}
            style={{ width: '100%', padding: '12px 0', background: '#6366f1', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
            Ajouter cet exercice</button>} />
      )}
    </div>
  )
}
