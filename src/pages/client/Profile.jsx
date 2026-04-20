import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { PageLayout } from '../../components/Layout'
import { Save, Zap } from 'lucide-react'

const ACTIVITY_LEVELS = [
  { value: 'sedentaire',  label: 'Sedentaire',          desc: 'Peu ou pas d\'exercice',         mult: 1.2   },
  { value: 'leger',       label: 'Legerement actif',     desc: '1-3 seances / semaine',           mult: 1.375 },
  { value: 'modere',      label: 'Moderement actif',     desc: '3-5 seances / semaine',           mult: 1.55  },
  { value: 'tres_actif',  label: 'Tres actif',           desc: '6-7 seances / semaine',           mult: 1.725 },
]

function calcAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const b = new Date(birthDate)
  let age = today.getFullYear() - b.getFullYear()
  if (today < new Date(today.getFullYear(), b.getMonth(), b.getDate())) age--
  return age
}

function calcBMR(weight, height, age, sex) {
  if (!weight || !height || !age || !sex) return null
  const base = 10 * weight + 6.25 * height - 5 * age
  return Math.round(sex === 'homme' ? base + 5 : base - 161)
}

function calcTDEE(bmr, activityLevel) {
  if (!bmr || !activityLevel) return null
  const level = ACTIVITY_LEVELS.find(a => a.value === activityLevel)
  return level ? Math.round(bmr * level.mult) : null
}

export default function Profile() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name:'', height:'', weight:'', birth_date:'', sex:'', activity_level:'' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        name:           profile.name           || '',
        height:         profile.height         || '',
        weight:         profile.weight         || '',
        birth_date:     profile.birth_date     || '',
        sex:            profile.sex            || '',
        activity_level: profile.activity_level || '',
      })
    }
  }, [profile])

  const age  = calcAge(form.birth_date)
  const bmr  = calcBMR(Number(form.weight), Number(form.height), age, form.sex)
  const tdee = calcTDEE(bmr, form.activity_level)

  async function save() {
    setSaving(true)
    await supabase.from('profiles').update({
      name: form.name || null,
      height: form.height ? Number(form.height) : null,
      weight: form.weight ? Number(form.weight) : null,
      birth_date: form.birth_date || null,
      sex: form.sex || null,
      activity_level: form.activity_level || null,
    }).eq('id', profile.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const inp = { background:'#1e1e2e', border:'1px solid #2a2a3e', borderRadius:10, padding:'10px 14px', color:'white', fontSize:14, width:'100%', outline:'none' }
  const lbl = { fontSize:12, color:'#888', marginBottom:4, display:'block' }

  return (
    <PageLayout title="Mon profil" back="/client">
      <div style={{padding:'16px 16px 100px', display:'flex', flexDirection:'column', gap:16}}>

        <div style={{background:'#1e1e2e', borderRadius:16, padding:16}}>
          <p style={{margin:'0 0 12px', fontWeight:700, fontSize:14, color:'#a78bfa'}}>Identite</p>
          <div style={{display:'flex', flexDirection:'column', gap:10}}>
            <div>
              <label style={lbl}>Prenom / Nom</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ton nom"/>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
              <div>
                <label style={lbl}>Date de naissance</label>
                <input type="date" style={inp} value={form.birth_date} onChange={e => setForm(f => ({...f, birth_date: e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>Sexe</label>
                <select style={{...inp, cursor:'pointer'}} value={form.sex} onChange={e => setForm(f => ({...f, sex: e.target.value}))}>
                  <option value="">--</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div style={{background:'#1e1e2e', borderRadius:16, padding:16}}>
          <p style={{margin:'0 0 12px', fontWeight:700, fontSize:14, color:'#6366f1'}}>Mensurations</p>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div>
              <label style={lbl}>Taille (cm)</label>
              <input type="number" style={inp} value={form.height} placeholder="175" onChange={e => setForm(f => ({...f, height: e.target.value}))}/>
            </div>
            <div>
              <label style={lbl}>Poids (kg)</label>
              <input type="number" style={inp} value={form.weight} placeholder="70" onChange={e => setForm(f => ({...f, weight: e.target.value}))}/>
            </div>
          </div>
        </div>

        <div style={{background:'#1e1e2e', borderRadius:16, padding:16}}>
          <p style={{margin:'0 0 12px', fontWeight:700, fontSize:14, color:'#22c55e'}}>Niveau d\'activite</p>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {ACTIVITY_LEVELS.map(a => (
              <button key={a.value} onClick={() => setForm(f => ({...f, activity_level: a.value}))}
                style={{background: form.activity_level === a.value ? '#14532d' : '#12121f',
                  border: '1px solid ' + (form.activity_level === a.value ? '#22c55e' : '#2a2a3e'),
                  borderRadius:10, padding:'10px 14px', cursor:'pointer',
                  display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div style={{textAlign:'left'}}>
                  <p style={{margin:0, fontSize:13, fontWeight:600, color: form.activity_level === a.value ? '#22c55e' : 'white'}}>{a.label}</p>
                  <p style={{margin:0, fontSize:11, color:'#666'}}>{a.desc}</p>
                </div>
                <p style={{margin:0, fontSize:11, color:'#555'}}>x{a.mult}</p>
              </button>
            ))}
          </div>
        </div>

        {tdee ? (
          <div style={{background:'linear-gradient(135deg,#1a1a3e,#0f1f3d)', border:'1px solid #6366f1', borderRadius:16, padding:20}}>
            <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:14}}>
              <Zap size={18} color="#f59e0b"/>
              <p style={{margin:0, fontWeight:700, fontSize:15}}>Tes besoins caloriques</p>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
              <div style={{background:'rgba(255,255,255,0.04)', borderRadius:12, padding:12, textAlign:'center'}}>
                <p style={{margin:0, fontSize:11, color:'#888', marginBottom:4}}>Metabolisme de base</p>
                <p style={{margin:0, fontSize:22, fontWeight:800, color:'#a78bfa'}}>{bmr}</p>
                <p style={{margin:0, fontSize:10, color:'#666'}}>kcal / jour</p>
              </div>
              <div style={{background:'rgba(255,255,255,0.06)', borderRadius:12, padding:12, textAlign:'center', border:'1px solid #6366f133'}}>
                <p style={{margin:0, fontSize:11, color:'#888', marginBottom:4}}>Depense totale (TDEE)</p>
                <p style={{margin:0, fontSize:22, fontWeight:800, color:'#6366f1'}}>{tdee}</p>
                <p style={{margin:0, fontSize:10, color:'#666'}}>kcal / jour</p>
              </div>
            </div>
            <p style={{margin:'12px 0 0', fontSize:11, color:'#555', textAlign:'center'}}>Formule Mifflin-St Jeor · {age} ans · {form.sex}</p>
          </div>
        ) : (
          <div style={{background:'#1e1e2e', borderRadius:12, padding:16, textAlign:'center', border:'1px dashed #2a2a3e'}}>
            <p style={{margin:0, fontSize:13, color:'#555'}}>Remplis taille, poids, date de naissance, sexe et niveau d\'activite pour voir tes besoins caloriques</p>
          </div>
        )}

        <button onClick={save} disabled={saving}
          style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:14, padding:16, color:'white', fontSize:15, fontWeight:700, cursor:'pointer'}}>
          {saving ? 'Enregistrement...' : saved ? 'Enregistre !' : 'Sauvegarder'}
        </button>

      </div>
    </PageLayout>
  )
}
