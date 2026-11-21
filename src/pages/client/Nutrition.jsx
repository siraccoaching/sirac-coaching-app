import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout } from '../../components/Layout'
import BarcodeScanner from '../../components/BarcodeScanner'
import { ChevronLeft, ChevronRight, Plus, Trash2, Search, ScanBarcode, Copy, X, Clock, ClipboardList, PenLine } from 'lucide-react'
import { DEFAULT_MEALS, localDateStr, estimateTargets, scaleFood, round1, fetchOffProduct, searchOff } from '../../lib/nutrition'
import { tone } from '../../lib/theme'

const MACROS = [
  { key: 'protein', label: 'Protéines', color: '#818cf8', targetKey: 'protein_target' },
  { key: 'carbs', label: 'Glucides', color: '#22c55e', targetKey: 'carbs_target' },
  { key: 'fat', label: 'Lipides', color: '#f87171', targetKey: 'fat_target' },
]

const input = { width: '100%', background: 'var(--fill)', border: '1px solid var(--separator)', borderRadius: 10, padding: '10px 12px', color: 'var(--label)', fontSize: 14, boxSizing: 'border-box', WebkitTextFillColor: 'var(--label)' }

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function CalorieRing({ consumed, target }) {
  const r = 52, circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0
  const over = target > 0 && consumed > target
  const color = over ? '#f87171' : '#f59e0b'
  return (
    <div style={{ position: 'relative', width: 128, height: 128, flexShrink: 0 }}>
      <svg width={128} height={128} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={64} cy={64} r={r} fill="none" stroke="var(--fill)" strokeWidth={10} />
        <circle cx={64} cy={64} r={r} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span data-testid="kcal-consumed" style={{ fontSize: 26, fontWeight: 800, color: 'var(--label)', lineHeight: 1 }}>{Math.round(consumed)}</span>
        <span style={{ fontSize: 11, color: 'var(--label2)', marginTop: 3 }}>{target ? `/ ${Math.round(target)} kcal` : 'kcal'}</span>
      </div>
    </div>
  )
}

