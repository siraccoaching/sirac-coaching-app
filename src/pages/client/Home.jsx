import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { PageLayout } from '../../components/Layout'
import { Play, CheckCircle, Dumbbell, Ruler, ClipboardList, TrendingUp, MessageCircle, Trophy, Calendar, Zap, Apple } from 'lucide-react'

export default function ClientHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [nextSession, setNextSession] = useState(null)
  const [lastCompletion, setLastCompletion] = useState(null)
  const [topPRs, setTopPRs] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [streak, setStreak] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) loadDashboard() }, [profile?.id])

  async function loadDashboard() {
    setLoading(true)
    await Promise.all([loadNextSession(), loadCompletions(), loadMessages()])
    setLoading(false)
  }

  async function loadNextSession() {
    const { data: prog } = await supabase
      .from('programs').select('id, name, type, program_sessions(id, name, program_exercises(id))')
      .eq('client_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!prog) return
    const sessions = prog.program_sessions || []
    const { data: done } = await supabase.from('session_completions')
      .select('program_session_id').eq('client_id', profile.id)
    const doneIds = new Set((done || []).map(d => d.program_session_id))
    const next = sessions.find(s => !doneIds.has(s.id)) || sessions[0]
    if (next) setNextSession({ ...next, programName: prog.name })
  }

  async function loadCompletions() {
    const { data: comps } = await supabase.from('session_completions')
      .select('id, created_at, program_sessions(name), exercise_logs(exercise_id, set_data, exercise:program_exercises(name))')
      .eq('client_id', profile.id).order('created_at', { ascending: false })
    if (!comps?.length) return
    setTotalSessions(comps.length)
    setLastCompletion(comps[0])
    const dates = [...new Set(comps.map(c => new Date(c.created_at).toDateString()))].map(d => new Date(d)).sort((a,b) => b-a)
    let s = 0, cur = new Date(); cur.setHours(0,0,0,0)
    for (const d of dates) { const dd = new Date(d); dd.setHours(0,0,0,0); if (Math.round((cur-dd)/86400000) <= 1) { s++; cur = dd } else break }
    setStreak(s)
    const exMaxes = {}
    for (const comp of [...comps].reverse()) {
      for (const log of comp.exercise_logs || []) {
        const name = log.exercise?.name
        if (!name) continue
        const sets = (log.set_data || []).filter(s => parseFloat(s.load) > 0)
        if (!sets.length) continue
        const m = Math.max(...sets.map(s => parseFloat(s.load)||0))
        if (!exMaxes[name] || m > exMaxes[name]) exMaxes[name] = m
      }
    }
    setTopPRs(Object.entries(exMaxes).sort((a,b) => b[1]-a[1]).slice(0, 4))
  }

  async function loadMessages() {
    if (!profile?.coach_id) return
    const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('receiver_id', profile.id).is('read_at', null)
    setUnreadCount(count || 0)
  }

  const timeAgo = (ts) => {
    const d = Math.floor((Date.now() - new Date(ts)) / 86400000)
    if (d === 0) return "aujourd'hui"
    if (d === 1) return "hier"
    return "il y a " + d + " j"
  }

  return (
    <PageLayout title={"Bonjour \u{1F44B} " + (profile?.name?.split(' ')[0] || '')} subtitle="Ton espace entraînement">
      <div style={{ padding:'16px 16px 24px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* Stats bar */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <div style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:14, padding:'12px 8px', textAlign:'center' }}>
            <p style={{ margin:0, fontSize:24, fontWeight:800, color:'#818cf8' }}>{totalSessions}</p>
            <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.38)', marginTop:2 }}>séances</p>
          </div>
          <div style={{ background:'rgba(251,146,60,0.1)', border:'1px solid rgba(251,146,60,0.2)', borderRadius:14, padding:'12px 8px', textAlign:'center' }}>
            <p style={{ margin:0, fontSize:24, fontWeight:800, color:'#fb923c' }}>{streak} {'\u{1F525}'}</p>
            <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.38)', marginTop:2 }}>jours streak</p>
          </div>
          <div style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:14, padding:'12px 8px', textAlign:'center' }}>
            <p style={{ margin:0, fontSize:24, fontWeight:800, color:'#fbbf24' }}>{topPRs.length}</p>
            <p style={{ margin:0, fontSize:10, color:'rgba(255,255,255,0.38)', marginTop:2 }}>records</p>
          </div>
        </div>

        {/* Next session CTA */}
        {nextSession ? (
          <div style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:18, padding:'18px 20px', cursor:'pointer' }}
            onClick={() => navigate('/client/session-log/' + nextSession.id)}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <p style={{ margin:'0 0 4px', fontSize:11, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Prochaine séance</p>
                <p style={{ margin:'0 0 3px', fontSize:18, fontWeight:700, color:'white' }}>{nextSession.name}</p>
                <p style={{ margin:0, fontSize:12, color:'rgba(255,255,255,0.55)' }}>{nextSession.programName} · {nextSession.program_exercises?.length || 0} exercices</p>
              </div>
              <div style={{ width:46, height:46, borderRadius:'50%', background:'rgba(255,255,255,0.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Play size={20} color="white" fill="white"/>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background:'#15152a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:18, padding:'18px 20px', textAlign:'center', cursor:'pointer' }}
            onClick={() => navigate('/client/program')}>
            <p style={{ margin:'0 0 4px', fontSize:15, color:'rgba(255,255,255,0.38)' }}>Aucun programme actif</p>
            <p style={{ margin:0, fontSize:12, color:'#818cf8' }}>Voir mes programmes →</p>
          </div>
        )}

        {/* Last workout */}
        {lastCompletion && (
          <div style={{ background:'#15152a', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(74,222,128,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <CheckCircle size={18} color="#4ade80"/>
            </div>
            <div style={{ flex:1 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:600, color:'white' }}>{lastCompletion.program_sessions?.name || 'Séance libre'}</p>
              <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 }}>Dernière séance · {timeAgo(lastCompletion.created_at)}</p>
            </div>
          </div>
        )}

        {/* Top PRs */}
        {topPRs.length > 0 && (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <Trophy size={13} color="#f59e0b"/>
              <p style={{ margin:0, fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'0.07em' }}>Tes records</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {topPRs.map(([name, load]) => (
                <div key={name} style={{ background:'#15152a', border:'1px solid rgba(245,158,11,0.15)', borderRadius:12, padding:'10px 14px' }}>
                  <p style={{ margin:'0 0 2px', fontSize:11, color:'rgba(255,255,255,0.38)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</p>
                  <p style={{ margin:0, fontSize:18, fontWeight:800, color:'#fbbf24' }}>{load} <span style={{ fontSize:12, fontWeight:400 }}>kg</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {[
            { icon: <Dumbbell size={16}/>, label: 'Mon programme', sub: 'Voir mes séances', path: '/client/program', color: '#818cf8', bg: 'linear-gradient(135deg,#312e81aa,#4c1d95aa)', border: '#6366f133' },
            { icon: <Zap size={16}/>, label: 'Séance libre', sub: 'Entraîn. libre', path: '/client/free-session', color: '#34d399', bg: 'linear-gradient(135deg,#064e3baa,#065f46aa)', border: '#10b98133' },
            { icon: <Apple size={16}/>, label: 'Nutrition', sub: 'Mon suivi', path: '/client/nutrition', color: '#22c55e', bg: 'linear-gradient(135deg,#14532daa,#166534aa)', border: '#16a34a33' },
            { icon: <MessageCircle size={16}/>, label: 'Mon coach', sub: 'Messages', path: '/client/messages', color: '#4ade80', bg: 'linear-gradient(135deg,#14532daa,#15803daa)', border: '#22c55e33', badge: unreadCount },
            { icon: <TrendingUp size={16}/>, label: 'Progression', sub: 'Courbes & records', path: '/client/progress', color: '#fbbf24', bg: 'linear-gradient(135deg,#78350faa,#92400eaa)', border: '#f59e0b33' },
            { icon: <Ruler size={16}/>, label: 'Mensurations', sub: 'Suivi du corps', path: '/client/measurements', color: '#2dd4bf', bg: 'linear-gradient(135deg,#134e4aaa,#115e59aa)', border: '#14b8a633' },
            { icon: <Calendar size={16}/>, label: 'Réserver', sub: 'Prendre RDV', path: '/client/book', color: '#a78bfa', bg: 'linear-gradient(135deg,#4c1d95aa,#5b21b6aa)', border: '#7c3aed33' },
            { icon: <ClipboardList size={16}/>, label: 'Bilan semaine', sub: 'Ton ressenti', path: '/client/checkin', color: '#fb923c', bg: 'linear-gradient(135deg,#7c2d12aa,#9a3412aa)', border: '#f9731633' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ position:'relative', background: item.bg, border:'1px solid '+item.border, borderRadius:16, padding:'14px 14px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', textAlign:'left' }}>
              {item.badge > 0 && (
                <span style={{ position:'absolute', top:8, right:8, background:'#ef4444', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'white' }}>{item.badge}</span>
              )}
              <div style={{ width:32, height:32, background:item.color+'22', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:item.color }}>
                {item.icon}
              </div>
              <div>
                <p style={{ margin:0, fontSize:13, fontWeight:600, color:'white' }}>{item.label}</p>
                <p style={{ margin:0, fontSize:11, color:item.color }}>{item.sub}</p>
              </div>
            </button>
          ))}
        </div>

      </div>
    </PageLayout>
  )
}
