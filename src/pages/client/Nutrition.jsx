import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { ChevronLeft, ChevronRight, Plus, Trash2, ChevronDown, ChevronUp, Apple } from 'lucide-react'

const MACROS = [
  { key: 'calories', label: 'Calories', unit: 'kcal', color: '#f59e0b', targetKey: 'calories_target' },
  { key: 'protein',  label: 'Protéines', unit: 'g',   color: '#6366f1', targetKey: 'protein_target' },
  { key: 'carbs',    label: 'Glucides',  unit: 'g',   color: '#22c55e', targetKey: 'carbs_target' },
  { key: 'fat',      label: 'Lipides',   unit: 'g',   color: '#ef4444', targetKey: 'fat_target' },
]

const S = {
  input: { width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 14px', color:'white', fontSize:14, boxSizing:'border-box', WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset' },
  numInput: { width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 12px', color:'white', fontSize:14, boxSizing:'border-box', textAlign:'center', WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset' },
}

function fmt(d) {
  return d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' })
}

function MacroCircle({ label, unit, color, consumed, target }) {
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0
  const r = 28, circ = 2 * Math.PI * r
  const dash = circ * pct
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
      <div style={{position:'relative', width:72, height:72}}>
        <svg width={72} height={72} style={{transform:'rotate(-90deg)'}}>
          <circle cx={36} cy={36} r={r} fill="none" stroke="#2a2a3e" strokeWidth={6}/>
          <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{transition:'stroke-dasharray 0.5s ease'}}/>
        </svg>
        <div style={{position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center'}}>
          <span style={{fontSize:13, fontWeight:700, color}}>{Math.round(consumed)}</span>
          <span style={{fontSize:9, color:'#888'}}>{unit}</span>
        </div>
      </div>
      <div style={{textAlign:'center'}}>
        <p style={{margin:0, fontSize:11, color:'#ccc', fontWeight:600}}>{label}</p>
        <p style={{margin:0, fontSize:10, color:'#666'}}>/ {target} {unit}</p>
      </div>
    </div>
  )
}

