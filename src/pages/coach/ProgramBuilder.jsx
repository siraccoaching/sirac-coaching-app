import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Dumbbell, Clock, Target } from 'lucide-react'

let _tmpId = 0
const tmpId = () => `tmp_${++_tmpId}`

function emptyExercise() {
  return { _id: tmpId(), name: '', sets: 3, reps: '8', load: '', rpe: '', rest_seconds: 120, notes: '' }
}
function emptySession(blockId = null) {
  return { _id: tmpId(), block_id: blockId, name: '', notes: '', exercises: [emptyExercise()] }
}
function emptyBlock() {
  return { _id: tmpId(), name: '', duration_weeks: 3, description: '', sessions: [emptySession(null)] }
}

export default function ProgramBuilder() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [clients, setClients] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openBlocks, setOpenBlocks] = useState({ 0: true })
  const [openSessions, setOpenSessions] = useState({})

  const [prog, setProg] = useState({
    name: '',
    description: '',
    type: 'block',
    client_id: '',
    blocks: [emptyBlock()],
    simpleSessions: [emptySession()],
  })

  useEffect(() => {
    if (!profile?.id) return
    loadClients()
    if (isEdit) loadProgram()
  }, [profile?.id])

  async function loadClients() {
    const { data } = await supabase.from('profiles').select('id,name,sport').eq('coach_id', profile.id).eq('role', 'client').order('name')
    setClients(data || [])
  }

  async function loadProgram() {
    // TODO: load existing program for editing
  }

  // ─── Updater helpers ───────────────────────────────────────────────────────

  const setField = (k, v) => setProg(p => ({ ...p, [k]: v }))

  const updateBlock = (bi, k, v) => setProg(p => {
    const blocks = [...p.blocks]
    blocks[bi] = { ...blocks[bi], [k]: v }
    return { ...p, blocks }
  })
  const addBlock = () => {
    setProg(p => ({ ...p, blocks: [...p.blocks, emptyBlock()] }))
    setOpenBlocks(ob => ({ ...ob, [prog.blocks.length]: true }))
  }
  const removeBlock = (bi) => setProg(p => ({ ...p, blocks: p.blocks.filter((_, i) => i !== bi) }))

  const updateSession = (bi, si, k, v, isSimple = false) => setProg(p => {
    if (isSimple) {
      const simpleSessions = [...p.simpleSessions]
      simpleSessions[si] = { ...simpleSessions[si], [k]: v }
      return { ...p, simpleSessions }
    }
    const blocks = [...p.blocks]
    const sessions = [...blocks[bi].sessions]
    sessions[si] = { ...sessions[si], [k]: v }
    blocks[bi] = { ...blocks[bi], sessions }
    return { ...p, blocks }
  })
  const addSession = (bi, isSimple = false) => setProg(p => {
    if (isSimple) return { ...p, simpleSessions: [...p.simpleSessions, emptySession()] }
    const blocks = [...p.blocks]
    blocks[bi] = { ...blocks[bi], sessions: [...blocks[bi].sessions, emptySession()] }
    return { ...p, blocks }
  })
  const removeSession = (bi, si, isSimple = false) => setProg(p => {
    if (isSimple) return { ...p, simpleSessions: p.simpleSessions.filter((_, i) => i !== si) }
    const blocks = [...p.blocks]
    blocks[bi] = { ...blocks[bi], sessions: blocks[bi].sessions.filter((_, i) => i !== si) }
    return { ...p, blocks }
  })

  const updateExercise = (bi, si, ei, k, v, isSimple = false) => setProg(p => {
    const sessions = isSimple ? [...p.simpleSessions] : [...p.blocks[bi].sessions]
    const exercises = [...sessions[si].exercises]
    exercises[ei] = { ...exercises[ei], [k]: v }
    sessions[si] = { ...sessions[si], exercises }
    if (isSimple) return { ...p, simpleSessions: sessions }
    const blocks = [...p.blocks]
    blocks[bi] = { ...blocks[bi], sessions }
    return { ...p, blocks }
  })
  const addExercise = (bi, si, isSimple = false) => setProg(p => {
    const sessions = isSimple ? [...p.simpleSessions] : [...p.blocks[bi].sessions]
    sessions[si] = { ...sessions[si], exercises: [...sessions[si].exercises, emptyExercise()] }
    if (isSimple) return { ...p, simpleSessions: sessions }
    const blocks = [...p.blocks]
    blocks[bi] = { ...blocks[bi], sessions }
    return { ...p, blocks }
  })
  const removeExercise = (bi, si, ei, isSimple = false) => setProg(p => {
    const sessions = isSimple ? [...p.simpleSessions] : [...p.blocks[bi].sessions]
    sessions[si] = { ...sessions[si], exercises: sessions[si].exercises.filter((_, i) => i !== ei) }
    if (isSimple) return { ...p, simpleSessions: sessions }
    const blocks = [...p.blocks]
    blocks[bi] = { ...blocks[bi], sessions }
    return { ...p, blocks }
  })

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!prog.name.trim()) { setError('Donne un nom au programme.'); return }
    setSaving(true); setError('')

    const allSessions = prog.type === 'block'
      ? prog.blocks.flatMap(b => b.sessions)
      : prog.simpleSessions
    const hasSession = allSessions.some(s => s.name.trim())
    if (!hasSession) { setError('Ajoute au moins une séance avec un nom.'); setSaving(false); return }

    // 1. Insert program
    const { data: progData, error: progErr } = await supabase
      .from('programs')
      .insert({ name: prog.name.trim(), description: prog.description, type: prog.type, client_id: prog.client_id || null, coach_id: profile.id })
      .select().single()
    if (progErr) { setError(progErr.message); setSaving(false); return }

    const programId = progData.id

    if (prog.type === 'block') {
      for (let bi = 0; bi < prog.blocks.length; bi++) {
        const block = prog.blocks[bi]
        if (!block.name.trim()) continue

        const { data: blockData, error: blockErr } = await supabase
          .from('program_blocks')
          .insert({ program_id: programId, name: block.name.trim(), description: block.description, duration_weeks: Number(block.duration_weeks) || 1, order_index: bi })
          .select().single()
        if (blockErr) { setError(blockErr.message); setSaving(false); return }

        await saveSessions(programId, blockData.id, block.sessions)
      }
    } else {
      await saveSessions(programId, null, prog.simpleSessions)
    }

    navigate(`/coach/programs/${programId}`)
  }

  async function saveSessions(programId, blockId, sessions) {
    for (let si = 0; si < sessions.length; si++) {
      const sess = sessions[si]
      if (!sess.name.trim()) continue

      const { data: sessData, error: sessErr } = await supabase
        .from('program_sessions')
        .insert({ program_id: programId, block_id: blockId, name: sess.name.trim(), notes: sess.notes, order_index: si })
        .select().single()
      if (sessErr) throw sessErr

      const validExercises = sess.exercises.filter(e => e.name.trim())
      if (validExercises.length > 0) {
        await supabase.from('program_exercises').insert(
          validExercises.map((ex, ei) => ({
            session_id: sessData.id,
            name: ex.name.trim(),
            sets: Number(ex.sets) || 3,
            reps: ex.reps || '8',
            load: ex.load || '',
            rpe: ex.rpe ? Number(ex.rpe) : null,
            rest_seconds: Number(ex.rest_seconds) || 120,
            notes: ex.notes || '',
            order_index: ei,
          }))
        )
      }
    }
  }

  const isSimple = prog.type === 'simple'
  const sessionList = isSimple ? prog.simpleSessions : null

  return (
    <PageLayout title={isEdit ? 'Modifier programme' : 'Nouveau programme'} back="/coach/programs">
      <div className="p-4 pb-10 space-y-4">

        {/* ── Programme info ── */}
        <Card className="p-4 space-y-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Programme</h3>
          <input value={prog.name} onChange={e => setField('name', e.target.value)}
            placeholder="Nom du programme (ex: Prépa Hors-Saison 8 semaines)"
            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors text-sm" />
          <input value={prog.description} onChange={e => setField('description', e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors text-sm" />

          {/* Type toggle */}
          <div className="flex gap-2">
            {[['block', 'Blocs (athlètes)'], ['simple', 'Simple (fitness)']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setField('type', val)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  prog.type === val ? 'bg-brand-600 border-brand-600 text-white' : 'bg-transparent border-white/15 text-gray-400'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Client assignment */}
          <select value={prog.client_id} onChange={e => setField('client_id', e.target.value)}
            className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 text-sm">
            <option value="">— Assigner à un client (optionnel) —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.sport ? `· ${c.sport}` : ''}</option>)}
          </select>
        </Card>

        {/* ── BLOC MODE ── */}
        {!isSimple && (
          <div className="space-y-3">
            {prog.blocks.map((block, bi) => (
              <Card key={block._id} className="overflow-hidden">
                {/* Block header */}
                <div className="flex items-center gap-2 p-3 bg-brand-600/10 border-b border-white/5">
                  <button onClick={() => setOpenBlocks(ob => ({ ...ob, [bi]: !ob[bi] }))}
                    className="flex-1 flex items-center gap-2 text-left">
                    {openBlocks[bi] ? <ChevronUp size={15} className="text-brand-400" /> : <ChevronDown size={15} className="text-brand-400" />}
                    <span className="text-brand-300 text-xs font-semibold uppercase tracking-wider">
                      Bloc {bi + 1}
                    </span>
                  </button>
                  {prog.blocks.length > 1 && (
                    <button onClick={() => removeBlock(bi)} className="p-1 text-gray-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {openBlocks[bi] && (
                  <div className="p-3 space-y-3">
                    <div className="flex gap-2">
                      <input value={block.name} onChange={e => updateBlock(bi, 'name', e.target.value)}
                        placeholder="Nom du bloc (ex: Accumulation)"
                        className="flex-1 bg-dark-900 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 text-sm" />
                      <div className="flex items-center gap-1.5 bg-dark-900 border border-white/10 rounded-xl px-3">
                        <input type="number" min="1" max="16" value={block.duration_weeks}
                          onChange={e => updateBlock(bi, 'duration_weeks', e.target.value)}
                          className="w-8 bg-transparent text-white text-sm text-center focus:outline-none" />
                        <span className="text-gray-500 text-xs">sem</span>
                      </div>
                    </div>

                    {/* Sessions in block */}
                    <div className="space-y-2">
                      {block.sessions.map((sess, si) => (
                        <SessionCard key={sess._id}
                          sess={sess} bi={bi} si={si} isSimple={false}
                          open={openSessions[`${bi}-${si}`]}
                          onToggle={() => setOpenSessions(os => ({ ...os, [`${bi}-${si}`]: !os[`${bi}-${si}`] }))}
                          onUpdate={(k, v) => updateSession(bi, si, k, v)}
                          onRemove={() => removeSession(bi, si)}
                          canRemove={block.sessions.length > 1}
                          onUpdateExercise={(ei, k, v) => updateExercise(bi, si, ei, k, v)}
                          onAddExercise={() => addExercise(bi, si)}
                          onRemoveExercise={(ei) => removeExercise(bi, si, ei)}
                        />
                      ))}
                    </div>
                    <button onClick={() => addSession(bi)}
                      className="w-full py-2 border border-dashed border-white/15 rounded-xl text-gray-500 text-xs hover:border-brand-500/50 hover:text-brand-400 transition-colors flex items-center justify-center gap-1.5">
                      <Plus size={12} /> Ajouter une séance
                    </button>
                  </div>
                )}
              </Card>
            ))}

            <button onClick={addBlock}
              className="w-full py-3 border border-dashed border-brand-500/30 rounded-2xl text-brand-400 text-sm hover:border-brand-500/60 transition-colors flex items-center justify-center gap-2">
              <Plus size={14} /> Ajouter un bloc
            </button>
          </div>
        )}

        {/* ── SIMPLE MODE ── */}
        {isSimple && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Séances</h3>
            {prog.simpleSessions.map((sess, si) => (
              <Card key={sess._id} className="overflow-hidden">
                <SessionCard
                  sess={sess} bi={0} si={si} isSimple={true}
                  open={openSessions[`s-${si}`]}
                  onToggle={() => setOpenSessions(os => ({ ...os, [`s-${si}`]: !os[`s-${si}`] }))}
                  onUpdate={(k, v) => updateSession(0, si, k, v, true)}
                  onRemove={() => removeSession(0, si, true)}
                  canRemove={prog.simpleSessions.length > 1}
                  onUpdateExercise={(ei, k, v) => updateExercise(0, si, ei, k, v, true)}
                  onAddExercise={() => addExercise(0, si, true)}
                  onRemoveExercise={(ei) => removeExercise(0, si, ei, true)}
                />
              </Card>
            ))}
            <button onClick={() => addSession(0, true)}
              className="w-full py-3 border border-dashed border-white/15 rounded-2xl text-gray-500 text-sm hover:border-brand-500/50 hover:text-brand-400 transition-colors flex items-center justify-center gap-2">
              <Plus size={14} /> Ajouter une séance
            </button>
          </div>
        )}

        {error && <p className="text-red-400 text-sm text-center px-2">{error}</p>}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2">
          <Save size={17} />
          {saving ? 'Enregistrement...' : 'Créer le programme'}
        </button>
      </div>
    </PageLayout>
  )
}

