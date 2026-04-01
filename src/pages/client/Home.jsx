import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Play, CheckCircle, Calendar, ChevronRight, Dumbbell, Ruler, ClipboardList, TrendingUp, MessageCircle, Trophy, Flame, Zap } from 'lucide-react'

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
    // Streak
    const dates = [...new Set(comps.map(c => new Date(c.created_at).toDateString()))].map(d => new Date(d)).sort((a,b) => b-a)
    let s = 0, cur = new Date(); cur.setHours(0,0,0,0)
    for (const d of dates) { const dd = new Date(d); dd.setHours(0,0,0,0); if (Math.round((cur-dd)/86400000) <= 1) { s++; cur = dd } else break }
    setStreak(s)
    // Top PRs
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
    const sorted = Object.entries(exMaxes).sort((a,b) => b[1]-a[1]).slice(0, 4)
    setTopPRs(sorted)
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
    <PageLayout title={"Bonjour " + (profile?.full_name?.split(' ')[0] || '') + " 👋"} subtitle="Ton espace entraînement">
      <div className="space-y-4">

        {/* Stats bar */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
          <div style={{background:'#1e1e2e', borderRadius:12, padding:'10px 8px', textAlign:'center'}}>
            <p style={{margin:0, fontSize:22, fontWeight:800, color:'#6366f1'}}>{totalSessions}</p>
            <p style={{margin:0, fontSize:10, color:'#888'}}>séances</p>
          </div>
          <div style={{background:'#1e1e2e', borderRadius:12, padding:'10px 8px', textAlign:'center'}}>
            <p style={{margin:0, fontSize:22, fontWeight:800, color:'#f59e0b'}}>{streak} 🔥</p>
            <p style={{margin:0, fontSize:10, color:'#888'}}>jours streak</p>
          </div>
          <div style={{background:'#1e1e2e', borderRadius:12, padding:'10px 8px', textAlign:'center'}}>
            <p style={{margin:0, fontSize:22, fontWeight:800, color:'#22c55e'}}>{topPRs.length}</p>
            <p style={{margin:0, fontSize:10, color:'#888'}}>records</p>
          </div>
        </div>

        {/* Next session CTA */}
        {nextSession ? (
          <div style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:16, padding:'16px 18px', cursor:'pointer'}}
            onClick={() => navigate('/client/session-log/' + nextSession.id)}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div>
                <p style={{margin:'0 0 3px', fontSize:12, color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:'0.05em'}}>Prochaine séance</p>
                <p style={{margin:'0 0 2px', fontSize:17, fontWeight:700, color:'white'}}>{nextSession.name}</p>
                <p style={{margin:0, fontSize:12, color:'rgba(255,255,255,0.6)'}}>{nextSession.programName} · {nextSession.program_exercises?.length || 0} exercices</p>
              </div>
              <div style={{width:44, height:44, borderRadius:'50%', background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                <Play size={20} color="white" fill="white"/>
              </div>
            </div>
          </div>
        ) : (
          <div style={{background:'#1e1e2e', borderRadius:16, padding:'16px 18px', textAlign:'center', cursor:'pointer'}} onClick={() => navigate('/client/program')}>
            <p style={{margin:'0 0 4px', fontSize:15, color:'#888'}}>Aucun programme actif</p>
            <p style={{margin:0, fontSize:12, color:'#6366f1'}}>Voir mes programmes →</p>
          </div>
        )}

        {/* Last workout */}
        {lastCompletion && (
          <div style={{background:'#1e1e2e', borderRadius:14, padding:'12px 16px', display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:36, height:36, borderRadius:10, background:'#22c55e22', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <CheckCircle size={18} color="#22c55e"/>
            </div>
            <div style={{flex:1}}>
              <p style={{margin:0, fontSize:13, fontWeight:600, color:'white'}}>{lastCompletion.program_sessions?.name || 'Séance libre'}</p>
              <p style={{margin:0, fontSize:11, color:'#888'}}>Dernière séance · {timeAgo(lastCompletion.created_at)}</p>
            </div>
          </div>
        )}

        {/* Top PRs */}
        {topPRs.length > 0 && (
          <div>
            <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
              <Trophy size={13} color="#f59e0b"/>
              <p style={{margin:0, fontSize:12, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em'}}>Tes records</p>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
              {topPRs.map(([name, load]) => (
                <div key={name} style={{background:'#1e1e2e', borderRadius:10, padding:'10px 12px'}}>
                  <p style={{margin:'0 0 2px', fontSize:11, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{name}</p>
                  <p style={{margin:0, fontSize:18, fontWeight:800, color:'#f59e0b'}}>{load} <span style={{fontSize:12, fontWeight:400}}>kg</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions grid */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
          <button onClick={() => navigate('/client/program')} style={{background:'linear-gradient(135deg,#312e81aa,#4c1d95aa)', border:'1px solid #6366f133', borderRadius:14, padding:'14px 12px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', textAlign:'left'}}>
            <div style={{width:32,height:32,background:'#6366f122',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><Dumbbell size={16} color="#818cf8"/></div>
            <div><p style={{margin:0,fontSize:13,fontWeight:600,color:'white'}}>Mon programme</p><p style={{margin:0,fontSize:11,color:'#818cf8'}}>Voir mes séances</p></div>
          </button>
          <button onClick={() => navigate('/client/messages')} style={{position:'relative', background:'linear-gradient(135deg,#14532daa,#15803daa)', border:'1px solid #22c55e33', borderRadius:14, padding:'14px 12px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', textAlign:'left'}}>
            {unreadCount > 0 && <span style={{position:'absolute',top:8,right:8,background:'#ef4444',borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'white'}}>{unreadCount}</span>}
            <div style={{width:32,height:32,background:'#22c55e22',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><MessageCircle size={16} color="#4ade80"/></div>
            <div><p style={{margin:0,fontSize:13,fontWeight:600,color:'white'}}>Mon coach</p><p style={{margin:0,fontSize:11,color:'#4ade80'}}>Messages</p></div>
          </button>
          <button onClick={() => navigate('/client/progress')} style={{background:'linear-gradient(135deg,#78350faa,#92400eaa)', border:'1px solid #f59e0b33', borderRadius:14, padding:'14px 12px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', textAlign:'left'}}>
            <div style={{width:32,height:32,background:'#f59e0b22',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><TrendingUp size={16} color="#fbbf24"/></div>
            <div><p style={{margin:0,fontSize:13,fontWeight:600,color:'white'}}>Progression</p><p style={{margin:0,fontSize:11,color:'#fbbf24'}}>Courbes & records</p></div>
          </button>
          <button onClick={() => navigate('/client/measurements')} style={{background:'linear-gradient(135deg,#134e4aaa,#115e59aa)', border:'1px solid #14b8a633', borderRadius:14, padding:'14px 12px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', textAlign:'left'}}>
            <div style={{width:32,height:32,background:'#14b8a622',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><Ruler size={16} color="#2dd4bf"/></div>
            <div><p style={{margin:0,fontSize:13,fontWeight:600,color:'white'}}>Mensurations</p><p style={{margin:0,fontSize:11,color:'#2dd4bf'}}>Suivi du corps</p></div>
          </button>
          <button onClick={() => navigate('/client/book')} style={{background:'linear-gradient(135deg,#4c1d95aa,#5b21b6aa)', border:'1px solid #7c3aed33', borderRadius:14, padding:'14px 12px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', textAlign:'left'}}>
            <div style={{width:32,height:32,background:'#7c3aed22',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><Calendar size={16} color="#a78bfa"/></div>
            <div><p style={{margin:0,fontSize:13,fontWeight:600,color:'white'}}>Réserver</p><p style={{margin:0,fontSize:11,color:'#a78bfa'}}>Prendre RDV</p></div>
          </button>
          <button onClick={() => navigate('/client/checkin')} style={{background:'linear-gradient(135deg,#7c2d12aa,#9a3412aa)', border:'1px solid #f9731633', borderRadius:14, padding:'14px 12px', display:'flex', flexDirection:'column', gap:8, cursor:'pointer', textAlign:'left'}}>
            <div style={{width:32,height:32,background:'#f9731622',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center'}}><ClipboardList size={16} color="#fb923c"/></div>
            <div><p style={{margin:0,fontSize:13,fontWeight:600,color:'white'}}>Bilan semaine</p><p style={{margin:0,fontSize:11,color:'#fb923c'}}>Ton ressenti</p></div>
          </button>
        </div>

      </div>
    </PageLayout>
  )
}
