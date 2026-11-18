import { useEffect, useState } from 'react'

// Anneaux d'activité façon Apple Watch : chaque anneau se remplit avec une animation à l'ouverture.
// rings = [{ label, value, goal, unit, color, track }]
export default function ActivityRings({ rings, size = 150 }) {
  const [shown, setShown] = useState(false)
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t) }, [])
  const stroke = size * 0.105, gap = stroke * 0.22
  return (
    <div className="ios-group" data-testid="activity-rings" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 18 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, transform: 'rotate(-90deg)' }} aria-hidden>
        {rings.map((r, i) => {
          const rad = size / 2 - stroke / 2 - i * (stroke + gap)
          const circ = 2 * Math.PI * rad
          const pct = r.goal > 0 ? Math.min(r.value / r.goal, 1) : 0
          return (
            <g key={r.label}>
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.track} strokeWidth={stroke} />
              <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={shown ? circ * (1 - pct) : circ}
                style={{ transition: `stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1) ${0.15 * i}s` }} />
            </g>
          )
        })}
      </svg>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rings.map(r => (
          <div key={r.label}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--label)' }}>{r.label}</p>
            <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: r.color, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(r.value)}<span style={{ fontSize: 13, fontWeight: 600 }}>/{Math.round(r.goal)} {r.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
