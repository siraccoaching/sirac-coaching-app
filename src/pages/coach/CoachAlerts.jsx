import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { Bell, AlertCircle, Trophy, Clock, X } from 'lucide-react'

export default function CoachAlerts() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_alerts') || '[]') } catch { return [] }
  })

  useEffect(() => { if (profile?.id) loadAlerts() }, [profile?.id])

  async function loadAlerts() {
    setLoading(true)
    const { data: clients } = await supabase.from('profiles').select('id, full_name, sport').eq('coach_id', profile.id)
    if (!clients?.length) { setLoading(false); return }

    const clientIds = clients.map(c => c.id)
    const now = new Date()
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString()
    const threeDaysAgo = new Date(now - 3 * 86400000).toISOString()

    // Last completion per client
    const { data: recent } = await supabase.from('session_completions')
      .select('client_id, created_at, rpe_session, exercise_logs(exercise_id, set_data, exercise:program_exercises(name))')
      .in('client_id', clientIds).gte('created_at', sevenDaysAgo).order('created_at', { ascending: false })

    // Clients who haven't trained in 7+ days
    const lastByClient = {}
    for (const c of recent || []) {
      if (!lastByClient[c.client_id]) lastByClient[c.client_id] = c
    }

    const newAlerts = []

    for (const client of clients) {
      const last = lastByClient[client.id]
      if (!last) {
        // Check if they have any completion at all
        const { data: anyComp } = await supabase.from('session_completions')
          .select('created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (!anyComp) continue // new client, no alert
        const daysSince = Math.floor((now - new Date(anyComp.created_at)) / 86400000)
        if (daysSince >= 7) {
          newAlerts.push({ id: 'inactive_' + client.id, type: 'inactive', clientId: client.id, clientName: client.full_name, days: daysSince, ts: anyComp.created_at })
        }
      }

      // Detect recent PRs (from last 3 days)
      const { data: recentComps } = await supabase.from('session_completions')
        .select('id, created_at, exercise_logs(exercise_id, set_data, exercise:program_exercises(name))')
        .eq('client_id', client.id).gte('created_at', threeDaysAgo)
      if (!recentComps?.length) continue

      // Get historical maxes before threeDaysAgo
      const { data: pastComps } = await supabase.from('session_completions')
        .select('id').eq('client_id', client.id).lt('created_at', threeDaysAgo)
      if (!pastComps?.length) continue
      const pastIds = pastComps.map(c => c.id)
      const { data: pastLogs } = await supabase.from('exercise_logs')
        .select('exercise_id, set_data').in('session_completion_id', pastIds)
      const histMax = {}
      for (const log of pastLogs || []) {
        const sets = (log.set_data || []).filter(s => parseFloat(s.load) > 0)
        if (!sets.length) continue
        const m = Math.max(...sets.map(s => parseFloat(s.load) || 0))
        if (!histMax[log.exercise_id] || m > histMax[log.exercise_id]) histMax[log.exercise_id] = m
      }

      // Check recent sessions for PRs
      for (const comp of recentComps) {
        for (const log of comp.exercise_logs || []) {
          const name = log.exercise?.name
          if (!name) continue
          const sets = (log.set_data || []).filter(s => s._done !== false && parseFloat(s.load) > 0)
          if (!sets.length) continue
          const m = Math.max(...sets.map(s => parseFloat(s.load) || 0))
          const prev = histMax[log.exercise_id]
          if (prev && m > prev) {
            newAlerts.push({ id: 'pr_' + client.id + '_' + log.exercise_id, type: 'pr', clientId: client.id, clientName: client.full_name, exercise: name, load: m, prev, ts: comp.created_at })
          }
        }
      }
    }

    // Sort: PRs first, then inactives; most recent first
    newAlerts.sort((a, b) => { if (a.type !== b.type) return a.type === 'pr' ? -1 : 1; return new Date(b.ts) - new Date(a.ts) })
    setAlerts(newAlerts.filter(a => !dismissed.includes(a.id)))
    setLoading(false)
  }

  function dismiss(id) {
    const newDismissed = [...dismissed, id]
    setDismissed(newDismissed)
    localStorage.setItem('dismissed_alerts', JSON.stringify(newDismissed))
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  if (loading || alerts.length === 0) return null

  return (
    <div style={{marginBottom: 16}}>
      <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
        <Bell size={13} color="#f59e0b"/>
        <p style={{margin:0, fontSize:12, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>Alertes ({alerts.length})</p>
      </div>
      {alerts.map(alert => (
        <div key={alert.id} onClick={() => navigate('/coach/clients/' + alert.clientId)}
          style={{background: alert.type === 'pr' ? '#1a2a1a' : '#2a1a1a',
            border: '1px solid ' + (alert.type === 'pr' ? '#22c55e33' : '#ef444433'),
            borderRadius:12, padding:'12px 14px', marginBottom:8, cursor:'pointer', display:'flex', alignItems:'flex-start', gap:10}}>
          <div style={{width:32, height:32, borderRadius:10, background: alert.type === 'pr' ? '#22c55e22' : '#ef444422',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
            {alert.type === 'pr' ? <Trophy size={16} color="#22c55e"/> : <Clock size={16} color="#ef4444"/>}
          </div>
          <div style={{flex:1}}>
            <p style={{margin:'0 0 2px', fontSize:13, fontWeight:600, color:'white'}}>{alert.clientName}</p>
            {alert.type === 'pr' ? (
              <p style={{margin:0, fontSize:12, color:'#22c55e'}}>🏆 PR sur {alert.exercise} : {alert.load} kg (+{(alert.load - alert.prev).toFixed(1)})</p>
            ) : (
              <p style={{margin:0, fontSize:12, color:'#ef4444'}}>⚠️ Inactif depuis {alert.days} jours</p>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); dismiss(alert.id) }}
            style={{background:'none', border:'none', color:'#555', cursor:'pointer', padding:2, flexShrink:0}}>
            <X size={14}/>
          </button>
        </div>
      ))}
    </div>
  )
}
