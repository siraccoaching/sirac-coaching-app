import { useEffect, useMemo, useState } from 'react'
import { X, Check, SkipForward, Minus, Plus } from 'lucide-react'
import { ExerciseAnimation } from './ExerciseDemo'
import { haptic } from '../lib/fx'

// Mode focus : une série à la fois, grosses commandes, anneau de récupération plein écran.
export default function FocusMode({ exercises, logs, onUpdateSet, onClose, onFinish }) {
  const steps = useMemo(() => exercises.flatMap(ex => (logs[ex.id]?.sets || []).map((_, si) => ({ ex, si }))), [exercises, logs])
  const firstTodo = Math.max(0, steps.findIndex(s => !logs[s.ex.id]?.sets[s.si]?._done))
  const [i, setI] = useState(firstTodo)
  const [rest, setRest] = useState(null) // { total, left }
  const step = steps[Math.min(i, steps.length - 1)]

  useEffect(() => {
    if (!rest) return
    if (rest.left <= 0) { haptic([30, 60, 30]); setRest(null); return }
    const t = setTimeout(() => setRest(r => r && { ...r, left: r.left - 1 }), 1000)
    return () => clearTimeout(t)
  }, [rest])

  if (!step) return null
  const { ex, si } = step
  const set = logs[ex.id]?.sets[si] || {}
  const nSets = logs[ex.id]?.sets.length || 0
  const done = i >= steps.length
  const bump = (field, d) => {
    const v = parseFloat(String(set[field]).replace(',', '.')) || 0
    onUpdateSet(ex.id, si, field, String(Math.max(0, Math.round((v + d) * 10) / 10)))
  }

  function validate() {
    haptic(15)
    onUpdateSet(ex.id, si, '_done', true)
    const next = i + 1
    setI(next)
    if (next < steps.length && ex.rest_seconds > 0) setRest({ total: ex.rest_seconds, left: ex.rest_seconds })
  }

  const R = 120, C = 2 * Math.PI * R
  return (
    <div data-testid="focus-mode" style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 10 }}>
        <button onClick={onClose} aria-label="Quitter le mode focus" style={{ width: 36, height: 36, borderRadius: 18, border: 'none', background: 'var(--fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--label)' }}><X size={18} /></button>
        <div style={{ flex: 1, height: 6, background: 'var(--fill)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(Math.min(i, steps.length) / steps.length) * 100}%`, background: 'linear-gradient(90deg,#5e5ce6,#bf5af2)', transition: 'width .4s' }} />
        </div>
        <span style={{ fontSize: 13, color: 'var(--label2)', fontVariantNumeric: 'tabular-nums' }}>{Math.min(i, steps.length)}/{steps.length}</span>
      </div>

      {rest ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--label2)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Récupération</p>
          <div style={{ position: 'relative', width: 2 * R + 24, height: 2 * R + 24 }}>
            <svg width={2 * R + 24} height={2 * R + 24} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="var(--fill)" strokeWidth={18} />
              <circle cx={R + 12} cy={R + 12} r={R} fill="none" stroke="url(#restg)" strokeWidth={18} strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - rest.left / rest.total)} style={{ transition: 'stroke-dashoffset 1s linear' }} />
              <defs><linearGradient id="restg"><stop offset="0%" stopColor="#5e5ce6" /><stop offset="100%" stopColor="#bf5af2" /></linearGradient></defs>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 64, fontWeight: 700, color: 'var(--label)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
                {Math.floor(rest.left / 60)}:{String(rest.left % 60).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 14, color: 'var(--label2)' }}>restantes</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--label2)', textAlign: 'center', padding: '0 24px' }}>
            Ensuite : <b style={{ color: 'var(--label)' }}>{steps[i]?.ex.name}</b> · série {steps[i]?.si + 1}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setRest(r => ({ ...r, left: r.left + 15, total: r.total + 15 }))} style={pill}>+15 s</button>
            <button onClick={() => setRest(null)} style={{ ...pill, background: 'var(--accent)', color: 'white' }}><SkipForward size={16} /> Passer</button>
          </div>
        </div>
      ) : done ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
          <span style={{ fontSize: 64 }}>🏁</span>
          <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--label)' }}>Toutes les séries sont faites !</p>
          <button onClick={onFinish} style={{ ...bigBtn, background: 'linear-gradient(135deg,#34c759,#30b0c7)' }}><Check size={22} /> Terminer la séance</button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '4px 20px 16px', gap: 14, overflowY: 'auto' }}>
          <ExerciseAnimation images={ex.exercise?.images} alt={ex.name} height={200} rounded={18} />
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Série {si + 1} sur {nSets}</p>
            <p style={{ margin: '2px 0 0', fontSize: 28, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{ex.name}</p>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--label2)' }}>Objectif : {ex.sets} × {ex.reps}{ex.load ? ` @ ${ex.load}` : ''}{ex.rpe ? ` · RPE ${ex.rpe}` : ''}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[['reps', 'Répétitions', 1], ['load', 'Charge (kg)', 2.5]].map(([f, l, step]) => (
              <div key={f} className="ios-group" style={{ padding: '12px 10px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--label2)', fontWeight: 600 }}>{l}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <button onClick={() => bump(f, -step)} aria-label={`Moins ${l}`} style={round}><Minus size={18} /></button>
                  <input value={set[f] ?? ''} inputMode="decimal" onChange={e => onUpdateSet(ex.id, si, f, e.target.value)} aria-label={l}
                    style={{ width: '100%', minWidth: 0, textAlign: 'center', fontSize: 30, fontWeight: 700, border: 'none', background: 'none', color: 'var(--label)', outline: 'none', WebkitTextFillColor: 'var(--label)' }} />
                  <button onClick={() => bump(f, step)} aria-label={`Plus ${l}`} style={round}><Plus size={18} /></button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={validate} style={bigBtn}><Check size={22} /> Série terminée</button>
        </div>
      )}
    </div>
  )
}

const pill = { display: 'flex', alignItems: 'center', gap: 6, border: 'none', borderRadius: 22, padding: '12px 20px', fontSize: 16, fontWeight: 600, background: 'var(--fill)', color: 'var(--label)', cursor: 'pointer' }
const bigBtn = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: 'none', borderRadius: 18, padding: '18px 0', fontSize: 18, fontWeight: 700, color: 'white', background: 'linear-gradient(135deg,#5e5ce6,#8b5cf6)', boxShadow: '0 10px 26px rgba(94,92,230,.35)', cursor: 'pointer' }
const round = { width: 38, height: 38, borderRadius: 19, border: 'none', background: 'var(--fill)', color: 'var(--label)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }
