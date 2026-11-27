import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Dumbbell, ChevronDown, ChevronUp, Clock, Play, CheckCircle, Layers } from 'lucide-react'
import { ExerciseThumb, ExerciseDetailModal } from '../../components/ExerciseDemo'
import { formatTarget, rpeLabel, restLabel } from '../../lib/measure'
import { loadClientProgram } from '../../lib/assignments'
import ProgramPlanner from '../../components/ProgramPlanner'
import { cacheGet, cacheSet, isOffline } from '../../lib/offline'
import { phaseAt, applyWeek } from '../../lib/periodization'

const EX_SELECT = 'program_exercises(*, exercise:exercises(*))'

export default function MyProgram() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [prog, setProg] = useState(null)
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [openBlocks, setOpenBlocks] = useState({ 0: true })
  const [openSessions, setOpenSessions] = useState({})
  const [demo, setDemo] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    loadProgram()
  }, [profile?.id])

  async function loadProgram() {
    const data = await loadClientProgram(profile.id, `
        *,
        program_blocks(*, program_sessions(*, ${EX_SELECT})),
        program_sessions!program_sessions_program_id_fkey(*, ${EX_SELECT})
      `)

    setProg(data || null)
    // ouvre directement la phase en cours
    const cur = data && phaseAt(data.program_blocks, data._start)
    if (cur?.block) setOpenBlocks({ [[...data.program_blocks].sort((a, b) => a.order_index - b.order_index).findIndex(b => b.id === cur.blockId)]: true })

    if (data) {
      const allSessionIds = (data.program_sessions || []).map(s => s.id)
      if (allSessionIds.length > 0) {
        if (isOffline()) setCompletions(cacheGet('comps:' + profile.id) || [])
        else {
          const { data: comps } = await supabase
            .from('session_completions')
            .select('program_session_id, completed_at')
            .eq('client_id', profile.id)
            .in('program_session_id', allSessionIds)
          setCompletions(comps || [])
          cacheSet('comps:' + profile.id, comps || [])
        }
      }
    }
    setLoading(false)
  }

  // Programme périodisé : une séance compte comme faite pour la semaine en cours seulement
  const phNow = prog?.type === 'block' ? phaseAt(prog.program_blocks, prog._start) : null
  const weekStart = phNow?.block ? new Date(new Date(prog._start + 'T00:00').getTime() + (phNow.globalWeek - 1) * 7 * 86400000) : null
  const doneIds = new Set(completions.filter(c => !weekStart || new Date(c.completed_at) >= weekStart).map(c => c.program_session_id))

  if (loading) return (
    <PageLayout title="Mon programme" back="/client">
      <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-dark-800 rounded-2xl animate-pulse" />)}</div>
    </PageLayout>
  )

  if (!prog) return (
    <PageLayout title="Mon programme" back="/client">
      <div className="p-8 text-center">
        <Dumbbell size={40} className="text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm font-medium">Aucun programme assigné</p>
        <p className="text-gray-600 text-xs mt-1">Ton coach va bientôt te créer un programme.</p>
      </div>
    </PageLayout>
  )

  const isBlock = prog.type === 'block'
  const blocks = prog.program_blocks?.sort((a, b) => a.order_index - b.order_index) || []
  const simpleSessions = (prog.program_sessions || [])
    .filter(s => !s.block_id)
    .sort((a, b) => a.order_index - b.order_index)

  const orderedSessions = isBlock
    ? blocks.flatMap(b => (b.program_sessions || []).sort((a, c) => a.order_index - c.order_index))
    : simpleSessions
  const ph = isBlock ? phaseAt(blocks, prog._start) : null
  const totalSessions = (prog.program_sessions || []).length
  const doneSessions = (prog.program_sessions || []).filter(s => doneIds.has(s.id)).length

  return (
    <PageLayout title={prog.name} back="/client">
      <div className="p-4 pb-10 space-y-4">

        {ph?.block && (
          <div data-testid="current-phase" className="ios-group" style={{ padding: 14 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Cette semaine</p>
            <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>{ph.block.name}</p>
            <p style={{ margin: '2px 0 8px', fontSize: 14, color: 'var(--label2)' }}>Semaine {ph.week} sur {ph.weeks}{ph.label ? ` · ${ph.label}` : ''} · semaine {ph.globalWeek} du programme</p>
            <div style={{ display: 'flex', gap: 3 }}>
              {Array.from({ length: ph.weeks }, (_, i) => (
                <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i + 1 < ph.week ? 'var(--accent)' : i + 1 === ph.week ? '#bf5af2' : (ph.block.week_labels?.[i + 1] ? 'rgba(52,199,89,0.45)' : 'var(--fill)') }} />
              ))}
            </div>
          </div>
        )}
        {ph?.before && <div className="ios-group" style={{ padding: 14, fontSize: 14, color: 'var(--label2)' }}>📅 Ton programme commence dans {ph.startsIn} jour{ph.startsIn > 1 ? 's' : ''}.</div>}

        <ProgramPlanner clientId={profile.id} sessions={orderedSessions} planSessions={ph?.blockId ? orderedSessions.filter(x => x.block_id === ph.blockId) : null} />

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-label text-sm font-semibold">Progression</p>
            <p className="text-brand-400 text-sm font-bold">{doneSessions}/{totalSessions}</p>
          </div>
          <div className="w-full bg-dark-700 rounded-full h-2">
            <div className="bg-brand-500 h-2 rounded-full transition-all"
              style={{ width: totalSessions ? `${(doneSessions / totalSessions) * 100}%` : '0%' }} />
          </div>
          <p className="text-gray-500 text-xs mt-1.5">séances complétées</p>
        </Card>

        {isBlock && blocks.map((block, bi) => {
          const blockSessions = (block.program_sessions || []).sort((a,b) => a.order_index - b.order_index)
          const blockDone = blockSessions.filter(s => doneIds.has(s.id)).length
          return (
            <Card key={block.id} className="overflow-hidden">
              <button onClick={() => setOpenBlocks(ob => ({ ...ob, [bi]: !ob[bi] }))}
                className="w-full flex items-center gap-2 p-3 bg-brand-600/10 border-b border-contrast/5 text-left">
                {openBlocks[bi] ? <ChevronUp size={14} className="text-brand-400" /> : <ChevronDown size={14} className="text-brand-400" />}
                <div className="flex-1">
                  <p className="text-brand-300 text-sm font-semibold">{block.name}</p>
                  <p className="text-gray-500 text-xs">{block.duration_weeks} sem · {blockDone}/{blockSessions.length} séances</p>
                </div>
                <Layers size={14} className="text-brand-500/50" />
              </button>
              {openBlocks[bi] && (
                <div className="p-3 space-y-2">
                  {block.description && (
                    <details data-testid="phase-info" style={{ background: 'var(--fill)', borderRadius: 12, padding: '10px 12px' }}>
                      <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--accent-text)' }}>Objectifs et consignes de la phase</summary>
                      <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--label1b)', whiteSpace: 'pre-line' }}>{block.description}</p>
                    </details>
                  )}
                  {blockSessions.map(sess => (
                    <SessionCard key={sess.id} sess={sess} done={doneIds.has(sess.id)} week={ph?.blockId === block.id ? ph.week : null}
                      open={openSessions[sess.id]}
                      onToggle={() => setOpenSessions(os => ({ ...os, [sess.id]: !os[sess.id] }))}
                      onStart={() => navigate(`/client/session-log/${sess.id}`)}
                      onDemo={setDemo}
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
                  onStart={() => navigate(`/client/session-log/${sess.id}`)}
                      onDemo={setDemo}
                />
              </Card>
            ))}
          </div>
        )}
      </div>
      {demo && <ExerciseDetailModal exercise={demo} onClose={() => setDemo(null)} />}
    </PageLayout>
  )
}

function SessionCard({ sess, done, open, onToggle, onStart, onDemo, week }) {
  const exercises = (sess.program_exercises || []).sort((a,b) => a.order_index - b.order_index).map(ex => applyWeek(ex, week))
  return (
    <div className="border border-contrast/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-dark-800">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          {done
            ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
            : (open ? <ChevronUp size={13} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-500 flex-shrink-0" />)
          }
          <span className={`text-sm truncate ${done ? 'text-gray-400 line-through' : 'text-label'}`}>{sess.name}</span>
          <span className="text-gray-600 text-xs flex-shrink-0">{exercises.length} exo{exercises.length !== 1 ? 's' : ''}</span>
        </button>
        <button onClick={onStart}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
            done ? 'bg-green-500/15 text-green-400' : 'bg-brand-600 text-white'
          }`}>
          {done ? <><CheckCircle size={11} /> Refaire</> : <><Play size={11} /> Démarrer</>}
        </button>
      </div>
      {open && (
        <div className="p-3 space-y-1.5 bg-dark-900/50">
          {sess.notes && <p className="text-gray-500 text-xs mb-2">{sess.notes}</p>}
          {exercises.map(ex => (
            <div key={ex.id} className="flex items-start gap-2 py-1.5 border-b border-contrast/5 last:border-0">
              {ex.exercise ? (
                <button onClick={() => onDemo?.({ ...ex.exercise, video_url: ex.video_url || ex.exercise.video_url })} aria-label={'Démo ' + ex.name} className="flex-shrink-0">
                  <ExerciseThumb exercise={ex.exercise} size={40} />
                </button>
              ) : <Dumbbell size={11} className="text-brand-400 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="text-label text-xs font-medium">{ex.name}</p>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  <span className="text-gray-500 text-xs">{formatTarget(ex)}</span>
                  {ex.load && <span className="text-gray-500 text-xs">@ {ex.load}</span>}
                  {rpeLabel(ex) && <span className="text-gray-500 text-xs">RPE {rpeLabel(ex)}</span>}
                  {restLabel(ex) && <span className="text-gray-500 text-xs flex items-center gap-0.5"><Clock size={9} />{restLabel(ex)}</span>}
                  {ex.tempo && <span className="text-gray-500 text-xs">⏱ {ex.tempo}</span>}
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
