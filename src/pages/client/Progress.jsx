import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, TrendingUp, BarChart3 } from 'lucide-react'

function LineChart({ data, label }) {
  if (!data || data.length < 2) return <p style={{color:'#888',fontSize:12,margin:'4px 0 8px'}}>Pas encore assez de données</p>
  const values = data.map(d => d.value)
  const min = Math.min(...values), max = Math.max(...values)
  const range = max - min || 1
  const W = 260, H = 72, PX = 8, PY = 8
  const pts = data.map((d,i) => ({ x: PX+(i/(data.length-1))*(W-2*PX), y: PY+(1-(d.value-min)/range)*(H-2*PY), ...d }))
  const poly = pts.map(p=>p.x+','+p.y).join(' ')
  const diff = values[values.length-1] - values[0]
  const color = diff >= 0 ? '#22c55e' : '#ef4444'
  const sid = label.replace(/[^a-zA-Z0-9]/g,'_')
  return (
    <div style={{marginBottom:4}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <span style={{fontSize:13,fontWeight:600,color:'#e2e8f0'}}>{label}</span>
        <span style={{fontSize:12,color,fontWeight:600}}>{diff>=0?'+':''}{diff%1===0?diff:diff.toFixed(1)} kg</span>
      </div>
      <svg width={W} height={H} style={{display:'block',overflow:'visible'}}>
        <defs><linearGradient id={'g'+sid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.25}/><stop offset="100%" stopColor={color} stopOpacity={0}/></linearGradient></defs>
        <polygon points={pts.map(p=>p.x+','+p.y).join(' ')+' '+pts[pts.length-1].x+','+H+' '+pts[0].x+','+H} fill={'url(#g'+sid+')'}/>
        <polyline points={poly} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"/>
        {pts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="#1e1e2e" strokeWidth={1.5}/>)}
      </svg>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#666',marginTop:3}}>
        <span>{data[0].date}</span><span style={{color:'#888'}}>{values[0]} → {values[values.length-1]} kg</span><span>{data[data.length-1].date}</span>
      </div>
    </div>
  )
}

function BarChartVol({ data }) {
  if (!data || data.length < 2) return <p style={{color:'#888',fontSize:12,margin:'4px 0 8px'}}>Pas encore assez de données</p>
  const values = data.map(d => d.value)
  const max = Math.max(...values) || 1
  const W = 260, H = 72
  const bw = Math.floor((W - (data.length-1)*4) / data.length)
  return (
    <div>
      <svg width={W} height={H} style={{display:'block'}}>
        {data.map((d,i) => {
          const h = Math.max(4, (d.value/max)*(H-10))
          const x = i*(bw+4)
          return <rect key={i} x={x} y={H-h} width={bw} height={h} rx={3} fill={i===data.length-1?'#6366f1':'#2a2a4e'}/>
        })}
      </svg>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#666',marginTop:3}}>
        <span>{data[0].date}</span>
        <span style={{color:'#888'}}>Tonnage hebdo (kg)</span>
        <span>{data[data.length-1].date}</span>
      </div>
    </div>
  )
}

