import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useClients } from '../../lib/hooks'
import { supabase, subscribeToPush } from '../../lib/supabase'
import { PageLayout, Card, Badge, SportIcon } from '../../components/Layout'
import { UserPlus, Bell, BellOff, Activity, CheckCircle, Users, Dumbbell, Settings, Calendar, MessageCircle, BookOpen, LayoutTemplate } from 'lucide-react'
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
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `status=eq.completed`
      }, payload => {
        triggerNotification(payload.new)
        fetchRecentActivity()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function checkPushStatus() {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
    }
  }

  async function enablePush() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    if (result === 'granted') {
      await subscribeToPush(profile?.id)
      setPushEnabled(true)
    }
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
      new Notification('🏋️ Séance complétée !', {
        body: `Un athlète vient de terminer sa séance – ${session.day_title || 'Entraînement'}`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
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

  return (
    <PageLayout
      title="Sirac Coaching"
      subtitle={`${clients.length} client${clients.length > 1 ? 's' : ''} actif${clients.length > 1 ? 's' : ''}`}
      action={
        <div className="flex gap-2">
          <button onClick={() => navigate('/coach/settings')}
            className="flex items-center gap-1.5 bg-dark-700 border border-white/10 hover:bg-dark-600 text-white text-sm font-medium px-2 py-2 rounded-xl transition-colors">
            <Settings size={15} />
          </button>
          <button onClick={() => navigate('/coach/programs')}
            className="flex items-center gap-1.5 bg-dark-700 border border-white/10 hover:bg-dark-600 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors">
            <Dumbbell size={15} />
            Programmes
          </button>
          <button onClick={() => navigate('/coach/add-client')}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors">
            <UserPlus size={15} />
            Ajouter
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-4 pb-8">
        <CoachAlerts clients={clients} />
        {!pushEnabled && ('Notification' in window) && (
          <button onClick={enablePush}
            className="w-full flex items-center gap-3 bg-brand-600/20 border border-brand-500/30 rounded-2xl p-4 text-left">
            <Bell size={20} className="text-brand-400 flex-shrink-0" />
            <div>
              <p className="text-white text-sm font-medium">Activer les notifications push</p>
              <p className="text-gray-400 text-xs">Sois averti dès qu'un athlète termine sa séance</p>
            </div>
          </button>
        )}
        {pushEnabled && (
          <div className="flex items-center gap-2 text-green-400 text-sm px-1">
            <BellOff size={15} />
            <span>Notifications push activées</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Users, label: 'Clients', value: clients.length, color: 'text-brand-400' },
            { icon: CheckCircle, label: "Séances aujourd'hui", value: activeToday, color: 'text-green-400' },
            { icon: Activity, label: 'En cours', value: clients.filter(c => getClientStatus(c) === 'in-progress').length, color: 'text-orange-400' },
          ].map(({ icon: Icon, label, value, color }) => (
            <Card key={label} className="p-3 text-center">
              <Icon size={18} className={`${color} mx-auto mb-1`} />
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-gray-500 text-xs leading-tight">{label}</p>
            </Card>
          ))}
        </div>

        {recentActivity.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <Activity size={15} className="text-brand-400" />
              <h2 className="text-sm font-semibold text-white">Activité récente</h2>
            </div>
            <div className="divide-y divide-white/5">
              {recentActivity.slice(0, 4).map(s => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={14} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{s.profiles?.name}</p>
                    <p className="text-gray-500 text-xs truncate">{s.day_title || 'Séance'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-gray-400 text-xs">{formatTime(s.completed_at)}</p>
                    <Badge color="green">Complété</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {sports.length > 2 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {sports.map(s => (
              <button key={s}
                onClick={() => setFilter(s)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === s ? 'bg-brand-600 text-white' : 'bg-dark-800 text-gray-400 border border-white/10'
                }`}>
                {s === 'all' ? 'Tous' : s}
              </button>
            ))}
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
            Mes clients ({filtered.length})
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-20 bg-dark-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-gray-500 text-sm">Aucun client pour l'instant.</p>
              <button onClick={() => navigate('/coach/add-client')}
                className="mt-3 text-brand-400 text-sm font-medium">
                + Ajouter un premier client
              </button>
            </Card>
          ) : (
            <div className="space-y-2">
              {filtered.map(client => {
                const status = getClientStatus(client)
                return (
                  <button key={client.id}
                    onClick={() => navigate(`/coach/client/${client.id}`)}
                    className="w-full bg-dark-800 hover:bg-dark-800/80 border border-white/10 rounded-2xl p-4 text-left transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 bg-brand-600/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                        <SportIcon sport={client.sport} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-white font-semibold truncate">{client.name}</p>
                          <StatusBadge status={status} />
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5 truncate">
                          {[client.sport, client.position].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

          <div style={{marginTop:16, marginBottom:8}}>
            <p style={{margin:'0 0 10px 4px', fontSize:12, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>Outils</p>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              {[
                { icon: <Calendar size={18}/>, label: 'Calendrier', path: '/coach/calendar', color: '#6366f1' },
                { icon: <MessageCircle size={18}/>, label: 'Messages', path: '/coach/messages', color: '#22c55e' },
                { icon: <BookOpen size={18}/>, label: 'Bibliothèque', path: '/coach/exercises', color: '#f59e0b' },
                { icon: <LayoutTemplate size={18}/>, label: 'Templates', path: '/coach/templates', color: '#ec4899' },
              ].map(tool => (
                <button key={tool.path} onClick={() => navigate(tool.path)}
                  style={{background:'#1e1e2e', border:'1px solid #2a2a3e', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', textAlign:'left'}}>
                  <div style={{width:34, height:34, borderRadius:10, background:tool.color + '22', display:'flex', alignItems:'center', justifyContent:'center', color:tool.color, flexShrink:0}}>
                    {tool.icon}
                  </div>
                  <span style={{fontSize:13, fontWeight:600, color:'white'}}>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
    </PageLayout>
  )
}

function StatusBadge({ status }) {
  const map = {
    'done-today': { color: 'green', label: "✓ Aujourd'hui" },
    'in-progress': { color: 'orange', label: '● En cours' },
    'done': { color: 'blue', label: 'Complété' },
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
