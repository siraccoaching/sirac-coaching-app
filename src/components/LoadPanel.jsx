import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { weeklyLoads, acwr } from '../lib/tests'

// Charge d'entraînement d'un client : RPE de séance × durée, ratio aigu/chronique, lancers, GPS, bien-être.
export default function LoadPanel({ clientId }) {
  const [comps, setComps] = useState(null)
  const [checks, setChecks] = useState([])
  useEffect(() => {
    if (!clientId) return
    const since = new Date(Date.now() - 56 * 86400000).toISOString()
    supabase.from('session_completions').select('id, created_at, rpe_session, duration_minutes, throws, gps, program_sessions(name)')
      .eq('client_id', clientId).gte('created_at', since).order('created_at', { ascending: false }).then(({ data }) => setComps(data || []))
    supabase.from('weekly_checkins').select('*').eq('client_id', clientId).order('week_start', { ascending: false }).limit(4).then(({ data }) => setChecks(data || []))
  }, [clientId])
  if (!comps) return <p style={{ color: 'var(--label2)', textAlign: 'center', padding: 20 }}>Chargement…</p>

  const weeks = weeklyLoads(comps, 8)
  const ratio = acwr(comps)
  const maxLoad = Math.max(1, ...weeks.map(w => w.load))
  const throwsW = weeks.map(w => comps.filter(c => { const t = new Date(c.created_at); return t > w.start && t <= w.end }).reduce((s, c) => s + (Number(c.throws) || 0), 0))
  const wb = c => c ? Math.round(((c.energy_level || 0) + (c.sleep_quality || 0) + (c.stress_level || 0) + (c.training_rating || 0)) / 4 * 10) / 10 : null
  const wbNow = wb(checks[0]), wbPrev = wb(checks[1])
  const zone = ratio == null ? null : ratio > 1.5 ? ['Hausse brutale de charge', 'var(--red-text)', 'rgba(255,59,48,0.12)'] : ratio < 0.8 ? ['Charge en baisse', 'var(--orange-text)', 'rgba(255,149,0,0.14)'] : ['Charge maîtrisée', 'var(--green-text)', 'rgba(52,199,89,0.14)']
  const alerts = []
  if (ratio > 1.5) alerts.push(`Ratio aigu/chronique à ${String(ratio).replace(".", ",")} (> 1,5) : risque de blessure accru, allège la semaine.`)
  if (wbNow != null && wbPrev != null && wbNow < wbPrev - 0.8) alerts.push(`Bien-être en baisse (${wbPrev} → ${wbNow} / 5) : à croiser avec la charge.`)
  const lastGps = comps.find(c => c.gps)

  return (
    <div data-testid="load-panel">
      {alerts.map(a => <p key={a} role="alert" style={{ margin: '0 0 8px', padding: '10px 12px', borderRadius: 12, background: 'rgba(255,59,48,0.12)', color: 'var(--red-text)', fontSize: 13 }}>⚠️ {a}</p>)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginBottom: 10 }}>
        <Stat label="Charge 7 j" value={weeks[7].load} unit="UA" />
        <Stat label="Ratio A/C" value={ratio == null ? '—' : String(ratio).replace('.', ',')} color={zone?.[1]} testid="acwr" />
        <Stat label="Bien-être" value={wbNow == null ? '—' : String(wbNow).replace('.', ',')} unit={wbNow == null ? '' : '/ 5'} />
      </div>
      {zone && <p style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 10, background: zone[2], color: zone[1], fontSize: 13, fontWeight: 600 }}>{zone[0]} · zone idéale 0,8 – 1,3</p>}

      <div className="ios-group" style={{ padding: 14, marginBottom: 10 }}>
        <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>Charge par semaine (RPE × minutes)</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }}>
          {weeks.map((w, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10, color: 'var(--label2)' }}>{w.load || ''}</span>
              <span style={{ width: '100%', height: Math.max(3, 80 * w.load / maxLoad), borderRadius: 5, background: i === 7 ? (ratio > 1.5 ? '#ff3b30' : 'var(--accent)') : 'var(--fill2)' }} />
              <span style={{ fontSize: 10, color: 'var(--label3)' }}>{w.end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}</span>
            </div>
          ))}
        </div>
      </div>

      {throwsW.some(Boolean) && (
        <div className="ios-group" style={{ padding: 14, marginBottom: 10 }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>🏈 Lancers par semaine</p>
          <p data-testid="throws-week" style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>{throwsW.map((t, i) => <span key={i} style={{ marginRight: 10, fontWeight: i === 7 ? 700 : 400, color: i === 7 ? 'var(--label)' : undefined }}>{t}</span>)}</p>
        </div>
      )}

      {lastGps && (
        <div className="ios-group" style={{ padding: 14, marginBottom: 10 }}>
          <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>📡 Dernières données GPS · {new Date(lastGps.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>
            {lastGps.gps.distance_m != null && <>Distance <b style={{ color: 'var(--label)' }}>{lastGps.gps.distance_m} m</b> · </>}
            {lastGps.gps.hsr_m != null && <>haute vitesse <b style={{ color: 'var(--label)' }}>{lastGps.gps.hsr_m} m</b> · </>}
            {lastGps.gps.vmax_kmh != null && <>V. max <b style={{ color: 'var(--label)' }}>{lastGps.gps.vmax_kmh} km/h</b></>}
          </p>
        </div>
      )}

      <p style={{ margin: '4px 2px 0', fontSize: 12, color: 'var(--label2)' }}>La charge se calcule automatiquement quand le joueur termine une séance (RPE × durée). Aucun indicateur ne décide seul : croise charge, bien-être et sensations.</p>
    </div>
  )
}

function Stat({ label, value, unit, color, testid }) {
  return (
    <div className="ios-group" style={{ padding: '10px 6px', textAlign: 'center' }} data-testid={testid}>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: color || 'var(--label)' }}>{value}<span style={{ fontSize: 11, fontWeight: 600, color: 'var(--label2)' }}> {unit}</span></p>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--label2)' }}>{label}</p>
    </div>
  )
}
