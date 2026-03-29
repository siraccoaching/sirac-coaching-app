import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { CheckCircle, Plus, ChevronDown, ChevronUp } from 'lucide-react'

const DEFAULT_EXERCISES = {
  1: ['Bench Press','Développé incliné haltères','Rowing barre','Développé militaire','Tractions','Curl biceps','Extension triceps','Planche'],
  2: ['Trap Bar Deadlift','Box Jumps','Back Squat','Hip Thrust','Nordic Hamstring Curl','Leg Curl','Calf Raises','Side Plank'],
  3: ['Floor Press','Pull-ups','Landmine Press','Face Pulls','Rowing haltères','Élévations latérales','Ab Wheel','Dead Bug'],
  4: ['Sprint 20m','Box Jumps','Broad Jumps','5-10-5 Drill','Skater Jumps','Med Ball Slams','Sprinter Sit-Ups','Planche latérale'],
}

export default function SessionLog() {
  const { sessionId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [logs, setLogs] = useState([])
  const [expanded, setExpanded] = useState(0)
  const [completing, setCompleting] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    fetchSession()
  }, [sessionId])

  async function fetchSession() {
    const { data } = await supabase.from('sessions').select('*, session_logs(*)').eq('id', sessionId).single()
    if (data) {
      setSession(data)
      setNotes(data.notes || '')
      const exercises = data.session_logs?.length
        ? data.session_logs
        : (DEFAULT_EXERCISES[data.day_number] || DEFAULT_EXERCISES[1]).map(name => ({ exercise_name: name, sets_done: null, reps_done: null, weight_kg: null, rpe_actual: null, comment: '' }))
      setLogs(exercises)
    }
  }

  function updateLog(index, field, value) {
    setLogs(l => l.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  async function saveAndComplete() {
    setCompleting(true)

    // Upsert all logs
    for (const log of logs) {
      if (log.id) {
        await supabase.from('session_logs').update({
          sets_done: log.sets_done, reps_done: log.reps_done,
          weight_kg: log.weight_kg, rpe_actual: log.rpe_actual,
          comment: log.comment
        }).eq('id', log.id)
      } else {
        await supabase.from('session_logs').insert({
          session_id: sessionId,
          exercise_name: log.exercise_name,
          sets_done: log.sets_done, reps_done: log.reps_done,
          weight_kg: log.weight_kg, rpe_actual: log.rpe_actual,
          comment: log.comment || ''
        })
      }
    }

    // Mark session complete
    await supabase.from('sessions').update({
      status: 'completed',
      notes,
      completed_at: new Date().toISOString()
    }).eq('id', sessionId)

    navigate('/client')
  }

  if (!session) return <div className="flex h-full items-center justify-center"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"/></div>

  const filled = logs.filter(l => l.weight_kg || l.reps_done).length
  const progress = logs.length > 0 ? Math.round((filled / logs.length) * 100) : 0

  return (
    <PageLayout title={session.day_title || 'Séance'} back="/client">
      <div className="p-4 space-y-4 pb-32">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>{filled}/{logs.length} exercices remplis</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Exercise list */}
        {logs.map((log, index) => (
          <Card key={index} className="overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === index ? -1 : index)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-colors ${
                (log.weight_kg || log.reps_done) ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-gray-500'
              }`}>
                {(log.weight_kg || log.reps_done) ? '✓' : index + 1}
              </div>
              <p className="flex-1 text-white text-sm font-medium text-left">{log.exercise_name}</p>
              {expanded === index ? <ChevronUp size={15} className="text-gray-500 flex-shrink-0"/> : <ChevronDown size={15} className="text-gray-500 flex-shrink-0"/>}
            </button>

            {expanded === index && (
              <div className="border-t border-white/10 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Séries', key: 'sets_done', placeholder: '4', type: 'number' },
                    { label: 'Reps', key: 'reps_done', placeholder: '8', type: 'text' },
                    { label: 'Charge (kg)', key: 'weight_kg', placeholder: '80', type: 'number' },
                  ].map(({ label, key, placeholder, type }) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-500 mb-1">{label}</label>
                      <input
                        type={type}
                        value={log[key] || ''}
                        onChange={e => updateLog(index, key, e.target.value)}
                        placeholder={placeholder}
                        className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm text-center focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-2">RPE ressenti</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {['6','7','7.5','8','8.5','9','9.5','10'].map(rpe => (
                      <button key={rpe} type="button"
                        onClick={() => updateLog(index, 'rpe_actual', rpe)}
                        className={`flex-1 min-w-0 py-2 rounded-xl text-sm font-medium transition-colors ${
                          log.rpe_actual === rpe ? 'bg-brand-600 text-white' : 'bg-dark-900 border border-white/10 text-gray-400'
                        }`}>
                        {rpe}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Commentaire</label>
                  <input
                    type="text"
                    value={log.comment || ''}
                    onChange={e => updateLog(index, 'comment', e.target.value)}
                    placeholder="Notes, sensations…"
                    className="w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}
          </Card>
        ))}

        {/* Session notes */}
        <Card className="p-4">
          <label className="block text-sm text-gray-400 mb-2">Note globale de la séance</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Comment s'est passée la séance ? Fatigue, motivation, douleurs…"
            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500 resize-none"
          />
        </Card>
      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-dark-900/95 backdrop-blur-md border-t border-white/10 safe-bottom">
        <button onClick={saveAndComplete} disabled={completing}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-base transition-colors">
          {completing ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle size={20} />
          )}
          {completing ? 'Enregistrement…' : 'Terminer la séance'}
        </button>
      </div>
    </PageLayout>
  )
}