function MacroBar({ label, color, value, target }) {
  const pct = target > 0 ? Math.min(value / target, 1) * 100 : 0
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--label1b)', fontWeight: 600 }}>{label}</span>
        <span style={{ color: 'var(--label2)' }}><span style={{ color: tone(color), fontWeight: 700 }}>{Math.round(value)}</span>{target ? ` / ${Math.round(target)}` : ''} g</span>
      </div>
      <div style={{ height: 6, background: 'var(--fill)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// Feuille d'ajout : recherche (base + Open Food Facts), scan, récents, plan du coach, saisie libre.
function AddFoodSheet({ meal, planMeals, recents, onClose, onAdd }) {
  const [tab, setTab] = useState('search')
  const [q, setQ] = useState('')
  const [local, setLocal] = useState([])
  const [off, setOff] = useState([])
  const [offState, setOffState] = useState('idle') // idle | loading | error
  const [selected, setSelected] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [manual, setManual] = useState({ food_name: '', quantity: 100, unit: 'g', calories: '', protein: '', carbs: '', fat: '' })
  const abortRef = useRef(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setLocal([]); setOff([]); setOffState('idle'); return }
    let alive = true
    supabase.from('food_items').select('*').ilike('name', `%${term}%`).order('name').limit(15)
      .then(({ data }) => { if (alive) setLocal(data || []) })
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setOffState('loading')
      try {
        const res = await searchOff(term, ctrl.signal)
        if (alive) { setOff(res); setOffState('idle') }
      } catch (e) {
        if (alive && e.name !== 'AbortError') { setOff([]); setOffState('error') }
      }
    }, 450)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  async function handleBarcode(code) {
    setScanning(false)
    setScanMsg('Recherche du produit ' + code + '…')
    try {
      const p = await fetchOffProduct(code)
      if (!p) { setScanMsg('Produit ' + code + ' introuvable. Ajoute-le en saisie libre.'); setTab('manual'); return }
      setScanMsg('')
      pick({ ...p })
    } catch (e) {
      setScanMsg(e.message)
    }
  }

  function pick(food) {
    const unit = food.unit || 'g'
    setSelected({ ...food, unit, quantity: food.default_quantity || food.portion_g || 100 })
  }

  function fromLogged(item) {
    const qty = Number(item.quantity) || 1
    const per = v => round1(((Number(v) || 0) / qty) * 100)
    return { name: item.food_name || item.name, unit: item.unit || 'g', default_quantity: qty, barcode: item.barcode, source: item.source || 'recent',
      calories: per(item.calories), protein: per(item.protein), carbs: per(item.carbs), fat: per(item.fat) }
  }

  const tabs = [['search', 'Rechercher', Search], ['recent', 'Récents', Clock], ['plan', 'Mon plan', ClipboardList], ['manual', 'Saisie libre', PenLine]]
    .filter(([k]) => k !== 'plan' || planMeals.some(m => m.nutrition_foods?.length))

  return (
    <div data-testid="add-food-sheet" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--card)', width: '100%', maxWidth: 520, borderRadius: '18px 18px 0 0', padding: '16px 16px 24px', height: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--label2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ajouter à</p>
            <h3 style={{ margin: 0, fontSize: 17, color: 'var(--label)' }}>{meal}</h3>
          </div>
          <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: 'var(--label2)', cursor: 'pointer' }}><X size={22} /></button>
        </div>

        {selected ? (
          <QuantityStep food={selected} meal={meal} onBack={() => setSelected(null)} onAdd={onAdd} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {tabs.map(([k, label, Icon]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{ flex: 1, padding: '8px 2px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    background: tab === k ? '#6366f1' : 'var(--fill)', color: tab === k ? 'white' : 'var(--label2)' }}>
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>
            {scanMsg && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--yellow-text)' }}>{scanMsg}</p>}

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {tab === 'search' && (
                <>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--fill)', borderRadius: 10, padding: '0 12px' }}>
                      <Search size={14} color="var(--label2)" />
                      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Riz, poulet, yaourt, Nutella…"
                        style={{ background: 'none', border: 'none', color: 'var(--label)', outline: 'none', flex: 1, minWidth: 0, padding: '10px 0', WebkitTextFillColor: 'var(--label)' }} />
                    </div>
                    <button onClick={() => setScanning(true)} aria-label="Scanner un code-barre"
                      style={{ background: '#22c55e', border: 'none', borderRadius: 10, width: 46, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ScanBarcode size={20} />
                    </button>
                  </div>
                  {q.trim().length < 2 ? (
                    <p style={{ textAlign: 'center', color: 'var(--label3)', fontSize: 13, marginTop: 24 }}>Tape au moins 2 lettres ou scanne un produit.</p>
                  ) : (
                    <>
                      {local.length > 0 && <SectionTitle>Aliments de base</SectionTitle>}
                      {local.map(f => (
                        <FoodRow key={f.id} name={f.name} sub={`${f.calories} kcal · P${f.protein} G${f.carbs} L${f.fat} /100 g`} onClick={() => pick({ ...f, source: 'base' })} />
                      ))}
                      <SectionTitle>Produits du commerce (Open Food Facts)</SectionTitle>
                      {offState === 'loading' && <p style={{ color: 'var(--label2)', fontSize: 12 }}>Recherche…</p>}
                      {offState === 'error' && <p style={{ color: 'var(--red-text)', fontSize: 12 }}>Recherche en ligne indisponible pour le moment.</p>}
                      {offState === 'idle' && off.length === 0 && <p style={{ color: 'var(--label3)', fontSize: 12 }}>Aucun produit trouvé.</p>}
                      {off.map(f => (
                        <FoodRow key={f.barcode + f.name} image={f.image} name={f.name} sub={`${f.brand ? f.brand + ' · ' : ''}${f.calories} kcal /100 ${f.unit}`} onClick={() => pick(f)} />
                      ))}
                    </>
                  )}
                </>
              )}

              {tab === 'recent' && (
                recents.length === 0
                  ? <p style={{ textAlign: 'center', color: 'var(--label3)', fontSize: 13, marginTop: 24 }}>Tes aliments récents apparaîtront ici.</p>
                  : recents.map(r => (
                    <FoodRow key={r.food_name + r.quantity + r.unit} name={r.food_name} sub={`${r.quantity} ${r.unit} · ${Math.round(r.calories)} kcal`} onClick={() => pick(fromLogged(r))} />
                  ))
              )}

              {tab === 'plan' && planMeals.map(m => (m.nutrition_foods?.length ? (
                <div key={m.id}>
                  <SectionTitle>{m.name}</SectionTitle>
                  {m.nutrition_foods.map(f => (
                    <FoodRow key={f.id} name={f.name} sub={`${f.quantity} ${f.unit} · ${Math.round(f.calories)} kcal`} onClick={() => pick(fromLogged(f))} />
                  ))}
                </div>
              ) : null))}

              {tab === 'manual' && (
                <div>
                  <input value={manual.food_name} onChange={e => setManual(m => ({ ...m, food_name: e.target.value }))} placeholder="Nom de l'aliment ou du plat" style={{ ...input, marginBottom: 10 }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 10 }}>
                    <input type="number" inputMode="decimal" value={manual.quantity} onChange={e => setManual(m => ({ ...m, quantity: e.target.value }))} placeholder="Quantité" style={input} aria-label="Quantité" />
                    <select value={manual.unit} onChange={e => setManual(m => ({ ...m, unit: e.target.value }))} style={input} aria-label="Unité">
                      {['g', 'ml', 'pièce', 'portion'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--label2)' }}>Valeurs pour la quantité indiquée</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 14 }}>
                    {[['calories', 'Kcal', '#f59e0b'], ['protein', 'Prot.', '#818cf8'], ['carbs', 'Gluc.', '#22c55e'], ['fat', 'Lip.', '#f87171']].map(([k, l, c]) => (
                      <label key={k} style={{ textAlign: 'center', fontSize: 11, color: c }}>{l}
                        <input type="number" inputMode="decimal" value={manual[k]} onChange={e => setManual(m => ({ ...m, [k]: e.target.value }))} style={{ ...input, textAlign: 'center', marginTop: 4, padding: '9px 4px' }} />
                      </label>
                    ))}
                  </div>
                  <button disabled={!manual.food_name.trim()} onClick={() => onAdd({
                    food_name: manual.food_name.trim(), quantity: Number(manual.quantity) || 1, unit: manual.unit, source: 'manuel',
                    calories: Number(manual.calories) || 0, protein: Number(manual.protein) || 0, carbs: Number(manual.carbs) || 0, fat: Number(manual.fat) || 0,
                  })} style={{ width: '100%', padding: '13px 0', background: manual.food_name.trim() ? '#6366f1' : 'var(--separator)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    Ajouter
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {scanning && <BarcodeScanner onDetected={handleBarcode} onClose={() => setScanning(false)} />}
    </div>
  )
}

function SectionTitle({ children }) {
  return <p style={{ margin: '10px 0 6px', fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{children}</p>
}

function FoodRow({ name, sub, image, onClick }) {
  return (
    <button onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--fill)', border: 'none', borderRadius: 10, padding: '9px 10px', marginBottom: 6, cursor: 'pointer', textAlign: 'left' }}>
      {image && <img src={image} alt="" style={{ width: 36, height: 36, objectFit: 'contain', background: 'white', borderRadius: 8, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--label)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--label2)' }}>{sub}</p>
      </div>
      <Plus size={16} color="#6366f1" />
    </button>
  )
}

function QuantityStep({ food, meal, onBack, onAdd }) {
  const [qty, setQty] = useState(food.quantity)
  const vals = scaleFood(food, qty)
  const presets = [...new Set([food.portion_g, 50, 100, 150, 200].filter(Boolean).map(Math.round))].slice(0, 5)
  return (
    <div data-testid="quantity-step">
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--accent-text)', cursor: 'pointer', padding: 0, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={15} /> Retour
      </button>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
        {food.image && <img src={food.image} alt="" style={{ width: 54, height: 54, objectFit: 'contain', background: 'white', borderRadius: 10 }} />}
        <div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>{food.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>{food.brand ? food.brand + ' · ' : ''}{food.calories} kcal pour 100 {food.unit}</p>
        </div>
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--label2)' }}>Quantité ({food.unit})</p>
      <input data-testid="qty-input" type="number" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} style={{ ...input, fontSize: 18, textAlign: 'center', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {presets.map(p => (
          <button key={p} onClick={() => setQty(p)} style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid ' + (Number(qty) === p ? '#6366f1' : 'var(--separator)'), background: Number(qty) === p ? 'var(--accent-soft)' : 'transparent', color: Number(qty) === p ? '#c7d2fe' : 'var(--label2)', fontSize: 12, cursor: 'pointer' }}>
            {p === Math.round(food.portion_g || -1) && food.portion_label ? `${food.portion_label} (${p} ${food.unit})` : `${p} ${food.unit}`}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, background: 'var(--fill)', borderRadius: 12, padding: '12px 6px', marginBottom: 16, textAlign: 'center' }}>
        {[['Kcal', vals.calories, '#f59e0b'], ['Prot.', vals.protein, '#818cf8'], ['Gluc.', vals.carbs, '#22c55e'], ['Lip.', vals.fat, '#f87171']].map(([l, v, c]) => (
          <div key={l}><p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: c }}>{v}</p><p style={{ margin: 0, fontSize: 10, color: 'var(--label2)' }}>{l}</p></div>
        ))}
      </div>
      <button data-testid="confirm-add-food" disabled={!(Number(qty) > 0)} onClick={() => onAdd({ food_name: food.brand ? `${food.name} (${food.brand})` : food.name, quantity: Number(qty), unit: food.unit, barcode: food.barcode || null, source: food.source || null, ...vals })}
        style={{ width: '100%', padding: '14px 0', background: Number(qty) > 0 ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'var(--separator)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        Ajouter · {meal}
      </button>
    </div>
  )
}

export default function Nutrition() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [date, setDate] = useState(new Date())
  const [plan, setPlan] = useState(null)
  const [planMeals, setPlanMeals] = useState([])
  const [logs, setLogs] = useState([])
  const [yesterdayLogs, setYesterdayLogs] = useState([])
  const [recents, setRecents] = useState([])
  const [loading, setLoading] = useState(true)
  const [addMeal, setAddMeal] = useState(null)
  const [busy, setBusy] = useState(false)

  const dateStr = localDateStr(date)
  const yesterdayStr = localDateStr(addDays(date, -1))
  const isToday = dateStr === localDateStr()

  useEffect(() => { if (profile?.id) { loadPlan(); loadRecents() } }, [profile?.id])
  useEffect(() => { if (profile?.id) loadLogs() }, [profile?.id, dateStr])

  async function loadPlan() {
    const { data } = await supabase.from('nutrition_plans')
      .select('*, nutrition_meals(*, nutrition_foods(*))')
      .eq('client_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setPlan(data || null)
    setPlanMeals((data?.nutrition_meals || []).sort((a, b) => a.order_index - b.order_index))
  }

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase.from('nutrition_logs').select('*')
      .eq('client_id', profile.id).in('date', [dateStr, yesterdayStr]).order('created_at')
    setLogs((data || []).filter(l => l.date === dateStr))
    setYesterdayLogs((data || []).filter(l => l.date === yesterdayStr))
    setLoading(false)
  }

  async function loadRecents() {
    const { data } = await supabase.from('nutrition_logs').select('food_name, quantity, unit, calories, protein, carbs, fat, barcode, source')
      .eq('client_id', profile.id).order('created_at', { ascending: false }).limit(150)
    const seen = new Set(); const out = []
    for (const r of data || []) { const k = r.food_name + '|' + r.quantity + '|' + r.unit; if (!seen.has(k)) { seen.add(k); out.push(r) } }
    setRecents(out.slice(0, 30))
  }

  async function addLog(entry) {
    const meal = addMeal
    const { error } = await supabase.from('nutrition_logs').insert({ client_id: profile.id, date: dateStr, meal_name: meal, ...entry })
    if (error) { alert('Erreur : ' + error.message); return }
    setAddMeal(null)
    loadLogs(); loadRecents()
  }

  async function deleteLog(id) {
    await supabase.from('nutrition_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  async function copyYesterday(mealName) {
    const src = yesterdayLogs.filter(l => !mealName || (l.meal_name || 'Autre') === mealName)
    if (!src.length) return
    setBusy(true)
    await supabase.from('nutrition_logs').insert(src.map(({ id, created_at, date: _d, ...rest }) => ({ ...rest, date: dateStr })))
    setBusy(false)
    loadLogs()
  }

  const targets = plan && plan.calories_target ? plan : estimateTargets(profile)
  const totals = logs.reduce((a, l) => ({
    calories: a.calories + (+l.calories || 0), protein: a.protein + (+l.protein || 0),
    carbs: a.carbs + (+l.carbs || 0), fat: a.fat + (+l.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })
  const remaining = targets?.calories_target ? Math.round(targets.calories_target - totals.calories) : null

  const mealNames = [...new Set([...(planMeals.length ? planMeals.map(m => m.name) : DEFAULT_MEALS), ...logs.map(l => l.meal_name || 'Autre')])]

  return (
    <PageLayout title="Nutrition" subtitle={plan ? 'Plan : ' + plan.name : 'Journal alimentaire'} back="/client">
      <div style={{ padding: '12px 16px 110px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setDate(d => addDays(d, -1))} aria-label="Jour précédent" style={navBtn}><ChevronLeft size={20} /></button>
          <button onClick={() => setDate(new Date())} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: isToday ? 'var(--accent-text)' : 'var(--label)' }}>
            {isToday ? "Aujourd'hui" : date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </button>
          <button onClick={() => setDate(d => addDays(d, 1))} aria-label="Jour suivant" style={navBtn}><ChevronRight size={20} /></button>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <CalorieRing consumed={totals.calories} target={targets?.calories_target || 0} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              {MACROS.map(m => <MacroBar key={m.key} label={m.label} color={m.color} value={totals[m.key]} target={targets?.[m.targetKey] || 0} />)}
            </div>
          </div>
          <p data-testid="kcal-remaining" style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 13, color: remaining != null && remaining < 0 ? 'var(--red-text)' : 'var(--label2)' }}>
            {remaining == null
              ? 'Renseigne taille, poids, âge et activité dans ton profil pour estimer ton objectif.'
              : remaining >= 0 ? <>Il te reste <b style={{ color: 'var(--label)' }}>{remaining} kcal</b> aujourd'hui</> : <>Objectif dépassé de <b>{-remaining} kcal</b></>}
          </p>
          {targets?.estimated && <p style={{ margin: '4px 0 0', textAlign: 'center', fontSize: 11, color: 'var(--label3)' }}>Objectif estimé d'après ton profil (ton coach peut le personnaliser)</p>}
        </div>

        <button data-testid="ai-plan-link" onClick={() => navigate('/client/meal-plan')}
          style={{ width: '100%', marginBottom: 12, padding: '14px 16px', border: 'none', borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
            background: 'linear-gradient(135deg,#5e5ce6,#bf5af2)', color: 'white', boxShadow: '0 8px 22px rgba(94,92,230,.28)' }}>
          <span style={{ fontSize: 26 }}>✨</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 16, fontWeight: 700 }}>Plan repas IA</span>
            <span style={{ display: 'block', fontSize: 13, opacity: .9 }}>Selon tes calories, tes allergies et ton matériel</span>
          </span>
          <ChevronRight size={20} />
        </button>

        {!loading && logs.length === 0 && yesterdayLogs.length > 0 && (
          <button disabled={busy} onClick={() => copyYesterday(null)}
            style={{ width: '100%', marginBottom: 12, padding: '11px 0', background: 'rgba(99,102,241,0.12)', border: '1px dashed rgba(99,102,241,0.5)', borderRadius: 12, color: 'var(--accent-text)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Copy size={14} /> Reprendre la journée d'hier ({yesterdayLogs.length} aliments)
          </button>
        )}

        {loading ? <p style={{ textAlign: 'center', color: 'var(--label3)', fontSize: 13, padding: 30 }}>Chargement…</p> : mealNames.map(mealName => {
          const items = logs.filter(l => (l.meal_name || 'Autre') === mealName)
          const kcal = items.reduce((s, f) => s + (+f.calories || 0), 0)
          const yCount = yesterdayLogs.filter(l => (l.meal_name || 'Autre') === mealName).length
          return (
            <div key={mealName} data-testid="meal-section" style={{ background: 'var(--card)', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: items.length ? '1px solid var(--fill)' : 'none' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--label)', flex: 1 }}>{mealName}</span>
                <span style={{ fontSize: 12, color: 'var(--yellow-text)', fontWeight: 600 }}>{Math.round(kcal)} kcal</span>
                {items.length === 0 && yCount > 0 && (
                  <button onClick={() => copyYesterday(mealName)} disabled={busy} title="Copier depuis hier" aria-label={'Copier ' + mealName + ' d’hier'}
                    style={{ background: 'none', border: 'none', color: 'var(--label2)', cursor: 'pointer', padding: 4, display: 'flex' }}><Copy size={15} /></button>
                )}
                <button onClick={() => setAddMeal(mealName)} aria-label={'Ajouter à ' + mealName}
                  style={{ background: '#6366f1', border: 'none', borderRadius: 8, width: 28, height: 28, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
              </div>
              {items.map(food => (
                <div key={food.id} data-testid="food-log" style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '0.5px solid var(--separator)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{food.food_name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--label3)' }}>
                      {food.quantity} {food.unit} · <span style={{ color: 'var(--yellow-text)' }}>{Math.round(food.calories)} kcal</span> · P{round1(food.protein)} G{round1(food.carbs)} L{round1(food.fat)}
                    </p>
                  </div>
                  <button onClick={() => deleteLog(food.id)} aria-label={'Supprimer ' + food.food_name} style={{ background: 'none', border: 'none', color: '#ef444488', cursor: 'pointer', padding: 4 }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )
        })}

        {plan?.notes && (
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: '12px 14px', marginTop: 4 }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase' }}>Conseils de ton coach</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--label1b)', whiteSpace: 'pre-wrap' }}>{plan.notes}</p>
          </div>
        )}
      </div>

      {addMeal && <AddFoodSheet meal={addMeal} planMeals={planMeals} recents={recents} onClose={() => setAddMeal(null)} onAdd={addLog} />}
    </PageLayout>
  )
}

const navBtn = { background: 'var(--card)', border: 'none', borderRadius: 10, width: 36, height: 36, color: 'var(--label)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
