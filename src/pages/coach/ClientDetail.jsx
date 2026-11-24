import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { PageLayout } from '../../components/Layout'
import { ArrowLeft, Trash2, TrendingUp, ChevronDown, ChevronUp, Check, Pencil, X } from 'lucide-react'
import ClientNutritionTab from '../../components/ClientNutritionTab'
import PrivatePhoto from '../../components/PrivatePhoto'
import { formatSetValue } from '../../lib/measure'
import { tone } from '../../lib/theme'
import { assignClient, personalizeForClient } from '../../lib/assignments'
import ProgramPlanner from '../../components/ProgramPlanner'

function ProgressChart({ data, label }) {
  if (!data || data.length < 2) {
    return <p style={{color:'var(--label2)', fontSize:12, margin:'4px 0 8px'}}>Pas encore assez de données</p>
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
        <span style={{fontSize:13, fontWeight:600, color:'var(--label1b)'}}>{label}</span>
        <span style={{fontSize:12, color: tone(color), fontWeight:600}}>
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
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="var(--card)" strokeWidth={1.5}/>
        ))}
      </svg>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--label3)', marginTop:3}}>
        <span>{data[0].date}</span>
        <span style={{color:'var(--label2)'}}>{first} kg   {last} kg</span>
        <span>{data[data.length-1].date}</span>
      </div>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile: coachProfile } = useAuth()
  const [client, setClient] = useState(null)
  const [completions, setCompletions] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [tab, setTab] = useState('history')
  const [progressData, setProgressData] = useState({})
  const [programs, setPrograms] = useState([])
  const [currentProgram, setCurrentProgram] = useState(null)
  const [assignModal, setAssignModal] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [measurements, setMeasurements] = useState([])
  const [sessions, setSessions] = useState([])
  const [checkins, setCheckins] = useState([])

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).single()
    setClient(profile)

    const coachId = coachProfile?.id || profile?.coach_id
    if (coachId) {
      const { data: progs } = await supabase
        .from('programs')
        .select('id, name, type, program_assignments(client_id), program_sessions!program_sessions_program_id_fkey(id, name, order_index, block_id, program_blocks(order_index))')
        .eq('coach_id', coachId)
      setPrograms(progs || [])
      const cp = (progs || []).find(p => (p.program_assignments || []).some(a => a.client_id === id))
      setCurrentProgram(cp || null)
    }

    const { data: comps } = await supabase
      .from('session_completions')
      .select('id, created_at, program_sessions(name), exercise_logs(id, exercise_id, exercise_name, set_data, notes, exercise:program_exercises(name))')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
    setCompletions(comps || [])
    buildProgressData(comps || [])
    const { data: meas } = await supabase.from('client_measurements').select('*').eq('client_id', id).order('measured_at', { ascending: false })
    setMeasurements(meas || [])
    const { data: sess } = await supabase.from('sessions').select('*').eq('client_id', id).order('session_date', { ascending: false }).limit(30)
    setSessions(sess || [])
    const { data: checks } = await supabase.from('weekly_checkins').select('*').eq('client_id', id).order('week_start', { ascending: false })
    setCheckins(checks || [])
    setLoading(false)
  }

  function buildProgressData(comps) {
    const exMap = {}
    const sorted = [...comps].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    for (const comp of sorted) {
      const dateStr = new Date(comp.created_at).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'})
      for (const log of comp.exercise_logs || []) {
        const name = log.exercise?.name || log.exercise_name || 'Exercice'
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

  async function assignProgram(progId) {
    setAssigning(true)
    try { await assignClient(progId, id) } catch (e) { alert('Erreur : ' + e.message) }
    const prog = programs.find(p => p.id === progId)
    setCurrentProgram(prog || null)
    setAssignModal(false)
    setAssigning(false)
  }

  // Copie du programme partagé, réservée à ce client, puis ouverture dans le créateur
  async function personalize() {
    if (!confirm(`Créer une version du programme rien que pour ${client.name} ? Les autres clients gardent le programme actuel.`)) return
    setAssigning(true)
    try {
      const prog = await personalizeForClient(currentProgram.id, id, client.name, coachProfile?.id || client.coach_id)
      navigate(`/coach/programs/${prog.id}/edit`)
    } catch (e) { alert('Erreur : ' + e.message) }
    setAssigning(false)
  }

  async function deleteCompletion(compId) {
    if (!confirm('Supprimer cette séance ?')) return
    setDeleting(compId)
    await supabase.from('exercise_logs').delete().eq('completion_id', compId)
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

  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editSaving, setEditSaving] = useState(false)

  if (loading) return <PageLayout back="/coach" title="Client"><div style={{color:'var(--label2)',padding:20}}>Chargement...</div></PageLayout>
  if (!client) return <PageLayout back="/coach" title="Client"><div style={{color:'var(--label2)',padding:20}}>Client introuvable</div></PageLayout>

  const streak = calcStreak()
  const progressEntries = Object.entries(progressData).filter(([, d]) => d.length >= 2)

  async function deleteClient() {
    if (!confirm('Retirer ce client de ta liste ? Son compte et son historique sont conservés, tu pourras le rattacher à nouveau.')) return
    await supabase.from('profiles').update({ coach_id: null }).eq('id', id)
    navigate('/coach')
  }

  function openEdit() {
    setEditForm({
      name: client?.name || '',
      sport: client?.sport || '',
      position: client?.position || '',
      current_phase: client?.current_phase || '',
    })
    setEditModal(true)
  }

  async function saveEdit() {
    setEditSaving(true)
    await supabase.from('profiles').update({
      name: editForm.name,
      sport: editForm.sport,
      position: editForm.position,
      current_phase: editForm.current_phase,
    }).eq('id', id)
    await loadData()
    setEditModal(false)
    setEditSaving(false)
  }

  return (
    <PageLayout back="/coach" title={client.name} subtitle={client.sport ? client.sport + (client.position ? ' · ' + client.position : '') : undefined}
      action={
        <div style={{display:'flex', gap:6}}>
          <button onClick={openEdit} aria-label="Modifier le client" style={iconBtn}><Pencil size={16}/></button>
          <button onClick={deleteClient} aria-label="Retirer ce client" style={{...iconBtn, color:'var(--red-text)'}}><Trash2 size={17}/></button>
        </div>
      }>
      <div style={{display:'flex', gap:10, padding:'12px 16px'}}>
        <div style={{flex:1, background:'var(--card)', borderRadius:12, padding:'12px 10px', textAlign:'center'}}>
          <p style={{margin:0, fontSize:22, fontWeight:700, color:'var(--accent-text)'}}>{completions.length}</p>
          <p style={{margin:0, fontSize:11, color:'var(--label2)'}}>séances</p>
        </div>
        <div style={{flex:1, background:'var(--card)', borderRadius:12, padding:'12px 10px', textAlign:'center'}}>
          <p style={{margin:0, fontSize:22, fontWeight:700, color:'var(--yellow-text)'}}>{streak} 🔥</p>
          <p style={{margin:0, fontSize:11, color:'var(--label2)'}}>jours consec.</p>
        </div>
        <div style={{flex:1, background:'var(--card)', borderRadius:12, padding:'12px 10px', textAlign:'center'}}>
          <p style={{margin:0, fontSize:22, fontWeight:700, color:'var(--green-text)'}}>{progressEntries.length}</p>
          <p style={{margin:0, fontSize:11, color:'var(--label2)'}}>exercices suivis</p>
        </div>
      </div>

      <div style={{margin:'0 16px 12px', background:'var(--card)', borderRadius:12, padding:'14px 16px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <p style={{margin:'0 0 3px', fontSize:11, color:'var(--label2)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Programme actif</p>
            <p style={{margin:0, fontSize:15, fontWeight:600, color: currentProgram ? 'var(--purple-text)' : 'var(--label3)'}}>
              {currentProgram ? currentProgram.name : 'Aucun programme assigné'}
            </p>
          </div>
          <button
            onClick={() => setAssignModal(true)}
            style={{background:'#6366f1', border:'none', color:'white', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:600, cursor:'pointer'}}
          >
            {currentProgram ? 'Changer' : 'Assigner'}
          </button>
        </div>
        {currentProgram && (currentProgram.program_assignments || []).length > 1 && (
          <div style={{marginTop:10, paddingTop:10, borderTop:'0.5px solid var(--separator)'}}>
            <p style={{margin:'0 0 8px', fontSize:13, color:'var(--label2)'}}>👥 Programme partagé avec {(currentProgram.program_assignments || []).length - 1} autre{(currentProgram.program_assignments || []).length > 2 ? 's' : ''} client{(currentProgram.program_assignments || []).length > 2 ? 's' : ''}. Une modification s’applique à tous.</p>
            <button data-testid="personalize-btn" onClick={personalize} disabled={assigning}
              style={{width:'100%', background:'var(--accent-soft)', border:'none', color:'var(--accent-text)', borderRadius:10, padding:'10px 0', fontSize:14, fontWeight:600, cursor:'pointer'}}>
              ✏️ {assigning ? 'Création…' : `Personnaliser pour ${client.name.split(' ')[0]}`}
            </button>
          </div>
        )}
      </div>

      <div style={{display:'flex', margin:'0 16px 12px', background:'var(--card)', borderRadius:10, padding:4, overflowX:'auto', gap:2}}>
        {[['history','📋 Historique'], ['progress','📈 Progression'], ['measurements','📏 Mensurations'], ['calendar','📅 Calendrier'], ['checkins','📊 Bilans'], ['nutrition','🍎 Nutrition']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flexShrink:0, padding:'8px 10px', border:'none', borderRadius:8, cursor:'pointer', fontSize:11, fontWeight:600, whiteSpace:'nowrap',
            background: tab === key ? '#6366f1' : 'transparent', color: tab === key ? 'white' : 'var(--label2)'
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div style={{padding:'0 16px'}}>
          {completions.length === 0 && (
            <p style={{color:'var(--label2)', textAlign:'center', marginTop:40}}>Aucune séance enregistrée</p>
          )}
          {completions.map(comp => (
            <div key={comp.id} style={{background:'var(--card)', borderRadius:12, marginBottom:12, overflow:'hidden'}}>
              <div style={{padding:'12px 14px', display:'flex', alignItems:'center', gap:8}}>
                <div style={{flex:1}}>
                  <p style={{margin:0, fontWeight:600, fontSize:15}}>{comp.program_sessions?.name || 'Séance libre'}</p>
                  <p style={{margin:0, fontSize:12, color:'var(--label2)'}}>
                    {new Date(comp.created_at).toLocaleDateString('fr-FR', {weekday:'short', day:'numeric', month:'short', year:'numeric'})}
                  </p>
                </div>
                <button onClick={() => deleteCompletion(comp.id)} disabled={deleting === comp.id} aria-label="Supprimer cette séance"
                  style={{background:'none', border:'none', color:'var(--red-text)', cursor:'pointer', opacity: deleting === comp.id ? 0.5 : 1, padding:4}}>
                  <Trash2 size={16}/>
                </button>
                <button onClick={() => toggleExpand(comp.id)}
                  style={{background:'none', border:'none', color:'var(--label2)', cursor:'pointer', padding:4}}>
                  {expanded[comp.id] ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
              </div>
              {expanded[comp.id] && (
                <div style={{borderTop:'1px solid var(--fill)', padding:'10px 14px'}}>
                  {(comp.exercise_logs || []).map((log, li) => (
                    <div key={li} style={{marginBottom:10}}>
                      <p style={{margin:'0 0 5px', fontSize:13, fontWeight:600, color:'var(--accent-text)'}}>
                        {log.exercise?.name || log.exercise_name || 'Exercice'}
                      </p>
                      <div style={{display:'flex', flexWrap:'wrap', gap:4}}>
                        {(log.set_data || []).map((s, si) => (
                          <div key={si} style={{
                            background: s._done === false ? 'var(--fill)' : 'rgba(52,199,89,0.12)',
                            border: '1px solid ' + (s._done === false ? 'var(--separator)' : '#22c55e44'),
                            borderRadius:6, padding:'3px 8px', fontSize:11,
                            color: s._done === false ? 'var(--label3)' : 'var(--label1b)'
                          }}>
                            {formatSetValue(s)}{s.load ? ' · ' + s.load + 'kg' : ''}{s.rpe ? ' · RPE ' + s.rpe : ''}
                          </div>
                        ))}
                      </div>
                      {log.notes && <p style={{margin:'4px 0 0', fontSize:11, color:'var(--label2)', fontStyle:'italic'}}>{log.notes}</p>}
                    </div>
                  ))}
                  {(comp.rpe_session || comp.notes || comp.wellbeing_note) && (
                    <div style={{marginTop:10, paddingTop:10, borderTop:'1px solid var(--fill)', display:'flex', flexDirection:'column', gap:6}}>
                      {comp.rpe_session && (
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          <span style={{fontSize:11, color:'var(--label2)'}}>RPE séance :</span>
                          <div style={{display:'flex', gap:3}}>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <div key={n} style={{width:14, height:14, borderRadius:3,
                                background: n <= comp.rpe_session ? (comp.rpe_session >= 9 ? '#ef4444' : comp.rpe_session >= 7 ? '#f59e0b' : '#22c55e') : 'var(--fill)'}}/>
                            ))}
                            <span style={{fontSize:11, color:'var(--label2)', marginLeft:4}}>{comp.rpe_session}/10</span>
                          </div>
                        </div>
                      )}
                      {comp.notes && (
                        <div style={{background:'var(--bg)', borderRadius:8, padding:'7px 10px'}}>
                          <p style={{margin:'0 0 2px', fontSize:10, color:'var(--label3)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Notes de séance</p>
                          <p style={{margin:0, fontSize:12, color:'var(--label1b)'}}>{comp.notes}</p>
                        </div>
                      )}
                      {comp.wellbeing_note && (
                        <div style={{background:'var(--bg)', borderRadius:8, padding:'7px 10px'}}>
                          <p style={{margin:'0 0 2px', fontSize:10, color:'var(--label3)', textTransform:'uppercase', letterSpacing:'0.5px'}}>Bien-être</p>
                          <p style={{margin:0, fontSize:12, color:'var(--label1b)'}}>{comp.wellbeing_note}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'progress' && (
        <div style={{padding:'0 16px'}}>
          {progressEntries.length === 0 ? (
            <div style={{textAlign:'center', marginTop:50, color:'var(--label2)'}}>
              <TrendingUp size={44} style={{margin:'0 auto 14px', display:'block', opacity:0.3}}/>
              <p style={{fontSize:15, margin:'0 0 8px'}}>Pas encore assez de données</p>
              <p style={{fontSize:12, margin:0}}>Il faut au moins 2 séances avec des charges renseignées.</p>
            </div>
          ) : (
            progressEntries.map(([name, data]) => (
              <div key={name} style={{background:'var(--card)', borderRadius:12, padding:'14px 16px', marginBottom:12}}>
                <ProgressChart data={data} label={name}/>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MENSURATIONS ── */}
      {tab === 'measurements' && (
        <div style={{padding:'0 16px'}}>
          {measurements.length === 0 ? (
            <div style={{textAlign:'center', paddingTop:40, color:'var(--label3)'}}>
              <p style={{fontSize:15}}>Aucune mensuration</p>
              <p style={{fontSize:12}}>Le client n'a pas encore renseigné de mensurations.</p>
            </div>
          ) : measurements.map(m => (
            <div key={m.id} style={{background:'var(--card)', borderRadius:12, padding:'14px 16px', marginBottom:10}}>
              <p style={{margin:'0 0 10px', fontSize:12, color:'var(--accent-text)', fontWeight:700}}>
                {new Date(m.measured_at).toLocaleDateString('fr-FR', {day:'numeric', month:'long', year:'numeric'})}
              </p>
              <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
                {[['Poids', m.weight, 'kg'],['% Graisse', m.body_fat, '%'],['Masse musc.', m.muscle_mass, 'kg'],
                  ['Tour taille', m.waist, 'cm'],['Tour hanches', m.hips, 'cm'],['Poitrine', m.chest, 'cm'],
                  ['Bras', m.arms, 'cm'],['Cuisses', m.thighs, 'cm']].filter(([,v]) => v != null).map(([lbl, val, unit]) => (
                  <div key={lbl} style={{background:'var(--bg)', borderRadius:8, padding:'8px 6px', textAlign:'center'}}>
                    <p style={{margin:0, fontSize:15, fontWeight:700, color:'var(--label)'}}>{val}<span style={{fontSize:10, color:'var(--label2)'}}> {unit}</span></p>
                    <p style={{margin:0, fontSize:10, color:'var(--label2)'}}>{lbl}</p>
                  </div>
                ))}
              </div>
              {m.notes && <p style={{margin:'10px 0 0', fontSize:12, color:'var(--label2)', fontStyle:'italic'}}>{m.notes}</p>}
              {(m.photo_before_url || m.photo_after_url) && (
                <div style={{display:'flex', gap:8, marginTop:10}}>
                  {[['Avant', m.photo_before_url], ['Après', m.photo_after_url]].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l} style={{flex:1}}>
                      <p style={{margin:'0 0 4px', fontSize:11, color:'var(--label2)'}}>{l}</p>
                      <PrivatePhoto value={v} alt={l} style={{width:'100%', aspectRatio:'3/4', objectFit:'cover', borderRadius:10}} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── CALENDRIER ── */}
      {tab === 'calendar' && (
        <div style={{padding:'0 16px'}}>
          {currentProgram && (
            <div style={{marginBottom:12}}>
              <ProgramPlanner readOnly clientId={id} sessions={[...(currentProgram.program_sessions || [])].sort((a, b) => ((a.program_blocks?.order_index ?? 0) - (b.program_blocks?.order_index ?? 0)) || (a.order_index - b.order_index))} />
            </div>
          )}
          {sessions.length === 0 ? (currentProgram ? null :
            <div style={{textAlign:'center', paddingTop:40, color:'var(--label3)'}}>
              <p style={{fontSize:15}}>Aucune séance planifiée</p>
              <p style={{fontSize:12}}>Aucune session dans le calendrier.</p>
            </div>
          ) : sessions.map(s => {
            const done = s.status === 'completed' || s.completed_at
            const d = s.session_date ? new Date(s.session_date) : null
            return (
              <div key={s.id} style={{background:'var(--card)', borderRadius:12, padding:'12px 16px', marginBottom:8}}>
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:44, textAlign:'center', flexShrink:0}}>
                  {d ? (
                    <>
                      <p style={{margin:0, fontSize:18, fontWeight:700, color: done ? 'var(--green-text)' : 'var(--accent-text)', lineHeight:1}}>{d.getDate()}</p>
                      <p style={{margin:0, fontSize:10, color:'var(--label2)'}}>{d.toLocaleDateString('fr-FR',{month:'short'}).toUpperCase()}</p>
                    </>
                  ) : <p style={{margin:0, fontSize:11, color:'var(--label3)'}}>–</p>}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <p style={{margin:0, fontWeight:600, fontSize:14}}>{s.day_title || 'Séance jour ' + s.day_number}</p>
                  {s.notes && !expanded[s.id] && <p style={{margin:'2px 0 0', fontSize:12, color:'var(--label2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{s.notes}</p>}
                </div>
                <div style={{flexShrink:0, background: done ? 'rgba(52,199,89,0.16)' : 'rgba(0,122,255,0.14)', borderRadius:20, padding:'3px 10px', marginRight:4}}>
                  <span style={{fontSize:11, color: done ? 'var(--green-text)' : 'var(--blue-text)', fontWeight:600}}>{done ? 'Fait ✓' : 'Planifié'}</span>
                </div>
                <button onClick={() => toggleExpand(s.id)} style={{background:'none', border:'none', color:'var(--label2)', cursor:'pointer', padding:4}}>
                  {expanded[s.id] ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </button>
              </div>
              {expanded[s.id] && (
                <div style={{marginTop:12, paddingTop:12, borderTop:'1px solid var(--fill)'}}>
                  {s.notes ? (
                    <div style={{marginBottom:10}}>
                      <p style={{margin:'0 0 4px', fontSize:11, color:'var(--label2)', textTransform:'uppercase', letterSpacing:1}}>Notes</p>
                      <p style={{margin:0, fontSize:13, color:'var(--label1b)', lineHeight:1.5}}>{s.notes}</p>
                    </div>
                  ) : (
                    <p style={{margin:'0 0 10px', fontSize:12, color:'var(--label3)', fontStyle:'italic'}}>Aucune note pour cette séance</p>
                  )}
                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    {s.day_number && <span style={{fontSize:11, background:'var(--fill)', borderRadius:8, padding:'3px 8px', color:'var(--label2)'}}>Jour {s.day_number}</span>}
                    {done && s.completed_at && <span style={{fontSize:11, background:'rgba(52,199,89,0.16)', borderRadius:8, padding:'3px 8px', color:'var(--green-text)'}}>Complétée le {new Date(s.completed_at).toLocaleDateString('fr-FR')}</span>}
                    {!done && s.session_date && <span style={{fontSize:11, background:'rgba(0,122,255,0.14)', borderRadius:8, padding:'3px 8px', color:'var(--accent-text)'}}>Planifiée le {new Date(s.session_date).toLocaleDateString('fr-FR')}</span>}
                  </div>
                </div>
              )}
            </div>
            )
          })}
        </div>
      )}

      {tab === 'nutrition' && client && <ClientNutritionTab client={client} />}

      {/* ── BILANS HEBDO ── */}
      {tab === 'checkins' && (
        <div style={{padding:'0 16px'}}>
          {checkins.length === 0 ? (
            <div style={{textAlign:'center', paddingTop:40, color:'var(--label3)'}}>
              <p style={{fontSize:15}}>Aucun bilan</p>
              <p style={{fontSize:12}}>Le client n'a pas encore soumis de bilan hebdomadaire.</p>
            </div>
          ) : checkins.map(ch => {
            const stars = (n, color) => n ? '★'.repeat(n) + '☆'.repeat(5-n) : '–'
            const week = new Date(ch.week_start)
            return (
              <div key={ch.id} style={{background:'var(--card)', borderRadius:12, padding:'14px 16px', marginBottom:10}}>
                <p style={{margin:'0 0 12px', fontSize:13, fontWeight:700, color:'var(--accent-text)'}}>
                  Semaine du {week.toLocaleDateString('fr-FR', {day:'numeric', month:'long'})}
                </p>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                  {[['🏋️ Entraînement', ch.training_rating, '#6366f1'],
                    ['⚡ Énergie', ch.energy_level, '#f59e0b'],
                    ['😴 Sommeil', ch.sleep_quality, '#22c55e'],
                    ['😤 Stress', ch.stress_level, '#ef4444']].map(([lbl, val, color]) => (
                    <div key={lbl} style={{background:'var(--bg)', borderRadius:8, padding:'8px 10px'}}>
                      <p style={{margin:'0 0 3px', fontSize:11, color:'var(--label2)'}}>{lbl}</p>
                      <p style={{margin:0, fontSize:16, letterSpacing:1, color: tone(color)}}>{val ? stars(val) : '–'}</p>
                    </div>
                  ))}
                </div>
                {ch.notes && (
                  <div style={{marginTop:10, padding:'8px 10px', background:'var(--bg)', borderRadius:8}}>
                    <p style={{margin:0, fontSize:12, color:'var(--label1b)', fontStyle:'italic'}}>" {ch.notes} "</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {assignModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'flex-end'}}
          onClick={(e) => { if (e.target === e.currentTarget) setAssignModal(false) }}>
          <div style={{background:'var(--card)', width:'100%', borderRadius:'16px 16px 0 0', padding:'20px 16px', maxHeight:'70vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <h3 style={{margin:0, fontSize:16}}>Choisir un programme</h3>
              <button onClick={() => setAssignModal(false)} style={{background:'none', border:'none', color:'var(--label2)', cursor:'pointer', fontSize:20, lineHeight:1}}>✕</button>
            </div>
            {programs.length === 0 ? (
              <p style={{color:'var(--label2)', textAlign:'center', padding:'20px 0'}}>Aucun programme créé</p>
            ) : (
              programs.map(prog => (
                <button key={prog.id} onClick={() => assignProgram(prog.id)} disabled={assigning}
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    width:'100%', background: currentProgram?.id === prog.id ? 'var(--accent-soft)' : 'var(--fill)',
                    border: '1px solid ' + (currentProgram?.id === prog.id ? '#6366f1' : 'var(--separator)'),
                    borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'pointer', color:'var(--label)', textAlign:'left',
                    opacity: assigning ? 0.6 : 1
                  }}>
                  <div>
                    <p style={{margin:0, fontWeight:600, fontSize:14}}>{prog.name}</p>
                    {prog.type && <p style={{margin:0, fontSize:12, color:'var(--label2)'}}>{prog.type}</p>}
                  </div>
                  {currentProgram?.id === prog.id && <Check size={16} color="#6366f1"/>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {editModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:50,display:'flex',alignItems:'flex-end',justifyContent:'center',padding:16}}>
          <div style={{background:'var(--card)',border:'1px solid rgba(var(--contrast),0.1)',borderRadius:24,padding:20,width:'100%',maxWidth:400}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:16,fontWeight:600,color:'var(--label)'}}>Modifier le client</h3>
              <button onClick={()=>setEditModal(false)} style={{background:'none',border:'none',color:'var(--label2)',cursor:'pointer'}}><X size={18}/></button>
            </div>
            {[{key:'name',label:'Nom complet'},{key:'sport',label:'Sport'},{key:'position',label:'Poste'},{key:'current_phase',label:'Phase actuelle'}].map(f=>(
              <div key={f.key} style={{marginBottom:12}}>
                <label style={{display:'block',fontSize:12,color:'var(--label2)',marginBottom:4}}>{f.label}</label>
                <input value={editForm[f.key]||''} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))}
                  style={{width:'100%',background:'var(--bg)',border:'1px solid rgba(var(--contrast),0.1)',borderRadius:10,padding:'10px 14px',color:'var(--label)',fontSize:14,outline:'none',boxSizing:'border-box'}}/>
              </div>
            ))}
            <button onClick={saveEdit} disabled={editSaving}
              style={{width:'100%',background:'var(--accent)',border:'none',borderRadius:12,padding:13,color:'#fff',fontWeight:700,fontSize:14,cursor:editSaving?'not-allowed':'pointer',marginTop:4,opacity:editSaving?0.6:1}}>
              {editSaving?'Enregistrement...':'Sauvegarder'}
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

const iconBtn = { width:34, height:34, borderRadius:17, background:'var(--fill)', border:'none', color:'var(--label2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }
