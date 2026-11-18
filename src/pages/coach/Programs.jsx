import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Plus, Layers, ChevronRight, Dumbbell, Copy, Trash2, Check, X } from 'lucide-react'

export default function Programs() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [programs, setPrograms] = useState([])
    const [loading, setLoading] = useState(true)
    const [clients, setClients] = useState([])
    const [assignProg, setAssignProg] = useState(null)
    const [assigning, setAssigning] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState(null)
    const [deleting, setDeleting] = useState(false)
    const [duplicating, setDuplicating] = useState(null)

  useEffect(() => {
        if (!profile?.id) return
        fetchPrograms()
        fetchClients()
  }, [profile?.id])

  async function fetchPrograms() {
        const { data } = await supabase
          .from('programs')
          .select(`
                  *,
                          client:profiles!programs_client_id_fkey(name, sport),
                                  program_blocks(id),
                                          program_sessions(id)
                                                `)
          .eq('coach_id', profile.id)
          .order('created_at', { ascending: false })
        setPrograms(data || [])
        setLoading(false)
  }

  async function fetchClients() {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, sport')
          .eq('coach_id', profile.id)
          .eq('role', 'client')
          .order('name')
        setClients(data || [])
  }

  async function assignToClient(clientId) {
        if (!assignProg) return
        setAssigning(true)
        // un seul programme actif par client : l'ancien est libéré
        if (clientId) await supabase.from('programs').update({ client_id: null }).eq('client_id', clientId).neq('id', assignProg.id)
        await supabase.from('programs').update({ client_id: clientId || null }).eq('id', assignProg.id)
        await fetchPrograms()
        setAssignProg(null)
        setAssigning(false)
  }

  async function deleteProgram(prog) {
        setDeleting(true)
        // Delete exercises first
      const { data: sessions } = await supabase.from('program_sessions').select('id').eq('program_id', prog.id)
        if (sessions?.length) {
                const sessionIds = sessions.map(s => s.id)
                await supabase.from('program_exercises').delete().in('session_id', sessionIds)
        }
        await supabase.from('program_sessions').delete().eq('program_id', prog.id)
        await supabase.from('program_blocks').delete().eq('program_id', prog.id)
        await supabase.from('programs').delete().eq('id', prog.id)
        setDeleteConfirm(null)
        setDeleting(false)
        await fetchPrograms()
  }

  async function duplicateProgram(prog) {
    setDuplicating(prog.id)
    try {
      const { data: newProg, error } = await supabase.from('programs').insert({
        name: prog.name + ' (copie)', type: prog.type, description: prog.description,
        coach_id: profile.id, client_id: null, is_active: true,
      }).select().single()
      if (error) throw error
      // blocs (on garde la correspondance ancien id -> nouvel id)
      const blockMap = {}
      const { data: blocks } = await supabase.from('program_blocks').select('*').eq('program_id', prog.id).order('order_index')
      for (const b of blocks || []) {
        const { data: nb, error: be } = await supabase.from('program_blocks').insert({
          program_id: newProg.id, name: b.name, description: b.description, duration_weeks: b.duration_weeks, order_index: b.order_index,
        }).select().single()
        if (be) throw be
        blockMap[b.id] = nb.id
      }
      // séances + exercices
      const { data: sessions } = await supabase.from('program_sessions').select('*, program_exercises(*)').eq('program_id', prog.id).order('order_index')
      for (const sess of sessions || []) {
        const { data: ns, error: se } = await supabase.from('program_sessions').insert({
          program_id: newProg.id, block_id: sess.block_id ? blockMap[sess.block_id] || null : null,
          name: sess.name, notes: sess.notes, day_number: sess.day_number, order_index: sess.order_index,
        }).select().single()
        if (se) throw se
        const exs = sess.program_exercises || []
        if (exs.length) {
          const { error: ee } = await supabase.from('program_exercises').insert(exs.map(ex => ({
            session_id: ns.id, exercise_id: ex.exercise_id, name: ex.name, sets: ex.sets, reps: ex.reps, load: ex.load,
            rpe: ex.rpe, rest_seconds: ex.rest_seconds, notes: ex.notes, video_url: ex.video_url, order_index: ex.order_index,
          })))
          if (ee) throw ee
        }
      }
    } catch (e) {
      alert('Erreur pendant la duplication : ' + e.message)
    }
    setDuplicating(null)
    await fetchPrograms()
  }

  return (
        <PageLayout
                title="Programmes"
                back="/coach"
                action={
                          <button
                                      onClick={() => navigate('/coach/programs/new')}
                                      className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors">
                                    <Plus size={15} />
                                    Nouveau
                          </button>
          }>
              <div className="p-4 pb-8 space-y-3">
                {loading ? (
                            [1,2,3].map(i => <div key={i} className="h-24 bg-dark-800 rounded-2xl animate-pulse" />)
                          ) : programs.length === 0 ? (
                            <Card className="p-10 text-center">
                                        <Dumbbell size={32} className="text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-400 text-sm font-medium mb-1">Aucun programme</p>
                                        <p className="text-gray-600 text-xs mb-4">Crée ton premier programme pour tes athlètes</p>
                                        <button onClick={() => navigate('/coach/programs/new')} className="text-brand-400 text-sm font-medium">
                                                      + Créer un programme
                                        </button>
                            </Card>
                          ) : (
                            programs.map(prog => (
                                          <div key={prog.id} className="bg-dark-800 border border-contrast/10 rounded-2xl overflow-hidden">
                                                        <button
                                                                          onClick={() => navigate('/coach/programs/' + prog.id)}
                                                                          className="w-full p-4 text-left hover:bg-dark-800/70 transition-colors">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                                          <div className="flex-1 min-w-0">
                                                                                                              <div className="flex items-center gap-2 mb-1">
                                                                                                                                    <p className="text-label font-semibold truncate">{prog.name}</p>
                                                                                                                                    <Badge color={prog.type === 'block' ? 'brand' : 'green'}>
                                                                                                                                      {prog.type === 'block' ? 'Blocs' : 'Simple'}
                                                                                                                                      </Badge>
                                                                                                                </div>
                                                                                            {prog.client ? (
                                                                                                  <p className="text-brand-400 text-xs font-medium">{prog.client.name}</p>
                                                                                                ) : (
                                                                                                  <p className="text-gray-500 text-xs">Non assigné</p>
                                                                                                              )}
                                                                                                              <div className="flex items-center gap-3 mt-2">
                                                                                                                {prog.type === 'block' && (
                                                                                                    <span className="text-gray-500 text-xs flex items-center gap-1">
                                                                                                                              <Layers size={11} />
                                                                                                      {prog.program_blocks?.length || 0} blocs
                                                                                                      </span>
                                                                                                                                    )}
                                                                                                                                    <span className="text-gray-500 text-xs flex items-center gap-1">
                                                                                                                                                            <Dumbbell size={11} />
                                                                                                                                      {prog.program_sessions?.length || 0} séances
                                                                                                                                      </span>
                                                                                                                </div>
                                                                                            </div>
                                                                                          <ChevronRight size={16} className="text-gray-600 flex-shrink-0 mt-1" />
                                                                        </div>
                                                        </button>
                                          
                                            {deleteConfirm?.id === prog.id ? (
                                                            <div className="border-t border-contrast/5 px-4 py-2.5 flex items-center justify-between bg-red-500/5">
                                                                              <p className="text-red-400 text-xs">Supprimer "{prog.name}" ?</p>
                                                                              <div className="flex gap-2">
                                                                                                  <button onClick={() => setDeleteConfirm(null)} className="text-gray-400 text-xs px-2 py-1 rounded-lg bg-dark-900">Annuler</button>
                                                                                                  <button onClick={() => deleteProgram(prog)} disabled={deleting} className="text-white text-xs px-2 py-1 rounded-lg bg-red-500 disabled:opacity-50">
                                                                                                    {deleting ? '...' : 'Supprimer'}
                                                                                                    </button>
                                                                              </div>
                                                            </div>
                                                          ) : (
                                                            <div className="border-t border-contrast/5 px-4 py-2 flex items-center justify-between">
                                                                              <div className="flex gap-1">
                                                                                                  <button
                                                                                                                          onClick={(e) => { e.stopPropagation(); duplicateProgram(prog) }}
                                                                                                                          disabled={duplicating === prog.id}
                                                                                                                          className="text-gray-400 text-xs font-medium hover:text-label transition-colors px-2 py-1 flex items-center gap-1">
                                                                                                                        <Copy size={11} />
                                                                                                    {duplicating === prog.id ? 'Copie...' : 'Dupliquer'}
                                                                                                    </button>
                                                                                                  <button
                                                                                                                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(prog) }}
                                                                                                                          className="text-red-400 text-xs font-medium hover:text-red-300 transition-colors px-2 py-1 flex items-center gap-1">
                                                                                                                        <Trash2 size={11} />
                                                                                                                        Supprimer
                                                                                                    </button>
                                                                              </div>
                                                                              <button
                                                                                                    onClick={(e) => { e.stopPropagation(); setAssignProg(prog) }}
                                                                                                    className="text-brand-400 text-xs font-medium hover:text-brand-300 transition-colors px-2 py-1">
                                                                                {prog.client ? '🔄 Changer de client' : '+ Assigner à un client'}
                                                                              </button>
                                                            </div>
                                                        )}
                                          </div>
                                        ))
                          )}
              </div>
        
          {/* Modal assignation */}
          {assignProg && (
                          <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center p-4" onClick={() => setAssignProg(null)}>
                                    <div className="bg-dark-800 border border-contrast/10 rounded-2xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center justify-between mb-4">
                                                              <h3 className="text-label font-semibold text-sm">Assigner "{assignProg.name}"</h3>
                                                              <button onClick={() => setAssignProg(null)} className="text-gray-500"><X size={16} /></button>
                                                </div>
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                              <button
                                                                                onClick={() => assignToClient(null)}
                                                                                disabled={assigning}
                                                                                className="w-full text-left px-3 py-2.5 rounded-xl text-gray-400 text-sm hover:bg-dark-900 transition-colors flex items-center gap-2">
                                                                              <X size={14} />
                                                                              Retirer l'assignation
                                                              </button>
                                                  {clients.map(c => (
                                            <button
                                                                key={c.id}
                                                                onClick={() => assignToClient(c.id)}
                                                                disabled={assigning}
                                                                className="w-full text-left px-3 py-2.5 rounded-xl text-label text-sm hover:bg-dark-900 transition-colors flex items-center justify-between">
                                                              <div>
                                                                                  <p className="font-medium">{c.name}</p>
                                                                {c.sport && <p className="text-gray-500 text-xs">{c.sport}</p>}
                                                              </div>
                                              {assignProg.client_id === c.id && <Check size={14} className="text-brand-400" />}
                                            </button>
                                          ))}
                                                  {clients.length === 0 && (
                                            <p className="text-gray-500 text-xs text-center py-4">Aucun client disponible</p>
                                                              )}
                                                </div>
                                    </div>
                          </div>
              )}
        </PageLayout>
      )
}
