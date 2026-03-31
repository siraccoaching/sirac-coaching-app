import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { PageLayout, Card, Badge, SportIcon } from '../../components/Layout'
import { TrendingUp, Calendar, CheckCircle, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

export default function ClientDetail() {
  const { id } = useParams()
  const [client, setClient] = useState(null)
  const [completions, setCompletions] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    fetchClient()
    fetchCompletions()
  }, [id])

  async function fetchClient() {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    setClient(data)
    setLoading(false)
  }

  async function fetchCompletions() {
    const { data } = await supabase
      .from('session_completions')
      .select(`
        *,
        program_session:program_sessions(name, notes),
        exercise_logs(*, exercise:program_exercises(name))
      `)
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    setCompletions(data || [])
  }

  async function handleDelete(completionId) {
    if (!confirm('Supprimer cette séance ? Cette action est irréversible.')) return
    setDeleting(completionId)
    await supabase.from('exercise_logs').delete().eq('completion_id', completionId)
    await supabase.from('session_completions').delete().eq('id', completionId)
    setCompletions(prev => prev.filter(c => c.id !== completionId))
    setDeleting(null)
  }

  const streak = calcStreak(completions)

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <PageLayout title={client?.name || 'Client'} subtitle={[client?.sport, client?.position].filter(Boolean).join(' · ')} back="/coach">
      <div className="p-4 space-y-4 pb-8">

        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-600/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
              <SportIcon sport={client?.sport} />
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-lg">{client?.name}</h2>
              <p className="text-gray-400 text-sm">{client?.email}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {client?.sport && <Badge color="blue">{client.sport}</Badge>}
                {client?.position && <Badge color="purple">{client.position}</Badge>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/10">
            {[
              { label: 'Séances', value: completions.length },
              { label: 'Streak', value: `${streak}j` },
              { label: 'Ce mois', value: completions.filter(c => isThisMonth(c.created_at)).length },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-gray-500 text-xs">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        {(client?.pr_bench || client?.pr_squat || client?.pr_deadlift) && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={15} className="text-brand-400" />
              <h3 className="text-white font-semibold text-sm">Records personnels</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Bench', value: client.pr_bench },
                { label: 'Squat', value: client.pr_squat },
                { label: 'Deadlift', value: client.pr_deadlift },
              ].filter(r => r.value).map(({ label, value }) => (
                <div key={label} className="bg-dark-900 rounded-xl p-3 text-center">
                  <p className="text-brand-400 font-bold">{value}kg</p>
                  <p className="text-gray-500 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Calendar size={15} className="text-gray-400" />
            <h3 className="text-white font-semibold text-sm">Historique des séances</h3>
          </div>

          {completions.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-gray-500 text-sm">Aucune séance enregistrée.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {completions.map(comp => {
                const logs = comp.exercise_logs || []
                const isOpen = expanded === comp.id
                return (
                  <Card key={comp.id} className="overflow-hidden">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpanded(isOpen ? null : comp.id)}
                        className="flex-1 flex items-center gap-3 p-4 text-left min-w-0"
                      >
                        <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                          <CheckCircle size={16} className="text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {comp.program_session?.name || 'Séance'}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {formatDate(comp.created_at)} · {logs.length} exercice{logs.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge color="green">Complété</Badge>
                          {isOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                        </div>
                      </button>

                      <button
                        onClick={() => handleDelete(comp.id)}
                        disabled={deleting === comp.id}
                        className="p-3 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 disabled:opacity-40"
                        title="Supprimer cette séance"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-white/10 divide-y divide-white/5">
                        {logs.length === 0 ? (
                          <p className="px-4 py-3 text-gray-500 text-xs">Aucun log d'exercice.</p>
                        ) : logs.map(log => {
                          const sets = log.set_data || []
                          const doneSets = sets.filter(s => s._done)
                          return (
                            <div key={log.id} className="px-4 py-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <p className="text-white text-sm font-medium">{log.exercise?.name || 'Exercice'}</p>
                                <p className="text-gray-500 text-xs">{doneSets.length}/{sets.length} séries</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {sets.map((set, si) => (
                                  <div key={si} className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${set._done ? 'bg-green-500/10 text-green-400' : 'bg-dark-700 text-gray-500'}`}>
                                    <span className="text-gray-500">{si + 1}.</span>
                                    {set.reps && <span>{set.reps}r</span>}
                                    {set.load && <span className="text-brand-400 font-semibold">{set.load}</span>}
                                    {set.rpe && <span className="text-gray-500">RPE{set.rpe}</span>}
                                  </div>
                                ))}
                              </div>
                              {log.notes && <p className="text-gray-500 text-xs mt-1.5 italic">"{log.notes}"</p>}
                            </div>
                          )
                        })}
                        {comp.notes && (
                          <div className="px-4 py-3">
                            <p className="text-gray-400 text-xs italic">Notes : "{comp.notes}"</p>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}

function calcStreak(completions) {
  if (!completions.length) return 0
  const dates = [...new Set(completions.map(c => c.created_at?.split('T')[0]))].sort().reverse()
  let streak = 0, prev = null
  for (const d of dates) {
    if (!prev) { streak = 1; prev = d; continue }
    const diff = (new Date(prev) - new Date(d)) / 86400000
    if (diff <= 2) { streak++; prev = d } else break
  }
  return streak
}

function isThisMonth(dateStr) {
  if (!dateStr) return false
  const d = new Date(dateStr), now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
