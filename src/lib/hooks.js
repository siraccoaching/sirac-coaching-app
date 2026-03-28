import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setLoading(false)
  }

  return { user, profile, loading }
}

export function useClients(coachId) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!coachId) return
    fetchClients()

    const channel = supabase.channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, fetchClients)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [coachId])

  async function fetchClients() {
    const { data } = await supabase
      .from('profiles')
      .select(`
        *,
        sessions(id, status, session_date, day_title, completed_at, created_at)
      `)
      .eq('coach_id', coachId)
      .eq('role', 'client')
      .order('name')
    setClients(data || [])
    setLoading(false)
  }

  return { clients, loading, refetch: fetchClients }
}

export function useClientSessions(clientId) {
  const [sessions, setSessions] = useState([])

  useEffect(() => {
    if (!clientId) return
    fetch()
    const ch = supabase.channel(`sessions-${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions', filter: `client_id=eq.${clientId}` }, fetch)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [clientId])

  async function fetch() {
    const { data } = await supabase
      .from('sessions')
      .select('*, session_logs(*)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(20)
    setSessions(data || [])
  }

  return { sessions, refetch: fetch }
}
