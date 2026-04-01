import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, Dumbbell, Zap, Heart, Target } from 'lucide-react'

// Template library organized by sport
export const PROGRAM_TEMPLATES = {
  rugby: {
    label: 'Rugby', icon: '🏉',
    positions: {
      avants: { label: 'Avants (piliers, talonneurs, 2e/3e ligne)' },
      arrières: { label: 'Arrières (demis, centres, ailiers, arrière)' }
    },
    templates: [
      {
        id: 'rugby_force_avants',
        name: 'Force & Puissance – Avants',
        position: 'avants',
        type: 'block',
        description: 'Développement de la force maximale et puissance pour le poste d'avant. 3 blocs progressifs.',
        blocks: [
          {
            name: 'Bloc 1 – Fondations (4 semaines)',
            duration_weeks: 4,
            sessions: [
              { name: 'Force Bas du corps', exercises: [
                { name: 'Squat', sets: 4, reps: '6', rest_seconds: 180 },
                { name: 'Romanian Deadlift', sets: 3, reps: '8', rest_seconds: 150 },
                { name: 'Leg Press', sets: 3, reps: '10', rest_seconds: 120 },
                { name: 'Hip Thrust', sets: 3, reps: '12', rest_seconds: 90 }
              ]},
              { name: 'Force Haut du corps', exercises: [
                { name: 'Développé couché', sets: 4, reps: '6', rest_seconds: 180 },
                { name: 'Rowing barre', sets: 4, reps: '8', rest_seconds: 150 },
                { name: 'Développé militaire', sets: 3, reps: '8', rest_seconds: 120 },
                { name: 'Tractions', sets: 3, reps: '8', rest_seconds: 120 }
              ]},
              { name: 'Plaquage & Gainage', exercises: [
                { name: 'Deadlift', sets: 4, reps: '5', rest_seconds: 180 },
                { name: 'Gainage planche', sets: 4, reps: '60s', rest_seconds: 60 },
                { name: 'Rotation du tronc avec charge', sets: 3, reps: '12', rest_seconds: 90 }
              ]}
            ]
          },
          {
            name: 'Bloc 2 – Force maximale (4 semaines)',
            duration_weeks: 4,
            sessions: [
              { name: 'Squat lourd', exercises: [
                { name: 'Squat', sets: 5, reps: '3', rest_seconds: 240 },
                { name: 'Good Morning', sets: 3, reps: '8', rest_seconds: 120 },
                { name: 'Fentes bulgares', sets: 3, reps: '8', rest_seconds: 120 }
              ]},
              { name: 'Bench & Dos', exercises: [
                { name: 'Développé couché', sets: 5, reps: '3', rest_seconds: 240 },
                { name: 'Rowing unilatéral', sets: 4, reps: '8', rest_seconds: 120 },
                { name: 'Dips', sets: 3, reps: '10', rest_seconds: 90 }
              ]}
            ]
          },
          {
            name: 'Bloc 3 – Puissance (3 semaines)',
            duration_weeks: 3,
            sessions: [
              { name: 'Puissance explosivité', exercises: [
                { name: 'Power clean', sets: 5, reps: '3', rest_seconds: 180 },
                { name: 'Box jump', sets: 4, reps: '5', rest_seconds: 120 },
                { name: 'Squat sauté', sets: 4, reps: '6', rest_seconds: 120 }
              ]},
              { name: 'Sprint & Gainage', exercises: [
                { name: 'Sprint 20m', sets: 6, reps: '1', rest_seconds: 120 },
                { name: 'Gainage latéral', sets: 3, reps: '45s', rest_seconds: 60 },
                { name: 'Burpees', sets: 4, reps: '10', rest_seconds: 90 }
              ]}
            ]
          }
        ]
      },
      {
        id: 'rugby_vitesse_arrieres',
        name: 'Vitesse & Endurance – Arrières',
        position: 'arrières',
        type: 'simple',
        description: 'Programme axé vitesse, changements d'appui et endurance spécifique.',
        sessions: [
          { name: 'Vitesse & Sprint', exercises: [
            { name: 'Sprint 10m (départ arrêté)', sets: 6, reps: '1', rest_seconds: 120 },
            { name: 'Sprint 30m', sets: 4, reps: '1', rest_seconds: 180 },
            { name: 'Ladder agilité', sets: 5, reps: '30s', rest_seconds: 60 }
          ]},
          { name: 'Force athlétique', exercises: [
            { name: 'Squat', sets: 4, reps: '8', rest_seconds: 120 },
            { name: 'Fentes marchées', sets: 3, reps: '12', rest_seconds: 90 },
            { name: 'Hip Thrust', sets: 3, reps: '12', rest_seconds: 90 },
            { name: 'Gainage planche', sets: 3, reps: '60s', rest_seconds: 60 }
          ]},
          { name: 'Endurance spécifique', exercises: [
            { name: 'Interval 400m', sets: 6, reps: '1', rest_seconds: 90 },
            { name: 'Agilité cônes', sets: 5, reps: '45s', rest_seconds: 60 }
          ]}
        ]
      }
    ]
  },
  fitness: {
    label: 'Fitness / Musculation', icon: '💪',
    positions: {
      debutant: { label: 'Débutant (< 1 an)' },
      intermediaire: { label: 'Intermédiaire (1–3 ans)' },
      avance: { label: 'Avancé (3+ ans)' }
    },
    templates: [
      {
        id: 'fitness_ppl_inter',
        name: 'Push / Pull / Legs – Intermédiaire',
        position: 'intermediaire',
        type: 'simple',
        description: 'Programme 3 jours classique Push/Pull/Legs pour la prise de masse.',
        sessions: [
          { name: 'Push (Pecs / Épaules / Triceps)', exercises: [
            { name: 'Développé couché', sets: 4, reps: '8-10', rest_seconds: 120 },
            { name: 'Développé incliné haltères', sets: 3, reps: '10-12', rest_seconds: 90 },
            { name: 'Écarté poulie basse', sets: 3, reps: '12-15', rest_seconds: 75 },
            { name: 'Développé militaire', sets: 3, reps: '10', rest_seconds: 90 },
            { name: 'Élévations latérales', sets: 3, reps: '15', rest_seconds: 60 },
            { name: 'Dips triceps', sets: 3, reps: '12', rest_seconds: 75 }
          ]},
          { name: 'Pull (Dos / Biceps)', exercises: [
            { name: 'Tractions', sets: 4, reps: '8', rest_seconds: 120 },
            { name: 'Rowing barre', sets: 4, reps: '8-10', rest_seconds: 120 },
            { name: 'Tirage poulie haute', sets: 3, reps: '12', rest_seconds: 90 },
            { name: 'Rowing haltère', sets: 3, reps: '12', rest_seconds: 90 },
            { name: 'Curl barre', sets: 3, reps: '12', rest_seconds: 60 },
            { name: 'Curl marteau', sets: 3, reps: '12', rest_seconds: 60 }
          ]},
          { name: 'Legs (Jambes)', exercises: [
            { name: 'Squat', sets: 4, reps: '8-10', rest_seconds: 150 },
            { name: 'Leg Press', sets: 3, reps: '12', rest_seconds: 120 },
            { name: 'Fentes marchées', sets: 3, reps: '12', rest_seconds: 90 },
            { name: 'Leg Curl', sets: 3, reps: '12', rest_seconds: 90 },
            { name: 'Mollets debout', sets: 4, reps: '15', rest_seconds: 60 }
          ]}
        ]
      },
      {
        id: 'fitness_fullbody_debutant',
        name: 'Full Body – Débutant',
        position: 'debutant',
        type: 'simple',
        description: 'Programme 3 jours full body pour acquérir les bases techniques et la force initiale.',
        sessions: [
          { name: 'Full Body A', exercises: [
            { name: 'Squat', sets: 3, reps: '10', rest_seconds: 120 },
            { name: 'Développé couché', sets: 3, reps: '10', rest_seconds: 120 },
            { name: 'Rowing barre', sets: 3, reps: '10', rest_seconds: 120 },
            { name: 'Gainage planche', sets: 3, reps: '30s', rest_seconds: 60 }
          ]},
          { name: 'Full Body B', exercises: [
            { name: 'Romanian Deadlift', sets: 3, reps: '10', rest_seconds: 120 },
            { name: 'Développé militaire', sets: 3, reps: '10', rest_seconds: 120 },
            { name: 'Tractions assistées', sets: 3, reps: '8', rest_seconds: 120 },
            { name: 'Crunch', sets: 3, reps: '15', rest_seconds: 60 }
          ]}
        ]
      }
    ]
  },
  football: {
    label: 'Football', icon: '⚽',
    positions: {
      gardien: { label: 'Gardien' },
      defenseur: { label: 'Défenseur' },
      milieu: { label: 'Milieu' },
      attaquant: { label: 'Attaquant' }
    },
    templates: [
      {
        id: 'foot_physique_terrain',
        name: 'Physique terrain – Défenseur/Milieu',
        position: 'defenseur',
        type: 'simple',
        description: 'Force athlétique et endurance spécifique au football.',
        sessions: [
          { name: 'Force athlétique', exercises: [
            { name: 'Squat', sets: 4, reps: '6', rest_seconds: 150 },
            { name: 'Fentes bulgares', sets: 3, reps: '10', rest_seconds: 90 },
            { name: 'Hip Thrust', sets: 3, reps: '12', rest_seconds: 90 },
            { name: 'Gainage', sets: 3, reps: '60s', rest_seconds: 60 }
          ]},
          { name: 'Vitesse & Agilité', exercises: [
            { name: 'Sprint 10m réaction', sets: 8, reps: '1', rest_seconds: 90 },
            { name: 'Changements direction', sets: 6, reps: '20s', rest_seconds: 60 },
            { name: 'Box jump', sets: 4, reps: '5', rest_seconds: 90 }
          ]},
          { name: 'Endurance spécifique', exercises: [
            { name: 'Intermittent 30-30', sets: 10, reps: '1', rest_seconds: 30 },
            { name: 'Navette 20m', sets: 6, reps: '1', rest_seconds: 60 }
          ]}
        ]
      }
    ]
  }
}

