import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../lib/hooks'
import { useNotifState, enableNotifications, disableNotifications, notify } from '../lib/notify'

function Switch({ on, onChange, disabled, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 51, height: 31, borderRadius: 16, border: 'none', padding: 2, cursor: disabled ? 'default' : 'pointer', flexShrink: 0,
        background: on ? '#34c759' : 'var(--fill2)', transition: 'background .2s', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ display: 'block', width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 3px 8px rgba(0,0,0,.15)',
        transform: on ? 'translateX(20px)' : 'none', transition: 'transform .25s cubic-bezier(.3,.7,.4,1)' }} />
    </button>
  )
}

export default function NotificationSettings() {
  const { profile } = useAuth()
  const state = useNotifState()
  const [busy, setBusy] = useState(false)
  const isCoach = profile?.role === 'coach'

  async function toggle(next) {
    setBusy(true)
    if (next) {
      const s = await enableNotifications(profile?.id)
      if (s === 'on') notify('Notifications activées ✓', 'Tu seras prévenu ici.', isCoach ? '/coach' : '/client')
    } else await disableNotifications(profile?.id)
    setBusy(false)
  }

  const help = {
    unsupported: 'Sur iPhone, ajoute d’abord l’app à l’écran d’accueil (Partager → « Sur l’écran d’accueil »), puis ouvre-la depuis l’icône pour activer les notifications.',
    blocked: 'Les notifications sont bloquées pour cette app. Autorise-les dans les réglages du téléphone (Réglages → Notifications → ARISE), puis reviens ici.',
  }[state]

  return (
    <div className="ios-group" style={{ padding: 16 }} data-testid="notif-settings">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: '#ff3b30', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bell size={17} color="white" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--label)' }}>Notifications</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--label2)' }}>
            {state === 'on' ? 'Activées sur cet appareil' : state === 'blocked' ? 'Bloquées par le téléphone' : state === 'unsupported' ? 'Indisponibles dans ce navigateur' : 'Désactivées'}
          </p>
        </div>
        <Switch on={state === 'on'} disabled={busy || state === 'unsupported' || state === 'blocked'} onChange={toggle} label="Notifications" />
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--label2)', lineHeight: 1.45 }}>
        {help || (isCoach
          ? 'Tu es prévenu quand un client termine une séance ou t’envoie un message.'
          : 'Tu es prévenu quand ton coach t’écrit ou met à jour ton programme ou ton plan nutritionnel.')}
      </p>
    </div>
  )
}
