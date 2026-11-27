import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { phaseAt, phaseDates } from '../lib/periodization'
import { Plus, Trash2 } from 'lucide-react'

const TYPES = { match: '🏈 Match', bye: '😴 Bye week', test: '📋 Tests', autre: '📌 Autre' }
const fmt = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

// Saison d'un client (coach) : date de début du programme → dates des phases, matchs et événements
export default function SeasonPanel({ clientId, program, onStartChange }) {
  const [start, setStart] = useState('')
  const [events, setEvents] = useState([])
  const [form, setForm] = useState({ date: '', type: 'match', label: '' })
  const [msg, setMsg] = useState('')

  useEffect(() => { if (clientId) load() }, [clientId, program?.id])
  async function load() {
    const [{ data: a }, { data: ev }] = await Promise.all([
      supabase.from('program_assignments').select('start_date, assigned_at').eq('client_id', clientId).maybeSingle(),
      supabase.from('client_events').select('*').eq('client_id', clientId).order('date'),
    ])
    setStart(a?.start_date || a?.assigned_at?.slice(0, 10) || '')
    setEvents(ev || [])
  }
  async function saveStart(v) {
    setStart(v)
    const { error } = await supabase.from('program_assignments').update({ start_date: v || null, updated_at: new Date().toISOString() }).eq('client_id', clientId)
    setMsg(error ? 'Erreur : ' + error.message : 'Date de début enregistrée ✓')
    onStartChange?.(v)
    setTimeout(() => setMsg(''), 2500)
  }
  async function addEvent() {
    if (!form.date) return
    const { error } = await supabase.from('client_events').insert({ client_id: clientId, ...form, label: form.label || null })
    if (error) { setMsg('Erreur : ' + error.message); return }
    setForm(f => ({ ...f, date: '', label: '' })); load()
  }
  async function del(id) { await supabase.from('client_events').delete().eq('id', id); load() }

  const blocks = program?.program_blocks || []
  const dates = phaseDates(blocks, start)
  const ph = phaseAt(blocks, start)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.date >= today)

  return (
    <div data-testid="season-panel" className="ios-group" style={{ padding: 14, marginBottom: 12 }}>
      <p style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>🗓️ Saison</p>
      {program ? (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--label2)' }}>
            Début du programme
            <input type="date" data-testid="start-date" value={start} onChange={e => saveStart(e.target.value)} style={{ ...inp, width: 'auto', marginLeft: 'auto' }} />
          </label>
          {msg && <p style={{ margin: '6px 0 0', fontSize: 12, color: msg.startsWith('Erreur') ? 'var(--red-text)' : 'var(--green-text)' }}>{msg}</p>}
          {dates.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {dates.map(({ block, start: s, end }) => {
                const cur = ph?.blockId === block.id
                return (
                  <div key={block.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, marginBottom: 4, background: cur ? 'var(--accent-soft)' : 'var(--fill)' }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: cur ? 700 : 500, color: cur ? 'var(--accent-text)' : 'var(--label)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--label2)', flexShrink: 0 }}>{fmt(s)} → {fmt(end)}{cur ? ` · S${ph.week}` : ''}</span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>Assigne un programme pour définir la saison.</p>}

      <p style={{ margin: '14px 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>Matchs et événements</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} aria-label="Date de l’événement" />
        <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp} aria-label="Type">
          {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Adversaire, lieu… (optionnel)" style={{ ...inp, flex: 1 }} aria-label="Détail" />
        <button data-testid="add-event" onClick={addEvent} disabled={!form.date} aria-label="Ajouter l’événement"
          style={{ width: 44, border: 'none', borderRadius: 10, background: 'var(--accent)', color: 'white', cursor: 'pointer', opacity: form.date ? 1 : .5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></button>
      </div>
      {upcoming.length === 0 ? <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--label2)' }}>Aucun événement à venir.</p> : upcoming.slice(0, 12).map(e => (
        <div key={e.id} data-testid="event-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px', borderBottom: '0.5px solid var(--separator)', fontSize: 14 }}>
          <span style={{ width: 92, color: 'var(--label2)', fontSize: 13 }}>{new Date(e.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <span style={{ flex: 1, color: 'var(--label)' }}>{TYPES[e.type]}{e.label ? ` · ${e.label}` : ''}</span>
          <button onClick={() => del(e.id)} aria-label="Supprimer l’événement" style={{ background: 'none', border: 'none', color: 'var(--label3)', cursor: 'pointer' }}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

const inp = { width: '100%', boxSizing: 'border-box', background: 'var(--fill)', border: 'none', borderRadius: 10, padding: '9px 10px', fontSize: 16, color: 'var(--label)' }
