import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageLayout, Card, Badge, SportIcon } from '../../components/Layout'
import { TrendingUp, Calendar, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [sessions, setSessions] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchClient()
    fetchSessions()
    const ch = supabase.channel(`client-detail-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `client_id=eq.${id}` }, fetchSessions)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [id])

  async function fetchClient() {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    setClient(data); setLoading(false)
  }

  async function fetchSessions() {
    const { data } = await supabase.from('sessions').select('*, session_logs(*)').eq('client_id', id).order('created_at', { ascending: false }).limit(30)
    setSessions(data || [])
  }

  const completed = sessions.filter(s => s.status === 'completed')
  const streak = calcStreak(completed)
  if (loading) return null

  return (
    <PageLayout title={client?.name || 'Client'} back="/coach">
      <div className="p-4 space-y-4">
        <Card className="p-4">
          <h2 className="text-white font-bold">{client?.name}</h2>
          <p className="text-gray-400">{client?.email}</p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {[{ label: 'Séances', value: completed.length }, { label: 'Streak', value: `${streak}j` }, { label: 'Mois', value: completed.filter(s => new Date(s.completed_at).getMonth() === new Date().getMonth()).length }].map(({ label, value }) => (<div key={label} className="text-center"><p className="text-xl font-bold text-white">{value}</p><p className="text-gray-500 text-xs">{label}</p></div>))}
          </div>
        </Card>
        <div className="space-y-2">
          {sessions.map(s => (
            <Card key={s.id} className="p-3">
              <p className="text-white">{s.day_title || 'Séance'}</p>
              <p className="text-gray-500 text-xs">{s.session_date} - {s.status}</p>
            </Card>
          ))}
        </div>
      </div>
    </PageLayout>
  )
}

function calcStreak(sessions) {
  if (!sessions.length) return 0
  const dates = sessions.map(s => s.session_date).sort().reverse()
  let streak = 0, prev = null
  for (const d of dates) {
    if (!prev) { streak = 1; prev = d; continue }
    const diff = (new Date(prev) - new Date(d)) / 86400000
    if (diff <= 2) { streak++; prev = d } else break
  }
  return streak
}
