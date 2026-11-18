import { Smartphone, Sun, Moon } from 'lucide-react'
import { useTheme } from '../lib/theme'

const OPTIONS = [
  ['system', 'Auto', Smartphone],
  ['light', 'Clair', Sun],
  ['dark', 'Sombre', Moon],
]

// Contrôle segmenté façon iOS pour choisir l'apparence.
export default function ThemePicker() {
  const { pref, setPref } = useTheme()
  const idx = OPTIONS.findIndex(o => o[0] === pref)
  return (
    <div className="ios-group" style={{ padding: 16 }} data-testid="theme-picker">
      <p style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 600, color: 'var(--label)' }}>Apparence</p>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--label2)' }}>
        « Auto » suit le réglage clair / sombre de ton téléphone.
      </p>
      <div role="radiogroup" aria-label="Apparence" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: 'var(--fill)', borderRadius: 10, padding: 2 }}>
        <div aria-hidden style={{
          position: 'absolute', top: 2, bottom: 2, left: `calc(${idx} * (100% - 4px) / 3 + 2px)`, width: 'calc((100% - 4px) / 3)',
          background: 'var(--segment)', borderRadius: 8, boxShadow: '0 3px 8px rgba(0,0,0,0.12), 0 1px 1px rgba(0,0,0,0.04)',
          transition: 'left 0.25s cubic-bezier(.3,.7,.4,1)',
        }} />
        {OPTIONS.map(([key, label, Icon]) => (
          <button key={key} role="radio" aria-checked={pref === key} onClick={() => setPref(key)}
            style={{ position: 'relative', zIndex: 1, border: 'none', background: 'none', padding: '8px 0', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: pref === key ? 600 : 500,
              color: 'var(--label)' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    </div>
  )
}