// ─── Session card subcomponent ──────────────────────────────────────────────

function SessionCard({ sess, si, open, onToggle, onUpdate, onRemove, canRemove, onUpdateExercise, onAddExercise, onRemoveExercise }) {
  return (
    <div className="border border-white/8 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-dark-800">
        <button onClick={onToggle} className="flex-1 flex items-center gap-2 text-left min-w-0">
          {open ? <ChevronUp size={13} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-500 flex-shrink-0" />}
          <span className="text-white text-sm truncate">{sess.name || `Séance ${si + 1}`}</span>
          {sess.exercises.filter(e => e.name).length > 0 && (
            <span className="text-gray-600 text-xs flex-shrink-0">{sess.exercises.filter(e => e.name).length} exo{sess.exercises.filter(e => e.name).length > 1 ? 's' : ''}</span>
          )}
        </button>
        {canRemove && (
          <button onClick={onRemove} className="p-1 text-gray-700 hover:text-red-400 transition-colors flex-shrink-0">
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="p-3 space-y-3 bg-dark-900/50">
          <input value={sess.name} onChange={e => onUpdate('name', e.target.value)}
            placeholder="Nom de la séance (ex: Jour 1 — Squat)"
            className="w-full bg-dark-800 border border-white/8 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500" />
          <input value={sess.notes} onChange={e => onUpdate('notes', e.target.value)}
            placeholder="Notes de séance (optionnel)"
            className="w-full bg-dark-800 border border-white/8 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand-500" />

          {/* Exercises */}
          <div className="space-y-2">
            {sess.exercises.map((ex, ei) => (
              <ExerciseRow key={ex._id} ex={ex} ei={ei}
                onUpdate={(k, v) => onUpdateExercise(ei, k, v)}
                onRemove={() => onRemoveExercise(ei)}
                canRemove={sess.exercises.length > 1}
              />
            ))}
          </div>
          <button onClick={onAddExercise}
            className="w-full py-2 border border-dashed border-white/10 rounded-lg text-gray-600 text-xs hover:border-brand-500/40 hover:text-brand-400 transition-colors flex items-center justify-center gap-1">
            <Plus size={11} /> Ajouter un exercice
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Exercise row ─────────────────────────────────────────────────────────────

function ExerciseRow({ ex, ei, onUpdate, onRemove, canRemove }) {
  const inp = 'bg-dark-700 border border-white/8 rounded-lg text-white text-xs focus:outline-none focus:border-brand-500 text-center'

  return (
    <div className="bg-dark-800 border border-white/5 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <Dumbbell size={12} className="text-gray-600 flex-shrink-0" />
        <input value={ex.name} onChange={e => onUpdate('name', e.target.value)}
          placeholder={`Exercice ${ei + 1} (ex: Back Squat)`}
          className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none" />
        {canRemove && (
          <button onClick={onRemove} className="text-gray-700 hover:text-red-400 transition-colors">
            <Trash2 size={11} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        <div className="text-center">
          <p className="text-gray-600 text-xs mb-1">Séries</p>
          <input type="number" min="1" value={ex.sets} onChange={e => onUpdate('sets', e.target.value)}
            className={`${inp} w-full py-1.5`} />
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-xs mb-1">Reps</p>
          <input value={ex.reps} onChange={e => onUpdate('reps', e.target.value)}
            placeholder="8" className={`${inp} w-full py-1.5`} />
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-xs mb-1">Charge</p>
          <input value={ex.load} onChange={e => onUpdate('load', e.target.value)}
            placeholder="80%" className={`${inp} w-full py-1.5`} />
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-xs mb-1">RPE</p>
          <input type="number" min="1" max="10" step="0.5" value={ex.rpe} onChange={e => onUpdate('rpe', e.target.value)}
            placeholder="7" className={`${inp} w-full py-1.5`} />
        </div>
        <div className="text-center">
          <p className="text-gray-600 text-xs mb-1 flex items-center justify-center gap-0.5"><Clock size={9} />Récup</p>
          <input type="number" min="0" step="15" value={ex.rest_seconds} onChange={e => onUpdate('rest_seconds', e.target.value)}
            className={`${inp} w-full py-1.5`} />
        </div>
      </div>

      <input value={ex.notes} onChange={e => onUpdate('notes', e.target.value)}
        placeholder="Notes (ex: tempo 30X1, grip serré...)"
        className="w-full bg-dark-700 border border-white/8 rounded-lg px-2.5 py-1.5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-brand-500" />
    </div>
  )
}
