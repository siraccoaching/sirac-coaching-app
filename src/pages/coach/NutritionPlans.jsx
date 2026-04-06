import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp, Check, Pencil, Apple } from 'lucide-react'

const S = {
  input: { width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 14px', color:'white', fontSize:14, boxSizing:'border-box', WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset' },
  numInput: { width:'100%', background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:10, padding:'10px 12px', color:'white', fontSize:14, boxSizing:'border-box', textAlign:'center', WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset' },
}

const MACRO_COLORS = { cal:'#f59e0b', prot:'#6366f1', gluc:'#22c55e', lip:'#ef4444' }

function MacroBar({ label, value, color }) {
  return (
    <div style={{textAlign:'center'}}>
      <p style={{margin:'0 0 2px', fontSize:18, fontWeight:700, color}}>{value || 0}</p>
      <p style={{margin:0, fontSize:10, color:'#888'}}>{label}</p>
    </div>
  )
}

export default function NutritionPlans() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [activePlan, setActivePlan] = useState(null)
  const [meals, setMeals] = useState([])
  const [clients, setClients] = useState([])
  const [expandedMeals, setExpandedMeals] = useState({})
  const [planForm, setPlanForm] = useState(null)
  const [mealForm, setMealForm] = useState(null)
  const [foodForm, setFoodForm] = useState(null)
  const [assignModal, setAssignModal] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (profile?.id) { fetchPlans(); fetchClients() } }, [profile?.id])

  async function fetchPlans() {
    setLoading(true)
    const { data } = await supabase
      .from('nutrition_plans')
      .select('*, client:profiles!nutrition_plans_client_id_fkey(name)')
      .eq('coach_id', profile.id)
      .order('created_at', { ascending: false })
    setPlans(data || [])
    setLoading(false)
  }

  async function fetchClients() {
    const { data } = await supabase.from('profiles').select('id, name, sport')
      .eq('coach_id', profile.id).eq('role', 'client').order('name')
    setClients(data || [])
  }

  async function fetchMeals(planId) {
    const { data } = await supabase
      .from('nutrition_meals')
      .select('*, nutrition_foods(*)')
      .eq('plan_id', planId)
      .order('order_index')
    setMeals(data || [])
  }

  async function openPlan(plan) {
    setActivePlan(plan)
    await fetchMeals(plan.id)
    setView('detail')
  }

  async function savePlan(form) {
    setSaving(true)
    if (form.id) {
      const { data } = await supabase.from('nutrition_plans').update({
        name: form.name, calories_target: +form.calories_target || 0,
        protein_target: +form.protein_target || 0, carbs_target: +form.carbs_target || 0,
        fat_target: +form.fat_target || 0, notes: form.notes || null
      }).eq('id', form.id).select('*, client:profiles!nutrition_plans_client_id_fkey(name)').single()
      setPlans(prev => prev.map(p => p.id === form.id ? data : p))
      if (activePlan?.id === form.id) setActivePlan(data)
    } else {
      await supabase.from('nutrition_plans').insert({
        name: form.name, calories_target: +form.calories_target || 0,
        protein_target: +form.protein_target || 0, carbs_target: +form.carbs_target || 0,
        fat_target: +form.fat_target || 0, notes: form.notes || null,
        coach_id: profile.id
      })
      fetchPlans()
    }
    setPlanForm(null)
    setSaving(false)
  }

  async function deletePlan(id) {
    if (!confirm('Supprimer ce plan nutritionnel ?')) return
    await supabase.from('nutrition_plans').delete().eq('id', id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  async function assignPlan(clientId) {
    if (!assignModal) return
    setSaving(true)
    await supabase.from('nutrition_plans').update({ client_id: clientId || null }).eq('id', assignModal.id)
    await fetchPlans()
    setAssignModal(null)
    setSaving(false)
  }

  async function saveMeal(form) {
    setSaving(true)
    if (form.id) {
      await supabase.from('nutrition_meals').update({ name: form.name }).eq('id', form.id)
    } else {
      await supabase.from('nutrition_meals').insert({ plan_id: activePlan.id, name: form.name, order_index: meals.length })
    }
    await fetchMeals(activePlan.id)
    setMealForm(null)
    setSaving(false)
  }

  async function deleteMeal(id) {
    if (!confirm('Supprimer ce repas et ses aliments ?')) return
    await supabase.from('nutrition_meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  async function saveFood(form) {
    setSaving(true)
    const payload = {
      name: form.name, quantity: +form.quantity || 100, unit: form.unit || 'g',
      calories: +form.calories || 0, protein: +form.protein || 0,
      carbs: +form.carbs || 0, fat: +form.fat || 0
    }
    if (form.id) {
      await supabase.from('nutrition_foods').update(payload).eq('id', form.id)
    } else {
      await supabase.from('nutrition_foods').insert({ ...payload, meal_id: form.meal_id })
    }
    await fetchMeals(activePlan.id)
    setFoodForm(null)
    setSaving(false)
  }

  async function deleteFood(id) {
    await supabase.from('nutrition_foods').delete().eq('id', id)
    setMeals(prev => prev.map(m => ({ ...m, nutrition_foods: (m.nutrition_foods || []).filter(f => f.id !== id) })))
  }

  function planTotals(plan) {
    return { cal: plan.calories_target, prot: plan.protein_target, gluc: plan.carbs_target, lip: plan.fat_target }
  }

  const emptyPlanForm = { name: '', calories_target: '', protein_target: '', carbs_target: '', fat_target: '', notes: '' }

  if (view === 'detail' && activePlan) {
    const t = planTotals(activePlan)
    return (
      <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:80}}>
        <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10}}>
          <button onClick={() => { setView('list'); setActivePlan(null) }} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:4}}>
            <ArrowLeft size={20}/>
          </button>
          <h2 style={{margin:0, flex:1, fontSize:18}}>{activePlan.name}</h2>
          <button onClick={() => setPlanForm({ ...activePlan })} style={{background:'none', border:'none', color:'#888', cursor:'pointer', padding:4}}>
            <Pencil size={16}/>
          </button>
        </div>
        <div style={{margin:'12px 16px', background:'#1e1e2e', borderRadius:12, padding:'14px 16px'}}>
          <p style={{margin:'0 0 10px', fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.5px'}}>Objectifs journaliers</p>
          <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8}}>
            <MacroBar label="kcal" value={t.cal} color={MACRO_COLORS.cal}/>
            <MacroBar label="Prot. g" value={t.prot} color={MACRO_COLORS.prot}/>
            <MacroBar label="Gluc. g" value={t.gluc} color={MACRO_COLORS.gluc}/>
            <MacroBar label="Lip. g" value={t.lip} color={MACRO_COLORS.lip}/>
          </div>
          {activePlan.client && (
            <p style={{margin:'10px 0 0', fontSize:12, color:'#a78bfa', textAlign:'center'}}>👤 Assigné à {activePlan.client.name}</p>
          )}
        </div>
        <div style={{padding:'0 16px'}}>
          {meals.map(meal => {
            const foods = meal.nutrition_foods || []
            const mealCal = foods.reduce((s, f) => s + (f.calories || 0), 0)
            return (
              <div key={meal.id} style={{background:'#1e1e2e', borderRadius:12, marginBottom:10, overflow:'hidden'}}>
                <div style={{padding:'11px 14px', display:'flex', alignItems:'center', gap:8}}>
                  <button onClick={() => setExpandedMeals(e => ({ ...e, [meal.id]: !e[meal.id] }))}
                    style={{flex:1, display:'flex', alignItems:'center', gap:8, background:'none', border:'none', color:'white', cursor:'pointer', textAlign:'left', padding:0}}>
                    <p style={{margin:0, fontWeight:600, fontSize:14}}>{meal.name}</p>
                    <span style={{fontSize:11, color:'#888'}}>{foods.length} aliments · {mealCal} kcal</span>
                    {expandedMeals[meal.id] ? <ChevronUp size={14} color="#888"/> : <ChevronDown size={14} color="#888"/>}
                  </button>
                  <button onClick={() => setMealForm({ ...meal })} style={{background:'none', border:'none', color:'#888', cursor:'pointer', padding:4}}><Pencil size={13}/></button>
                  <button onClick={() => deleteMeal(meal.id)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:4}}><Trash2 size={13}/></button>
                </div>
                {expandedMeals[meal.id] && (
                  <div style={{borderTop:'1px solid #2a2a3e', padding:'8px 14px 12px'}}>
                    {foods.map(food => (
                      <div key={food.id} style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                        <div style={{flex:1}}>
                          <span style={{fontSize:13, color:'white', fontWeight:500}}>{food.name}</span>
                          <span style={{fontSize:11, color:'#888', marginLeft:6}}>{food.quantity}{food.unit}</span>
                          <span style={{fontSize:11, color:'#f59e0b', marginLeft:6}}>{food.calories}kcal</span>
                          <span style={{fontSize:11, color:'#6366f1', marginLeft:4}}>P{food.protein}g</span>
                          <span style={{fontSize:11, color:'#22c55e', marginLeft:4}}>G{food.carbs}g</span>
                          <span style={{fontSize:11, color:'#ef4444', marginLeft:4}}>L{food.fat}g</span>
                        </div>
                        <button onClick={() => setFoodForm({ ...food, meal_id: meal.id })} style={{background:'none', border:'none', color:'#888', cursor:'pointer', padding:2}}><Pencil size={12}/></button>
                        <button onClick={() => deleteFood(food.id)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:2}}><Trash2 size={12}/></button>
                      </div>
                    ))}
                    <button onClick={() => setFoodForm({ meal_id: meal.id, name:'', quantity:100, unit:'g', calories:0, protein:0, carbs:0, fat:0 })}
                      style={{display:'flex', alignItems:'center', gap:6, background:'none', border:'1px dashed #3a3a4e', borderRadius:8, padding:'6px 12px', color:'#888', cursor:'pointer', fontSize:12, marginTop:4, width:'100%', justifyContent:'center'}}>
                      <Plus size={12}/> Ajouter un aliment
                    </button>
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => setMealForm({ name: '' })}
            style={{display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'12px 0', background:'#1e1e2e', border:'1px dashed #3a3a4e', borderRadius:12, color:'#6366f1', cursor:'pointer', fontWeight:600, fontSize:14}}>
            <Plus size={16}/> Ajouter un repas
          </button>
        </div>
        {planForm && <PlanFormModal form={planForm} setForm={setPlanForm} onSave={savePlan} saving={saving}/>}
        {mealForm && (
          <BottomModal onClose={() => setMealForm(null)} title={mealForm.id ? 'Modifier le repas' : 'Nouveau repas'}>
            <input value={mealForm.name} onChange={e => setMealForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom du repas (ex: Petit-déjeuner)" style={{ ...S.input, marginBottom:14 }}/>
            <SaveCancelButtons onCancel={() => setMealForm(null)} onSave={() => saveMeal(mealForm)} disabled={!mealForm.name.trim() || saving}/>
          </BottomModal>
        )}
        {foodForm && (
          <BottomModal onClose={() => setFoodForm(null)} title={foodForm.id ? "Modifier l'aliment" : 'Ajouter un aliment'}>
            <input value={foodForm.name} onChange={e => setFoodForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom de l'aliment" style={{ ...S.input, marginBottom:10 }}/>
            <div style={{display:'grid', gridTemplateColumns:'2fr 1fr', gap:8, marginBottom:10}}>
              <input value={foodForm.quantity} onChange={e => setFoodForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="Quantité" type="number" style={S.numInput}/>
              <select value={foodForm.unit} onChange={e => setFoodForm(f => ({ ...f, unit: e.target.value }))}
                style={{ ...S.numInput, padding:'10px 8px' }}>
                {['g','ml','pièce','cuillère','portion'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <p style={{margin:'0 0 6px', fontSize:12, color:'#888'}}>Macros pour cette quantité :</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:14}}>
              {[['calories','kcal','#f59e0b'],['protein','Prot.','#6366f1'],['carbs','Gluc.','#22c55e'],['fat','Lip.','#ef4444']].map(([k,l,c]) => (
                <div key={k} style={{textAlign:'center'}}>
                  <p style={{margin:'0 0 4px', fontSize:10, color:c}}>{l}</p>
                  <input value={foodForm[k]} onChange={e => setFoodForm(f => ({ ...f, [k]: e.target.value }))}
                    type="number" style={{ ...S.numInput, fontSize:13 }}/>
                </div>
              ))}
            </div>
            <SaveCancelButtons onCancel={() => setFoodForm(null)} onSave={() => saveFood(foodForm)} disabled={!foodForm.name.trim() || saving}/>
          </BottomModal>
        )}
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:80}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:10}}>
        <button onClick={() => navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer', padding:4}}>
          <ArrowLeft size={20}/>
        </button>
        <h2 style={{margin:0, flex:1, fontSize:18}}>Plans nutritionnels</h2>
        <button onClick={() => setPlanForm(emptyPlanForm)}
          style={{background:'#6366f1', border:'none', borderRadius:10, padding:'8px 14px', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontWeight:600, fontSize:14}}>
          <Plus size={16}/> Nouveau
        </button>
      </div>
      <div style={{padding:'12px 16px'}}>
        {loading ? (
          [1,2].map(i => <div key={i} style={{height:100, background:'#1e1e2e', borderRadius:12, marginBottom:10, opacity: 0.5 + i*0.1}}/>)
        ) : plans.length === 0 ? (
          <div style={{textAlign:'center', marginTop:60, color:'#888'}}>
            <Apple size={44} style={{margin:'0 auto 14px', display:'block', opacity:0.3}}/>
            <p style={{fontSize:15, margin:'0 0 8px'}}>Aucun plan nutritionnel</p>
            <p style={{fontSize:12, margin:0}}>Crée un plan pour tes athlètes.</p>
          </div>
        ) : (
          plans.map(plan => {
            const t = planTotals(plan)
            return (
              <div key={plan.id} style={{background:'#1e1e2e', borderRadius:12, marginBottom:10, overflow:'hidden'}}>
                <button onClick={() => openPlan(plan)}
                  style={{width:'100%', padding:'14px 16px', background:'none', border:'none', color:'white', cursor:'pointer', textAlign:'left'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10}}>
                    <div>
                      <p style={{margin:0, fontWeight:700, fontSize:15}}>{plan.name}</p>
                      {plan.client ? (
                        <p style={{margin:'3px 0 0', fontSize:12, color:'#a78bfa'}}>👤 {plan.client.name}</p>
                      ) : (
                        <p style={{margin:'3px 0 0', fontSize:12, color:'#555'}}>Non assigné</p>
                      )}
                    </div>
                    <ChevronDown size={16} color="#666"/>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6}}>
                    {[['kcal', t.cal, MACRO_COLORS.cal],['P', t.prot, MACRO_COLORS.prot],['G', t.gluc, MACRO_COLORS.gluc],['L', t.lip, MACRO_COLORS.lip]].map(([l, v, c]) => (
                      <div key={l} style={{background:'#0f0f1a', borderRadius:8, padding:'6px 4px', textAlign:'center'}}>
                        <p style={{margin:0, fontSize:14, fontWeight:700, color:c}}>{v || 0}</p>
                        <p style={{margin:0, fontSize:10, color:'#666'}}>{l}</p>
                      </div>
                    ))}
                  </div>
                </button>
                <div style={{borderTop:'1px solid #2a2a3e', padding:'8px 12px', display:'flex', gap:8, justifyContent:'flex-end'}}>
                  <button onClick={(e) => { e.stopPropagation(); setAssignModal(plan) }}
                    style={{background:'none', border:'1px solid #3a3a4e', borderRadius:8, padding:'5px 12px', color:'#a78bfa', cursor:'pointer', fontSize:12, fontWeight:600}}>
                    {plan.client ? '🔄 Changer' : '+ Assigner'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); deletePlan(plan.id) }}
                    style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer', padding:'5px 8px'}}>
                    <Trash2 size={14}/>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
      {planForm && <PlanFormModal form={planForm} setForm={setPlanForm} onSave={savePlan} saving={saving}/>}
      {assignModal && (
        <BottomModal onClose={() => setAssignModal(null)} title="Assigner à un client" subtitle={`Plan : ${assignModal.name}`}>
          {assignModal.client_id && (
            <button onClick={() => assignPlan(null)} disabled={saving}
              style={{width:'100%', background:'#2a1a1a', border:'1px solid #ef444433', borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'pointer', color:'#ef4444', fontSize:13, fontWeight:600, opacity: saving ? 0.6 : 1}}>
              Retirer l'assignation
            </button>
          )}
          {clients.length === 0 ? (
            <p style={{color:'#888', textAlign:'center', padding:'16px 0'}}>Aucun client trouvé</p>
          ) : clients.map(c => (
            <button key={c.id} onClick={() => assignPlan(c.id)} disabled={saving}
              style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background: assignModal.client_id === c.id ? '#2d2b55' : '#252537', border:'1px solid ' + (assignModal.client_id === c.id ? '#6366f1' : '#3a3a4e'), borderRadius:10, padding:'12px 14px', marginBottom:8, cursor:'pointer', color:'white', textAlign:'left', opacity: saving ? 0.6 : 1}}>
              <div>
                <p style={{margin:0, fontWeight:600, fontSize:14}}>{c.name}</p>
                {c.sport && <p style={{margin:0, fontSize:12, color:'#888'}}>{c.sport}</p>}
              </div>
              {assignModal.client_id === c.id && <Check size={16} color="#6366f1"/>}
            </button>
          ))}
        </BottomModal>
      )}
    </div>
  )
}

function PlanFormModal({ form, setForm, onSave, saving }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <BottomModal onClose={() => setForm(null)} title={form.id ? 'Modifier le plan' : 'Nouveau plan nutritionnel'}>
      <input value={form.name} onChange={e => set('name', e.target.value)}
        placeholder="Nom du plan (ex: Prise de masse)" style={{ ...S.input, marginBottom:14 }}/>
      <p style={{margin:'0 0 8px', fontSize:13, color:'#aaa', fontWeight:600}}>Objectifs journaliers</p>
      <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14}}>
        {[['calories_target','kcal','#f59e0b'],['protein_target','Prot.','#6366f1'],['carbs_target','Gluc.','#22c55e'],['fat_target','Lip.','#ef4444']].map(([k,l,c]) => (
          <div key={k} style={{textAlign:'center'}}>
            <p style={{margin:'0 0 4px', fontSize:10, color:c, fontWeight:600}}>{l}</p>
            <input value={form[k]} onChange={e => set(k, e.target.value)} type="number" placeholder="0"
              style={{ ...S.numInput, fontSize:13 }}/>
          </div>
        ))}
      </div>
      <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)}
        placeholder="Notes / consignes (optionnel)" rows={2}
        style={{ ...S.input, resize:'none', marginBottom:14 }}/>
      <SaveCancelButtons onCancel={() => setForm(null)} onSave={() => onSave(form)} disabled={!form.name?.trim() || saving}/>
    </BottomModal>
  )
}

