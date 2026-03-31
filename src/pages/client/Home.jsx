import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import { PageLayout, Card, Badge } from '../../components/Layout'
import { Play, CheckCircle, Calendar, ChevronRight, Dumbbell, Ruler, ClipboardList } from 'lucide-react'

export default function ClientHome() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [todaySession, setTodaySession] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [program, setProgram] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!profile) return; fetchData() }, [profile])

  async function fetchData() {
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase.from('sessions').select('*, session_logs(*)').eq('client_id', profile.id).eq('session_date', today).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setTodaySession(existing)
    const { data: recent } = await supabase.from('sessions').select('*').eq('client_id', profile.id).order('created_at', { ascending: false }).limit(5)
    setRecentSessions(recent || [])
    const { data: assignment } = await supabase.from('programs').select('id, name').eq('client_id', profile.id).eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setProgram(assignment)
    setLoading(false)
  }

  async function startNewSession(dayNumber, dayTitle) {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('sessions').insert({ client_id: profile.id, assignment_id: program?.id, session_date: today, day_number: dayNumber, day_title: dayTitle, status: 'in_progress' }).select().single()
    if (data) navigate(`/client/session/${data.id}`)
  }

  const DAYS = [{ n: 1, title: 'Jour 1 – Force' }, { n: 2, title: 'Jour 2 – Puissance' }, { n: 3, title: 'Jour 3 – Haut du corps' }, { n: 4, title: 'Jour 4 – Vitesse & Agilité' }]
  const weekSessions = recentSessions.filter(s => { const diff = (Date.now() - new Date(s.session_date)) / 86400000; return diff <= 7 && s.status === 'completed' }).length

  return (
    <PageLayout title="Mon Programme" subtitle={profile?.name}>
      <div className="p-4 space-y-4 pb-8">
        <div className="bg-gradient-to-br from-brand-600 to-brand-900 rounded-3xl p-5">
          <p className="text-brand-200 text-sm font-medium">Bonjour {profile?.name?.split(' ')[0]} 👋</p>
          <h2 className="text-white font-bold text-xl mt-1">{profile?.sport || 'Préparation physique'}</h2>
          <div className="flex items-center gap-2 mt-2">{profile?.position && <Badge color="blue">{profile.position}</Badge>}{profile?.current_phase && <Badge color="gray">{profile.current_phase}</Badge>}</div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
            <div className="text-center"><p className="text-white font-bold text-2xl">{weekSessions}</p><p className="text-brand-300 text-xs">séances cette semaine</p></div>
            <div className="text-center"><p className="text-white font-bold text-2xl">{recentSessions.filter(s => s.status === 'completed').length}</p><p className="text-brand-300 text-xs">total complétées</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => navigate('/client/program')} className="bg-gradient-to-br from-brand-700 to-brand-900 border border-brand-500/30 rounded-2xl p-4 flex flex-col items-start gap-2 text-left">
            <div className="w-9 h-9 bg-brand-500/20 rounded-xl flex items-center justify-center"><Dumbbell size={18} className="text-brand-300" /></div>
            <div><p className="text-white text-sm font-semibold">Mon programme</p><p className="text-brand-300 text-xs">Voir mes séances</p></div>
          </button>
          <button onClick={() => navigate('/client/book')} className="bg-gradient-to-br from-purple-800/60 to-purple-900/60 border border-purple-500/30 rounded-2xl p-4 flex flex-col items-start gap-2 text-left">
            <div className="w-9 h-9 bg-purple-500/20 rounded-xl flex items-center justify-center"><Calendar size={18} className="text-purple-300" /></div>
            <div><p className="text-white text-sm font-semibold">Réserver</p><p className="text-purple-300 text-xs">Prendre un RDV</p></div>
          </button>
          <button onClick={() => navigate('/client/measurements')} className="bg-gradient-to-br from-teal-800/60 to-teal-900/60 border border-teal-500/30 rounded-2xl p-4 flex flex-col items-start gap-2 text-left">
            <div className="w-9 h-9 bg-teal-500/20 rounded-xl flex items-center justify-center"><Ruler size={18} className="text-teal-300" /></div>
            <div><p className="text-white text-sm font-semibold">Mensurations</p><p className="text-teal-300 text-xs">Suivi du corps</p></div>
          </button>
          <button onClick={() => navigate('/client/checkin')} className="bg-gradient-to-br from-orange-800/60 to-orange-900/60 border border-orange-500/30 rounded-2xl p-4 flex flex-col items-start gap-2 text-left">
            <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center"><ClipboardList size={18} className="text-orange-300" /></div>
            <div><p className="text-white text-sm font-semibold">Bilan semaine</p><p className="text-orange-300 text-xs">Ton ressenti</p></div>
          </button>
        </div>

        {todaySession ? (<Card className="overflow-hidden"><div className="p-4 flex items-center gap-3"><div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${todaySession.status === 'completed' ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>{todaySession.status === 'completed' ? <CheckCircle size={20} className="text-green-400" /> : <Play size={20} className="text-orange-400" />}</div><div className="flex-1"><p className="text-white font-semibold">{todaySession.day_title || "Séance d'aujourd'hui"}</p><p className="text-gray-400 text-sm">{todaySession.status === 'completed' ? '✓ Séance terminée !' : 'En cours…'}</p></div>{todaySession.status !== 'completed' && (<button onClick={() => navigate(`/client/session/${todaySession.id}`)} className="bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-xl">Continuer</button>)}</div></Card>) : null}

        <Card className="overflow-hidden">
          <div className="px-4 pt-4 pb-2"><h3 className="text-white font-semibold text-sm">Commencer une séance</h3><p className="text-gray-500 text-xs mt-0.5">Choisis ton entraînement du jour</p></div>
          <div className="divide-y divide-white/5">{DAYS.map(({ n, title }) => (<button key={n} onClick={() => startNewSession(n, title)} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left"><div className="w-9 h-9 bg-brand-600/20 rounded-xl flex items-center justify-center flex-shrink-0"><span className="text-brand-400 font-bold text-sm">J{n}</span></div><div className="flex-1"><p className="text-white text-sm font-medium">{title}</p></div><Play size={15} className="text-gray-500" /></button>))}</div>
        </Card>

        {recentSessions.length > 0 && (<Card className="overflow-hidden"><div className="px-4 pt-4 pb-2 flex items-center justify-between"><div className="flex items-center gap-2"><Calendar size={15} className="text-gray-400" /><h3 className="text-white font-semibold text-sm">Historique récent</h3></div><button onClick={() => navigate('/client/history')} className="text-brand-400 text-xs font-medium flex items-center gap-1">Tout voir <ChevronRight size={12} /></button></div><div className="divide-y divide-white/5">{recentSessions.slice(0, 4).map(s => (<div key={s.id} className="flex items-center gap-3 px-4 py-3"><div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'completed' ? 'bg-green-400' : 'bg-orange-400'}`} /><div className="flex-1 min-w-0"><p className="text-white text-sm truncate">{s.day_title || 'Séance'}</p><p className="text-gray-500 text-xs">{formatDate(s.session_date)}</p></div><Badge color={s.status === 'completed' ? 'green' : 'orange'}>{s.status === 'completed' ? '✓' : '…'}</Badge></div>))}</div></Card>)}
      </div>
    </PageLayout>
  )
}

function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short' }) }
