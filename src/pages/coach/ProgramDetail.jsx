import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Layers, Dumbbell, Clock, ChevronDown, ChevronUp, Users, Trash2, Pencil, ExternalLink } from 'lucide-react'

export default function ProgramDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [prog, setProg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openBlocks, setOpenBlocks] = useState({ 0: true })
  const [openSessions, setOpenSessions] = useState({})

  useEffect(() => { loadProgram() }, [id])

  async function loadProgram() {
    const { data } = await supabase
      .from('programs')
      .select(`
        *,
        client:profiles!programs_client_id_fkey(id, name, sport),
        program_blocks(*, program_sessions(*, program_exercises(*))),
        program_sessions!program_sessions_program_id_fkey(*, program_exercises(*))
      `)
      .eq('id', id)
      .single()
    setProg(data)
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('Supprimer ce programme ?')) return
    await supabase.from('programs').delete().eq('id', id)
    navigate('/coach/programs')
  }

  if (loading) return <PageLayout title="Programme" back="/coach/programs"><div className="p-4"><div className="h-32 bg-dark-800 rounded-2xl animate-pulse" /></div></PageLayout>
  if (!prog) return <PageLayout title="Programme" back="/coach/programs"><div className="p-4 text-gray-500 text-sm">Programme introuvable.</div></PageLayout>

  const isBlock = prog.type === 'block'
  const blocks = prog.program_blocks?.sort((a, b) => a.order_index - b.order_index) || []
  const simpleSessions = prog.program_sessions
    ?.filter(s => !s.block_id)
    .sort((a, b) => a.order_index - b.order_index) || []

  return (
    <PageLayout title={prog.name} back="/coach/programs" action={
      <div className="flex gap-2">
        <button onClick={() => navigate(`/coach/programs/${id}/edit`)}
          className="p-2 text-gray-400 hover:text-white transition-colors">
          <Pencil size={17} />
        </button>
        <button onClick={handleDelete} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
          <Trash2 size={17} />
        </button>
      </div>
    }>
      <div className="p-4 pb-10 space-y-4">

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color={isBlock ? 'brand' : 'green'}>{isBlock ? 'Organisation en blocs' : 'Simple'}</Badge>
            {prog.client && <Badge color="gray"><Users size={10} className="inline mr-1" />{prog.client.name}</Badge>}
          </div>
          {prog.description && <p className="text-gray-400 text-sm">{prog.description}</p>}
        </Card>

        {isBlock && blocks.map((block, bi) => (
          <Card key={block.id} className="overflow-hidden">
            <button onClick={() => setOpenBlocks(ob => ({ ...ob, [bi]: !ob[bi] }))}
              className="w-full flex items-center gap-2 p-3 bg-brand-600/10 border-b border-white/5 text-left">
              {openBlocks[bi] ? <ChevronUp size={14} className="text-brand-400" /> : <ChevronDown size={14} className="text-brand-400" />}
              <span className="flex-1 text-brand-300 text-sm font-semibold">{block.name}</span>
              <span className="text-gray-500 text-xs">{block.duration_weeks} sem · {block.program_sessions?.length || 0} séances</span>
            </button>
            {openBlocks[bi] && (
              <div className="p-3 space-y-2">
                {block.description ? <p className="text-gray-500 text-xs px-1 mb-2">{block.description}</p> : null}
                {block.program_sessions?.sort((a,b) => a.order_index - b.order_index).map((sess, si) => (
                  <SessionView key={sess.id} sess={sess}
                    open={openSessions[sess.id]}
                    onToggle={() => setOpenSessions(os => ({ ...os, [sess.id]: !os[sess.id] }))}
                  />
                ))}
              </div>
            )}
          </Card>
        ))}

        {!isBlock && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Séances</h3>
            {simpleSessions.map(sess => (
              <Card key={sess.id} className="overflow-hidden">
                <SessionView sess={sess}
                  open={openSessions[sess.id]}
                  onToggle={() => setOpenSessions(os => ({ ...os, [sess.id]: !os[sess.id] }))}
                />
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

function SessionView({ sess, open, onToggle }) {
  const exercises = sess.program_exercises?.sort((a,b) => a.order_index - b.order_index) || []
  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-dark-800">
        {open ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
        <span className="flex-1 text-white text-sm">{sess.name}</span>
        <span className="text-gray-600 text-xs">{exercises.length} exo{exercises.length !== 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 bg-dark-900/50">
          {sess.notes && <p className="text-gray-500 text-xs px-1">{sess.notes}</p>}
          {exercises.map(ex => (
            <div key={ex.id} className="bg-dark-800 border border-white/5 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell size={12} className="text-brand-400 flex-shrink-0" />
                <p className="text-white text-sm font-medium">{ex.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill label="Séries" value={ex.sets} />
                <Pill label="Reps" value={ex.reps} />
                {ex.load && <Pill label="Charge" value={ex.load} />}
                {ex.rpe && <Pill label="RPE" value={ex.rpe} />}
                {ex.rest_seconds > 0 && <Pill label="Récup" value={`${ex.rest_seconds}s`} icon={<Clock size={9} />} />}
              </div>
              {ex.notes && <p className="text-gray-500 text-xs mt-1.5">{ex.notes}</p>}
              {ex.video_url && (
                <a href={ex.video_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-400 text-xs mt-1 hover:underline">
                  <ExternalLink size={10} />Vidéo
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Pill({ label, value, icon }) {
  return (
    <div className="flex items-center gap-1 bg-dark-700 rounded-lg px-2 py-1">
      {icon}
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-white text-xs font-semibold">{value}</span>
    </div>
  )
}
