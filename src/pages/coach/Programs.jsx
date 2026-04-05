import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Plus, Layers, ChevronRight, Dumbbell, Check } from 'lucide-react'

export default function Programs() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [assignProg, setAssignProg] = useState(null)
  const [assigning, setAssigning] = useState(false)

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
    await supabase.from('programs').update({ client_id: clientId || null }).eq('id', assignProg.id)
    await fetchPrograms()
    setAssignProg(null)
    setAssigning(false)
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
            <div key={prog.id} className="bg-dark-800 border border-white/10 rounded-2xl overflow-hidden">
              <button
                onClick={() => navigate('/coach/programs/' + prog.id)}
                className="w-full p-4 text-left hover:bg-dark-800/70 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold truncate">{prog.name}</p>
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
              <div className="border-t border-white/5 px-4 py-2 flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); setAssignProg(prog) }}
                  className="text-brand-400 text-xs font-medium hover:text-brand-300 transition-colors px-2 py-1">
                  {prog.client ? '🔄 Changer de client' : '+ Assigner à un client'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {assignProg && (
        <div
          style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'flex-end'}}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignProg(null) }}>
          <div style={{background:'#1e1e2e', width:'100%', borderRadius:'16px 16px 0 0', padding:'20px 16px', maxHeight:'70vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
              <h3 style={{margin:0, fontSize:16, color:'white'}}>Assigner un client</h3>
              <button onClick={() => setAssignProg(null)} style={{background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:20, lineHeight:1}}>✕</button>
            </div>
            <p style={{margin:'0 0 14px', fontSize:12, color:'#888'}}>Programme : {assignProg.name}</p>

            {assignProg.client_id && (
              <button
                onClick={() => assignToClient(null)}
                disabled={assigning}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  width:'100%', background:'#2a1a1a', border:'1px solid #ef444433',
                  borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'pointer', color:'#ef4444', textAlign:'left',
                  opacity: assigning ? 0.6 : 1, fontSize:13, fontWeight:600
                }}>
                Retirer l'assignation
              </button>
            )}

            {clients.length === 0 ? (
              <p style={{color:'#888', textAlign:'center', padding:'20px 0'}}>Aucun client trouvé</p>
            ) : (
              clients.map(client => (
                <button key={client.id} onClick={() => assignToClient(client.id)} disabled={assigning}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    width:'100%', background: assignProg.client_id === client.id ? '#2d2b55' : '#252537',
                    border: '1px solid ' + (assignProg.client_id === client.id ? '#6366f1' : '#3a3a4e'),
                    borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'pointer', color:'white', textAlign:'left',
                    opacity: assigning ? 0.6 : 1
                  }}>
                  <div>
                    <p style={{margin:0, fontWeight:600, fontSize:14}}>{client.name}</p>
                    {client.sport && <p style={{margin:0, fontSize:12, color:'#888'}}>{client.sport}</p>}
                  </div>
                  {assignProg.client_id === client.id && <Check size={16} color="#6366f1"/>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
