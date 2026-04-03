import { useNavigate } from 'react-router-dom'
import { PageLayout } from '../../components/Layout'
import { Dumbbell, Users, Zap } from 'lucide-react'

const TEMPLATES = [
  {
    id: 'rugby-avants',
    label: 'Rugby',
    icon: '🏉',
    name: 'Force & Puissance - Avants',
    position: 'avants',
    type: 'block',
    description: 'Developpement de la force maximale et puissance pour les avants. 3 blocs progressifs.',
    blocks: [
      {
        name: 'Bloc 1 - Fondations (4 semaines)',
        duration_weeks: 4,
        sessions: [
          { name: 'Force Bas du corps', exercises: [
            { name: 'Squat', sets: 4, reps: '6', rest_seconds: 180 },
            { name: 'Romanian Deadlift', sets: 3, reps: '8', rest_seconds: 150 },
            { name: 'Leg Press', sets: 3, reps: '10', rest_seconds: 120 },
            { name: 'Hip Thrust', sets: 3, reps: '12', rest_seconds: 90 }
          ]},
          { name: 'Force Haut du corps', exercises: [
            { name: 'Developpe couche', sets: 4, reps: '6', rest_seconds: 180 },
            { name: 'Rowing barre', sets: 4, reps: '8', rest_seconds: 150 },
            { name: 'Developpe militaire', sets: 3, reps: '8', rest_seconds: 120 },
            { name: 'Tractions', sets: 3, reps: '8', rest_seconds: 120 }
          ]},
          { name: 'Puissance & Athletisme', exercises: [
            { name: 'Power Clean', sets: 5, reps: '3', rest_seconds: 180 },
            { name: 'Box Jump', sets: 4, reps: '5', rest_seconds: 120 },
            { name: 'Sprint 20m', sets: 6, reps: '1', rest_seconds: 90 }
          ]}
        ]
      },
      {
        name: 'Bloc 2 - Intensification (4 semaines)',
        duration_weeks: 4,
        sessions: [
          { name: 'Force Max Jambes', exercises: [
            { name: 'Squat', sets: 5, reps: '4', rest_seconds: 210 },
            { name: 'Deadlift', sets: 4, reps: '4', rest_seconds: 210 },
            { name: 'Fentes bulgares', sets: 3, reps: '6', rest_seconds: 150 }
          ]},
          { name: 'Force Max Buste', exercises: [
            { name: 'Developpe couche', sets: 5, reps: '4', rest_seconds: 210 },
            { name: 'Rowing Yates', sets: 5, reps: '5', rest_seconds: 180 },
            { name: 'Developpe incline', sets: 3, reps: '6', rest_seconds: 150 }
          ]},
          { name: 'Puissance Explosive', exercises: [
            { name: 'Power Snatch', sets: 5, reps: '3', rest_seconds: 180 },
            { name: 'Push Jerk', sets: 4, reps: '4', rest_seconds: 180 },
            { name: 'Sprint 30m', sets: 8, reps: '1', rest_seconds: 90 }
          ]}
        ]
      },
      {
        name: 'Bloc 3 - Pic de forme (3 semaines)',
        duration_weeks: 3,
        sessions: [
          { name: 'Peaking Bas du corps', exercises: [
            { name: 'Squat', sets: 3, reps: '2', rest_seconds: 240 },
            { name: 'Deadlift', sets: 3, reps: '2', rest_seconds: 240 }
          ]},
          { name: 'Peaking Haut du corps', exercises: [
            { name: 'Developpe couche', sets: 3, reps: '2', rest_seconds: 240 },
            { name: 'Rowing barre', sets: 3, reps: '3', rest_seconds: 210 }
          ]},
          { name: 'Vitesse & Explosivite', exercises: [
            { name: 'Sprint 10m', sets: 8, reps: '1', rest_seconds: 60 },
            { name: 'Jump Squat', sets: 4, reps: '4', rest_seconds: 120 }
          ]}
        ]
      }
    ]
  },
  {
    id: 'fitness-perte-poids',
    label: 'Fitness',
    icon: '🔥',
    name: 'Perte de poids & Remise en forme',
    type: 'simple',
    description: 'Programme complet 3 seances par semaine pour la perte de poids et le renforcement musculaire.',
    sessions: [
      { name: 'Full Body A', exercises: [
        { name: 'Squat goblet', sets: 3, reps: '15', rest_seconds: 60 },
        { name: 'Pompes', sets: 3, reps: '12', rest_seconds: 60 },
        { name: 'Rowing haltere', sets: 3, reps: '12', rest_seconds: 60 },
        { name: 'Fentes marchees', sets: 3, reps: '10', rest_seconds: 60 },
        { name: 'Planche', sets: 3, reps: '30s', rest_seconds: 45 }
      ]},
      { name: 'Full Body B', exercises: [
        { name: 'Deadlift roumain', sets: 3, reps: '12', rest_seconds: 75 },
        { name: 'Developpe halteres', sets: 3, reps: '12', rest_seconds: 60 },
        { name: 'Tractions assistees', sets: 3, reps: '10', rest_seconds: 75 },
        { name: 'Hip Thrust', sets: 3, reps: '15', rest_seconds: 60 },
        { name: 'Crunchs', sets: 3, reps: '20', rest_seconds: 45 }
      ]},
      { name: 'Circuit Cardio-Muscu', exercises: [
        { name: 'Burpees', sets: 4, reps: '10', rest_seconds: 45 },
        { name: 'Kettlebell swing', sets: 4, reps: '15', rest_seconds: 45 },
        { name: 'Mountain climbers', sets: 4, reps: '20', rest_seconds: 45 },
        { name: 'Box step-up', sets: 4, reps: '12', rest_seconds: 45 }
      ]}
    ]
  },
  {
    id: 'football-vitesse',
    label: 'Football',
    icon: '⚽',
    name: 'Vitesse & Endurance - Football',
    type: 'simple',
    description: 'Programme athletique pour footballeurs. Priorite vitesse, explosivite et endurance specifique.',
    sessions: [
      { name: 'Vitesse & Sprint', exercises: [
        { name: 'Sprint 10m depart arrete', sets: 8, reps: '1', rest_seconds: 60 },
        { name: 'Sprint 30m', sets: 6, reps: '1', rest_seconds: 90 },
        { name: 'Navettes 5-10-5', sets: 5, reps: '1', rest_seconds: 90 },
        { name: 'Sauts horizontaux', sets: 4, reps: '5', rest_seconds: 60 }
      ]},
      { name: 'Force - Membres inferieurs', exercises: [
        { name: 'Squat', sets: 4, reps: '6', rest_seconds: 150 },
        { name: 'Fentes bulgares', sets: 3, reps: '8', rest_seconds: 120 },
        { name: 'Nordic Curl', sets: 3, reps: '6', rest_seconds: 120 },
        { name: 'Calf raises', sets: 4, reps: '15', rest_seconds: 60 }
      ]},
      { name: 'Endurance specifique', exercises: [
        { name: 'Fractionne 30/30', sets: 10, reps: '1', rest_seconds: 30 },
        { name: 'Carre 40m', sets: 6, reps: '1', rest_seconds: 60 },
        { name: 'Jeu de jambes echelle', sets: 5, reps: '1', rest_seconds: 45 }
      ]},
      { name: 'Prevention & Gainage', exercises: [
        { name: 'Planche', sets: 3, reps: '45s', rest_seconds: 45 },
        { name: 'Pont fessier', sets: 3, reps: '15', rest_seconds: 45 },
        { name: 'Copenhagen plank', sets: 3, reps: '20s', rest_seconds: 45 },
        { name: 'Rotation epaules', sets: 2, reps: '15', rest_seconds: 30 }
      ]}
    ]
  }
]

