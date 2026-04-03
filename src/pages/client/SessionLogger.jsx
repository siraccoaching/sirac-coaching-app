import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Dumbbell, Clock, Plus, Trash2, CheckCircle, ChevronDown, ChevronUp, ExternalLink, X, History } from 'lucide-react'

const inputStyle = {
  WebkitTextFillColor: 'white',
  WebkitBoxShadow: '0 0 0px 1000px #1e1e2e inset',
  colorScheme: 'dark',
}

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
  const [completionId, setCompletionId] = useState(null)
  const [rpeValue, setRpeValue] = useState(7)
  const [wellbeingNote, setWellbeingNote] = useState('')
  const [rpeFeeling, setRpeFeeling] = useState(null)
  const [historicalPRs, setHistoricalPRs] = useState({})
  const [sessionPRs, setSessionPRs] = useState([])

  useEffect(() => { if (profile?.id) loadSession() }, [sessionId, profile?.id])

  useEffect(() => {
    if (activeTimer === null) return
    if (timerSeconds <= 0) { setActiveTimer(null); return }
    const t = setTimeout(() => setTimerSeconds(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [activeTimer, timerSeconds])

  async function loadSession() {
    const { data } = await supabase
      .from('program_sessions')
      .select('*, program_exercises(*)')
      .eq('id', sessionId)
      .single()
    setSess(data)

    if (data?.program_exercises) {
      const { data: lastComp } = await supabase
        .from('session_completions')
        .select('id, created_at, exercise_logs(exercise_id, set_data, notes)')
        .eq('program_session_id', sessionId)
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      const prevLogs = {}
      if (lastComp?.exercise_logs?.length > 0) {
        setHasHistory(true)
        for (const log of lastComp.exercise_logs) {
          prevLogs[log.exercise_id] = { sets: log.set_data, notes: log.notes }
        }
      }

      const initial = {}
      for (const ex of data.program_exercises.sort((a,b) => a.order_index - b.order_index)) {
        const prev = prevLogs[ex.id]
        initial[ex.id] = {
          sets: prev?.sets
            ? prev.sets.map(s => ({ reps: s.reps || '', load: s.load || '', rpe: s.rpe || '', _done: false }))
            : Array.from({ length: ex.sets }, () => ({ reps: ex.reps || '', load: ex.load || '', rpe: '', _done: false })),
          notes: prev?.notes || '',
        }
        if (ex.order_index === 0) setOpenExercises({ [ex.id]: true })
      }
      setLogs(initial)
      // Fetch historical max per exercise for PR detection
      if (data.program_exercises?.length > 0) {
        const exIds = data.program_exercises.map(e => e.id)
        const { data: pastComps } = await supabase
          .from('session_completions').select('id').eq('client_id', profile.id)
        const pastIds = (pastComps || []).map(s => s.id)
        if (pastIds.length > 0) {
          const { data: pastLogs } = await supabase
            .from('exercise_logs').select('exercise_id, set_data')
            .in('completion_id', pastIds).in('exercise_id', exIds)
          const maxMap = {}
          for (const log of pastLogs || []) {
            const sets = (log.set_data || []).filter(s => parseFloat(s.load) > 0)
            if (sets.length === 0) continue
            const m = Math.max(...sets.map(s => parseFloat(s.load) || 0))
            if (!maxMap[log.exercise_id] || m > maxMap[log.exercise_id]) maxMap[log.exercise_id] = m
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
  function addSet(exId, ex) {
    setLogs(l => ({ ...l, [exId]: { ...l[exId], sets: [...l[exId].sets, { reps: ex.reps || '', load: ex.load || '', rpe: '', _done: false }] } }))
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
    const { data: comp, error: compErr } = await supabase
      .from('session_completions')
      .insert({ program_session_id: sessionId, client_id: profile.id, notes: sessionNotes })
      .select().single()
    if (compErr) { alert('Erreur: ' + compErr.message); setSaving(false); return }

    const exercises = sess.program_exercises.sort((a,b) => a.order_index - b.order_index)
    const logsToInsert = exercises
      .filter(ex => logs[ex.id]?.sets?.length > 0)
      .map(ex => ({ completion_id: comp.id, exercise_id: ex.id, set_data: logs[ex.id].sets, notes: logs[ex.id].notes || '' }))

    if (logsToInsert.length > 0) {
      const { error: logErr } = await supabase.from('exercise_logs').insert(logsToInsert)
      if (logErr) console.error('Log error:', logErr)
    }
    // Detect PRs
    const newPRs = []
    for (const log of logsToInsert) {
      const doneSets = (log.set_data || []).filter(s => s._done !== false && parseFloat(s.load) > 0)
      if (doneSets.length === 0) continue
      const maxLoad = Math.max(...doneSets.map(s => parseFloat(s.load) || 0))
      const prevMax = historicalPRs[log.exercise_id] || 0
      if (maxLoad > prevMax) {
        const exName = sess?.program_exercises?.find(e => e.id === log.exercise_id)?.name || 'Exercice'
        newPRs.push({ name: exName, load: maxLoad, prev: prevMax })
      }
    }
    if (newPRs.length > 0) setSessionPRs(newPRs)
    setCompletionId(comp.id)
    setShowRPEModal(true)
  }

  async function submitRPE() {
    if (completionId) {
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

        {hasHistory && (
          <div className="flex items-center gap-2 bg-brand-600/10 border border-brand-500/20 rounded-2xl px-3 py-2.5">
            <History size={13} className="text-brand-400 flex-shrink-0" />
            <p className="text-brand-300 text-xs">Charges pré-remplies depuis ta dernière séance</p>
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
              <Clock size={16} className="text-white" />
              <span className="text-white text-sm font-semibold">Récupération</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-white text-xl font-bold tabular-nums">
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
              <button onClick={() => setOpenExercises(oe => ({ ...oe, [ex.id]: !oe[ex.id] }))}
                className="w-full flex items-center gap-2 p-3 text-left">
                <div className="w-7 h-7 bg-brand-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Dumbbell size={13} className="text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{ex.name}</p>
                  <p className="text-gray-500 text-xs">
                    {ex.sets}×{ex.reps}
                    {ex.load ? ` @ ${ex.load}` : ''}
                    {ex.rpe ? ` · RPE ${ex.rpe}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ex.video_url && (
                    <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 text-brand-400 text-xs px-2 py-1 rounded-lg border border-brand-500/30 hover:border-brand-500 transition-colors">
                      <ExternalLink size={10} />Vidéo
                    </a>
                  )}
                  {ex.rest_seconds > 0 && (
                    <button onClick={e => { e.stopPropagation(); startTimer(ex.rest_seconds) }}
                      className="flex items-center gap-1 text-gray-500 text-xs px-2 py-1 rounded-lg border border-white/10 hover:border-brand-500/50 hover:text-brand-400 transition-colors">
                      <Clock size={10} />{ex.rest_seconds}s
                    </button>
                  )}
                  {isOpen ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-3">
                  {ex.notes && <p className="text-gray-500 text-xs italic">{ex.notes}</p>}
                  {embedUrl && (
                    <div className="rounded-xl overflow-hidden aspect-video">
                      <iframe src={embedUrl} className="w-full h-full" frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-1 px-1">
                    {['Série', 'Reps', 'Charge', 'RPE'].map(h => (
                      <p key={h} className="text-gray-600 text-xs text-center">{h}</p>
                    ))}
                  </div>
                  {exLog.sets.map((set, si) => (
                    <div key={si} className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-dark-700 rounded-md flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-500 text-xs">{si + 1}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 flex-1">
                        {['reps', 'load', 'rpe'].map(field => (
                          <input key={field}
                            value={set[field]}
                            onChange={e => updateSet(ex.id, si, field, e.target.value)}
                            placeholder={field === 'reps' ? ex.reps : field === 'load' ? ex.load || '—' : '—'}
                            style={inputStyle}
                            className="bg-dark-700 border border-white/10 rounded-lg px-2 py-2 text-white text-xs text-center focus:outline-none focus:border-brand-500 placeholder-gray-600"
                          />
                        ))}
                      </div>
                      <button onClick={() => { updateSet(ex.id, si, '_done', true); if (ex.rest_seconds > 0) startTimer(ex.rest_seconds) }}
                        className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${set._done ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-gray-600 hover:text-green-400'}`}>
                        <CheckCircle size={13} />
                      </button>
                      {exLog.sets.length > 1 && (
                        <button onClick={() => removeSet(ex.id, si)} className="w-6 h-6 flex items-center justify-center text-gray-700 hover:text-red-400 flex-shrink-0">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addSet(ex.id, ex)}
                    className="w-full py-1.5 border border-dashed border-white/10 rounded-lg text-gray-600 text-xs hover:text-brand-400 hover:border-brand-500/30 transition-colors flex items-center justify-center gap-1">
                    <Plus size={11} /> Ajouter une série
                  </button>
                  <input value={exLog.notes} onChange={e => updateExNotes(ex.id, e.target.value)}
                    placeholder="Notes sur cet exercice..."
                    style={inputStyle}
                    className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-brand-500" />
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
            className="w-full bg-dark-800 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 resize-none" />
        </Card>

        <button onClick={handleComplete} disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <CheckCircle size={18} />
          {saving ? 'Enregistrement...' : 'Terminer la séance'}
        </button>

        <button onClick={() => setShowQuitConfirm(true)}
          className="w-full border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30 text-sm py-3 rounded-2xl transition-colors">
          Abandonner la séance
        </button>

        
      {showRPEModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
          <div style={{background:'#1e1e2e', borderRadius:'24px 24px 0 0', padding:'28px 20px 40px', width:'100%', maxWidth:480}}>
            <h3 style={{margin:'0 0 6px', fontSize:20, fontWeight:700, textAlign:'center', color:'white'}}>Séance terminée ! ð</h3>
            <p style={{margin:'0 0 16px', fontSize:14, color:'#888', textAlign:'center'}}>Comment tu te sens ?</p>
            {sessionPRs.length > 0 && (
              <div style={{background:'linear-gradient(135deg,#f59e0b22,#ef444422)', border:'1px solid #f59e0b44', borderRadius:12, padding:'12px 14px', marginBottom:16}}>
                <p style={{margin:'0 0 8px', fontSize:13, fontWeight:700, color:'#f59e0b', textAlign:'center'}}>ð Nouveau{sessionPRs.length > 1 ? 'x' : ''} PR !</p>
                {sessionPRs.map((pr, i) => (
                  <div key={i} style={{display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:3}}>
                    <span style={{color:'#e2e8f0'}}>{pr.name}</span>
                    <span style={{color:'#f59e0b', fontWeight:700}}>{pr.load} kg {pr.prev > 0 ? '(+' + (pr.load - pr.prev).toFixed(1) + ')' : 'ð'}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{display:'flex', justifyContent:'space-around', marginBottom:24}}>
              {[['ð´','Fatigué'], ['ð','Neutre'], ['ðª','En forme'], ['ð¥','Au top']].map(([emoji, label]) => (
                <button key={emoji} onClick={() => setRpeFeeling(emoji)}
                  style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4, background: rpeFeeling === emoji ? '#6366f133' : 'transparent',
                    border: rpeFeeling === emoji ? '2px solid #6366f1' : '2px solid #2a2a3e',
                    borderRadius:12, padding:'10px 12px', cursor:'pointer'}}>
                  <span style={{fontSize:24}}>{emoji}</span>
                  <span style={{fontSize:10, color:'#aaa'}}>{label}</span>
                </button>
              ))}
            </div>

            <p style={{margin:'0 0 8px', fontSize:13, color:'#ccc', fontWeight:600}}>Difficulté perçue (RPE) : <span style={{color:'#6366f1'}}>{rpeValue}/10</span></p>
            <input type="range" min={1} max={10} value={rpeValue} onChange={e => setRpeValue(Number(e.target.value))}
              style={{width:'100%', marginBottom:20, accentColor:'#6366f1'}}/>

            <textarea value={wellbeingNote} onChange={e => setWellbeingNote(e.target.value)}
              placeholder="Un commentaire sur ta séance ? (optionnel)"
              rows={2}
              style={{width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:12,
                padding:'10px 14px', color:'white', fontSize:14, resize:'none', boxSizing:'border-box', marginBottom:16,
                WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}}/>

            <button onClick={submitRPE}
              style={{width:'100%', padding:'14px 0', background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
                border:'none', borderRadius:14, color:'white', fontSize:16, fontWeight:700, cursor:'pointer'}}>
              Enregistrer et terminer
            </button>
            <button onClick={() => navigate('/client/program', { replace: true })}
              style={{width:'100%', marginTop:10, padding:'10px 0', background:'transparent', border:'none',
                color:'#666', fontSize:13, cursor:'pointer'}}>
              Passer
            </button>
          </div>
        </div>
      )}

{showQuitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-dark-800 border border-white/10 rounded-3xl p-6 w-full max-w-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">Abandonner la séance ?</h3>
                <button onClick={() => setShowQuitConfirm(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
              </div>
              <p className="text-gray-400 text-sm">Ta progression ne sera pas sauvegardée.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowQuitConfirm(false)}
                  className="flex-1 py-3 border border-white/10 text-gray-300 rounded-2xl text-sm font-medium">Continuer</button>
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