function BottomModal({ children, onClose, title, subtitle }) {
  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'flex-end'}}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{background:'#1e1e2e', width:'100%', borderRadius:'16px 16px 0 0', padding:'20px 16px', maxHeight:'85vh', overflowY:'auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: subtitle ? 2 : 16}}>
          <h3 style={{margin:0, fontSize:16, color:'white'}}>{title}</h3>
          <button onClick={onClose} style={{background:'none', border:'none', color:'#888', cursor:'pointer', fontSize:20, lineHeight:1}}>✕</button>
        </div>
        {subtitle && <p style={{margin:'0 0 14px', fontSize:12, color:'#888'}}>{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

function SaveCancelButtons({ onCancel, onSave, disabled }) {
  return (
    <div style={{display:'flex', gap:10}}>
      <button onClick={onCancel} style={{flex:1, padding:'11px 0', background:'#2a2a3e', border:'none', borderRadius:10, color:'#aaa', cursor:'pointer', fontSize:14}}>Annuler</button>
      <button onClick={onSave} disabled={disabled}
        style={{flex:2, padding:'11px 0', background: disabled ? '#3a3a4e' : '#6366f1', border:'none', borderRadius:10, color:'white', cursor: disabled ? 'default' : 'pointer', fontSize:14, fontWeight:600}}>
        Enregistrer
      </button>
    </div>
  )
}
