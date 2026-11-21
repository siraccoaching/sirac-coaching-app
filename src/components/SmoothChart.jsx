import { useEffect, useRef, useState } from 'react'
import { tone } from '../lib/theme'

// Courbe lissée animée et interactive : glisser le doigt sur le graphique affiche la valeur du point.
export function SmoothChart({ data, color = '#5e5ce6', unit = 'kg', height = 120 }) {
  const ref = useRef(null)
  const [w, setW] = useState(300)
  const [active, setActive] = useState(null)
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width))); ro.observe(el)
    const t = requestAnimationFrame(() => setDrawn(true))
    return () => { ro.disconnect(); cancelAnimationFrame(t) }
  }, [])
  if (!data || data.length < 2) return <p style={{ color: 'var(--label2)', fontSize: 13, margin: '4px 0 8px' }}>Pas encore assez de données</p>
  const values = data.map(d => d.value)
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1
  const PX = 10, PT = 26, PB = 10, H = height
  const pts = data.map((d, i) => ({ x: PX + (i / (data.length - 1)) * (w - 2 * PX), y: PT + (1 - (d.value - min) / range) * (H - PT - PB), ...d }))
  // courbe de Catmull-Rom convertie en Bézier
  let path = `M${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    path += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`
  }
  const area = `${path} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`
  const id = 'sc' + Math.abs(color.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 99999
  const pick = clientX => {
    const r = ref.current.getBoundingClientRect(); const x = clientX - r.left
    let best = 0; pts.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i })
    setActive(best)
  }
  const a = active != null ? pts[active] : pts[pts.length - 1]
  return (
    <div ref={ref} style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none' }}
      onPointerDown={e => pick(e.clientX)} onPointerMove={e => (e.buttons || e.pointerType === 'touch') && pick(e.clientX)} onPointerLeave={() => setActive(null)}>
      <svg width={w} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.32} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient>
        </defs>
        <path d={area} fill={`url(#${id})`} style={{ opacity: drawn ? 1 : 0, transition: 'opacity .8s ease .4s' }} />
        <path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" pathLength={1}
          strokeDasharray={1} strokeDashoffset={drawn ? 0 : 1} style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.3,.7,.3,1)' }} />
        <line x1={a.x} x2={a.x} y1={PT - 6} y2={H} stroke={color} strokeOpacity={0.35} strokeDasharray="3 3" />
        <circle cx={a.x} cy={a.y} r={6} fill={color} stroke="var(--card)" strokeWidth={3} />
      </svg>
      <div style={{ position: 'absolute', top: 0, left: Math.min(Math.max(a.x - 45, 0), w - 90), width: 90, textAlign: 'center', pointerEvents: 'none' }}>
        <span style={{ display: 'inline-block', background: color + '2e', color: tone(color), borderRadius: 8, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
          {a.value} {unit} · {a.date}
        </span>
      </div>
    </div>
  )
}

// Barres qui « poussent » à l'ouverture ; toucher une barre affiche sa valeur.
export function GrowBars({ data, color = '#5e5ce6', height = 110, unit = 'kg' }) {
  const [shown, setShown] = useState(false)
  const [active, setActive] = useState(data?.length ? data.length - 1 : 0)
  useEffect(() => { const t = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(t) }, [])
  if (!data || data.length < 2) return <p style={{ color: 'var(--label2)', fontSize: 13, margin: '4px 0 8px' }}>Pas encore assez de données</p>
  const max = Math.max(...data.map(d => d.value)) || 1
  const a = data[active]
  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--label2)' }}>
        <b style={{ fontSize: 20, color: 'var(--label)' }}>{Math.round(a.value).toLocaleString('fr-FR')}</b> {unit} · semaine du {a.date}
      </p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height }}>
        {data.map((d, i) => (
          <button key={i} onClick={() => setActive(i)} aria-label={`${d.date} : ${d.value} ${unit}`}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
            <span style={{ display: 'block', width: '100%', borderRadius: 6, background: i === active ? color : 'var(--fill2)',
              height: shown ? `${Math.max(6, (d.value / max) * 100)}%` : '4%', transition: `height .7s cubic-bezier(.2,.9,.3,1.2) ${i * 0.05}s, background .2s` }} />
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--label3)', marginTop: 4 }}>
        <span>{data[0].date}</span><span>{data[data.length - 1].date}</span>
      </div>
    </div>
  )
}
