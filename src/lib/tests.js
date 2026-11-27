// Catalogue des tests de performance (repris de la fiche « Tests & repères »)
export const TESTS = [
  { key: 'bodyweight', label: 'Poids de corps', unit: 'kg', better: 'none' },
  { key: 'cmj', label: 'Saut contre-mouvement (CMJ)', unit: 'cm', better: 'up', hint: '1-2×/semaine, même moment' },
  { key: 'sprint_10yd', label: 'Sprint 10 yd', unit: 's', better: 'down' },
  { key: 'sprint_40yd', label: 'Sprint 40 yd', unit: 's', better: 'down' },
  { key: 'flying_10yd', label: '10 yd lancés', unit: 's', better: 'down' },
  { key: 'pro_agility', label: '5-10-5', unit: 's', better: 'down' },
  { key: 'l_drill', label: 'L-drill', unit: 's', better: 'down' },
  { key: 'nordbord', label: 'Force excentrique ischios (G / D)', unit: 'N', better: 'up', two: true, hint: 'Asymétrie > 10-15 % : bloc correctif' },
  { key: 'vertical', label: 'Détente verticale', unit: 'cm', better: 'up' },
]
// Les maximums de force se saisissent par exercice (clé « rm:<exercice> »)
export const STRENGTH_SUGGESTIONS = ['Squat barre (Back Squat)', 'Soulevé de terre trap bar', 'Landmine press (par bras)', 'Développé couché', 'Front squat barre', 'Soulevé de terre roumain']

export const testMeta = key => key?.startsWith('rm:') ? { key, label: key.slice(3), unit: 'kg', better: 'up', strength: true } : (TESTS.find(t => t.key === key) || { key, label: key, unit: '' })

// Asymétrie gauche / droite en %
export const asymmetry = (a, b) => (a > 0 && b > 0 ? Math.round(Math.abs(a - b) / Math.max(a, b) * 100) : null)

// Charge interne (méthode RPE de séance × durée) et ratio aigu / chronique
export function weeklyLoads(completions, weeks = 8, now = new Date()) {
  const DAY = 86400000
  const out = []
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date(now.getTime() - i * 7 * DAY), start = new Date(end.getTime() - 7 * DAY)
    const load = (completions || []).filter(c => { const t = new Date(c.created_at); return t > start && t <= end })
      .reduce((s, c) => s + (Number(c.rpe_session) || 0) * (Number(c.duration_minutes) || 0), 0)
    out.push({ start, end, load: Math.round(load) })
  }
  return out
}
export function acwr(completions, now = new Date()) {
  const w = weeklyLoads(completions, 4, now)
  const acute = w[3].load, chronic = (w[0].load + w[1].load + w[2].load + w[3].load) / 4
  return chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null
}
