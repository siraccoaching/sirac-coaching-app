import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, TrendingUp } from 'lucide-react'

function ProgressChart({ data, label }) {
  if (!data || data.length < 2) {
    return <p style={{color:'#888', fontSize:12, margin:'4px 0 8px'}}>Pas encore assez de données</p>
  }
  const values = data.map(d => d.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const W = 260, H = 72, PX = 8, PY = 8
  const pts = data.map((d, i) => {
    const x = PX + (i / (data.length - 1)) * (W - 2*PX)
    const y = PY + (1 - (d.value - min) / range) * (H - 2*PY)
    return { x, y, ...d }
  })
  const polyPts = pts.map(p => p.x + ',' + p.y).join(' ')
  const first = values[0], last = values[values.length - 1]
  const diff = last - first
  const color = diff >= 0 ? '#22c55e' : '#ef4444'
  const safeId = label.replace(/[^a-zA-Z0-9]/g, '_')
  return (
    <div style={{marginBottom:4}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
        <span style={{fontSize:13, fontWeight:600, color:'#e2e8f0'}}>{label}</span>
        <span style={{fontSize:12, color, fontWeight:600}}>
          {diff >= 0 ? '+' : ''}{diff % 1 === 0 ? diff : diff.toFixed(1)} kg
        </span>
      </div>
      <svg width={W} height={H} style={{display:'block', overflow:'visible'}}>
        <defs>
          <linearGradient id={'pg_' + safeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25}/>
            <stop offset="100%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <polygon
          points={pts.map(p => p.x + ',' + p.y).join(' ') + ' ' + pts[pts.length-1].x + ',' + H + ' ' + pts[0].x + ',' + H}
          fill={'url(#pg_' + safeId + ')'}
        />
        <polyline points={polyPts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="#1e1e2e" strokeWidth={1.5}/>
        ))}
      </svg>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#666', marginTop:3}}>
        <span>{data[0].date}</span>
        <span style={{color:'#888'}}>{first} kg → {last} kg</span>
        <span>{data[data.length-1].date}</span>
      </div>
    </div>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [progressData, setProgressData] = useState({})
  const [totalSessions, setTotalSessions] = useState(0)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: comps } = await supabase
      .from('session_completions')
      .select('id, created_at, exercise_logs(exercise_id, set_data, exercise:program_exercises(name))')
      .eq('client_id', user.id)
      .order('created_at', { ascending: true })
    setTotalSessions((comps || []).length)
    buildProgressData(comps || [])
    setLoading(false)
  }

  function buildProgressData(comps) {
    const exMap = {}
    for (const comp of comps) {
      const dateStr = new Date(comp.created_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'})
      for (const log of comp.exercise_logs || []) {
        const name = log.exercise?.name || 'Exercice'
        if (!exMap[name]) exMap[name] = []
        const sets = (log.set_data || []).filter(s => s._done !== false && parseFloat(s.load) > 0)
        if (sets.length === 0) continue
        const maxLoad = Math.max(...sets.map(s => parseFloat(s.load) || 0))
        const existing = exMap[name].find(e => e.date === dateStr)
        if (existing) { existing.value = Math.max(existing.value, maxLoad) }
        else { exMap[name].push({ date: dateStr, value: maxLoad }) }
      }
    }
    setProgressData(exMap)
  }

  const entries = Object.entries(progressData).filter(([, d]) => d.length >= 2)

  if (loading) return <div style={{color:'white', padding:20}}>Chargement...</div>

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:80}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={() => navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:4}}>
          <ArrowLeft size={20}/>
        </button>
        <div>
          <h2 style={{margin:0, fontSize:18}}>Ma progression</h2>
          <p style={{margin:0, fontSize:12, color:'#888'}}>{totalSessions} séance{totalSessions > 1 ? 's' : ''} enregistrée{totalSessions > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div style={{padding:16}}>
        {entries.length === 0 ? (
          <div style={{textAlign:'center', marginTop:60, color:'#888', padding:'0 24px'}}>
            <TrendingUp size={48} style={{margin:'0 auto 16px', display:'block', opacity:0.3}}/>
            <p style={{fontSize:16, margin:'0 0 8px', color:'#aaa'}}>Pas encore de données</p>
            <p style={{fontSize:13, margin:0, lineHeight:1.5}}>
              Complète au moins 2 séances avec des charges pour voir ta courbe de progression.
            </p>
          </div>
        ) : (
          <>
            <p style={{fontSize:12, color:'#888', margin:'0 0 12px'}}>Charge maximale par exercice au fil du temps</p>
            {entries.map(([name, data]) => (
              <div key={name} style={{background:'#1e1e2e', borderRadius:12, padding:'14px 16px', marginBottom:12}}>
                <ProgressChart data={data} label={name}/>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
