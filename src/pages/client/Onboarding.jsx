import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/hooks'
import { ChevronRight } from 'lucide-react'

const STEPS = [
  { id: 'sport', title: 'Ton sport', subtitle: 'On adapte ton programme à ta discipline' },
  { id: 'goals', title: 'Tes objectifs', subtitle: 'Pour personnaliser ton suivi' },
  { id: 'body', title: 'Ton profil physique', subtitle: 'Pour suivre ton évolution' },
  { id: 'history', title: 'Historique sportif', subtitle: 'Pour mieux te connaître' },
]

const SPORTS = ['Rugby','Football','Basketball','Tennis','Natation','Cyclisme','Fitness / Musculation','CrossFit','Athlétisme','Arts martiaux','Autre']
const GOALS = ['Prise de masse','Perte de poids','Performance sportive','Force maximale','Endurance','Souplesse & mobilité','Rééducation / Santé']
const LEVELS = ['Débutant (< 1 an)', 'Intermédiaire (1–3 ans)', 'Avancé (3–5 ans)', 'Expert (5+ ans)']
const FREQS = ['1 fois / semaine','2 fois / semaine','3 fois / semaine','4+ fois / semaine']

export default function Onboarding() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState({
    sport: '', position: '', selectedGoals: [], weight: '', height: '',
    injuries: '', level: '', frequency: '', notes: ''
  })
  const set = (k, v) => setData(d => ({ ...d, [k]: v }))
  const toggleGoal = (g) => setData(d => ({
    ...d, selectedGoals: d.selectedGoals.includes(g) ? d.selectedGoals.filter(x=>x!==g) : [...d.selectedGoals, g]
  }))

  async function finish() {
    setSaving(true)
    await supabase.from('profiles').update({
      sport: data.sport, position: data.position,
      goals: data.selectedGoals.join(', '),
      weight: parseFloat(data.weight) || null,
      height: parseFloat(data.height) || null,
      injury_history: data.injuries,
      level: data.level, training_frequency: data.frequency,
      onboarding_notes: data.notes, onboarding_done: true
    }).eq('id', profile.id)
    setSaving(false)
    navigate('/client')
  }

  const inp = {background:'#2a2a3e',border:'1px solid #3a3a4e',borderRadius:12,padding:'12px 14px',color:'white',fontSize:14,width:'100%',boxSizing:'border-box',outline:'none',WebkitTextFillColor:'white',WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}
  const chip = (selected) => ({ padding:'8px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:13,fontWeight:600, background:selected?'#6366f1':'#2a2a3e', color:selected?'white':'#aaa' })

  const current = STEPS[step]

  return (
    <div style={{minHeight:'100vh',background:'#0f0f1a',color:'white',display:'flex',flexDirection:'column'}}>
      {/* Progress bar */}
      <div style={{height:3,background:'#1e1e2e'}}>
        <div style={{height:'100%',background:'#6366f1',transition:'width 0.3s',width:((step+1)/STEPS.length*100)+'%'}}/>
      </div>

      <div style={{flex:1,padding:'24px 20px',display:'flex',flexDirection:'column'}}>
        <p style={{margin:'0 0 4px',fontSize:12,color:'#888'}}>{step+1} / {STEPS.length}</p>
        <h2 style={{margin:'0 0 6px',fontSize:22,fontWeight:700}}>{current.title}</h2>
        <p style={{margin:'0 0 28px',color:'#888',fontSize:14}}>{current.subtitle}</p>

        {step === 0 && (
          <div>
            <p style={{margin:'0 0 10px',fontSize:13,color:'#ccc',fontWeight:600}}>Sport</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
              {SPORTS.map(s=><button key={s} onClick={()=>set('sport',s)} style={chip(data.sport===s)}>{s}</button>)}
            </div>
            <p style={{margin:'0 0 8px',fontSize:13,color:'#ccc',fontWeight:600}}>Poste / spécialité (optionnel)</p>
            <input value={data.position} onChange={e=>set('position',e.target.value)} placeholder="Ex : Pilier, Milieu de terrain, Gardien..." style={inp}/>
          </div>
        )}

        {step === 1 && (
          <div>
            <p style={{margin:'0 0 10px',fontSize:13,color:'#ccc',fontWeight:600}}>Objectifs (plusieurs possibles)</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
              {GOALS.map(g=><button key={g} onClick={()=>toggleGoal(g)} style={chip(data.selectedGoals.includes(g))}>{g}</button>)}
            </div>
            <p style={{margin:'0 0 8px',fontSize:13,color:'#ccc',fontWeight:600}}>Fréquence d'entraînement souhaitée</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
              {FREQS.map(f=><button key={f} onClick={()=>set('frequency',f)} style={chip(data.frequency===f)}>{f}</button>)}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
              <div>
                <p style={{margin:'0 0 6px',fontSize:13,color:'#ccc'}}>Poids (kg)</p>
                <input type="number" inputMode="decimal" value={data.weight} onChange={e=>set('weight',e.target.value)} placeholder="75" style={inp}/>
              </div>
              <div>
                <p style={{margin:'0 0 6px',fontSize:13,color:'#ccc'}}>Taille (cm)</p>
                <input type="number" inputMode="decimal" value={data.height} onChange={e=>set('height',e.target.value)} placeholder="180" style={inp}/>
              </div>
            </div>
            <p style={{margin:'0 0 8px',fontSize:13,color:'#ccc',fontWeight:600}}>Blessures / antécédents (optionnel)</p>
            <textarea value={data.injuries} onChange={e=>set('injuries',e.target.value)} placeholder="Ex : Entorse cheville 2023, douleurs lombaires..." rows={3}
              style={{...inp,resize:'none',WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}}/>
          </div>
        )}

        {step === 3 && (
          <div>
            <p style={{margin:'0 0 10px',fontSize:13,color:'#ccc',fontWeight:600}}>Niveau d'expérience</p>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
              {LEVELS.map(l=><button key={l} onClick={()=>set('level',l)} style={chip(data.level===l)}>{l}</button>)}
            </div>
            <p style={{margin:'0 0 8px',fontSize:13,color:'#ccc',fontWeight:600}}>Notes pour ton coach (optionnel)</p>
            <textarea value={data.notes} onChange={e=>set('notes',e.target.value)} placeholder="Informations supplémentaires que tu veux partager..." rows={3}
              style={{...inp,resize:'none',WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}}/>
          </div>
        )}

        <div style={{marginTop:'auto',paddingTop:24}}>
          {step < STEPS.length - 1 ? (
            <button onClick={()=>setStep(s=>s+1)}
              style={{width:'100%',padding:'14px 0',background:'#6366f1',border:'none',borderRadius:14,color:'white',fontSize:16,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              Continuer <ChevronRight size={18}/>
            </button>
          ) : (
            <button onClick={finish} disabled={saving}
              style={{width:'100%',padding:'14px 0',background:saving?'#3a3a4e':'linear-gradient(135deg,#6366f1,#8b5cf6)',border:'none',borderRadius:14,color:'white',fontSize:16,fontWeight:700,cursor:saving?'default':'pointer'}}>
              {saving ? 'Enregistrement...' : 'Terminer et accéder à mon espace 🚀'}
            </button>
          )}
          {step > 0 && (
            <button onClick={()=>setStep(s=>s-1)} style={{width:'100%',marginTop:10,padding:'10px 0',background:'transparent',border:'none',color:'#666',fontSize:13,cursor:'pointer'}}>
              Retour
            </button>
          )}
          <button onClick={()=>navigate('/client')} style={{width:'100%',marginTop:6,padding:'10px 0',background:'transparent',border:'none',color:'#555',fontSize:12,cursor:'pointer'}}>
            Passer pour l'instant
          </button>
        </div>
      </div>
    </div>
  )
}