export default function Nutrition() {
  const { profile } = useAuth()
  const [date, setDate] = useState(new Date())
  const [plan, setPlan] = useState(null)
  const [planMeals, setPlanMeals] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [expandCopy, setExpandCopy] = useState(false)
  const [form, setForm] = useState({ meal_name:'', food_name:'', quantity:100, unit:'g', calories:0, protein:0, carbs:0, fat:0 })
  const [saving, setSaving] = useState(false)

  const dateStr = date.toISOString().slice(0, 10)

  useEffect(() => { if (profile?.id) { loadPlan(); } }, [profile?.id])
  useEffect(() => { if (profile?.id) { loadLogs(); } }, [profile?.id, dateStr])

  async function loadPlan() {
    const { data } = await supabase
      .from('nutrition_plans')
      .select('*, nutrition_meals(*, nutrition_foods(*))')
      .eq('client_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setPlan(data || null)
    setPlanMeals(data?.nutrition_meals || [])
  }

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('nutrition_logs')
      .select('*')
      .eq('client_id', profile.id)
      .eq('date', dateStr)
      .order('created_at')
    setLogs(data || [])
    setLoading(false)
  }

  function prevDay() { const d = new Date(date); d.setDate(d.getDate()-1); setDate(d) }
  function nextDay() { const d = new Date(date); d.setDate(d.getDate()+1); setDate(d) }
  const isToday = dateStr === new Date().toISOString().slice(0,10)

  // Totals
  const totals = logs.reduce((acc, l) => {
    acc.calories += l.calories || 0
    acc.protein  += l.protein  || 0
    acc.carbs    += l.carbs    || 0
    acc.fat      += l.fat      || 0
    return acc
  }, { calories:0, protein:0, carbs:0, fat:0 })

  // Logs grouped by meal
  const byMeal = logs.reduce((acc, l) => {
    const m = l.meal_name || 'Autre'
    if (!acc[m]) acc[m] = []
    acc[m].push(l)
    return acc
  }, {})

  async function addLog() {
    if (!form.food_name.trim()) return
    setSaving(true)
    await supabase.from('nutrition_logs').insert({
      client_id: profile.id, date: dateStr,
      meal_name: form.meal_name || 'Repas', food_name: form.food_name,
      quantity: +form.quantity || 100, unit: form.unit || 'g',
      calories: +form.calories || 0, protein: +form.protein || 0,
      carbs: +form.carbs || 0, fat: +form.fat || 0
    })
    await loadLogs()
    setAddModal(false)
    setForm({ meal_name:'', food_name:'', quantity:100, unit:'g', calories:0, protein:0, carbs:0, fat:0 })
    setSaving(false)
  }

  async function deleteLog(id) {
    await supabase.from('nutrition_logs').delete().eq('id', id)
    setLogs(prev => prev.filter(l => l.id !== id))
  }

  function prefillFromFood(food, mealName) {
    setForm(f => ({
      ...f,
      meal_name: mealName || f.meal_name,
      food_name: food.name,
      quantity: food.quantity || 100,
      unit: food.unit || 'g',
      calories: food.calories || 0,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
    }))
    setExpandCopy(false)
  }

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:100}}>
      {/* Header */}
      <div style={{background:'#1e1e2e', padding:'16px 20px', position:'sticky', top:0, zIndex:10}}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10}}>
          <h2 style={{margin:0, fontSize:18}}>Nutrition</h2>
          {plan && <span style={{fontSize:12, color:'#a78bfa', background:'#2d2b55', padding:'3px 10px', borderRadius:20}}>{plan.name}</span>}
        </div>
        {/* Date nav */}
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:16}}>
          <button onClick={prevDay} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:4}}><ChevronLeft size={20}/></button>
          <span style={{fontSize:14, fontWeight:600, color: isToday ? '#6366f1' : 'white', minWidth:200, textAlign:'center'}}>
            {isToday ? "Aujourd'hui" : fmt(date)}
          </span>
          <button onClick={nextDay} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:4}}><ChevronRight size={20}/></button>
        </div>
      </div>

      {/* Macro circles */}
      <div style={{margin:'12px 16px', background:'#1e1e2e', borderRadius:12, padding:'16px 8px'}}>
        <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:4}}>
          {MACROS.map(m => (
            <MacroCircle key={m.key} label={m.label} unit={m.unit} color={m.color}
              consumed={totals[m.key]} target={plan ? plan[m.targetKey] || 0 : 0}/>
          ))}
        </div>
        {!plan && (
          <p style={{margin:'12px 0 0', textAlign:'center', fontSize:12, color:'#666'}}>Aucun plan nutritionnel assigné</p>
        )}
      </div>

      {/* Food log by meal */}
      <div style={{padding:'0 16px'}}>
        {loading ? (
          <div style={{textAlign:'center', padding:'30px 0', color:'#666', fontSize:13}}>Chargement...</div>
        ) : Object.keys(byMeal).length === 0 ? (
          <div style={{textAlign:'center', padding:'30px 0'}}>
            <Apple size={36} style={{margin:'0 auto 10px', display:'block', opacity:0.2}}/>
            <p style={{color:'#666', fontSize:13, margin:0}}>Rien de loggé ce jour</p>
          </div>
        ) : (
          Object.entries(byMeal).map(([mealName, foods]) => {
            const mealCal = foods.reduce((s, f) => s + (f.calories || 0), 0)
            return (
              <div key={mealName} style={{background:'#1e1e2e', borderRadius:12, marginBottom:10, overflow:'hidden'}}>
                <div style={{padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #2a2a3e'}}>
                  <span style={{fontWeight:600, fontSize:14}}>{mealName}</span>
                  <span style={{fontSize:12, color:'#f59e0b'}}>{Math.round(mealCal)} kcal</span>
                </div>
                {foods.map(food => (
                  <div key={food.id} style={{padding:'8px 14px', display:'flex', alignItems:'center', gap:6, borderBottom:'1px solid #1a1a2e'}}>
                    <div style={{flex:1}}>
                      <span style={{fontSize:13, color:'white', fontWeight:500}}>{food.food_name}</span>
                      <span style={{fontSize:11, color:'#888', marginLeft:6}}>{food.quantity}{food.unit}</span>
                      <span style={{fontSize:11, color:'#f59e0b', marginLeft:6}}>{food.calories}kcal</span>
                      <span style={{fontSize:11, color:'#6366f1', marginLeft:4}}>P{food.protein}g</span>
                      <span style={{fontSize:11, color:'#22c55e', marginLeft:4}}>G{food.carbs}g</span>
                      <span style={{fontSize:11, color:'#ef4444', marginLeft:4}}>L{food.fat}g</span>
                    </div>
                    <button onClick={() => deleteLog(food.id)} style={{background:'none', border:'none', color:'#ef444466', cursor:'pointer', padding:2}}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setAddModal(true)}
        style={{position:'fixed', bottom:80, right:20, width:52, height:52, borderRadius:26, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', color:'white', fontSize:26, cursor:'pointer', boxShadow:'0 4px 20px #6366f166', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50}}>
        <Plus size={24}/>
      </button>

      {/* Add food modal */}
      {addModal && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'flex-end'}}
          onClick={e => { if (e.target === e.currentTarget) setAddModal(false) }}>
          <div style={{background:'#1e1e2e', width:'100%', borderRadius:'16px 16px 0 0', padding:'20px 16px', maxHeight:'90vh', overflowY:'auto'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
              <h3 style={{margin:0, fontSize:16}}>Ajouter un aliment</h3>
              <button onClick={() => setAddModal(false)} style={{background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:20}}>✕</button>
            </div>

            {/* Meal selector */}
            {planMeals.length > 0 ? (
              <div style={{marginBottom:10}}>
                <p style={{margin:'0 0 6px', fontSize:12, color:'#888'}}>Repas</p>
                <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                  {planMeals.map(m => (
                    <button key={m.id} onClick={() => setForm(f => ({ ...f, meal_name: m.name }))}
                      style={{padding:'6px 12px', borderRadius:20, border:'1px solid ' + (form.meal_name === m.name ? '#6366f1' : '#3a3a4e'),
                        background: form.meal_name === m.name ? '#2d2b55' : 'transparent', color: form.meal_name === m.name ? '#a78bfa' : '#888', cursor:'pointer', fontSize:12}}>
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <input value={form.meal_name} onChange={e => setForm(f => ({ ...f, meal_name: e.target.value }))}
                placeholder="Nom du repas" style={{ ...S.input, marginBottom:10 }}/>
            )}

            <input value={form.food_name} onChange={e => setForm(f => ({ ...f, food_name: e.target.value }))}
              placeholder="Nom de l'aliment" style={{ ...S.input, marginBottom:10 }}/>

            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:8, marginBottom:10}}>
              <input value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                type="number" placeholder="Quantité" style={S.numInput}/>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                style={{ ...S.numInput, padding:'10px 8px' }}>
                {['g','ml','pièce','cuillère','portion'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:14}}>
              {MACROS.map(m => (
                <div key={m.key} style={{textAlign:'center'}}>
                  <p style={{margin:'0 0 4px', fontSize:10, color:m.color}}>{m.label.slice(0,4)}.</p>
                  <input value={form[m.key]} onChange={e => setForm(f => ({ ...f, [m.key]: e.target.value }))}
                    type="number" style={{ ...S.numInput, fontSize:13 }}/>
                </div>
              ))}
            </div>

            {/* Copy from plan */}
            {plan && planMeals.length > 0 && (
              <div style={{marginBottom:14}}>
                <button onClick={() => setExpandCopy(v => !v)}
                  style={{display:'flex', alignItems:'center', gap:6, background:'none', border:'1px solid #3a3a4e', borderRadius:8, padding:'7px 12px', color:'#888', cursor:'pointer', fontSize:12, width:'100%', justifyContent:'center'}}>
                  {expandCopy ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  Copier depuis mon plan
                </button>
                {expandCopy && (
                  <div style={{marginTop:8, maxHeight:200, overflowY:'auto'}}>
                    {planMeals.map(meal => (
                      <div key={meal.id}>
                        <p style={{margin:'6px 0 4px', fontSize:11, color:'#6366f1', fontWeight:600}}>{meal.name}</p>
                        {(meal.nutrition_foods || []).map(food => (
                          <button key={food.id} onClick={() => prefillFromFood(food, meal.name)}
                            style={{display:'block', width:'100%', textAlign:'left', background:'#252537', border:'none', borderRadius:8, padding:'7px 10px', marginBottom:4, cursor:'pointer', color:'white', fontSize:12}}>
                            {food.name} <span style={{color:'#888'}}>{food.quantity}{food.unit} · {food.calories}kcal</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{display:'flex', gap:10}}>
              <button onClick={() => setAddModal(false)}
                style={{flex:1, padding:'11px 0', background:'#2a2a3e', border:'none', borderRadius:10, color:'#aaa', cursor:'pointer', fontSize:14}}>Annuler</button>
              <button onClick={addLog} disabled={!form.food_name.trim() || saving}
                style={{flex:2, padding:'11px 0', background: (!form.food_name.trim() || saving) ? '#3a3a4e' : '#6366f1', border:'none', borderRadius:10, color:'white', cursor: (!form.food_name.trim() || saving) ? 'default' : 'pointer', fontSize:14, fontWeight:600}}>
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