const categoryIcons = { Rugby: <Users size={16} />, Fitness: <Dumbbell size={16} />, Football: <Zap size={16} /> }

export default function ProgramTemplates() {
  const navigate = useNavigate()

  function useTemplate(tpl) {
    navigate('/coach/programs/new', { state: { template: tpl } })
  }

  return (
    <PageLayout title="Gabarits de programmes" back="/coach">
      <div className="p-4 pb-10 space-y-6">
        {['Rugby', 'Fitness', 'Football'].map(cat => {
          const tpls = TEMPLATES.filter(t => t.label === cat)
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-400">{categoryIcons[cat]}</span>
                <p className="text-sm font-semibold text-white">{cat}</p>
              </div>
              <div className="space-y-3">
                {tpls.map(tpl => (
                  <div key={tpl.id} style={{background:'#ffffff08', border:'1px solid #ffffff12', borderRadius:14, padding:16}}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span style={{fontSize:22}}>{tpl.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-white">{tpl.name}</p>
                          <p style={{fontSize:11, color:'#888', marginTop:2}}>
                            {tpl.type === 'block'
                              ? tpl.blocks?.length + ' blocs - ' + tpl.blocks?.reduce((a, b) => a + (b.sessions?.length || 0), 0) + ' seances'
                              : tpl.sessions?.length + ' seances'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => useTemplate(tpl)}
                        style={{flexShrink:0, background:'linear-gradient(135deg,#7c3aed,#4f46e5)', color:'white', border:'none', borderRadius:10, padding:'8px 14px', fontSize:12, fontWeight:700, cursor:'pointer'}}
                      >
                        Utiliser
                      </button>
                    </div>
                    <p style={{fontSize:12, color:'#888', margin:0, lineHeight:1.5}}>{tpl.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </PageLayout>
  )
}
