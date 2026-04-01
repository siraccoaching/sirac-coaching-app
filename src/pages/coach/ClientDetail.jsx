import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Trash2, TrendingUp, Calendar, ChevronDown, ChevronUp } from 'lucide-react'

function ProgressChart({ data, label }) {
  if (!data || data.length < 2) {
    return <p style={{color:'#888', fontSize:12, margin:'4px 0 8px'}}>Pas encore assez de donnÃ©es</p>
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
    <div style={{marginBottom: 4}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6}}>
        <span style={{fontSize:13, fontWeight:600, color:'#e2e8f0'}}>{label}</span>
        <span style={{fontSize:12, color, fontWeight:600}}>
          {diff >= 0 ? '+' : ''}{diff % 1 === 0 ? diff : diff.toFixed(1)} kg
        </span>
      </div>
      <svg width={W} height={H} style={{display:'block', overflow:'visible'}}>
        <defs>
          <linearGradient id={'grad_' + safeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25}/>
            <stop offset="100%" stopColor={color} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <polygon
          points={pts.map(p => p.x + ',' + p.y).join(' ') + ' ' + pts[pts.length-1].x + ',' + H + ' ' + pts[0].x + ',' + H}
          fill={'url(#grad_' + safeId + ')'}
        />
        <polyline points={polyPts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="#1e1e2e" strokeWidth={1.5}/>
        ))}
      </svg>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'#666', marginTop:3}}>
        <span>{data[0].date}</span>
        <span style={{color:'#888'}}>{first} kg â {last} kg</span>
        <span>{data[data.length-1].date}</span>
      </div>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [client, setClient] = useState(null)
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [tab, setTab] = useState('history')
  const [progressData, setProgressData] = useState({})

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
    setClient(profile)
    const { data: comps } = await supabase
      .from('session_completions')
      .select('id, created_at, duration_seconds, program_sessions(name), exercise_logs(id, exercise_id, set_data, notes, exercise:program_exercises(name))')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
    setCompletions(comps || [])
    buildProgressData(comps || [])
    setLoading(false)
  }

  function buildProgressData(comps) {
    const exMap = {}
    const sorted = [...comps].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    for (const comp of sorted) {
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

  async function deleteCompletion(compId) {
    if (!confirm('Supprimer cette sÃ©ance ?')) return
    setDeleting(compId)
    await supabase.from('exercise_logs').delete().eq('session_completion_id', compId)
    await supabase.from('session_completions').delete().eq('id', compId)
    setCompletions(prev => prev.filter(c => c.id !== compId))
    setDeleting(null)
  }

  function toggleExpand(cid) {
    setExpanded(prev => ({ ...prev, [cid]: !prev[cid] }))
  }

  function calcStreak() {
    if (completions.length === 0) return 0
    const dates = [...new Set(completions.map(c => new Date(c.created_at).toDateString()))]
      .map(d => new Date(d)).sort((a, b) => b - a)
    let streak = 0, cur = new Date()
    cur.setHours(0,0,0,0)
    for (const d of dates) {
      const dd = new Date(d); dd.setHours(0,0,0,0)
      const diff = Math.round((cur - dd) / 86400000)
      if (diff <= 1) { streak++; cur = dd } else break
    }
    return streak
  }

  if (loading) return <div style={{color:'white',padding:20}}>Chargement...</div>
  if (!client) return <div style={{color:'white',padding:20}}>Client introuvable</div>

  const streak = calcStreak()
  const progressEntries = Object.entries(progressData).filter(([, d]) => d.length >= 2)

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:40}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={() => navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:4}}>
          <ArrowLeft size={20}/>
        </button>
        <div style={{flex:1}}>
          <h2 style={{margin:0, fontSize:18}}>{client.name}</h2>
          {client.sport && <p style={{margin:0, fontSize:13, color:'#888'}}>{client.sport}{client.position ? ' Â· ' + client.position : ''}</p>}
        </div>
      </div>

      <div style={{display:'flex', gap:10, padding:'12px 16px'}}>
        <div style={{flex:1, background:'#1e1e2e', borderRadius:12, padding:'12px 10px', textAlign:'center'}}>
          <p style={{margin:0, fontSize:22, fontWeight:700, color:'#6366f1'}}>{completions.length}</p>
          <p style={{margin:0, fontSize:11, color:'#888'}}>sÃ©ances</p>
        </div>
        <div style={{flex:1, background:'#1e1e2e', borderRadius:12, padding:'12px 10px', textAlign:'center'}}>
          <p style={{margin:0, fontSize:22, fontWeight:700, color:'#f59e0b'}}>{streak} ð¥</p>
          <p style={{margin:0, fontSize:11, color:'#888'}}>jours consec.</p>
        </div>
        <div style={{flex:1, background:'#1e1e2e', borderRadius:12, padding:'12px 10px', textAlign:'center'}}>
          <p style={{margin:0, fontSize:22, fontWeight:700, color:'#22c55e'}}>{progressEntries.length}</p>
          <p style={{margin:0, fontSize:11, color:'#888'}}>exercices suivis</p>
        </div>
      </div>

      <div style={{display:'flex', margin:'0 16px 12px', background:'#1e1e2e', borderRadius:10, padding:4}}>
        {[['history','ð Historique'], ['progress','ð Progression']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{flex:1, padding:'8px 0', border:'none', borderRadius:8, cursor:'pointer', fontSize:14, fontWeight:600,
              background: tab === key ? '#6366f1' : 'transparent',
              color: tab === key ? 'white' : '#888'}}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div style={{padding:'0 16px'}}>
          {completions.length === 0 && (
            <p style={{color:'#888', textAlign:'center', marginTop:40}}>Aucune sÃ©ance enregistrÃ©e</p>
          )}
          {completions.map(comp => (
            <div key={comp.id} style={{background:'#1e1e2e', borderRadius:12, marginBottom:12, overflow:'hidden'}}>
              <div style={{padding:'12px 14px', display:'flex', alignItems:'center', gap:8}}>
                <div style={{flex:1}}>
                  <p style={{margin:0, fontWeight:600, fontSize:15}}>{comp.program_sessions?.name || 'SÃ©ance libre'}</p>
                  <p style={{margin:0, fontSize:12, color:'#888'}}>
                    {new Date(comp.created_at).toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short', year:'numeric'})}
                    {comp.duration_seconds ? ' Â· ' + Math.round(comp.duration_seconds / 60) + ' min' : ''}
                  </p>
                </div>
                <button onClick={() => deleteCompletion(comp.id)} disabled={deleting === comp.id}
                  style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', opacity: deleting === comp.id ? 0.5 : 1, padding:4}}>
                  <Trash2 size={16}/>
                </button>
                <button onClick={() => toggleExpand(comp.id)}
                  style={{background:'none', border:'none', color:'#888', cursor:'pointer', padding:4}}>
                  {expanded[comp.id] ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
              </div>
              {expanded[comp.id] && (
                <div style={{borderTop:'1px solid #2a2a3e', padding:'10px 14px'}}>
                  {(comp.exercise_logs || []).map((log, li) => (
                    <div key={li} style={{marginBottom:10}}>
                      <p style={{margin:'0 0 5px', fontSize:13, fontWeight:600, color:'#a78bfa'}}>
                        {log.exercise?.name || 'Exercice'}
                      </p>
                      <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {(log.set_data || []).map((s, si) => (
                          <div key={si} style={{
                            background: s._done === false ? '#2a2a3e' : '#1a2a1a',
                            border: '1px solid ' + (s._done === false ? '#3a3a4e' : '#22c55e44'),
                            borderRadius:6, padding:'3px 8px', fontSize:11,
                            color: s._done === false ? '#555' : '#ccc'
                          }}>
                            {s.reps ? s.reps + ' reps' : ''}{s.load ? ' Â· ' + s.load + 'kg' : ''}{s.rpe ? ' Â· RPE ' + s.rpe : ''}
                          </div>
                        ))}
                      </div>
                      {log.notes && <p style={{margin:'4px 0 0', fontSize:11, color:'#888', fontStyle:'italic'}}>{log.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'progress' && (
        <div style={{padding:'0 16px'}}>
          {progressEntries.length === 0 ? (
            <div style={{textAlign:'center', marginTop:50, color:'#888'}}>
              <TrendingUp size={44} style={{margin:'0 auto 14px', display:'block', opacity:0.3}}/>
              <p style={{fontSize:15, margin:'0 0 8px'}}>Pas encore assez de donnÃ©es</p>
              <p style={{fontSize:12, margin:0}}>Il faut au moins 2 sÃ©ances avec des charges renseignÃ©es.</p>
            </div>
          ) : (
            progressEntries.map(([name, data]) => (
              <div key={name} style={{background:'#1e1e2e', borderRadius:12, padding:'14px 16px', marginBottom:12}}>
                <ProgressChart data={data} label={name}/>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
