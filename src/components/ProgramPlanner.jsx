import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { localDateStr } from '../lib/nutrition'
import { haptic } from '../lib/fx'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, X, Play, Trash2, Check, GripVertical } from 'lucide-react'
import { cacheGet, cacheSet, isOffline } from '../lib/offline'

const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const COLORS = ['#5e5ce6', '#34c759', '#ff9500', '#ff375f', '#30b0c7', '#af52de', '#a2845e']

const mondayOf = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x }
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const fmtDay = d => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

// Planning du client : il place les séances de son programme sur les jours de son choix
// et peut les déplacer (glisser-déposer, ou toucher la séance puis choisir un autre jour).
// En lecture seule pour le coach (fiche client).
export default function ProgramPlanner({ clientId, sessions, readOnly = false }) {
  const navigate = useNavigate()
  const [week, setWeek] = useState(() => mondayOf(new Date()))
  const [rows, setRows] = useState([])
  const [done, setDone] = useState([])
  const [moving, setMoving] = useState(null)      // ligne touchée → feuille « déplacer »
  const [adding, setAdding] = useState(null)      // date → feuille « ajouter une séance »
  const [wizard, setWizard] = useState(false)
  const [drag, setDrag] = useState(null)          // { row, x, y, over }
  const todayStr = localDateStr(new Date())
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])
  const color = id => COLORS[Math.max(0, sessions.findIndex(s => s.id === id)) % COLORS.length]
  const nameOf = id => sessions.find(s => s.id === id)?.name || 'Séance'

  useEffect(() => { if (clientId) load() }, [clientId, week])

  async function load() {
    const from = localDateStr(week), to = localDateStr(addDays(week, 6))
    const ck = 'planner:' + clientId + ':' + from
    if (isOffline()) { const c = cacheGet(ck); if (c) { setRows(c.rows); setDone(c.done) } return }
    const [{ data: r }, { data: c }] = await Promise.all([
      supabase.from('scheduled_sessions').select('*').eq('client_id', clientId).gte('date', from).lte('date', to).order('created_at'),
      supabase.from('session_completions').select('program_session_id, created_at').eq('client_id', clientId)
        .gte('created_at', week.toISOString()).lt('created_at', addDays(week, 7).toISOString()),
    ])
    const d = (c || []).map(x => ({ sid: x.program_session_id, date: localDateStr(new Date(x.created_at)) }))
    setRows(r || []); setDone(d)
    cacheSet(ck, { rows: r || [], done: d })
  }

  const isDone = r => done.some(d => d.sid === r.program_session_id && d.date === r.date)

  async function moveTo(row, date) {
    if (!row || row.date === date) return
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, date } : r))
    haptic(12)
    const { error } = await supabase.from('scheduled_sessions').update({ date }).eq('id', row.id)
    if (error) { alert('Erreur : ' + error.message); load() }
  }
  async function remove(row) {
    setRows(rs => rs.filter(r => r.id !== row.id))
    await supabase.from('scheduled_sessions').delete().eq('id', row.id)
  }
  async function add(sessionId, date) {
    const { data, error } = await supabase.from('scheduled_sessions').insert({ client_id: clientId, program_session_id: sessionId, date }).select().single()
    if (error) { alert('Erreur : ' + error.message); return }
    setRows(rs => [...rs, data]); haptic(10)
  }

  // ── Glisser-déposer (doigt ou souris) : appui long puis on glisse sur un autre jour ──
  const pressRef = useRef(null)
  function onPointerDown(e, row) {
    if (readOnly) return
    const start = { x: e.clientX, y: e.clientY }
    const timer = setTimeout(() => { haptic(15); setDrag({ row, x: start.x, y: start.y, over: row.date }) }, 280)
    pressRef.current = { timer, start, row, moved: false }
  }
  function onPointerMove(e) {
    const p = pressRef.current
    if (!p) return
    if (!drag && Math.hypot(e.clientX - p.start.x, e.clientY - p.start.y) > 8) { clearTimeout(p.timer); pressRef.current = null }
  }
  function onPointerUp(row) {
    const p = pressRef.current
    if (p) { clearTimeout(p.timer); pressRef.current = null }
    if (!drag && p) setMoving(row) // simple toucher : feuille « déplacer »
  }
  useEffect(() => {
    if (!drag) return
    const move = e => {
      const pt = e.touches ? e.touches[0] : e
      if (e.cancelable) e.preventDefault()
      const el = document.elementFromPoint(pt.clientX, pt.clientY)?.closest('[data-day]')
      setDrag(d => d && { ...d, x: pt.clientX, y: pt.clientY, over: el?.dataset.day || d.over })
    }
    const up = () => { setDrag(d => { if (d) moveTo(d.row, d.over); return null }); pressRef.current = null }
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('pointermove', move)
    window.addEventListener('touchend', up)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('touchmove', move); window.removeEventListener('pointermove', move); window.removeEventListener('touchend', up); window.removeEventListener('pointerup', up) }
  }, [!!drag])

  const weekLabel = `${fmtDay(days[0])} – ${fmtDay(days[6])}`
  const plannedCount = rows.length

  return (
    <div data-testid="planner" className="ios-group" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <CalendarDays size={18} color="var(--accent-text)" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>{readOnly ? 'Planning du client' : 'Mon planning'}</p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>{weekLabel} · {plannedCount} séance{plannedCount > 1 ? 's' : ''}</p>
        </div>
        <button aria-label="Semaine précédente" onClick={() => setWeek(w => addDays(w, -7))} style={navBtn}><ChevronLeft size={18} /></button>
        <button aria-label="Semaine suivante" onClick={() => setWeek(w => addDays(w, 7))} style={navBtn}><ChevronRight size={18} /></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {days.map((d, i) => {
          const ds = localDateStr(d)
          const items = rows.filter(r => r.date === ds)
          const isToday = ds === todayStr
          const past = ds < todayStr
          const over = drag?.over === ds
          return (
            <div key={ds} data-day={ds} data-testid={'day-' + ds}
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '6px 8px', borderRadius: 12,
                background: over ? 'var(--accent-soft)' : isToday ? 'var(--fill)' : 'transparent',
                outline: over ? '2px dashed var(--accent)' : 'none', transition: 'background .15s' }}>
              <div style={{ width: 42, flexShrink: 0, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: isToday ? 'var(--accent-text)' : 'var(--label2)' }}>{DAY_SHORT[i]}</p>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: isToday ? 'var(--accent-text)' : past ? 'var(--label3)' : 'var(--label)' }}>{d.getDate()}</p>
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.length === 0 && <span style={{ fontSize: 13, color: 'var(--label3)' }}>Repos</span>}
                {items.map(r => {
                  const ok = isDone(r)
                  const missed = !ok && past
                  const c = color(r.program_session_id)
                  return (
                    <button key={r.id} data-testid="planned-session"
                      onPointerDown={e => onPointerDown(e, r)} onPointerMove={onPointerMove} onPointerUp={() => onPointerUp(r)} onPointerCancel={() => { if (pressRef.current) { clearTimeout(pressRef.current.timer); pressRef.current = null } }}
                      onClick={readOnly ? undefined : e => e.preventDefault()} onContextMenu={e => e.preventDefault()}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', padding: '7px 10px', borderRadius: 10, border: 'none',
                        cursor: readOnly ? 'default' : 'grab', fontSize: 14, fontWeight: 600, textAlign: 'left', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none',
                        background: ok ? 'rgba(52,199,89,0.16)' : c + '22', color: ok ? 'var(--green-text)' : 'var(--label)',
                        borderLeft: `4px solid ${ok ? '#34c759' : missed ? '#ff9500' : c}`, opacity: drag?.row.id === r.id ? 0.35 : 1 }}>
                      {!readOnly && !ok && <GripVertical size={14} color="var(--label3)" style={{ flexShrink: 0 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(r.program_session_id)}</span>
                      {ok && <Check size={15} />}
                      {missed && <span style={{ fontSize: 11, color: 'var(--orange-text)' }}>manquée</span>}
                    </button>
                  )
                })}
              </div>
              {!readOnly && !past && (
                <button aria-label={'Ajouter une séance le ' + DAY_LONG[i]} onClick={() => setAdding(ds)} style={{ ...navBtn, width: 30, height: 30 }}><Plus size={16} /></button>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <>
          <button data-testid="plan-wizard-btn" onClick={() => setWizard(true)} style={mainBtn}><CalendarDays size={17} /> {plannedCount ? 'Replanifier mon programme' : 'Planifier mon programme'}</button>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--label2)', textAlign: 'center' }}>Touche une séance pour la déplacer, ou garde le doigt appuyé et glisse-la sur un autre jour.</p>
        </>
      )}

      {drag && createPortal(
        <div style={{ position: 'fixed', left: drag.x - 70, top: drag.y - 22, width: 140, padding: '8px 10px', borderRadius: 10, zIndex: 3000, pointerEvents: 'none',
          background: color(drag.row.program_session_id), color: 'white', fontSize: 13, fontWeight: 700, boxShadow: '0 10px 24px rgba(0,0,0,.25)', transform: 'rotate(-3deg)' }}>
          {nameOf(drag.row.program_session_id)}
        </div>, document.body)}

      {moving && (
        <Sheet title={nameOf(moving.program_session_id)} subtitle={'Prévue ' + new Date(moving.date + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setMoving(null)}>
          <button onClick={() => navigate(`/client/session-log/${moving.program_session_id}`)} style={{ ...mainBtn, marginTop: 0, background: 'linear-gradient(135deg,#34c759,#30b0c7)' }}><Play size={17} /> Commencer la séance</button>
          <p style={sheetLabel}>Déplacer à</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 6 }}>
            {days.map((d, i) => {
              const ds = localDateStr(d); const cur = ds === moving.date
              return (
                <button key={ds} data-testid={'move-' + ds} onClick={() => { moveTo(moving, ds); setMoving(null) }} disabled={cur}
                  style={{ padding: '8px 0', borderRadius: 10, border: 'none', cursor: cur ? 'default' : 'pointer', background: cur ? 'var(--accent)' : 'var(--fill)', color: cur ? 'white' : 'var(--label)' }}>
                  <span style={{ display: 'block', fontSize: 11, fontWeight: 600 }}>{DAY_SHORT[i]}</span>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>{d.getDate()}</span>
                </button>
              )
            })}
          </div>
          <p style={sheetLabel}>Ou une autre date</p>
          <input type="date" defaultValue={moving.date} onChange={e => { if (e.target.value) { moveTo(moving, e.target.value); setMoving(null) } }} style={input} aria-label="Autre date" />
          <button onClick={() => { remove(moving); setMoving(null) }} style={{ ...mainBtn, background: 'rgba(255,59,48,0.12)', color: 'var(--red-text)', boxShadow: 'none' }}><Trash2 size={16} /> Retirer du planning</button>
        </Sheet>
      )}

      {adding && (
        <Sheet title="Ajouter une séance" subtitle={new Date(adding + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setAdding(null)}>
          {sessions.map(s => (
            <button key={s.id} onClick={() => { add(s.id, adding); setAdding(null) }} style={rowBtn}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: color(s.id), flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: 'left' }}>{s.name}</span><Plus size={16} color="var(--accent-text)" />
            </button>
          ))}
        </Sheet>
      )}

      {wizard && <PlanWizard sessions={sessions} color={color} clientId={clientId} onClose={() => setWizard(false)} onDone={() => { setWizard(false); setWeek(mondayOf(new Date())); load() }} />}
    </div>
  )
}

