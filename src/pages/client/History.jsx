import { useEffect, useState } from 'react'
import { useAuth } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { CheckCircle, Clock } from 'lucide-react'

export default function SessionHistory() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    if (!profile) return
    supabase.from('sessions').select('*, session_logs(*)')
      .eq('client_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setSessions(data || []))
  }, [profile])

  return (
    <PageLayout title="Historique" back="/client">
      <div className="p-4 space-y-6">
        {sessions.map(s => (
          <Card key={s.id} className="p-4">
            <p className="text-white">{s.day_title || 'Séance'}</p>
            <p className="text-gray-500">{s.session_date}</p>
          </Card>
        ))}
      </div>
    </PageLayout>
  )
}
