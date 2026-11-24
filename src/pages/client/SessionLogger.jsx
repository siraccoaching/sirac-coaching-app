import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Dumbbell, Clock, Plus, Trash2, CheckCircle, ChevronDown, ChevronUp, X, History, Info } from 'lucide-react'
import { ExerciseMedia, ExerciseThumb, ExerciseDetailModal } from '../../components/ExerciseDemo'
import FocusMode from '../../components/FocusMode'
import { celebrate, haptic } from '../../lib/fx'
import { Maximize2 } from 'lucide-react'
import { MEASURES, measureOf, formatTarget, setHint, fillFromHints, emptySet } from '../../lib/measure'
import { cacheGet, cacheSet, isNetworkError, isOffline, queueSession, updateQueued } from '../../lib/offline'

const inputStyle = {
  WebkitTextFillColor: 'var(--label)',
}
// Série | valeur | charge | RPE | ✓ | supprimer : mêmes colonnes pour l'en-tête et les lignes
const setGrid = { display: 'grid', gridTemplateColumns: '30px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) 34px 22px', gap: 6, alignItems: 'center' }

export default function SessionLogger() {
  const { sessionId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [sess, setSess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openExercises, setOpenExercises] = useState({})
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [logs, setLogs] = useState({})
  const [sessionNotes, setSessionNotes] = useState('')
  const [activeTimer, setActiveTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [hasHistory, setHasHistory] = useState(false)
  const [showRPEModal, setShowRPEModal] = useState(false)
  const [focus, setFocus] = useState(false)
  const [completionId, setCompletionId] = useState(null)
  const [rpeValue, setRpeValue] = useState(7)
  const [wellbeingNote, setWellbeingNote] = useState('')
  const [rpeFeeling, setRpeFeeling] = useState(null)
  const [historicalPRs, setHistoricalPRs] = useState({})
  const [sessionPRs, setSessionPRs] = useState([])
  const [demo, setDemo] = useState(null)
  const [offlineMode, setOfflineMode] = useState(false)
  const [localId, setLocalId] = useState(null)
  const [savedOffline, setSavedOffline] = useState(false)

  useEffect(() => { if (profile?.id) loadSession() }, [sessionId, profile?.id])

  useEffect(() => {
    if (activeTimer === null) return
    if (timerSeconds <= 0) { setActiveTimer(null); return }
    const t = setTimeout(() => setTimerSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [activeTimer, timerSeconds])

  async function loadSession() {
    let { data, error: sessErr } = isOffline() ? { data: null, error: new Error('offline') } : await supabase
      .from('program_sessions')
      .select('*, program_exercises(*, exercise:exercises(*))')
      .eq('id', sessionId)
      .single()
    if (sessErr && isNetworkError(sessErr)) { data = cacheGet('session:' + sessionId); setOfflineMode(true) }
    else if (data) cacheSet('session:' + sessionId, data)
    setSess(data)

    if (data?.program_exercises) {
      let { data: lastComp, error: lcErr } = isOffline() ? { data: null, error: new Error('offline') } : await supabase
        .from('session_completions')
        .select('id, created_at, exercise_logs(exercise_id, exercise_name, set_data, notes)')
        .eq('program_session_id', sessionId)
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lcErr && isNetworkError(lcErr)) lastComp = cacheGet('last:' + sessionId)
      else cacheSet('last:' + sessionId, lastComp || null)

      const prevLogs = {}
      if (lastComp?.exercise_logs?.length > 0) {
        setHasHistory(true)
        for (const log of lastComp.exercise_logs) {
          prevLogs[log.exercise_id] = { sets: log.set_data, notes: log.notes }
          if (log.exercise_name) prevLogs['name:' + log.exercise_name] = prevLogs[log.exercise_id]
        }
      }

      const initial = {}
      for (const ex of data.program_exercises.sort((a,b) => a.order_index - b.order_index)) {
        const prev = prevLogs[ex.id] || prevLogs['name:' + ex.name]
        initial[ex.id] = {
          // Cases vides par défaut : la dernière séance / l'objectif s'affichent en gris
          sets: prev?.sets?.length
            ? prev.sets.map(s => emptySet(s))
            : Array.from({ length: ex.sets }, () => emptySet()),
          notes: prev?.notes || '',
        }
        if (ex.order_index === 0) setOpenExercises({ [ex.id]: true })
      }
      setLogs(initial)
      // Fetch historical max per exercise for PR detection
      if (data.program_exercises?.length > 0 && !isOffline()) {
        const names = data.program_exercises.map(e => e.name)
        const { data: pastComps } = await supabase
          .from('session_completions').select('id').eq('client_id', profile.id)
        const pastIds = (pastComps || []).map(s => s.id)
        if (pastIds.length > 0) {
          const { data: pastLogs } = await supabase
            .from('exercise_logs').select('exercise_name, set_data, exercise:program_exercises(name)')
            .in('completion_id', pastIds)
          const maxMap = {}
          for (const log of pastLogs || []) {
            const name = log.exercise?.name || log.exercise_name
            if (!names.includes(name)) continue
            const sets = (log.set_data || []).filter(s => parseFloat(s.load) > 0)
            if (sets.length === 0) continue
            const m = Math.max(...sets.map(s => parseFloat(s.load) || 0))
            if (!maxMap[name] || m > maxMap[name]) maxMap[name] = m
          }
          setHistoricalPRs(maxMap)
        }
      }
    }
    setLoading(false)
  }

  function updateSet(exId, setIdx, field, value) {
    setLogs(l => ({ ...l, [exId]: { ...l[exId], sets: l[exId].sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s) } }))
  }
  function completeSet(exId, setIdx) {
    const ex = (sess?.program_exercises || []).find(e => e.id === exId)
    setLogs(l => ({ ...l, [exId]: { ...l[exId], sets: l[exId].sets.map((s, i) => i === setIdx ? { ...fillFromHints(ex, s), _done: true } : s) } }))
  }
  function addSet(exId) {
    setLogs(l => {
      const sets = l[exId].sets
      const last = sets[sets.length - 1]
      return { ...l, [exId]: { ...l[exId], sets: [...sets, emptySet(last && (last.reps || last.load) ? last : last?._prev)] } }
    })
  }
  function removeSet(exId, setIdx) {
    setLogs(l => ({ ...l, [exId]: { ...l[exId], sets: l[exId].sets.filter((_, i) => i !== setIdx) } }))
  }
  function updateExNotes(exId, val) {
    setLogs(l => ({ ...l, [exId]: { ...l[exId], notes: val } }))
  }
  function startTimer(seconds) {
    setActiveTimer(Date.now())
    setTimerSeconds(seconds)
  }

  async function handleComplete() {
    setSaving(true)
    const exercises = sess.program_exercises.sort((a,b) => a.order_index - b.order_index)
    const buildLogs = cid => exercises
      .filter(ex => logs[ex.id]?.sets?.length > 0)
      .map(ex => ({ ...(cid ? { completion_id: cid } : {}), exercise_id: ex.id, library_exercise_id: ex.exercise_id || null, exercise_name: ex.name, set_data: logs[ex.id].sets.map(({ _prev, ...st }) => ({ ...st, measure: ex.measure || 'reps' })), notes: logs[ex.id].notes || '' }))

    const completion = { program_session_id: sessionId, client_id: profile.id, notes: sessionNotes }
    let comp = null, compErr = null
    if (!isOffline()) ({ data: comp, error: compErr } = await supabase.from('session_completions').insert(completion).select().single())
    let logsToInsert
    if (isOffline() || (compErr && isNetworkError(compErr))) {
      // Pas de réseau : la séance est gardée sur le téléphone et sera envoyée au retour du réseau
      const lid = 'local-' + Date.now()
      logsToInsert = buildLogs(null)
      queueSession({ localId: lid, completion, logs: logsToInsert, rating: null })
      setLocalId(lid); setSavedOffline(true)
    } else if (compErr) {
      alert('Erreur: ' + compErr.message); setSaving(false); return
    } else {
      logsToInsert = buildLogs(comp.id)
      if (logsToInsert.length > 0) {
        const { error: logErr } = await supabase.from('exercise_logs').insert(logsToInsert)
        if (logErr) console.error('Log error:', logErr)
      }
    }
    // Detect PRs
    const newPRs = []
    for (const log of logsToInsert) {
      const doneSets = (log.set_data || []).filter(s => s._done !== false && parseFloat(s.load) > 0)
      if (doneSets.length === 0) continue
      const maxLoad = Math.max(...doneSets.map(s => parseFloat(s.load) || 0))
      const prevMax = historicalPRs[log.exercise_name] || 0
      if (maxLoad > prevMax) {
        const exName = log.exercise_name || 'Exercice'
        newPRs.push({ name: exName, load: maxLoad, prev: prevMax })
      }
    }
    if (newPRs.length > 0) setSessionPRs(newPRs)
    setFocus(false)
    celebrate({ big: newPRs.length > 0 })
    setCompletionId(comp?.id || null)
    setShowRPEModal(true)
  }

  async function submitRPE() {
    if (localId) updateQueued(localId, { rating: { rpe_session: rpeValue, wellbeing_note: wellbeingNote, session_rating: { feeling: rpeFeeling } } })
    else if (completionId) {
      await supabase.from('session_completions').update({
        rpe_session: rpeValue,
        wellbeing_note: wellbeingNote,
        session_rating: { feeling: rpeFeeling }
      }).eq('id', completionId)
    }
    navigate('/client/program', { replace: true })
  }

  function getYoutubeEmbedUrl(url) {
    if (!url) return null
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
    if (match) return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`
    return null
  }

  if (loading) return (
    <PageLayout title="Séance" back="/client/program">
      <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-dark-800 rounded-2xl animate-pulse" />)}</div>
    </PageLayout>
  )
  if (!sess) return <PageLayout title="Séance" back="/client/program"><div className="p-4 text-gray-500 text-sm">Séance introuvable.</div></PageLayout>

  const exercises = (sess.program_exercises || []).sort((a,b) => a.order_index - b.order_index)

  return (
    <PageLayout title={sess.name} back="/client/program">
      <div className="p-4 pb-10 space-y-4">

        {offlineMode && (
          <div data-testid="offline-banner" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 14, background: 'rgba(255,149,0,0.14)', color: 'var(--orange-text)', fontSize: 14 }}>
            📶 Pas de réseau : tu peux faire ta séance, elle sera envoyée à ton coach dès que tu retrouves du réseau.
          </div>
        )}
        <button onClick={() => setFocus(true)} data-testid="focus-btn"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 16, padding: '14px 0', fontSize: 16, fontWeight: 700, color: 'white', cursor: 'pointer', background: 'linear-gradient(135deg,#5e5ce6,#8b5cf6)', boxShadow: '0 8px 22px rgba(94,92,230,.3)' }}>
          <Maximize2 size={18} /> Mode focus · une série à la fois
        </button>

        {hasHistory && (
          <div className="flex items-center gap-2 bg-brand-600/10 border border-brand-500/20 rounded-2xl px-3 py-2.5">
            <History size={13} className="text-brand-400 flex-shrink-0" />
            <p className="text-brand-300 text-xs">En gris : tes valeurs de la dernière séance. Valide ✓ pour les reprendre.</p>
          </div>
        )}

        {sess.notes && (
          <Card className="p-3">
            <p className="text-gray-400 text-sm">{sess.notes}</p>
          </Card>
        )}

        {activeTimer !== null && timerSeconds > 0 && (
          <div className="sticky top-0 z-10 bg-brand-600/90 backdrop-blur-sm rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-label" />
              <span className="text-label text-sm font-semibold">Récupération</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-label text-xl font-bold tabular-nums">
                {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, '0')}
              </span>
              <button onClick={() => { setActiveTimer(null); setTimerSeconds(0) }} className="text-white/70 text-xs underline">Stop</button>
            </div>
          </div>
        )}

        {exercises.map((ex) => {
          const exLog = logs[ex.id] || { sets: [], notes: '' }
          const isOpen = openExercises[ex.id]
          const embedUrl = getYoutubeEmbedUrl(ex.video_url)
          return (
            <Card key={ex.id} className="overflow-hidden">
              <div role="button" tabIndex={0} onClick={() => setOpenExercises(oe => ({ ...oe, [ex.id]: !oe[ex.id] }))}
                className="w-full p-3 text-left cursor-pointer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  {ex.exercise?.images?.length ? <ExerciseThumb exercise={ex.exercise} size={40} /> : (
                  <div className="w-9 h-9 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Dumbbell size={15} className="text-brand-400" />
                  </div>)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="text-label font-semibold" style={{ fontSize: 15, lineHeight: 1.25, margin: 0 }}>{ex.name}</p>
                    <p className="text-gray-500 text-xs" style={{ margin: '2px 0 0' }}>
                      {formatTarget(ex)}
                      {ex.load ? ` @ ${ex.load}` : ''}
                      {ex.rpe ? ` · RPE ${ex.rpe}` : ''}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />}
                </div>
                {((ex.video_url || ex.exercise) || ex.rest_seconds > 0) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(ex.video_url || ex.exercise) && (
                      <span role="button" tabIndex={0} onClick={e => { e.stopPropagation(); setDemo({ ...(ex.exercise || {}), name: ex.exercise?.name || ex.name, video_url: ex.video_url || ex.exercise?.video_url }) }}
                        className="flex items-center gap-1 text-brand-400 text-xs px-2.5 py-1 rounded-full border border-brand-500/30">
                        <Info size={11} />Démo
                      </span>
                    )}
                    {ex.rest_seconds > 0 && (
                      <button onClick={e => { e.stopPropagation(); startTimer(ex.rest_seconds) }}
                        className="flex items-center gap-1 text-gray-500 text-xs px-2.5 py-1 rounded-full border border-contrast/10">
                        <Clock size={11} />Récup {ex.rest_seconds}s
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="px-3 pb-3 space-y-3">
                  {ex.notes && <p className="text-gray-500 text-xs italic">{ex.notes}</p>}
                  {(embedUrl || ex.exercise?.images?.length > 0) && (
                    <ExerciseMedia exercise={{ ...(ex.exercise || {}), name: ex.name, video_url: ex.video_url || ex.exercise?.video_url }} height={180} />
                  )}
                  <div style={{ ...setGrid, padding: '0 2px' }}>
                    {['Série', measureOf(ex).key === 'reps' ? 'Reps' : measureOf(ex).key === 'distance' ? 'Mètres' : 'Sec.', 'Kg', 'RPE', '', ''].map((h, hi) => (
                      <p key={hi} className="text-gray-500 text-xs text-center" style={{ margin: 0 }}>{h}</p>
                    ))}
                  </div>
                  {exLog.sets.map((set, si) => (
                    <div key={si} style={setGrid}>
                      <div className="h-8 bg-dark-700 rounded-md flex items-center justify-center">
                        <span className="text-gray-500 text-xs">{si + 1}</span>
                      </div>
                      {['reps', 'load', 'rpe'].map(field => (
                        <input key={field}
                          value={set[field]}
                          onChange={e => updateSet(ex.id, si, field, e.target.value)}
                          placeholder={setHint(ex, set, field) || '—'}
                          inputMode="decimal"
                          aria-label={(field === 'reps' ? measureOf(ex).long : field === 'load' ? 'Charge' : 'RPE') + ' série ' + (si + 1)}
                          style={inputStyle}
                          className="hint-input min-w-0 w-full bg-dark-700 border border-contrast/10 rounded-lg px-1 py-2 text-label text-sm text-center focus:outline-none focus:border-brand-500"
                        />
                      ))}
                      <button onClick={() => { haptic(12); completeSet(ex.id, si); if (ex.rest_seconds > 0) startTimer(ex.rest_seconds) }} aria-label={'Valider la série ' + (si + 1)}
                        className={`h-8 rounded-md flex items-center justify-center transition-colors ${set._done ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-gray-500'}`}>
                        <CheckCircle size={15} />
                      </button>
                      {exLog.sets.length > 1 ? (
                        <button onClick={() => removeSet(ex.id, si)} aria-label={'Supprimer la série ' + (si + 1)} className="h-8 flex items-center justify-center text-gray-500 hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      ) : <span />}
                    </div>
                  ))}
                  <button onClick={() => addSet(ex.id)}
                    className="w-full py-1.5 border border-dashed border-contrast/10 rounded-lg text-gray-600 text-xs hover:text-brand-400 hover:border-brand-500/30 transition-colors flex items-center justify-center gap-1">
                    <Plus size={11} /> Ajouter une série
                  </button>
                  <input value={exLog.notes} onChange={e => updateExNotes(ex.id, e.target.value)}
                    placeholder="Notes sur cet exercice..."
                    style={inputStyle}
                    className="w-full bg-dark-700 border border-contrast/10 rounded-lg px-3 py-2 text-label placeholder-gray-600 text-xs focus:outline-none focus:border-brand-500" />
                </div>
              )}
            </Card>
          )
        })}

        <Card className="p-3">
          <p className="text-gray-400 text-xs mb-2 font-medium">Notes de séance</p>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Comment s'est passée la séance ?"
            rows={3} style={inputStyle}
            className="w-full bg-dark-800 border border-contrast/10 rounded-xl px-3 py-2 text-label placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 resize-none" />
        </Card>

        <button onClick={handleComplete} disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <CheckCircle size={18} />
          {saving ? 'Enregistrement...' : 'Terminer la séance'}
        </button>

        <button onClick={() => setShowQuitConfirm(true)}
          className="w-full border border-contrast/10 text-gray-500 hover:text-red-400 hover:border-red-500/30 text-sm py-3 rounded-2xl transition-colors">
          Abandonner la séance
        </button>

        
      {showRPEModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
          <div style={{background:'var(--card)', borderRadius:'24px 24px 0 0', padding:'28px 20px 40px', width:'100%', maxWidth:480}}>
            <h3 style={{margin:'0 0 6px', fontSize:20, fontWeight:700, textAlign:'center', color:'var(--label)'}}>Séance terminée ! 🎉</h3>
            {savedOffline && <p data-testid="saved-offline" style={{margin:'0 0 10px', fontSize:13, textAlign:'center', color:'var(--orange-text)'}}>📶 Enregistrée sur ton téléphone. Elle partira toute seule au retour du réseau.</p>}
            <p style={{margin:'0 0 16px', fontSize:14, color:'var(--label2)', textAlign:'center'}}>Comment tu te sens ?</p>
            {sessionPRs.length > 0 && (
              <div className="ios-pop" style={{background:'linear-gradient(135deg,#f59e0b22,#ef444422)', border:'1px solid #f59e0b44', borderRadius:12, padding:'12px 14px', marginBottom:16}}>
                <p style={{margin:'0 0 8px', fontSize:13, fontWeight:700, color:'var(--orange-text)', textAlign:'center'}}><span style={{fontSize:28, display:'block'}}>🏆</span>Nouveau{sessionPRs.length > 1 ? 'x' : ''} PR !</p>
                {sessionPRs.map((pr, i) => (
                  <div key={i} className="ios-pop" style={{animationDelay: (0.25 + i * 0.15) + 's', display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3}}>
                    <span style={{color:'var(--label1b)'}}>{pr.name}</span>
                    <span style={{color:'var(--yellow-text)', fontWeight:700}}>{pr.load} kg {pr.prev > 0 ? '(+' + (pr.load - pr.prev).toFixed(1) + ')' : '🆕'}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex', justifyContent:'space-around', marginBottom:24}}>
              {[['😴','Fatigué'], ['😐','Neutre'], ['💪','En forme'], ['🔥','Au top']].map(([emoji, label]) => (
                <button key={emoji} onClick={() => setRpeFeeling(emoji)}
                  style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4, background: rpeFeeling === emoji ? '#6366f133' : 'transparent',
                    border: rpeFeeling === emoji ? '2px solid #6366f1' : '2px solid var(--fill)',
                    borderRadius:12, padding:'10px 12px', cursor:'pointer'}}>
                  <span style={{fontSize:24}}>{emoji}</span>
                  <span style={{fontSize:10, color:'var(--label2)'}}>{label}</span>
                </button>
              ))}
            </div>

            <p style={{margin:'0 0 8px', fontSize:13, color:'var(--label1b)', fontWeight:600}}>Difficulté perçue (RPE) : <span style={{color:'var(--accent-text)'}}>{rpeValue}/10</span></p>
            <input type="range" min={1} max={10} value={rpeValue} onChange={e => setRpeValue(Number(e.target.value))}
              style={{width:'100%', marginBottom:20, accentColor:'#6366f1'}}/>

            <textarea value={wellbeingNote} onChange={e => setWellbeingNote(e.target.value)}
              placeholder="Un commentaire sur ta séance ? (optionnel)"
              rows={2}
              style={{width:'100%', background:'var(--fill)', border:'1px solid var(--separator)', borderRadius:12,
                padding:'10px 14px', color:'var(--label)', fontSize:14, resize:'none', boxSizing:'border-box', marginBottom:16,
                WebkitTextFillColor:'var(--label)', WebkitBoxShadow:'0 0 0px 1000px var(--fill) inset'}}/>

            <button onClick={submitRPE}
              style={{width:'100%', padding:'14px 0', background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border:'none', borderRadius:14, color:'white', fontSize:16, fontWeight:700, cursor:'pointer'}}>
              Enregistrer et terminer
            </button>
            <button onClick={() => navigate('/client/program', { replace: true })}
              style={{width:'100%', marginTop:10, padding:'10px 0', background:'transparent', border:'none',
                color:'var(--label3)', fontSize:13, cursor:'pointer'}}>
              Passer
            </button>
          </div>
        </div>
      )}

{focus && <FocusMode exercises={exercises} logs={logs} onUpdateSet={updateSet} onCompleteSet={completeSet} onClose={() => setFocus(false)} onFinish={handleComplete} />}
{demo && <ExerciseDetailModal exercise={demo} onClose={() => setDemo(null)} />}

{showQuitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-dark-800 border border-contrast/10 rounded-3xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-label font-semibold">Abandonner la séance ?</h3>
                <button onClick={() => setShowQuitConfirm(false)} className="text-gray-500 hover:text-label"><X size={18} /></button>
              </div>
              <p className="text-gray-400 text-sm">Ta progression ne sera pas sauvegardée.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowQuitConfirm(false)}
                  className="flex-1 py-3 border border-contrast/10 text-gray-300 rounded-2xl text-sm font-medium">Continuer</button>
                <button onClick={() => navigate('/client/program', { replace: true })}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm font-medium transition-colors">Quitter</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
