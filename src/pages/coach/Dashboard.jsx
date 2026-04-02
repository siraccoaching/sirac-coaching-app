import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useClients } from '../../lib/hooks'
import { supabase, subscribeToPush } from '../../lib/supabase'
import { PageLayout, Card, Badge, SportIcon } from '../../components/Layout'
import { UserPlus, Bell, BellOff, Activity, CheckCircle, Users, Dumbbell, BookOpen, LayoutTemplate, ChevronRight } from 'lucide-react'
import CoachAlerts from './CoachAlerts'

export default function CoachDashboard() {
  const { profile } = useAuth()
  const { clients, loading } = useClients(profile?.id)
  const navigate = useNavigate()
  const [pushEnabled, setPushEnabled] = useState(false)
  const [recentActivity, setRecentActivity] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    checkPushStatus()
    fetchRecentActivity()
    const channel = supabase.channel('coach-notifications')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `status=eq.completed` }, payload => {
        triggerNotification(payload.new)
        fetchRecentActivity()
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function checkPushStatus() {
    if ('Notification' in window) setPushEnabled(Notification.permission === 'granted')
  }

  async function enablePush() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    if (result === 'granted') { await subscribeToPush(profile?.id); setPushEnabled(true) }
  }

  async function fetchRecentActivity() {
    const { data } = await supabase
      .from('sessions')
      .select('*, profiles!sessions_client_id_fkey(name, sport, position)')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(10)
    setRecentActivity(data || [])
  }

  function triggerNotification(session) {
    if (Notification.permission === 'granted') {
      new Notification('S\u00e9ance compl\u00e9t\u00e9e !', {
        body: `Un athl\u00e8te vient de terminer sa s\u00e9ance - ${session.day_title || 'Entra\u00eenement'}`,
        icon: '/pwa-192x192.png', badge: '/pwa-192x192.png',
      })
    }
  }

  const sports = ['all', ...new Set(clients.map(c => c.sport).filter(Boolean))]
  const filtered = filter === 'all' ? clients : clients.filter(c => c.sport === filter)
  const activeToday = clients.filter(c => c.sessions?.some(s => {
    const today = new Date().toISOString().split('T')[0]
    return s.session_date === today && s.status === 'completed'
  })).length

  function getClientStatus(client) {
    if (!client.sessions?.length) return 'no-session'
    const last = [...client.sessions].sort((a,b) => new Date(b.created_at)-new Date(a.created_at))[0]
    if (last.status === 'completed') {
      const hours = (Date.now() - new Date(last.completed_at)) / 3600000
      if (hours < 24) return 'done-today'
      return 'done'
    }
    return 'in-progress'
  }

  const statusAccent = { 'done-today': '#4ade80', 'in-progress': '#fb923c', 'done': '#818cf8', 'no-session': '#2a2a3e' }
  const dayStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = profile?.name?.split(' ')[0] || ''

  return (
    <PageLayout
      title="Sirac Coaching"
      subtitle={`${clients.length} client${clients.length > 1 ? 's' : ''} actif${clients.length > 1 ? 's' : ''}`}
      action={
        <button onClick={() => navigate('/coach/add-client')}
          style={{ display:'flex', alignItems:'center', gap:6, background:'#6366f1', color:'white', fontSize:13, fontWeight:600, padding:'8px 14px', borderRadius:12, border:'none', cursor:'pointer' }}>
          <UserPlus size={14} />
          Ajouter
        </button>
      }
    >
      <div style={{ padding:'16px 16px 24px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* Greeting */}
        <div style={{ background:'linear-gradient(135deg,#1a1a35,#1e1a3a)', borderRadius:18, padding:'16px 18px' }}>
          <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.38)', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.07em' }}>{dayStr}</p>
          <p style={{ margin:'5px 0 0', fontSize:20, fontWeight:700, color:'white' }}>Bonjour {firstName} {'\u{1F44B}'}</p>
        </div>

        <CoachAlerts clients={clients} />

        {!pushEnabled && ('Notification' in window) && (
          <button onClick={enablePush}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:12, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:16, padding:'14px 16px', cursor:'pointer', textAlign:'left' }}>
            <Bell size={18} color="#818cf8" style={{ flexShrink:0 }} />
            <div>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'white' }}>Activer les notifications push</p>
              <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.38)', marginTop:2 }}>Sois averti d\u00e8s qu'un athl\u00e8te termine sa s\u00e9ance</p>
            </div>
          </button>
        )}

        {pushEnabled && (
          <div style={{ display:'flex', alignItems:'center', gap:8, color:'#4ade80', fontSize:12, paddingLeft:2 }}>
            <BellOff size={14} />
            <span>Notifications push activ\u00e9es</span>
          </div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { icon: Users, label: 'Clients', value: clients.length, color: '#818cf8', bg: 'rgba(99,102,241,0.12)' },
            { icon: CheckCircle, label: 'Auj. \u2713', value: activeToday, color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
            { icon: Activity, label: 'En cours', value: clients.filter(c => getClientStatus(c) === 'in-progress').length, color: '#fb923c', bg: 'rgba(251,146,60,0.1)' },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} style={{ background: bg, border:'1px solid '+color+'25', borderRadius:14, padding:'12px 8px', textAlign:'center' }}>
              <Icon size={16} color={color} style={{ marginBottom:4 }} />
              <p style={{ margin:0, fontSize:22, fontWeight:800, color }}>{value}</p>
              <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.38)', lineHeight:1.3, marginTop:2 }}>{label}</p>
            </div>
          ))}
        </div>

        {recentActivity.length > 0 && (
          <div style={{ background:'#15152a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, overflow:'hidden' }}>
            <div style={{ padding:'12px 16px 8px', display:'flex', alignItems:'center', gap:8 }}>
              <Activity size={14} color="#818cf8" />
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'white' }}>Activit\u00e9 r\u00e9cente</p>
            </div>
            {recentActivity.slice(0, 4).map((s, i) => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderTop: i===0 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width:30, height:30, background:'rgba(74,222,128,0.12)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <CheckCircle size={14} color="#4ade80" />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:0, fontSize:13, fontWeight:600, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.profiles?.name}</p>
                  <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.35)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.day_title || 'S\u00e9ance'}</p>
                </div>
                <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.28)', flexShrink:0 }}>{formatTime(s.completed_at)}</p>
              </div>
            ))}
          </div>
        )}

        {sports.length > 2 && (
          <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:2 }}>
            {sports.map(s => (
              <button key={s} onClick={() => setFilter(s)}
                style={{ flexShrink:0, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', border:'none', transition:'all 0.15s',
                  background: filter === s ? '#6366f1' : 'rgba(255,255,255,0.07)',
                  color: filter === s ? 'white' : 'rgba(255,255,255,0.42)',
                }}>
                {s === 'all' ? 'Tous' : s}
              </button>
            ))}
          </div>
        )}

        <div>
          <p style={{ margin:'0 0 10px 2px', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.32)', textTransform:'uppercase', letterSpacing:'0.07em' }}>
            Mes clients ({filtered.length})
          </p>

          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height:68, background:'rgba(255,255,255,0.04)', borderRadius:16 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ background:'#15152a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:32, textAlign:'center' }}>
              <p style={{ margin:'0 0 8px', fontSize:13, color:'rgba(255,255,255,0.38)' }}>Aucun client pour l'instant.</p>
              <button onClick={() => navigate('/coach/add-client')} style={{ background:'none', border:'none', cursor:'pointer', color:'#818cf8', fontSize:13, fontWeight:600 }}>
                + Ajouter un premier client
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(client => {
                const status = getClientStatus(client)
                return (
                  <button key={client.id} onClick={() => navigate(`/coach/client/${client.id}`)}
                    style={{ width:'100%', display:'flex', alignItems:'stretch', background:'#15152a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, overflow:'hidden', cursor:'pointer', textAlign:'left' }}>
                    <div style={{ width:3, background: statusAccent[status], flexShrink:0 }} />
                    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', flex:1 }}>
                      <div style={{ width:42, height:42, background:'rgba(99,102,241,0.1)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                        <SportIcon sport={client.sport} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                          <p style={{ margin:0, fontSize:14, fontWeight:600, color:'white', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{client.name}</p>
                          <StatusBadge status={status} />
                        </div>
                        <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.32)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {[client.sport, client.position].filter(Boolean).join(' \u00b7 ')}
                        </p>
                      </div>
                      <ChevronRight size={14} color="rgba(255,255,255,0.18)" style={{ flexShrink:0 }} />
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick tools */}
        <div>
          <p style={{ margin:'4px 0 10px 2px', fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.32)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Outils</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { icon: <BookOpen size={18}/>, label: 'Biblioth\u00e8que', path: '/coach/exercises', color: '#f59e0b' },
              { icon: <LayoutTemplate size={18}/>, label: 'Templates', path: '/coach/templates', color: '#ec4899' },
            ].map(tool => (
              <button key={tool.path} onClick={() => navigate(tool.path)}
                style={{ background:'#15152a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', textAlign:'left' }}>
                <div style={{ width:36, height:36, borderRadius:10, background:tool.color+'22', display:'flex', alignItems:'center', justifyContent:'center', color:tool.color, flexShrink:0 }}>
                  {tool.icon}
                </div>
                <span style={{ fontSize:13, fontWeight:600, color:'white' }}>{tool.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </PageLayout>
  )
}

function StatusBadge({ status }) {
  const map = {
    'done-today': { color: 'green', label: "Aujourd'hui" },
    'in-progress': { color: 'orange', label: 'En cours' },
    'done': { color: 'blue', label: 'Compl\u00e9t\u00e9' },
    'no-session': { color: 'gray', label: 'En attente' },
  }
  const { color, label } = map[status] || map['no-session']
  return <Badge color={color}>{label}</Badge>
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 60000
  if (diff < 60) return `Il y a ${Math.floor(diff)}min`
  if (diff < 1440) return `Il y a ${Math.floor(diff/60)}h`
  return d.toLocaleDateString('fr-FR', { day:'numeric', month:'short' })
}
