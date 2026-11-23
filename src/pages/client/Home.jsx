import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { PageLayout } from '../../components/Layout'
import { Play, CheckCircle, Dumbbell, Ruler, ClipboardList, TrendingUp, MessageCircle, Trophy, Calendar, Zap, Apple, User } from 'lucide-react'
import { IosList } from '../../components/IosList'
import ActivityRings from '../../components/ActivityRings'
import { localDateStr, estimateTargets } from '../../lib/nutrition'
import { loadClientProgram } from '../../lib/assignments'

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
  const [rings, setRings] = useState(null)

  useEffect(() => { if (profile?.id) loadDashboard() }, [profile?.id])

  async function loadDashboard() {
    setLoading(true)
    await Promise.all([loadNextSession(), loadCompletions(), loadMessages(), loadRings()])
    setLoading(false)
  }

  async function loadNextSession() {
    const prog = await loadClientProgram(profile.id, 'id, name, type, program_sessions(id, name, program_exercises(id))')
    if (!prog) return
    const sessions = prog.program_sessions || []
    const { data: done } = await supabase.from('session_completions')
      .select('program_session_id, created_at').eq('client_id', profile.id)
    const doneIds = new Set((done || []).map(d => d.program_session_id))
    // Priorité au planning du client : prochaine séance prévue à partir d'aujourd'hui
    const today = localDateStr(new Date())
    const { data: planned } = await supabase.from('scheduled_sessions').select('program_session_id, date')
      .eq('client_id', profile.id).gte('date', today).order('date').limit(10)
    const doneToday = new Set((done || []).filter(d => d.created_at && localDateStr(new Date(d.created_at)) === today).map(d => d.program_session_id))
    const slot = (planned || []).find(p => !(p.date === today && doneToday.has(p.program_session_id)) && sessions.some(s => s.id === p.program_session_id))
    if (slot) {
      const s = sessions.find(x => x.id === slot.program_session_id)
      const d = new Date(slot.date + 'T12:00')
      const when = slot.date === today ? "Aujourd'hui" : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
      setNextSession({ ...s, programName: prog.name, when })
      return
    }
    const next = sessions.find(s => !doneIds.has(s.id)) || sessions[0]
    if (next) setNextSession({ ...next, programName: prog.name })
  }

  async function loadCompletions() {
    const { data: comps } = await supabase.from('session_completions')
      .select('id, created_at, program_sessions(name), exercise_logs(exercise_id, exercise_name, set_data, exercise:program_exercises(name))')
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
        const name = log.exercise?.name || log.exercise_name
        if (!name) continue
        const sets = (log.set_data || []).filter(s => parseFloat(s.load) > 0)
        if (!sets.length) continue
        const m = Math.max(...sets.map(s => parseFloat(s.load)||0))
        if (!exMaxes[name] || m > exMaxes[name]) exMaxes[name] = m
      }
    }
    setTopPRs(Object.entries(exMaxes).sort((a,b) => b[1]-a[1]).slice(0, 4))
  }

  // Anneaux : séances de la semaine, calories du jour, jours actifs de la semaine
  async function loadRings() {
    const now = new Date(); const monday = new Date(now); monday.setHours(0, 0, 0, 0); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const [{ data: comps }, { data: logs }, { data: plan }] = await Promise.all([
      supabase.from('session_completions').select('created_at').eq('client_id', profile.id).gte('created_at', monday.toISOString()),
      supabase.from('nutrition_logs').select('date, calories').eq('client_id', profile.id).gte('date', localDateStr(monday)),
      supabase.from('nutrition_plans').select('calories_target').eq('client_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const freq = parseInt(String(profile.training_frequency || '').match(/\d+/)?.[0] || '3', 10)
    const today = localDateStr()
    const kcal = (logs || []).filter(l => l.date === today).reduce((s, l) => s + (+l.calories || 0), 0)
    const target = plan?.calories_target || estimateTargets(profile)?.calories_target || 2000
    const days = new Set([...(comps || []).map(c => localDateStr(new Date(c.created_at))), ...(logs || []).map(l => l.date)])
    setRings([
      { label: 'Séances cette semaine', value: (comps || []).length, goal: freq, unit: '', color: '#ff375f', track: 'rgba(255,55,95,0.18)' },
      { label: 'Calories aujourd\u2019hui', value: kcal, goal: target, unit: 'kcal', color: '#30d158', track: 'rgba(48,209,88,0.18)' },
      { label: 'Jours actifs', value: days.size, goal: 7, unit: 'j', color: '#64d2ff', track: 'rgba(100,210,255,0.18)' },
    ])
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

  const firstName = profile?.name?.split(' ')[0] || ''
  return (
    <PageLayout brand title={'Bonjour ' + firstName + ' \u{1F44B}'} subtitle={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}>
      <div style={{ padding: '16px 16px 28px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 640, margin: '0 auto' }}>

        {profile && !profile.onboarding_done && (
          <button onClick={() => navigate('/client/onboarding')} className="ios-group"
            style={{ border: 'none', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: '#ff9500', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><User size={18} color="white" /></span>
            <span>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--label)' }}>Complète ton profil sportif</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--label2)' }}>Objectifs, niveau, blessures : ton coach adapte ton programme.</span>
            </span>
          </button>
        )}

        {rings && <ActivityRings rings={rings} />}

        {/* Statistiques */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[[totalSessions, 'Séances', 'var(--accent-text)'], [streak + ' \u{1F525}', 'Jours d\u2019affilée', 'var(--orange-text)'], [topPRs.length, 'Records', 'var(--yellow-text)']].map(([v, l, c]) => (
            <div key={l} className="ios-group" style={{ padding: '14px 8px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: c, letterSpacing: '-0.02em' }}>{v}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--label2)' }}>{l}</p>
            </div>
          ))}
        </div>

        {/* Prochaine séance */}
        {nextSession ? (
          <button onClick={() => navigate('/client/session-log/' + nextSession.id)} data-testid="next-session"
            style={{ border: 'none', textAlign: 'left', background: 'linear-gradient(135deg,#5e5ce6,#8b5cf6)', borderRadius: 20, padding: '18px 20px', cursor: 'pointer', boxShadow: '0 10px 30px rgba(94,92,230,0.35)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Prochaine séance{nextSession.when ? ' · ' + nextSession.when : ''}</p>
              <p style={{ margin: '0 0 3px', fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>{nextSession.name}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{nextSession.programName} · {nextSession.program_exercises?.length || 0} exercices</p>
            </div>
            <span style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Play size={22} color="white" fill="white" />
            </span>
          </button>
        ) : (
          <button onClick={() => navigate('/client/program')} className="ios-group" style={{ border: 'none', padding: '18px 20px', textAlign: 'center', cursor: 'pointer' }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, color: 'var(--label2)' }}>Aucun programme actif</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--accent)' }}>Voir mes programmes →</p>
          </button>
        )}

        {lastCompletion && (
          <div className="ios-group" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: '#34c759', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><CheckCircle size={18} color="white" /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--label)' }}>{lastCompletion.program_sessions?.name || 'Séance libre'}</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Dernière séance · {timeAgo(lastCompletion.created_at)}</p>
            </div>
          </div>
        )}

        {topPRs.length > 0 && (
          <div>
            <p className="ios-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={13} color="#ff9f0a" /> Tes records</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {topPRs.map(([name, load]) => (
                <div key={name} className="ios-group" style={{ padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--label2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.02em' }}>{load} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--label2)' }}>kg</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        <IosList title="Entraînement" items={[
          { icon: Dumbbell, color: '#5e5ce6', label: 'Mon programme', detail: 'Mes séances', onClick: () => navigate('/client/program') },
          { icon: Zap, color: '#34c759', label: 'Séance libre', onClick: () => navigate('/client/free-session') },
          { icon: TrendingUp, color: '#ff9500', label: 'Progression', detail: 'Courbes et records', onClick: () => navigate('/client/progress') },
          { icon: Ruler, color: '#30b0c7', label: 'Mensurations', onClick: () => navigate('/client/measurements') },
        ]} />

        <IosList title="Suivi" items={[
          { icon: Apple, color: '#34c759', label: 'Nutrition', detail: 'Calories du jour', onClick: () => navigate('/client/nutrition') },
          { icon: ClipboardList, color: '#ff9f0a', label: 'Bilan de la semaine', onClick: () => navigate('/client/checkin') },
          { icon: MessageCircle, color: '#007aff', label: 'Mon coach', badge: unreadCount, onClick: () => navigate('/client/messages') },
          { icon: Calendar, color: '#af52de', label: 'Réserver un créneau', onClick: () => navigate('/client/book') },
          { icon: User, color: '#8e8e93', label: 'Mon profil et apparence', onClick: () => navigate('/client/profile') },
        ]} />
      </div>
    </PageLayout>
  )
}
