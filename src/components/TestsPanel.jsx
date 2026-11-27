import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TESTS, STRENGTH_SUGGESTIONS, testMeta, asymmetry } from '../lib/tests'
import { e1rm } from '../lib/strength'
import { Plus, X, TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react'

// Tests de performance d'un client : 1RM, sauts, sprints, ischios… (coach et client)
export default function TestsPanel({ clientId, canDelete = true }) {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (clientId) load() }, [clientId])
  async function load() {
    const { data } = await supabase.from('performance_tests').select('*').eq('client_id', clientId).order('tested_at', { ascending: false }).order('created_at', { ascending: false })
    setRows(data || [])
  }
  async function save() {
    setErr('')
    const key = form.kind === 'rm' ? 'rm:' + form.exercise.trim() : form.key
    const value = Number(String(form.value).replace(',', '.'))
    if (form.kind === 'rm' && !form.exercise.trim()) { setErr('Choisis l’exercice.'); return }
    if (!(value > 0)) { setErr('Valeur invalide.'); return }
    const meta = testMeta(key)
    setBusy(true)
    const { error } = await supabase.from('performance_tests').insert({
      client_id: clientId, test_key: key, label: meta.label, value, unit: meta.unit,
      value2: form.value2 ? Number(String(form.value2).replace(',', '.')) : null,
      reps: form.kind === 'rm' ? Number(form.reps) || 1 : null, tested_at: form.date, notes: form.notes || null,
    })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setForm(null); load()
  }
  async function remove(id) {
    if (!confirm('Supprimer ce résultat ?')) return
    await supabase.from('performance_tests').delete().eq('id', id); load()
  }

  // regroupement par test : dernier résultat, précédent, ratio
  const groups = {}
  for (const r of rows) (groups[r.test_key] = groups[r.test_key] || []).push(r)
  const bw = groups.bodyweight?.[0]?.value
  const order = Object.keys(groups).sort((a, b) => (a.startsWith('rm:') ? 0 : 1) - (b.startsWith('rm:') ? 0 : 1) || a.localeCompare(b))
  const val = r => (r.test_key.startsWith('rm:') && r.reps > 1 ? Math.round(e1rm(r.value, r.reps)) : Number(r.value))
  const fmt = (v, unit) => `${String(Math.round(v * 100) / 100).replace('.', ',')} ${unit || ''}`.trim()
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div data-testid="tests-panel">
      <button data-testid="add-test" onClick={() => setForm({ kind: 'rm', key: 'cmj', exercise: '', value: '', value2: '', reps: 1, date: today, notes: '' })}
        style={{ width: '100%', marginBottom: 10, padding: '12px 0', border: '1.5px dashed var(--accent)', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <Plus size={16} /> Ajouter un résultat de test
      </button>

      {form && (
        <div data-testid="test-form" className="ios-group" style={{ padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', background: 'var(--fill)', borderRadius: 9, padding: 2, gap: 2, marginBottom: 10 }}>
            {[['rm', 'Force (1RM / xRM)'], ['other', 'Saut, sprint, autre']].map(([k, l]) => (
              <button key={k} onClick={() => setForm(f => ({ ...f, kind: k }))} style={{ flex: 1, border: 'none', borderRadius: 7, padding: '7px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: form.kind === k ? 'var(--segment)' : 'transparent', color: form.kind === k ? 'var(--label)' : 'var(--label2)' }}>{l}</button>
            ))}
          </div>
          {form.kind === 'rm' ? (
            <>
              <input list="rm-suggest" value={form.exercise} onChange={e => setForm(f => ({ ...f, exercise: e.target.value }))} placeholder="Exercice (ex. Squat barre (Back Squat))" style={inp} aria-label="Exercice" />
              <datalist id="rm-suggest">{STRENGTH_SUGGESTIONS.map(x => <option key={x} value={x} />)}</datalist>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                <label style={lbl}>Charge (kg)<input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} inputMode="decimal" style={inp} aria-label="Charge (kg)" /></label>
                <label style={lbl}>Répétitions<input value={form.reps} onChange={e => setForm(f => ({ ...f, reps: e.target.value.replace(/[^\d]/g, '') }))} inputMode="numeric" style={inp} aria-label="Répétitions" /></label>
              </div>
              {Number(form.reps) > 1 && Number(form.value) > 0 && <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--accent-text)' }}>1RM estimé : {Math.round(e1rm(form.value, form.reps))} kg</p>}
            </>
          ) : (
            <>
              <select value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} style={inp} aria-label="Test">
                {TESTS.map(t => <option key={t.key} value={t.key}>{t.label} ({t.unit})</option>)}
              </select>
              <div style={{ display: 'grid', gridTemplateColumns: testMeta(form.key).two ? '1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}>
                <label style={lbl}>{testMeta(form.key).two ? 'Gauche' : 'Résultat'} ({testMeta(form.key).unit})<input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} inputMode="decimal" style={inp} aria-label="Résultat" /></label>
                {testMeta(form.key).two && <label style={lbl}>Droite ({testMeta(form.key).unit})<input value={form.value2} onChange={e => setForm(f => ({ ...f, value2: e.target.value }))} inputMode="decimal" style={inp} aria-label="Droite" /></label>}
              </div>
            </>
          )}
          <label style={{ ...lbl, marginTop: 8 }}>Date<input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></label>
          {err && <p role="alert" style={{ margin: '8px 0 0', color: 'var(--red-text)', fontSize: 13 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setForm(null)} style={{ flex: 1, ...btn, background: 'var(--fill)', color: 'var(--label2)' }}><X size={15} /> Annuler</button>
            <button data-testid="save-test" onClick={save} disabled={busy} style={{ flex: 2, ...btn, background: 'var(--accent)', color: 'white' }}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </div>
      )}

      {order.length === 0 && !form && <p style={{ textAlign: 'center', color: 'var(--label2)', fontSize: 14, padding: '20px 0' }}>Aucun test pour l’instant.</p>}
      {order.map(k => {
        const list = groups[k], meta = testMeta(k), last = list[0], prev = list[1]
        const v = val(last), pv = prev ? val(prev) : null
        const diff = pv != null ? v - pv : null
        const good = diff == null || diff === 0 ? null : (meta.better === 'down' ? diff < 0 : meta.better === 'up' ? diff > 0 : null)
        const asym = meta.two ? asymmetry(Number(last.value), Number(last.value2)) : null
        return (
          <div key={k} data-testid="test-row" className="ios-group" style={{ padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <p style={{ margin: 0, flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--label)' }}>{meta.strength ? '🏋️ ' : ''}{meta.label}{meta.strength ? ' · 1RM' : ''}</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--label)' }}>{meta.two ? `${fmt(last.value, '')} / ${fmt(last.value2 || 0, meta.unit)}` : fmt(v, meta.unit)}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 12, color: 'var(--label2)', flexWrap: 'wrap' }}>
              <span>{new Date(last.tested_at + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
              {meta.strength && last.reps > 1 && <span>· {last.value} kg × {last.reps}</span>}
              {diff != null && diff !== 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700, color: good ? 'var(--green-text)' : good === false ? 'var(--red-text)' : 'var(--label2)' }}>
                {diff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{diff > 0 ? '+' : ''}{fmt(diff, meta.unit)}</span>}
              {diff === 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}><Minus size={12} />stable</span>}
              {meta.strength && bw > 0 && <span style={{ fontWeight: 700, color: 'var(--accent-text)' }}>· {String(Math.round(v / bw * 100) / 100).replace('.', ',')} × poids de corps</span>}
              {asym != null && <span style={{ fontWeight: 700, color: asym > 10 ? 'var(--red-text)' : 'var(--green-text)' }}>· asymétrie {asym} %{asym > 10 ? ' ⚠️ bloc correctif' : ''}</span>}
              {canDelete && <button onClick={() => remove(last.id)} aria-label={'Supprimer ' + meta.label} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--label3)', cursor: 'pointer', padding: 2 }}><Trash2 size={13} /></button>}
            </div>
            {list.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28, marginTop: 6 }} aria-hidden>
                {[...list].reverse().slice(-12).map((r, i, arr) => {
                  const vals = arr.map(val), mn = Math.min(...vals), mxv = Math.max(...vals)
                  const h = mxv === mn ? 14 : 6 + 22 * (val(r) - mn) / (mxv - mn)
                  return <span key={r.id} style={{ flex: 1, height: h, borderRadius: 3, background: i === arr.length - 1 ? 'var(--accent)' : 'var(--fill2)' }} />
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const inp = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 3, background: 'var(--fill)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 16, color: 'var(--label)' }
const lbl = { display: 'block', fontSize: 12, color: 'var(--label2)' }
const btn = { border: 'none', borderRadius: 12, padding: '11px 0', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
