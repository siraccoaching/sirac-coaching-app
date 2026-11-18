import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { localDateStr, estimateTargets, round1 } from '../lib/nutrition'

// Onglet coach : suivi alimentaire du client sur les 14 derniers jours.
export default function ClientNutritionTab({ client }) {
  const navigate = useNavigate()
  const [days, setDays] = useState([])
  const [plan, setPlan] = useState(null)
  const [open, setOpen] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (client?.id) load() }, [client?.id])

  async function load() {
    const from = new Date(); from.setDate(from.getDate() - 13)
    const [{ data: logs }, { data: p }] = await Promise.all([
      supabase.from('nutrition_logs').select('*').eq('client_id', client.id).gte('date', localDateStr(from)).order('created_at'),
      supabase.from('nutrition_plans').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    const byDay = {}
    for (const l of logs || []) (byDay[l.date] = byDay[l.date] || []).push(l)
    setDays(Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0])))
    setPlan(p || null)
    setLoading(false)
  }

  const target = plan?.calories_target ? plan : estimateTargets(client)
  const sum = (items, k) => items.reduce((s, l) => s + (+l[k] || 0), 0)
  const avg = days.length ? Math.round(days.reduce((s, [, it]) => s + sum(it, 'calories'), 0) / days.length) : 0

  if (loading) return <p style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>Chargement…</p>

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ background: '#1e1e2e', borderRadius: 12, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{plan ? 'Plan : ' + plan.name : 'Aucun plan assigné'}</p>
          <p style={{ margin: '2px 0 0', fontSize: 14, color: 'white', fontWeight: 600 }}>
            Objectif : {target?.calories_target ? Math.round(target.calories_target) + ' kcal' : 'non défini'}{target?.estimated ? ' (estimé)' : ''}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#aaa' }}>Moyenne sur {days.length} jour{days.length > 1 ? 's' : ''} saisis : <b style={{ color: '#f59e0b' }}>{avg} kcal</b></p>
        </div>
        <button onClick={() => navigate('/coach/nutrition')} style={{ background: '#6366f1', border: 'none', color: 'white', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Plans</button>
      </div>
      {days.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center', marginTop: 30, fontSize: 14 }}>Le client n'a encore rien saisi ces 14 derniers jours.</p>
      ) : days.map(([d, items]) => {
        const kcal = Math.round(sum(items, 'calories'))
        const pct = target?.calories_target ? Math.min(kcal / target.calories_target, 1.3) : 0
        const color = !target?.calories_target ? '#6366f1' : pct > 1.1 ? '#f87171' : pct < 0.8 ? '#fbbf24' : '#22c55e'
        return (
          <div key={d} style={{ background: '#1e1e2e', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
            <button onClick={() => setOpen(open === d ? null : d)} style={{ width: '100%', background: 'none', border: 'none', padding: '11px 14px', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span style={{ color, fontSize: 13, fontWeight: 700 }}>{kcal} kcal</span>
              </div>
              <div style={{ height: 5, background: '#2a2a3e', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ width: Math.min(pct, 1) * 100 + '%', height: '100%', background: color }} />
              </div>
              <span style={{ fontSize: 11, color: '#888' }}>P {Math.round(sum(items, 'protein'))} g · G {Math.round(sum(items, 'carbs'))} g · L {Math.round(sum(items, 'fat'))} g · {items.length} aliments</span>
            </button>
            {open === d && (
              <div style={{ padding: '0 14px 10px' }}>
                {items.map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '5px 0', borderTop: '1px solid #2a2a3e' }}>
                    <span style={{ color: '#ccc' }}><span style={{ color: '#a5b4fc' }}>{l.meal_name}</span> · {l.food_name} <span style={{ color: '#666' }}>{l.quantity} {l.unit}</span></span>
                    <span style={{ color: '#f59e0b', flexShrink: 0 }}>{Math.round(l.calories)} kcal · P{round1(l.protein)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
