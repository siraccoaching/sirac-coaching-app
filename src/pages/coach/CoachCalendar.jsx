import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { ArrowLeft, ChevronLeft, ChevronRight, Users } from 'lucide-react'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier','FÃ©vrier','Mars','Avril','Mai','Juin','Juillet','AoÃ»t','Septembre','Octobre','Novembre','DÃ©cembre']

export default function CoachCalendar() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [completions, setCompletions] = useState([])
  const [clients, setClients] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [viewDate, setViewDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [viewDate])

  async function loadData() {
    setLoading(true)
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const from = new Date(year, month, 1).toISOString()
    const to = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    const { data: cls } = await supabase.from('profiles').select('id, name, sport').eq('coach_id', profile.id)
    setClients(cls || [])

    const clientIds = (cls || []).map(c => c.id)
    if (clientIds.length > 0) {
      const { data: comps } = await supabase.from('session_completions')
        .select('id, created_at, client_id, rpe_session, program_sessions(name)')
        .in('client_id', clientIds)
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at')
      setCompletions(comps || [])
    }
    setLoading(false)
  }

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7 // Monday = 0

  // Map completions by day number
  const byDay = {}
  for (const c of completions) {
    const d = new Date(c.created_at).getDate()
    if (!byDay[d]) byDay[d] = []
    byDay[d].push(c)
  }

  const today = new Date()
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const selectedComps = selectedDay ? (byDay[selectedDay] || []) : []
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:40}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={() => navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><ArrowLeft size={20}/></button>
        <h2 style={{margin:0, flex:1, fontSize:18}}>Calendrier</h2>
        <span style={{fontSize:13, color:'#888'}}>{completions.length} sÃ©ance{completions.length>1?'s':''} ce mois</span>
      </div>

      <div style={{background:'#1e1e2e', margin:'12px 16px', borderRadius:16, padding:16}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14}}>
          <button onClick={prevMonth} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:6}}><ChevronLeft size={20}/></button>
          <p style={{margin:0, fontWeight:700, fontSize:16}}>{MONTHS[month]} {year}</p>
          <button onClick={nextMonth} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:6}}><ChevronRight size={20}/></button>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:6}}>
          {DAYS.map(d => <div key={d} style={{textAlign:'center', fontSize:11, color:'#666', fontWeight:600, padding:'2px 0'}}>{d}</div>)}
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4}}>
          {Array.from({length: startOffset}).map((_, i) => <div key={'e'+i}/>)}
          {Array.from({length: daysInMonth}).map((_, i) => {
            const day = i + 1
            const count = byDay[day]?.length || 0
            const selected = selectedDay === day
            const todayFlag = isToday(day)
            return (
              <button key={day} onClick={() => setSelectedDay(selected ? null : day)}
                style={{aspectRatio:'1', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  borderRadius:10, border: todayFlag ? '2px solid #6366f1' : '2px solid transparent',
                  background: selected ? '#6366f133' : count > 0 ? '#1a2a3a' : 'transparent',
                  cursor:'pointer', position:'relative'}}>
                <span style={{fontSize:13, fontWeight: todayFlag ? 700 : 400, color: todayFlag ? '#6366f1' : count > 0 ? 'white' : '#555'}}>{day}</span>
                {count > 0 && (
                  <div style={{display:'flex', gap:2, marginTop:2}}>
                    {Array.from({length: Math.min(count, 3)}).map((_, j) => (
                      <div key={j} style={{width:4, height:4, borderRadius:'50%', background:'#22c55e'}}/>
                    ))}
                    {count > 3 && <div style={{width:4, height:4, borderRadius:'50%', background:'#f59e0b'}}/>}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <div style={{padding:'0 16px'}}>
          <p style={{margin:'0 0 10px', color:'#888', fontSize:13}}>{selectedComps.length > 0 ? selectedComps.length + ' sÃ©ance' + (selectedComps.length>1?'s':'') + ' le ' + selectedDay + ' ' + MONTHS[month] : 'Aucune sÃ©ance ce jour'}</p>
          {selectedComps.map(comp => {
            const cl = clientMap[comp.client_id]
            return (
              <div key={comp.id} onClick={() => navigate('/coach/clients/' + comp.client_id)}
                style={{background:'#1e1e2e', borderRadius:12, padding:'12px 14px', marginBottom:10, cursor:'pointer', display:'flex', gap:10, alignItems:'center'}}>
                <div style={{width:36, height:36, borderRadius:'50%', background:'#6366f133', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <span style={{color:'#6366f1', fontWeight:700}}>{cl?.name?.[0] || '?'}</span>
                </div>
                <div style={{flex:1}}>
                  <p style={{margin:0, fontWeight:600, fontSize:14}}>{cl?.name || 'Client'}</p>
                  <p style={{margin:0, fontSize:12, color:'#888'}}>{comp.program_sessions?.name || 'SÃ©ance libre'} {comp.rpe_session ? 'Â· RPE ' + comp.rpe_session : ''}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!selectedDay && (
        <div style={{padding:'0 16px'}}>
          <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:10}}>
            <Users size={14} color="#888"/>
            <p style={{margin:0, fontSize:13, color:'#888'}}>ActivitÃ© de tous les clients ce mois</p>
          </div>
          {clients.filter(c => completions.some(cp => cp.client_id === c.id)).map(c => {
            const count = completions.filter(cp => cp.client_id === c.id).length
            return (
              <div key={c.id} onClick={() => navigate('/coach/clients/' + c.id)}
                style={{background:'#1e1e2e', borderRadius:12, padding:'10px 14px', marginBottom:8, display:'flex', alignItems:'center', gap:10, cursor:'pointer'}}>
                <div style={{width:32, height:32, borderRadius:'50%', background:'#6366f133', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                  <span style={{color:'#6366f1', fontWeight:700, fontSize:13}}>{c.name[0]}</span>
                </div>
                <p style={{margin:0, flex:1, fontWeight:500, fontSize:14}}>{c.name}</p>
                <span style={{fontSize:13, color:'#22c55e', fontWeight:600}}>{count} sÃ©ance{count>1?'s':''}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
