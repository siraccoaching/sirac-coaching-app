import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { TrendingUp, BarChart3 } from 'lucide-react'
import { PageLayout } from '../../components/Layout'
import { SmoothChart, GrowBars } from '../../components/SmoothChart'
import TestsPanel from '../../components/TestsPanel'
import { useAuth } from '../../lib/hooks'

export default function Progress() {
  const navigate = useNavigate()
  const { profile } = useAuth()
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
      .select('id, created_at, exercise_logs(exercise_id, exercise_name, set_data, exercise:program_exercises(name))')
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
        const name = log.exercise?.name || log.exercise_name || 'Exercice'
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

  const COLORS = ['#5e5ce6', '#34c759', '#ff9f0a', '#ff375f', '#64d2ff', '#bf5af2']
  const bestGain = loadEntries.map(([n, d]) => [n, d[d.length - 1].value - d[0].value]).sort((a, b) => b[1] - a[1])[0]

  return (
    <PageLayout title="Progrès" subtitle={`${totalSessions} séance${totalSessions > 1 ? 's' : ''} enregistrée${totalSessions > 1 ? 's' : ''}`}>
      <div style={{ padding: '16px 16px 28px', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? <p style={{ color: 'var(--label2)', textAlign: 'center' }}>Chargement…</p> : <>
        {bestGain && bestGain[1] > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#34c759,#30b0c7)', borderRadius: 18, padding: '14px 16px', color: 'white', boxShadow: '0 10px 26px rgba(52,199,89,.3)' }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', opacity: .85 }}>Meilleure progression</p>
            <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700 }}>{bestGain[0]} <span style={{ opacity: .9 }}>+{bestGain[1] % 1 === 0 ? bestGain[1] : bestGain[1].toFixed(1)} kg</span></p>
          </div>
        )}
        <div role="tablist" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--fill)', borderRadius: 10, padding: 2 }}>
          {[['load', 'Charges max'], ['tonnage', 'Tonnage hebdo']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={activeTab === k} onClick={() => setActiveTab(k)}
              style={{ padding: '8px 0', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--label)',
                background: activeTab === k ? 'var(--segment)' : 'transparent', boxShadow: activeTab === k ? '0 3px 8px rgba(0,0,0,.12)' : 'none', transition: 'background .2s' }}>{l}</button>
          ))}
        </div>
        {activeTab === 'load' && (loadEntries.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--label2)' }}>
            <TrendingUp size={44} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.3 }} />
            <p>Complète au moins 2 séances avec des charges.</p>
          </div>
        ) : loadEntries.map(([name, data], i) => {
          const diff = data[data.length - 1].value - data[0].value
          return (
            <div key={name} className="ios-group" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--label)' }}>{name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: diff >= 0 ? 'var(--green-text)' : 'var(--red-text)' }}>{diff >= 0 ? '▲ +' : '▼ '}{diff % 1 === 0 ? diff : diff.toFixed(1)} kg</span>
              </div>
              <SmoothChart data={data} color={COLORS[i % COLORS.length]} />
            </div>
          )
        }))}
        {activeTab === 'tonnage' && (tonnageData.length < 2 ? (
          <div style={{ textAlign: 'center', marginTop: 40, color: 'var(--label2)' }}>
            <BarChart3 size={44} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.3 }} />
            <p>Pas encore assez de données de volume.</p>
          </div>
        ) : (
          <>
            <div className="ios-group" style={{ padding: 16 }}>
              <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: 'var(--label)' }}>Tonnage par semaine</p>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--label2)' }}>Séries × répétitions × charge · touche une barre</p>
              <GrowBars data={tonnageData} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[[Math.max(...tonnageData.map(d => d.value)), 'Record hebdo', 'var(--accent-text)'], [Math.round(tonnageData.reduce((s, d) => s + d.value, 0) / tonnageData.length), 'Moyenne hebdo', 'var(--green-text)']].map(([v, l, c]) => (
                <div key={l} className="ios-group" style={{ padding: '12px 14px' }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: c }}>{v.toLocaleString('fr-FR')} <span style={{ fontSize: 13 }}>kg</span></p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>{l}</p>
                </div>
              ))}
            </div>
          </>
        ))}
        </>}
      </div>
      <div style={{ padding: '0 16px 24px' }}>
        <p className="ios-section-title" style={{ marginTop: 8 }}>Mes tests</p>
        {profile?.id && <TestsPanel clientId={profile.id} canDelete={false} />}
      </div>
    </PageLayout>
  )
}