export default function Progress() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('load')
  const [loadData, setLoadData] = useState({})
  const [tonnageData, setTonnageData] = useState([])
  const [totalSessions, setTotalSessions] = useState(0)

  useEffect(() => { loadAllData() }, [])

  async function loadAllData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: comps } = await supabase.from('session_completions')
      .select('id, created_at, exercise_logs(exercise_id, set_data, exercise:program_exercises(name))')
      .eq('client_id', user.id).order('created_at', { ascending: true })
    setTotalSessions((comps||[]).length)
    buildLoadData(comps||[])
    buildTonnageData(comps||[])
    setLoading(false)
  }

  function buildLoadData(comps) {
    const exMap = {}
    for (const comp of comps) {
      const dateStr = new Date(comp.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})
      for (const log of comp.exercise_logs||[]) {
        const name = log.exercise?.name||'Exercice'
        if (!exMap[name]) exMap[name] = []
        const sets = (log.set_data||[]).filter(s=>s._done!==false&&parseFloat(s.load)>0)
        if (!sets.length) continue
        const m = Math.max(...sets.map(s=>parseFloat(s.load)||0))
        const ex = exMap[name].find(e=>e.date===dateStr)
        if (ex) { ex.value = Math.max(ex.value,m) } else { exMap[name].push({date:dateStr,value:m}) }
      }
    }
    setLoadData(exMap)
  }

  function buildTonnageData(comps) {
    // Group by week, sum sets*reps*load
    const weekMap = {}
    for (const comp of comps) {
      const d = new Date(comp.created_at)
      const week = getWeekKey(d)
      if (!weekMap[week]) weekMap[week] = { date: formatWeek(d), value: 0 }
      for (const log of comp.exercise_logs||[]) {
        for (const s of log.set_data||[]) {
          if (s._done === false) continue
          const vol = (parseFloat(s.reps)||0) * (parseFloat(s.load)||0)
          weekMap[week].value += vol
        }
      }
    }
    const sorted = Object.values(weekMap).slice(-12)
    sorted.forEach(w => { w.value = Math.round(w.value) })
    setTonnageData(sorted)
  }

  function getWeekKey(d) {
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay() + 1)
    return start.toISOString().slice(0,10)
  }
  function formatWeek(d) {
    const start = new Date(d)
    start.setDate(d.getDate() - d.getDay() + 1)
    return start.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})
  }

  const loadEntries = Object.entries(loadData).filter(([,d])=>d.length>=2)

  if (loading) return <div style={{color:'white',padding:20}}>Chargement...</div>
  return (
    <div style={{minHeight:'100vh',background:'#0f0f1a',color:'white',paddingBottom:80}}>
      <div style={{background:'#1e1e2e',padding:'16px 20px',display:'flex',alignItems:'center',gap:12}}>
        <button onClick={()=>navigate(-1)} style={{background:'none',border:'none',color:'white',cursor:'pointer'}}><ArrowLeft size={20}/></button>
        <div>
          <h2 style={{margin:0,fontSize:18}}>Ma progression</h2>
          <p style={{margin:0,fontSize:12,color:'#888'}}>{totalSessions} séance{totalSessions>1?'s':''} enregistrée{totalSessions>1?'s':''}</p>
        </div>
      </div>

      <div style={{display:'flex',margin:'12px 16px 8px',background:'#1e1e2e',borderRadius:10,padding:4}}>
        {[['load','📈 Charges max'],['tonnage','📊 Tonnage hebdo']].map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)} style={{flex:1,padding:'8px 0',border:'none',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:600,
            background:activeTab===k?'#6366f1':'transparent',color:activeTab===k?'white':'#888'}}>{l}</button>
        ))}
      </div>

      <div style={{padding:'0 16px'}}>
        {activeTab === 'load' && (
          loadEntries.length === 0 ? (
            <div style={{textAlign:'center',marginTop:50,color:'#888'}}>
              <TrendingUp size={44} style={{margin:'0 auto 14px',display:'block',opacity:0.3}}/>
              <p>Complète au moins 2 séances avec des charges.</p>
            </div>
          ) : loadEntries.map(([name,data])=>(
            <div key={name} style={{background:'#1e1e2e',borderRadius:12,padding:'14px 16px',marginBottom:12}}>
              <LineChart data={data} label={name}/>
            </div>
          ))
        )}
        {activeTab === 'tonnage' && (
          tonnageData.length < 2 ? (
            <div style={{textAlign:'center',marginTop:50,color:'#888'}}>
              <BarChart3 size={44} style={{margin:'0 auto 14px',display:'block',opacity:0.3}}/>
              <p>Pas encore assez de données de volume.</p>
            </div>
          ) : (
            <div style={{background:'#1e1e2e',borderRadius:12,padding:'16px',marginBottom:12}}>
              <p style={{margin:'0 0 4px',fontSize:13,fontWeight:600,color:'#e2e8f0'}}>Tonnage total par semaine</p>
              <p style={{margin:'0 0 14px',fontSize:12,color:'#888'}}>Somme (séries × reps × charge)</p>
              <BarChartVol data={tonnageData}/>
              <div style={{marginTop:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div style={{background:'#2a2a3e',borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
                  <p style={{margin:0,fontSize:18,fontWeight:700,color:'#6366f1'}}>{Math.max(...tonnageData.map(d=>d.value)).toLocaleString()}</p>
                  <p style={{margin:0,fontSize:11,color:'#888'}}>record hebdo (kg)</p>
                </div>
                <div style={{background:'#2a2a3e',borderRadius:10,padding:'10px 12px',textAlign:'center'}}>
                  <p style={{margin:0,fontSize:18,fontWeight:700,color:'#22c55e'}}>{Math.round(tonnageData.reduce((s,d)=>s+d.value,0)/tonnageData.length).toLocaleString()}</p>
                  <p style={{margin:0,fontSize:11,color:'#888'}}>moyenne hebdo (kg)</p>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
