import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Dumbbell, Clock, Plus, Trash2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

export default function SessionLogger() {
  const { sessionId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [sess, setSess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openExercises, setOpenExercises] = useState({})

  // logs: { [exercise_id]: { sets: [{reps, load, rpe, notes}], notes: '' } }
  const [logs, setLogs] = useState({})
  const [sessionNotes, setSessionNotes] = useState('')
  const [activeTimer, setActiveTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)

  useEffect(() => {
    loadSession()
  }, [sessionId])

  // Countdown timer
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

    // Initialize logs for each exercise
    if (data?.program_exercises) {
      const initial = {}
      for (const ex of data.program_exercises.sort((a,b) => a.order_index - b.order_index)) {
        initial[ex.id] = {
          sets: Array.from({ length: ex.sets }, (_, i) => ({ reps: ex.reps || '', load: ex.load || '', rpe: '', notes: '' })),
          notes: '',
        }
        // Open first exercise by default
        if (ex.order_index === 0) setOpenExercises({ [ex.id]: true })
      }
      setLogs(initial)
    }
    setLoading(false)
  }

  function updateSet(exId, setIdx, field, value) {
    setLogs(l => ({
      ...l,
      [exId]: {
        ...l[exId],
        sets: l[exId].sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s)
      }
    }))
  }
  function addSet(exId, ex) {
    setLogs(l => ({
      ...l,
      [exId]: { ...l[exId], sets: [...l[exId].sets, { reps: ex.reps || '', load: ex.load || '', rpe: '', notes: '' }] }
    }))
  }
  function removeSet(exId, setIdx) {
    setLogs(l => ({
      ...l,
      [exId]: { ...l[exId], sets: l[exId].sets.filter((_, i) => i !== setIdx) }
    }))
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
    // 1. Create completion record
    const { data: comp, error: compErr } = await supabase
      .from('session_completions')
      .insert({ program_session_id: sessionId, client_id: profile.id, notes: sessionNotes })
      .select().single()
    if (compErr) { alert('Erreur: ' + compErr.message); setSaving(false); return }

    // 2. Insert exercise logs
    const exercises = sess.program_exercises.sort((a,b) => a.order_index - b.order_index)
    const logsToInsert = exercises
      .filter(ex => logs[ex.id]?.sets?.length > 0)
      .map(ex => ({
        completion_id: comp.id,
        exercise_id: ex.id,
        set_data: logs[ex.id].sets,
        notes: logs[ex.id].notes || '',
      }))

    if (logsToInsert.length > 0) {
      const { error: logErr } = await supabase.from('exercise_logs').insert(logsToInsert)
      if (logErr) console.error('Log error:', logErr)
    }

    navigate('/client/program', { replace: true })
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

        {sess.notes && (
          <Card className="p-3">
            <p className="text-gray-400 text-sm">{sess.notes}</p>
          </Card>
        )}

        {/* Active rest timer */}
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
              <button onClick={() => { setActiveTimer(null); setTimerSeconds(0) }}
                className="text-white/70 text-xs underline">Stop</button>
            </div>
          </div>
        )}

        {/* Exercises */}
        {exercises.map((ex, exIdx) => {
          const exLog = logs[ex.id] || { sets: [], notes: '' }
          const isOpen = openExercises[ex.id]
          return (
            <Card key={ex.id} className="overflow-hidden">
              {/* Exercise header */}
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

                  {/* Sets table header */}
                  <div className="grid grid-cols-4 gap-1 px-1">
                    {['Série', 'Reps', 'Charge', 'RPE'].map(h => (
                      <p key={h} className="text-gray-600 text-xs text-center">{h}</p>
                    ))}
                  </div>

                  {/* Sets */}
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
                            className="bg-dark-700 border border-white/8 rounded-lg px-2 py-2 text-white text-xs text-center focus:outline-none focus:border-brand-500 placeholder-gray-700"
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
                    className="w-full bg-dark-700 border border-white/8 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-brand-500" />
                </div>
              )}
            </Card>
          )
        })}

        {/* Session notes */}
        <Card className="p-3">
          <p className="text-gray-400 text-xs mb-2 font-medium">Notes de séance</p>
          <textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)}
            placeholder="Comment s'est passée la séance ?"
            rows={3}
            className="w-full bg-dark-800 border border-white/8 rounded-xl px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500 resize-none" />
        </Card>

        <button onClick={handleComplete} disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <CheckCircle size={18} />
          {saving ? 'Enregistrement...' : 'Terminer la séance'}
        </button>
      </div>
    </PageLayout>
  )
}
