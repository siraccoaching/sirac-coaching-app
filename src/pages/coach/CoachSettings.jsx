import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Calendar, Save, CheckCircle, ExternalLink } from 'lucide-react'

const inputStyle = {
  WebkitTextFillColor: 'white',
  WebkitBoxShadow: '0 0 0px 1000px #0f0f1a inset',
  colorScheme: 'dark',
}

export default function CoachSettings() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [calendlyUrl, setCalendlyUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setCalendlyUrl(profile.calendly_url || '')
  }, [profile])

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ calendly_url: calendlyUrl.trim() || null })
      .eq('id', profile.id)
    setSaving(false)
    if (error) { alert('Erreur: ' + error.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <PageLayout title="Paramètres" back="/coach">
      <div className="p-4 pb-10 space-y-4">

        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-brand-400" />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">Lien Calendly</h3>
              <p className="text-gray-500 text-xs">Tes clients pourront réserver directement depuis l'app</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-medium">Ton lien de réservation</label>
            <input
              value={calendlyUrl}
              onChange={e => setCalendlyUrl(e.target.value)}
              placeholder="https://calendly.com/ton-nom"
              style={inputStyle}
              className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 text-sm transition-colors"
            />
            <p className="text-gray-600 text-xs">
              Colle l'URL de ton profil Calendly ou d'un type d'événement spécifique.
            </p>
          </div>

          {calendlyUrl && (
            <a href={calendlyUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-brand-400 text-sm hover:text-brand-300 transition-colors">
              <ExternalLink size={13} />
              Tester le lien
            </a>
          )}

          <button onClick={handleSave} disabled={saving}
            className={`w-full font-semibold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white'
            }`}>
            {saved ? <><CheckCircle size={16} /> Sauvegardé !</> : saving ? 'Enregistrement...' : <><Save size={16} /> Sauvegarder</>}
          </button>
        </Card>

        <Card className="p-4">
          <h3 className="text-white text-sm font-semibold mb-2">Comment ça marche ?</h3>
          <div className="space-y-2 text-gray-400 text-sm">
            <p>1. Crée un compte Calendly sur <span className="text-brand-400">calendly.com</span></p>
            <p>2. Configure tes types d'événements et disponibilités</p>
            <p>3. Colle ton lien Calendly ici</p>
            <p>4. Tes clients verront un bouton "Réserver une séance" dans leur app</p>
          </div>
        </Card>
      </div>
    </PageLayout>
  )
}
