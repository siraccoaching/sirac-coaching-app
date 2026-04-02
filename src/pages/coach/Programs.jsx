import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Plus, Users, Layers, ChevronRight, Dumbbell } from 'lucide-react'

export default function Programs() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    fetchPrograms()
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

  return (
    <PageLayout title="Programmes" back="/coach" action={
      <button onClick={() => navigate('/coach/programs/new')}
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
            <button onClick={() => navigate('/coach/programs/new')}
              className="text-brand-400 text-sm font-medium">
              + Créer un programme
            </button>
          </Card>
        ) : (
          programs.map(prog => (
            <button key={prog.id}
              onClick={() => navigate('/coach/programs/' + prog.id)}
              className="w-full bg-dark-800 border border-white/10 rounded-2xl p-4 text-left hover:bg-dark-800/70 transition-colors">
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
          ))
        )}
      </div>
    </PageLayout>
  )
}
