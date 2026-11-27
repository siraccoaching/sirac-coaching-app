// Type de mesure d'un exercice : répétitions, distance (mètres) ou durée (secondes).
export const MEASURES = {
  reps: { key: 'reps', label: 'Reps', long: 'Répétitions', unit: '', step: 1, placeholder: '8' },
  distance: { key: 'distance', label: 'Distance', long: 'Distance (m)', unit: ' m', step: 50, placeholder: '400' },
  time: { key: 'time', label: 'Durée', long: 'Durée (s)', unit: ' s', step: 5, placeholder: '30' },
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
  if (!ex?.reps) return `${ex?.sets ?? ''} séries`
  return `${ex.sets} × ${ex.reps}${m.unit}`
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
