import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Plus, Layers, ChevronRight, Dumbbell, Copy, Trash2, Check, X } from 'lucide-react'
import { setProgramClients, copyProgram } from '../../lib/assignments'

export default function Programs() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [programs, setPrograms] = useState([])
    const [loading, setLoading] = useState(true)
    const [clients, setClients] = useState([])
    const [assignProg, setAssignProg] = useState(null)
    const [assignSel, setAssignSel] = useState([])
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
                          program_assignments(client_id, client:profiles(id, name, sport)),
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

  // Plusieurs clients peuvent suivre le même programme
  async function saveAssignments() {
        if (!assignProg) return
        setAssigning(true)
        try { await setProgramClients(assignProg.id, assignSel) } catch (e) { alert('Erreur : ' + e.message) }
        await fetchPrograms()
        setAssignProg(null)
        setAssigning(false)
  }
  function openAssign(prog) {
        setAssignSel((prog.program_assignments || []).map(a => a.client_id))
        setAssignProg(prog)
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
      await copyProgram(prog.id, profile.id, prog.name + ' (copie)')
    } catch (e) {
      alert('Erreur pendant la duplication : ' + e.message)
    }
    setDuplicating(null)
    await fetchPrograms()
  }

  return (
        <PageLayout
                title="Programmes"
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
                                                                                            <ClientNames list={prog.program_assignments} />
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
                                                                                                    onClick={(e) => { e.stopPropagation(); openAssign(prog) }}
                                                                                                    className="text-brand-400 text-xs font-medium hover:text-brand-300 transition-colors px-2 py-1">
                                                                                {prog.program_assignments?.length ? '👥 Gérer les clients' : '+ Assigner des clients'}
                                                                              </button>
                                                            </div>
                                                        )}
                                          </div>
                                        ))
                          )}
              </div>
        
          {/* Modal assignation : plusieurs clients */}
          {assignProg && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setAssignProg(null)}>
              <div data-testid="assign-sheet" className="bg-dark-800 w-full max-w-md" style={{ borderRadius: '20px 20px 0 0', padding: 16 }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-label font-semibold" style={{ fontSize: 17 }}>Clients de « {assignProg.name} »</h3>
                  <button onClick={() => setAssignProg(null)} aria-label="Fermer" className="text-gray-500"><X size={18} /></button>
                </div>
                <p className="text-gray-500 text-xs mb-3">Coche un ou plusieurs clients. Un client coché quitte son programme précédent.</p>
                <div className="space-y-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
                  {clients.map(c => {
                    const on = assignSel.includes(c.id)
                    return (
                      <button key={c.id} role="checkbox" aria-checked={on} onClick={() => setAssignSel(sel => on ? sel.filter(x => x !== c.id) : [...sel, c.id])}
                        className="w-full text-left px-3 py-3 rounded-xl text-label text-sm flex items-center gap-3"
                        style={{ background: on ? 'var(--accent-soft)' : 'var(--fill)' }}>
                        <span style={{ width: 22, height: 22, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '2px solid rgb(var(--gray700-rgb))', color: 'white' }}>{on && <Check size={14} />}</span>
                        <span style={{ flex: 1 }}>
                          <span className="font-medium" style={{ display: 'block' }}>{c.name}</span>
                          {c.sport && <span className="text-gray-500 text-xs">{c.sport}</span>}
                        </span>
                      </button>
                    )
                  })}
                  {clients.length === 0 && <p className="text-gray-500 text-xs text-center py-4">Aucun client disponible</p>}
                </div>
                <button onClick={saveAssignments} disabled={assigning} data-testid="assign-save"
                  style={{ width: '100%', marginTop: 14, padding: '14px 0', border: 'none', borderRadius: 14, background: 'var(--accent)', color: 'white', fontSize: 16, fontWeight: 700, cursor: 'pointer', opacity: assigning ? .6 : 1 }}>
                  {assigning ? 'Enregistrement…' : assignSel.length ? `Assigner à ${assignSel.length} client${assignSel.length > 1 ? 's' : ''}` : 'Retirer tous les clients'}
                </button>
              </div>
            </div>
          )}
        </PageLayout>
      )
}

function ClientNames({ list }) {
  const names = (list || []).map(a => a.client?.name).filter(Boolean)
  if (!names.length) return <p className="text-gray-500 text-xs">Non assigné</p>
  return <p className="text-brand-400 text-xs font-medium">👥 {names.length > 3 ? names.slice(0, 3).join(', ') + ` +${names.length - 3}` : names.join(', ')}</p>
}