// Planification rapide : jours de la semaine pour chaque séance, sur plusieurs semaines.
function PlanWizard({ sessions, color, clientId, onClose, onDone }) {
  const defaults = [[0], [2], [4], [1], [3], [5], [6]]
  const [pick, setPick] = useState(() => Object.fromEntries(sessions.map((s, i) => [s.id, defaults[i % 7]])))
  const [weeks, setWeeks] = useState(4)
  const [busy, setBusy] = useState(false)
  const toggle = (sid, d) => setPick(p => ({ ...p, [sid]: p[sid].includes(d) ? p[sid].filter(x => x !== d) : [...p[sid], d].sort() }))
  const total = Object.values(pick).reduce((n, a) => n + a.length, 0) * weeks

  async function save() {
    setBusy(true)
    const today = localDateStr(new Date())
    const monday = mondayOf(new Date())
    const ins = []
    for (let w = 0; w < weeks; w++) for (const s of sessions) for (const d of pick[s.id] || []) {
      const ds = localDateStr(addDays(monday, w * 7 + d))
      if (ds >= today) ins.push({ client_id: clientId, program_session_id: s.id, date: ds })
    }
    // on remplace le planning à venir de ces séances
    const { error: delErr } = await supabase.from('scheduled_sessions').delete().eq('client_id', clientId).gte('date', today).in('program_session_id', sessions.map(s => s.id))
    if (delErr) { alert('Erreur : ' + delErr.message); setBusy(false); return }
    if (ins.length) {
      const { error } = await supabase.from('scheduled_sessions').insert(ins)
      if (error) { alert('Erreur : ' + error.message); setBusy(false); return }
    }
    haptic([20, 40, 20])
    onDone()
  }

  return (
    <Sheet title="Planifier mon programme" subtitle="Choisis tes jours d’entraînement pour chaque séance" onClose={onClose}>
      <div data-testid="plan-wizard" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sessions.map(s => (
          <div key={s.id}>
            <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--label)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: color(s.id) }} />{s.name}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0,1fr))', gap: 5 }}>
              {DAY_SHORT.map((l, d) => {
                const on = pick[s.id]?.includes(d)
                return (
                  <button key={d} aria-pressed={on} aria-label={`${s.name} le ${DAY_LONG[d]}`} onClick={() => toggle(s.id, d)}
                    style={{ padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                      background: on ? color(s.id) : 'var(--fill)', color: on ? 'white' : 'var(--label2)' }}>{l}</button>
                )
              })}
            </div>
          </div>
        ))}
        <div>
          <p style={sheetLabel}>Pendant</p>
          <div style={{ display: 'flex', background: 'var(--fill)', borderRadius: 10, padding: 2, gap: 2 }}>
            {[1, 2, 4, 8].map(w => (
              <button key={w} role="radio" aria-checked={w === weeks} onClick={() => setWeeks(w)}
                style={{ flex: 1, border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: w === weeks ? 'var(--segment)' : 'transparent', color: w === weeks ? 'var(--label)' : 'var(--label2)' }}>{w} sem.</button>
            ))}
          </div>
        </div>
        <button data-testid="plan-wizard-save" onClick={save} disabled={busy || !total} style={{ ...mainBtn, opacity: busy || !total ? .6 : 1 }}>
          <Check size={17} /> {busy ? 'Enregistrement…' : `Planifier ${total} séance${total > 1 ? 's' : ''}`}
        </button>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)', textAlign: 'center' }}>Ton planning à venir pour ces séances sera remplacé. Tu pourras ensuite déplacer chaque séance.</p>
      </div>
    </Sheet>
  )
}

function Sheet({ title, subtitle, onClose, children }) {
  return createPortal(
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 520, borderRadius: '20px 20px 0 0', padding: '16px 16px 24px', maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--label)' }}>{title}</p>
            {subtitle && <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--label2)' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer" style={navBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>, document.body)
}

const navBtn = { width: 34, height: 34, borderRadius: 17, border: 'none', background: 'var(--fill)', color: 'var(--label)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }
const mainBtn = { width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 700, color: 'white', cursor: 'pointer', background: 'linear-gradient(135deg,#5e5ce6,#8b5cf6)', boxShadow: '0 8px 20px rgba(94,92,230,.25)' }
const sheetLabel = { margin: '16px 0 6px', fontSize: 13, fontWeight: 700, color: 'var(--label2)', textTransform: 'uppercase', letterSpacing: '.04em' }
const input = { width: '100%', boxSizing: 'border-box', background: 'var(--fill)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 16, color: 'var(--label)' }
const rowBtn = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 4px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--separator)', cursor: 'pointer', color: 'var(--label)', fontSize: 15 }
