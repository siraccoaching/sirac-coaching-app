import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout, Card } from '../../components/Layout'
import { Calendar, Save, CheckCircle, ExternalLink, Link, Copy, RefreshCw } from 'lucide-react'

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
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)

  useEffect(() => {
    if (!profile) return
    setCalendlyUrl(profile.calendly_url || '')
    setInviteCode(profile.invite_code || '')
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

  async function generateInviteCode() {
    setGeneratingCode(true)
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase()
    const { error } = await supabase.from('profiles').update({ invite_code: newCode }).eq('id', profile.id)
    if (!error) setInviteCode(newCode)
    setGeneratingCode(false)
  }

  function copyInviteLink() {
    const link = window.location.origin + '/join?code=' + inviteCode
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    } else {
      // Fallback for Safari iOS
      const el = document.createElement('textarea')
      el.value = link
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch(e) {}
      document.body.removeChild(el)
    }
  }


  return (
    <PageLayout title="ParamÃ¨tres" back="/coach">
      <div className="p-4 pb-10 space-y-4">

        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar size={18} className="text-brand-400" />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">Lien Calendly</h3>
              <p className="text-gray-500 text-xs">Tes clients pourront rÃ©server directement depuis l'app</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-gray-400 text-xs font-medium">Ton lien de rÃ©servation</label>
            <input
              value={calendlyUrl}
              onChange={e => setCalendlyUrl(e.target.value)}
              placeholder="https://calendly.com/ton-nom"
              style={inputStyle}
              className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 text-sm transition-colors"
            />
            <p className="text-gray-600 text-xs">
              Colle l'URL de ton profil Calendly ou d'un type d'Ã©vÃ©nement spÃ©cifique.
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
            {saved ? <><CheckCircle size={16} /> SauvegardÃ©Â !</> : saving ? 'Enregistrement...' : <><Save size={16} /> Sauvegarder</>}
          </button>
        </Card>

        <Card className="p-4">
          <h3 className="text-white text-sm font-semibold mb-2">Comment Ã§a marcheÂ ?</h3>
          <div className="space-y-2 text-gray-400 text-sm">
            <p>1. CrÃ©e un compte Calendly sur <span className="text-brand-400">calendly.com</span></p>
            <p>2. Configure tes types d'Ã©vÃ©nements et disponibilitÃ©s</p>
            <p>3. Colle ton lien Calendly ici</p>
            <p>4. Tes clients verront un bouton "RÃ©server une sÃ©ance" dans leur app</p>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Link size={16} className="text-purple-400" />
            <p className="text-sm font-semibold text-white">Lien d'invitation client</p>
          </div>
          <p className="text-xs text-gray-400">Partagez ce lien pour que vos clients rejoignent votre espace directement.</p>

          {inviteCode ? (
            <div style={{background:'#ffffff0d', borderRadius:10, padding:'10px 12px', display:'flex', alignItems:'center', gap:8, border:'1px solid #ffffff15'}}>
              <span style={{flex:1, fontSize:12, color:'#a78bfa', wordBreak:'break-all', fontFamily:'monospace'}}>
                {window.location.origin}/join?code={inviteCode}
              </span>
              <button onClick={copyInviteLink} style={{flexShrink:0, background: copied ? '#22c55e22' : '#7c3aed33', border:'1px solid ' + (copied ? '#22c55e44' : '#7c3aed44'), borderRadius:8, padding:'6px 10px', color: copied ? '#22c55e' : '#a78bfa', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:4}}>
                {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
                {copied ? 'CopiÃ© !' : 'Copier'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">Aucun code gÃ©nÃ©rÃ© pour l'instant.</p>
          )}

          <button
            onClick={generateInviteCode}
            disabled={generatingCode}
            className="flex items-center gap-2 bg-dark-700 border border-white/10 hover:bg-dark-600 text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={generatingCode ? 'animate-spin' : ''} />
            {inviteCode ? 'RÃ©gÃ©nÃ©rer le lien' : 'GÃ©nÃ©rer un lien'}
          </button>
        </Card>

      </div>
    </PageLayout>
  )
}
