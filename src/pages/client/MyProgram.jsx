import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Dumbbell, ChevronDown, ChevronUp, Clock, Play, CheckCircle, Layers } from 'lucide-react'

export default function MyProgram() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [prog, setProg] = useState(null)
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [openBlocks, setOpenBlocks] = useState({ 0: true })
  const [openSessions, setOpenSessions] = useState({})

  useEffect(() => {
    if (!profile?.id) return
    loadProgram()
  }, [profile?.id])

  async function loadProgram() {
    const { data } = await supabase
      .from('programs')
      .select(`
        *,
        program_blocks(*, program_sessions(*, program_exercises(*))),
        program_sessions!program_sessions_program_id_fkey(*, program_exercises(*))
      `)
      .eq('client_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    setProg(data || null)
    if (data) {
      const allSessionIds = (data.program_sessions || []).map(s => s.id)
      if (allSessionIds.length > 0) {
        const { data: comps } = await supabase
          .from('session_completions')
          .select('program_session_id, completed_at')
          .eq('client_id', profile.id)
          .in('program_session_id', allSessionIds)
        setCompletions(comps || [])
      }
    }
    setLoading(false)
  }

  const doneIds = new Set(completions.map(c => c.program_session_id))

  if (loading) return (<PageLayout title="Mon programme" back="/client"><div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-dark-800 rounded-2xl animate-pulse" />)}</div></PageLayout>)
  if (!prog) return (<PageLayout title="Mon programme" back="/client"><div className="p-8 text-center"><Dumbbell size={40} className="text-gray-600 mx-auto mb-3" /><p className="text-gray-400 text-sm font-medium">Aucun programme assign\u00e9</p><p className="text-gray-600 text-xs mt-1">Ton coach va bient\u00f4t te cr\u00e9er un programme.</p></div></PageLayout>)

  const isBlock = prog.type === 'block'
  const blocks = prog.program_blocks?.sort((a, b) => a.order_index - b.order_index) || []
  const simpleSessions = (prog.program_sessions || []).filter(s => !s.block_id).sort((a, b) => a.order_index - b.order_index)
  const totalSessions = (prog.program_sessions || []).length
  const doneSessions = (prog.program_sessions || []).filter(s => doneIds.has(s.id)).length

  return (
    <PageLayout title={prog.name} back="/client">
      <div className="p-4 pb-10 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-white text-sm font-semibold">Progression</p>
            <p className="text-brand-400 text-sm font-bold">{doneSessions}/{totalSessions}</p>
          </div>
          <div className="w-full bg-dark-700 rounded-full h-2">
            <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: totalSessions ? ((doneSessions / totalSessions) * 100) + '%' : '0%' }} />
          </div>
          <p className="text-gray-500 text-xs mt-1.5">seances completees</p>
        </Card>
        {isBlock && blocks.map((block, bi) => {
          const blockSessions = (block.program_sessions || []).sort((a,b) => a.order_index - b.order_index)
          const blockDone = blockSessions.filter(s => doneIds.has(s.id)).length
          return (
            <Card key={block.id} className="overflow-hidden">
              <button onClick={() => setOpenBlocks(ob => ({ ...ob, [bi]: !ob[bi] }))}
                className="w-full flex items-center gap-2 p-3 bg-brand-600/10 border-b border-white/5 text-left">
                {openBlocks[bi] ? <ChevronUp size={14} className="text-brand-400" /> : <ChevronDown size={14} className="text-brand-400" />}
                <div className="flex-1">
                  <p className="text-brand-300 text-sm font-semibold">{block.name}</p>
                  <p className="text-gray-500 text-xs">{block.duration_weeks} sem - {blockDone}/{blockSessions.length} seances</p>
                </div>
                <Layers size={14} className="text-brand-500/50" />
              </button>
              {openBlocks[bi] && (
                <div className="p-3 space-y-2">
                  {blockSessions.map(sess => (
                    <SessionCard key={sess.id} sess={sess} done={doneIds.has(sess.id)}
                      open={openSessions[sess.id]}
                      onToggle={() => setOpenSessions(os => ({ ...os, [sess.id]: !os[sess.id] }))}
                      onStart={() => navigate('/client/session-log/' + sess.id)}
                    />
                  ))}
                </div>
              )}
            </Card>
          )
        })}
        {!isBlock && (
          <div className="space-y-2">
            {simpleSessions.map(sess => (
              <Card key={sess.id} className="overflow-hidden">
                <SessionCard sess={sess} done={doneIds.has(sess.id)}
                  open={openSessions[sess.id]}
                  onToggle={() => setOpenSessions(os => ({ ...os, [sess.id]: !os[sess.id] }))}
                  onStart={() => navigate('/client/session-log/' + sess.id)}
                />
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

function SessionCard({ sess, done, open, onToggle, onStart }) {
  const exercises = (sess.program_exercises || []).sort((a,b) => a.order_index - b.order_index)
  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-dark-800">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          {done ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" /> : (open ? <ChevronUp size={13} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-500 flex-shrink-0" />)}
          <span className={'text-sm truncate ' + (done ? 'text-gray-400 line-through' : 'text-white')}>{sess.name}</span>
          <span className="text-gray-600 text-xs flex-shrink-0">{exercises.length} exo{exercises.length !== 1 ? 's' : ''}</span>
        </button>
        <button onClick={onStart} className={'flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ' + (done ? 'bg-green-500/15 text-green-400' : 'bg-brand-600 text-white')}>
          {done ? <><CheckCircle size={11} /> Refaire</> : <><Play size={11} /> Demarrer</>}
        </button>
      </div>
      {open && (
        <div className="p-3 space-y-1.5 bg-dark-900/50">
          {sess.notes && <p className="text-gray-500 text-xs mb-2">{sess.notes}</p>}
          {exercises.map(ex => (
            <div key={ex.id} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
              <Dumbbell size={11} className="text-brand-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium">{ex.name}</p>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  <span className="text-gray-500 text-xs">{ex.sets}x{ex.reps}</span>
                  {ex.load && <span className="text-gray-500 text-xs">@ {ex.load}</span>}
                  {ex.rpe && <span className="text-gray-500 text-xs">RPE {ex.rpe}</span>}
                  {ex.rest_seconds > 0 && <span className="text-gray-500 text-xs flex items-center gap-0.5"><Clock size={9} />{ex.rest_seconds}s</span>}
                </div>
                {ex.notes && <p className="text-gray-600 text-xs italic mt-0.5">{ex.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
