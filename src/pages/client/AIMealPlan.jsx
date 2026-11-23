import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout } from '../../components/Layout'
import { estimateTargets, localDateStr } from '../../lib/nutrition'
import { ALLERGENS, EQUIPMENT, DIETS, DAY_OPTIONS, MEALS_OPTIONS } from '../../lib/mealPlanOptions'
import { Sparkles, Clock, ChevronDown, ChevronUp, ShoppingCart, AlertTriangle, Plus, Check, History } from 'lucide-react'
import { haptic } from '../../lib/fx'

// Plan alimentaire personnalisé, généré selon l'objectif calorique, les allergies et le matériel de cuisine.
// Côté client (/client/meal-plan) pour lui-même, côté coach (/coach/client/:id/meal-plan) pour un client.
export default function AIMealPlan() {
  const { profile: me } = useAuth()
  const { id: clientParam } = useParams()
  const asCoach = !!clientParam
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    if (!me?.id) return
    if (!asCoach) { setProfile(me); return }
    supabase.from('profiles').select('*').eq('id', clientParam).single().then(({ data }) => setProfile(data))
  }, [me?.id, clientParam])
  const [coachTarget, setCoachTarget] = useState(null)
  const [kcal, setKcal] = useState('')
  const [allergies, setAllergies] = useState([])
  const [otherAllergies, setOtherAllergies] = useState('')
  const [equipment, setEquipment] = useState(['plaques', 'micro_ondes'])
  const [diet, setDiet] = useState('omnivore')
  const [dislikes, setDislikes] = useState('')
  const [days, setDays] = useState(3)
  const [meals, setMeals] = useState(4)
  const [history, setHistory] = useState([])
  const [current, setCurrent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(true)

  useEffect(() => { if (profile?.id) init() }, [profile?.id])

  async function init() {
    if (profile.allergies?.length) setAllergies(profile.allergies)
    if (profile.kitchen_equipment?.length) setEquipment(profile.kitchen_equipment)
    if (profile.diet) setDiet(profile.diet)
    if (profile.food_dislikes) setDislikes(profile.food_dislikes)
    const { data: plan } = await supabase.from('nutrition_plans').select('calories_target')
      .eq('client_id', profile.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const t = plan?.calories_target || estimateTargets(profile)?.calories_target
    if (plan?.calories_target) setCoachTarget(plan.calories_target)
    if (t) setKcal(String(Math.round(t)))
    const { data: hist } = await supabase.from('ai_meal_plans').select('*').eq('client_id', profile.id).order('created_at', { ascending: false }).limit(10)
    setHistory(hist || [])
    if (hist?.length) { setCurrent(hist[0]); setShowForm(false) }
  }

  const toggle = (list, set, key) => set(list.includes(key) ? list.filter(k => k !== key) : [...list, key])

  async function generate() {
    setError(''); setBusy(true); haptic(10)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ client_id: asCoach ? profile.id : undefined, target_kcal: Number(kcal), days, meals_per_day: meals, allergies, other_allergies: otherAllergies, equipment, diet, dislikes }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erreur ' + res.status)
      setCurrent(json.plan); setHistory(h => [json.plan, ...h]); setShowForm(false)
      haptic([20, 40, 20])
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Connexion impossible. Vérifie ton réseau.' : e.message)
    }
    setBusy(false)
  }

  const kcalOk = Number(kcal) >= 1000 && Number(kcal) <= 6000

  return (
    <PageLayout title="Plan alimentaire" subtitle={asCoach ? (profile?.name ? 'Pour ' + profile.name : 'Pour ton client') : 'Personnalisé selon tes besoins'} back={asCoach ? `/coach/client/${clientParam}` : '/client/nutrition'}>
      <div style={{ padding: '12px 16px 24px', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {current && !showForm && (
          <button onClick={() => setShowForm(true)} style={secondaryBtn}><Sparkles size={16} /> Générer un nouveau plan</button>
        )}

        {showForm && (
          <>
            <Section title="Objectif calorique">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input data-testid="ai-kcal" value={kcal} onChange={e => setKcal(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" disabled={!!coachTarget && !asCoach}
                  placeholder="2200" aria-label="Calories par jour" style={{ ...input, width: 120, fontSize: 20, fontWeight: 700, textAlign: 'center' }} />
                <span style={{ color: 'var(--label2)', fontSize: 15 }}>kcal / jour</span>
              </div>
              <p style={hint}>{asCoach ? (coachTarget ? 'Repris de son plan nutritionnel. Tu peux l’ajuster.' : 'Estimé d’après son profil. Tu peux l’ajuster.') : coachTarget ? 'Fixé par ton coach dans ton plan nutritionnel.' : kcal ? 'Estimé d’après ton profil. Tu peux l’ajuster.' : 'Renseigne ton profil (taille, poids…) ou saisis ton objectif.'}</p>
            </Section>

            <Section title="Allergies et intolérances">
              <Chips items={ALLERGENS} selected={allergies} onToggle={k => toggle(allergies, setAllergies, k)} tone="red" />
              <input value={otherAllergies} onChange={e => setOtherAllergies(e.target.value)} maxLength={200} placeholder="Autre allergie (ex : kiwi, fraise)…" style={{ ...input, marginTop: 10 }} aria-label="Autres allergies" />
            </Section>

            <Section title="Matériel de cuisine">
              <Chips items={EQUIPMENT} selected={equipment} onToggle={k => toggle(equipment, setEquipment, k)} />
              <p style={hint}>{equipment.length ? 'Les recettes n’utiliseront que ce matériel.' : 'Aucun matériel : uniquement des repas sans cuisson.'}</p>
            </Section>

            <Section title="Régime alimentaire">
              <Chips items={DIETS} selected={[diet]} onToggle={setDiet} />
              <input value={dislikes} onChange={e => setDislikes(e.target.value)} maxLength={200} placeholder="Aliments que tu n’aimes pas (optionnel)" style={{ ...input, marginTop: 10 }} aria-label="Aliments non aimés" />
            </Section>

            <Section title="Durée">
              <Segmented label="Jours" options={DAY_OPTIONS} value={days} onChange={setDays} fmt={d => d === 1 ? '1 jour' : d + ' jours'} />
              <div style={{ height: 10 }} />
              <Segmented label="Repas par jour" options={MEALS_OPTIONS} value={meals} onChange={setMeals} fmt={m => m + ' repas'} />
            </Section>

            {error && <p role="alert" style={{ margin: 0, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,59,48,0.12)', color: 'var(--red-text)', fontSize: 14 }}>{error}</p>}

            <button data-testid="ai-generate" onClick={generate} disabled={busy || !kcalOk}
              style={{ ...primaryBtn, opacity: busy || !kcalOk ? 0.6 : 1 }}>
              <Sparkles size={18} /> {busy ? 'Préparation de ton plan…' : 'Générer mon plan'}
            </button>
            {busy && <p style={{ ...hint, textAlign: 'center' }} className="ios-page">Composition des repas en cours. Cela prend de 20 secondes à 2 minutes, garde l’app ouverte.</p>}
            {current && !busy && <button onClick={() => setShowForm(false)} style={{ ...secondaryBtn, background: 'transparent' }}>Revenir à mon plan</button>}
          </>
        )}

        {current && !showForm && <PlanView row={current} profileId={profile?.id} canLog={!asCoach} />}

        {history.length > 1 && !showForm && (
          <Section title="Plans précédents">
            {history.map(h => (
              <button key={h.id} onClick={() => setCurrent(h)} style={{ ...rowBtn, fontWeight: h.id === current?.id ? 700 : 500 }}>
                <History size={15} color="var(--label2)" />
                <span style={{ flex: 1, textAlign: 'left' }}>{new Date(h.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {h.days} j · {h.target_kcal} kcal</span>
                {h.id === current?.id && <Check size={16} color="var(--accent-text)" />}
              </button>
            ))}
          </Section>
        )}
        <p style={{ ...hint, textAlign: 'center' }}>Plan proposé automatiquement, à titre indicatif. En cas d’allergie, vérifie toujours les étiquettes des produits.</p>
      </div>
    </PageLayout>
  )
}

function PlanView({ row, profileId, canLog }) {
  const plan = row.plan || {}
  const [day, setDay] = useState(0)
  const [open, setOpen] = useState({ 0: true })
  const [added, setAdded] = useState({})
  const [showList, setShowList] = useState(false)
  useEffect(() => { setDay(0); setOpen({ 0: true }); setAdded({}) }, [row.id])
  const d = plan.days?.[day]

  async function addToJournal(m, key) {
    const { error } = await supabase.from('nutrition_logs').insert({
      client_id: profileId, date: localDateStr(new Date()), meal_name: m.meal, food_name: m.title, quantity: 1, unit: 'portion',
      calories: m.macros.kcal, protein: m.macros.protein_g, carbs: m.macros.carbs_g, fat: m.macros.fat_g, source: 'ia',
    })
    if (error) { alert('Erreur : ' + error.message); return }
    haptic(12); setAdded(a => ({ ...a, [key]: true }))
  }

  return (
    <div data-testid="ai-plan" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ios-group" style={{ padding: 14 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>✨ Plan · {row.target_kcal} kcal / jour{row.preferences?.created_by === 'coach' ? ' · préparé par le coach' : ''}</p>
        <p style={{ margin: '6px 0 0', fontSize: 15, color: 'var(--label)', lineHeight: 1.4 }}>{plan.summary}</p>
        {row.preferences?.allergies?.length > 0 && (
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--label2)' }}>Sans : {row.preferences.allergies.map(k => ALLERGENS.find(a => a.key === k)?.label).filter(Boolean).join(', ')}</p>
        )}
      </div>

      {plan.warnings?.length > 0 && (
        <div role="alert" style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,149,0,0.14)', color: 'var(--orange-text)', fontSize: 13 }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>À vérifier : {plan.warnings.map(w => `${w.item} (${w.allergen})`).join(', ')}. Remplace ces ingrédients si besoin.</span>
        </div>
      )}

      {plan.days?.length > 1 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }} className="scrollbar-hide">
          {plan.days.map((x, i) => (
            <button key={i} onClick={() => { setDay(i); setOpen({ 0: true }) }}
              style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                background: i === day ? 'var(--accent)' : 'var(--card)', color: i === day ? 'white' : 'var(--label2)', boxShadow: 'var(--card-shadow)' }}>{x.day}</button>
          ))}
        </div>
      )}

      {d && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            {[['kcal', d.totals.kcal, ''], ['Prot.', d.totals.protein_g, ' g'], ['Gluc.', d.totals.carbs_g, ' g'], ['Lip.', d.totals.fat_g, ' g']].map(([l, v, u]) => (
              <div key={l} className="ios-group" style={{ padding: '10px 4px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--label)' }}>{v}{u}</p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--label2)' }}>{l}</p>
              </div>
            ))}
          </div>

          {d.meals.map((m, i) => {
            const key = `${day}-${i}`
            const isOpen = open[i]
            return (
              <div key={key} data-testid="ai-meal" className="ios-group" style={{ overflow: 'hidden' }}>
                <button onClick={() => setOpen(o => ({ ...o, [i]: !o[i] }))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.meal}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 600, color: 'var(--label)', lineHeight: 1.3 }}>{m.title}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--label2)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <b style={{ color: 'var(--yellow-text)' }}>{m.macros.kcal} kcal</b> · P {m.macros.protein_g} · G {m.macros.carbs_g} · L {m.macros.fat_g}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Clock size={12} />{m.prep_minutes} min</span>
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={18} color="var(--label2)" /> : <ChevronDown size={18} color="var(--label2)" />}
                </button>
                {isOpen && (
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {m.equipment?.length > 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--label2)' }}>🍳 {m.equipment.join(' · ')}</p>}
                    <div>
                      <p style={subTitle}>Ingrédients</p>
                      <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', color: 'var(--label)', fontSize: 14, lineHeight: 1.6 }}>
                        {m.ingredients.map((g, k) => <li key={k}><b>{g.quantity}</b> {g.item}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p style={subTitle}>Préparation</p>
                      <ol style={{ margin: 0, paddingLeft: 18, listStyle: 'decimal', color: 'var(--label)', fontSize: 14, lineHeight: 1.5 }}>
                        {m.steps.map((s, k) => <li key={k} style={{ marginBottom: 4 }}>{s}</li>)}
                      </ol>
                    </div>
                    {canLog && <button onClick={() => addToJournal(m, key)} disabled={added[key]}
                      style={{ ...secondaryBtn, padding: '10px 0', fontSize: 14, color: added[key] ? 'var(--green-text)' : 'var(--accent-text)' }}>
                      {added[key] ? <><Check size={16} /> Ajouté au journal du jour</> : <><Plus size={16} /> Ajouter à mon journal d’aujourd’hui</>}
                    </button>}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {plan.shopping_list?.length > 0 && (
        <div className="ios-group" style={{ overflow: 'hidden' }}>
          <button onClick={() => setShowList(s => !s)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--label)', fontSize: 16, fontWeight: 600 }}>
            <ShoppingCart size={18} color="var(--green-text)" /><span style={{ flex: 1, textAlign: 'left' }}>Liste de courses</span>
            {showList ? <ChevronUp size={18} color="var(--label2)" /> : <ChevronDown size={18} color="var(--label2)" />}
          </button>
          {showList && (
            <div style={{ padding: '0 14px 14px' }}>
              {plan.shopping_list.map((c, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <p style={subTitle}>{c.category}</p>
                  <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', color: 'var(--label)', fontSize: 14, lineHeight: 1.6 }}>{c.items.map((it, k) => <li key={k}>{it}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {plan.tips?.length > 0 && (
        <div className="ios-group" style={{ padding: 14 }}>
          <p style={subTitle}>Conseils</p>
          <ul style={{ margin: 0, paddingLeft: 18, listStyle: 'disc', color: 'var(--label)', fontSize: 14, lineHeight: 1.5 }}>{plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="ios-section-title">{title}</p>
      <div className="ios-group" style={{ padding: 14 }}>{children}</div>
    </div>
  )
}

function Chips({ items, selected, onToggle, tone }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {items.map(it => {
        const on = selected.includes(it.key)
        const activeBg = tone === 'red' ? 'rgba(255,59,48,0.14)' : 'var(--accent-soft)'
        const activeFg = tone === 'red' ? 'var(--red-text)' : 'var(--accent-text)'
        return (
          <button key={it.key} onClick={() => onToggle(it.key)} aria-pressed={on}
            style={{ padding: '8px 12px', borderRadius: 18, cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5,
              border: '1px solid ' + (on ? 'transparent' : 'var(--separator)'), background: on ? activeBg : 'transparent', color: on ? activeFg : 'var(--label)' }}>
            {it.emoji && <span>{it.emoji}</span>}{it.label}{on && <Check size={14} />}
          </button>
        )
      })}
    </div>
  )
}

function Segmented({ label, options, value, onChange, fmt }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--label2)' }}>{label}</p>
      <div style={{ display: 'flex', background: 'var(--fill)', borderRadius: 10, padding: 2, gap: 2 }} role="radiogroup" aria-label={label}>
        {options.map(o => (
          <button key={o} role="radio" aria-checked={o === value} onClick={() => onChange(o)}
            style={{ flex: 1, border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              background: o === value ? 'var(--segment)' : 'transparent', color: o === value ? 'var(--label)' : 'var(--label2)', boxShadow: o === value ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{fmt(o)}</button>
        ))}
      </div>
    </div>
  )
}

const input = { width: '100%', boxSizing: 'border-box', background: 'var(--fill)', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 16, color: 'var(--label)', outline: 'none', WebkitTextFillColor: 'var(--label)' }
const hint = { margin: '8px 0 0', fontSize: 13, color: 'var(--label2)' }
const subTitle = { margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--label2)', textTransform: 'uppercase', letterSpacing: '.04em' }
const primaryBtn = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 16, padding: '16px 0', fontSize: 17, fontWeight: 700, color: 'white', cursor: 'pointer', background: 'linear-gradient(135deg,#5e5ce6,#bf5af2)', boxShadow: '0 10px 26px rgba(94,92,230,.3)' }
const secondaryBtn = { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 14, padding: '13px 0', fontSize: 15, fontWeight: 600, color: 'var(--accent-text)', cursor: 'pointer', background: 'var(--accent-soft)' }
const rowBtn = { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', background: 'none', border: 'none', borderBottom: '0.5px solid var(--separator)', cursor: 'pointer', color: 'var(--label)', fontSize: 14 }