export default function ProgramTemplates() {
  const navigate = useNavigate()
  const [selectedSport, setSelectedSport] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  const sports = Object.entries(PROGRAM_TEMPLATES)
  const currentSport = selectedSport ? PROGRAM_TEMPLATES[selectedSport] : null
  const templates = currentSport?.templates || []

  if (selectedTemplate) {
    const tpl = templates.find(t => t.id === selectedTemplate)
    return (
      <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:80}}>
        <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
          <button onClick={() => setSelectedTemplate(null)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><ArrowLeft size={20}/></button>
          <h2 style={{margin:0, fontSize:16}}>{tpl?.name}</h2>
        </div>
        <div style={{padding:16}}>
          <p style={{color:'#888', fontSize:13, marginBottom:16}}>{tpl?.description}</p>
          <button onClick={() => navigate('/coach/programs/new', { state: { template: tpl } })}
            style={{width:'100%', padding:'14px 0', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:14, color:'white', fontSize:16, fontWeight:700, cursor:'pointer', marginBottom:20}}>
            Utiliser ce template
          </button>
          {(tpl?.blocks || tpl?.sessions || []).map((item, i) => (
            <div key={i} style={{background:'#1e1e2e', borderRadius:12, padding:'12px 14px', marginBottom:10}}>
              <p style={{margin:'0 0 8px', fontWeight:700, fontSize:14, color:'#a78bfa'}}>{item.name}{item.duration_weeks ? ' (' + item.duration_weeks + ' sem.)' : ''}</p>
              {(item.sessions || []).map((s, j) => (
                <div key={j} style={{marginBottom:8}}>
                  <p style={{margin:'0 0 4px', fontSize:13, fontWeight:600, color:'#ccc'}}>{s.name}</p>
                  {s.exercises.map((ex, k) => (
                    <p key={k} style={{margin:'2px 0', fontSize:12, color:'#888', paddingLeft:10}}>• {ex.name} — {ex.sets}×{ex.reps}</p>
                  ))}
                </div>
              ))}
              {(item.exercises || []).map((ex, k) => (
                <p key={k} style={{margin:'2px 0', fontSize:12, color:'#888', paddingLeft:10}}>• {ex.name} — {ex.sets}×{ex.reps}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:40}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={() => selectedSport ? setSelectedSport(null) : navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><ArrowLeft size={20}/></button>
        <h2 style={{margin:0, fontSize:18}}>{selectedSport ? currentSport?.label : 'Templates de programmes'}</h2>
      </div>

      <div style={{padding:16}}>
        {!selectedSport ? (
          <>
            <p style={{color:'#888', fontSize:13, marginBottom:16}}>Choisis un sport pour voir les templates disponibles</p>
            {sports.map(([key, sport]) => (
              <button key={key} onClick={() => setSelectedSport(key)}
                style={{width:'100%', background:'#1e1e2e', border:'none', borderRadius:12, padding:'16px', marginBottom:10, display:'flex', alignItems:'center', gap:14, cursor:'pointer', textAlign:'left'}}>
                <span style={{fontSize:28}}>{sport.icon}</span>
                <div style={{flex:1}}>
                  <p style={{margin:0, fontWeight:600, color:'white', fontSize:15}}>{sport.label}</p>
                  <p style={{margin:0, fontSize:12, color:'#888'}}>{sport.templates.length} template{sport.templates.length>1?'s':''}</p>
                </div>
                <ChevronRight size={16} color="#888"/>
              </button>
            ))}
          </>
        ) : (
          <>
            {templates.map(tpl => (
              <button key={tpl.id} onClick={() => setSelectedTemplate(tpl.id)}
                style={{width:'100%', background:'#1e1e2e', border:'none', borderRadius:12, padding:'16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', textAlign:'left'}}>
                <div style={{flex:1}}>
                  <p style={{margin:'0 0 4px', fontWeight:600, color:'white', fontSize:15}}>{tpl.name}</p>
                  <p style={{margin:'0 0 6px', fontSize:12, color:'#888'}}>{tpl.description}</p>
                  <span style={{fontSize:11, background:'#6366f122', color:'#6366f1', padding:'2px 8px', borderRadius:20, fontWeight:600}}>
                    {currentSport?.positions?.[tpl.position]?.label || tpl.position}
                  </span>
                </div>
                <ChevronRight size={16} color="#888"/>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
