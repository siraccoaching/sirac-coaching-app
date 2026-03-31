import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Calendar, ExternalLink } from 'lucide-react'

export default function BookSession() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [coachCalendly, setCoachCalendly] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.coach_id) return
    loadCoachCalendly()
  }, [profile?.coach_id])

  async function loadCoachCalendly() {
    const { data } = await supabase
      .from('profiles')
      .select('calendly_url, name')
      .eq('id', profile.coach_id)
      .single()
    setCoachCalendly(data)
    setLoading(false)
  }

  function getEmbedUrl(url) {
    if (!url) return null
    try {
      const u = new URL(url)
      u.searchParams.set('embed_domain', window.location.hostname)
      u.searchParams.set('embed_type', 'Inline')
      u.searchParams.set('background_color', '0f0f1a')
      u.searchParams.set('text_color', 'ffffff')
      u.searchParams.set('primary_color', '6366f1')
      return u.toString()
    } catch {
      return url
    }
  }

  if (loading) return (
    <PageLayout title="Réserver une séance" back="/client/home">
      <div className="p-4"><div className="h-64 bg-dark-800 rounded-2xl animate-pulse" /></div>
    </PageLayout>
  )

  return (
    <PageLayout title="Réserver une séance" back="/client/home">
      <div className="p-4 pb-10 space-y-4">

        {coachCalendly?.calendly_url ? (
          <>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center">
                  <Calendar size={18} className="text-brand-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">Réserver avec {coachCalendly.name}</p>
                  <p className="text-gray-500 text-xs">Choisis un créneau disponible</p>
                </div>
              </div>
            </Card>

            <div className="bg-dark-800 border border-white/10 rounded-2xl overflow-hidden" style={{ minHeight: '600px' }}>
              <iframe
                src={getEmbedUrl(coachCalendly.calendly_url)}
                width="100%"
                height="700"
                frameBorder="0"
                title="Réserver une séance"
                style={{ display: 'block' }}
              />
            </div>

            <a href={coachCalendly.calendly_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-brand-400 text-sm py-3">
              <ExternalLink size={14} />
              Ouvrir dans Calendly
            </a>
          </>
        ) : (
          <Card className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-dark-900 rounded-2xl flex items-center justify-center mx-auto">
              <Calendar size={24} className="text-gray-500" />
            </div>
            <p className="text-white font-semibold">Pas encore disponible</p>
            <p className="text-gray-500 text-sm">
              Ton coach n'a pas encore configuré son lien de réservation.
              Contacte-le directement pour prendre rendez-vous.
            </p>
          </Card>
        )}
      </div>
    </PageLayout>
  )
}
