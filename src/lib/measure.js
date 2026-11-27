// Type de mesure d'un exercice : répétitions, distance (mètres ou yards) ou durée (secondes ou minutes).
export const MEASURES = {
  reps: { key: 'reps', label: 'Reps', seg: 'Reps', col: 'Reps', long: 'Répétitions', unit: '', step: 1, placeholder: '8' },
  distance: { key: 'distance', label: 'Distance', seg: 'Mètres', col: 'Mètres', long: 'Distance (m)', unit: ' m', step: 50, placeholder: '400' },
  yards: { key: 'yards', label: 'Distance', seg: 'Yards', col: 'Yards', long: 'Distance (yd)', unit: ' yd', step: 5, placeholder: '40' },
  time: { key: 'time', label: 'Durée', seg: 'Secondes', col: 'Sec.', long: 'Durée (s)', unit: ' s', step: 5, placeholder: '30' },
  minutes: { key: 'minutes', label: 'Durée', seg: 'Minutes', col: 'Min', long: 'Durée (min)', unit: ' min', step: 1, placeholder: '20' },
}

// Type de bloc (couleur et libellé) : terrain, salle, prévention, conditionnement
export const BLOCK_TYPES = {
  terrain: { key: 'terrain', label: 'Terrain', emoji: '🏃', color: '#ff9500' },
  salle: { key: 'salle', label: 'Salle', emoji: '🏋️', color: '#007aff' },
  prevention: { key: 'prevention', label: 'Prévention', emoji: '🛡️', color: '#34c759' },
  conditionnement: { key: 'conditionnement', label: 'Cond.', emoji: '❤️', color: '#ff375f' },
}

// Libellés avec fourchettes : « 2 → 3 », « RPE 7-8 », « Récup 2-3 min »
export const setsLabel = ex => ex?.sets_text || String(ex?.sets ?? '')
export const rpeLabel = ex => ex?.rpe_text || (ex?.rpe != null && ex?.rpe !== '' ? String(ex.rpe) : '')
export function restLabel(ex) {
  if (ex?.rest_text) return ex.rest_text
  const s = Number(ex?.rest_seconds) || 0
  if (!s) return ''
  if (s < 120) return s + ' s'
  return Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + String(s % 60).padStart(2, '0') : '')
}

// « 2-3 min » → 150 s ; « 90 s » → 90 ; texte libre → 0
export function parseRest(text) {
  const m = String(text || '').replace(',', '.').match(/^\s*(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*(min|s|sec)?\b/i)
  if (!m) return 0
  const a = parseFloat(m[1]), b = parseFloat(m[2] || m[1]), v = (a + b) / 2
  return Math.round((m[3] || 's').toLowerCase().startsWith('min') ? v * 60 : v)
}

export function measureOf(ex) {
  return MEASURES[ex?.measure] || MEASURES.reps
}

// Mesure proposée par défaut quand on choisit un exercice de la bibliothèque
export function defaultMeasure(libEx) {
  return libEx?.category === 'Cardio' ? 'distance' : 'reps'
}

// « 4 × 10 », « 6 × 200 m », « 3 × 45 s »
export function formatTarget(ex) {
  const m = measureOf(ex)
  const sets = setsLabel(ex)
  if (!ex?.reps) return `${sets} séries`
  const unit = m.unit && !String(ex.reps).trim().toLowerCase().endsWith(m.unit.trim()) ? m.unit : ''
  return `${sets} × ${ex.reps}${unit}`
}

// Valeur d'une série enregistrée : « 10 reps », « 400 m », « 45 s »
export function formatSetValue(set) {
  if (!set?.reps) return ''
  const m = MEASURES[set.measure] || MEASURES.reps
  return set.reps + (m.key === 'reps' ? ' reps' : m.unit)
}

const isNum = v => /^\d+([.,]\d+)?$/.test(String(v ?? '').trim())

// Valeur suggérée (affichée en gris) tant que la case est vide :
// la valeur de la dernière séance, sinon l'objectif du coach.
export function setHint(ex, set, field) {
  const prev = set?._prev?.[field]
  if (prev) return String(prev)
  if (field === 'reps') return String(ex?.reps ?? '')
  // charge : seulement une valeur en kg (pas « 70-72 % », « PdC » ou « Technique »)
  if (field === 'load') return /^\s*\d+([.,]\d+)?\s*(kg)?\s*$/i.test(String(ex?.load ?? '')) ? String(ex.load) : ''
  return ''
}

// Série validée sans rien saisir : on reprend les valeurs suggérées (si ce sont des nombres)
export function fillFromHints(ex, set) {
  const out = { ...set }
  for (const f of ['reps', 'load']) {
    if (String(out[f] ?? '').trim() === '') {
      const h = setHint(ex, set, f)
      if (isNum(h)) out[f] = h
    }
  }
  return out
}

export function emptySet(prev) {
  return { reps: '', load: '', rpe: '', _done: false, ...(prev ? { _prev: { reps: prev.reps || '', load: prev.load || '', rpe: prev.rpe || '' } } : {}) }
}
