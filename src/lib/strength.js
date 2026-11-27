// Force : 1RM estimé, conversion des « % du 1RM » en kilos pour chaque joueur.
export const round25 = v => Math.round(v / 2.5) * 2.5

// Formule d'Epley (fiable jusqu'à ~10 répétitions)
export function e1rm(load, reps) {
  const l = parseFloat(String(load).replace(',', '.')), r = parseInt(reps, 10)
  if (!(l > 0) || !(r > 0)) return 0
  return r === 1 ? l : l * (1 + Math.min(r, 12) / 30)
}

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
export const exerciseKey = name => norm(name)

// Maximum de référence d'un exercice : test saisi (1RM, ou xRM converti) en priorité, sinon meilleur e1RM des séances.
// maxes : { [clé normalisée]: { value, source } }
export function maxFor(maxes, ex) {
  if (!maxes) return null
  for (const n of [ex?.name, ex?.exercise?.name]) {
    const k = norm(n)
    if (k && maxes[k]) return maxes[k]
  }
  // correspondance souple : « back squat ou safety bar » ↔ « back squat »
  const k = norm(ex?.name)
  const hit = Object.keys(maxes).find(m => m.length > 4 && (k.startsWith(m) || m.startsWith(k)))
  return hit ? maxes[hit] : null
}

// « 70-72 % » + 1RM 140 → « 97,5-100 kg »
export function percentToKg(loadText, oneRm) {
  if (!oneRm || !loadText) return ''
  const m = String(loadText).replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?\s*%/)
  if (!m || /PdC|poids de corps/i.test(loadText.slice(0, m.index + m[0].length + 4))) return ''
  const a = round25(oneRm * parseFloat(m[1]) / 100), b = m[2] ? round25(oneRm * parseFloat(m[2]) / 100) : null
  const f = v => String(v).replace('.', ',')
  return b && b !== a ? `${f(a)}-${f(b)} kg` : `${f(a)} kg`
}

// Construit la table des maximums d'un client à partir de ses tests et de son historique
export function buildMaxes(tests, logs) {
  const out = {}
  for (const l of logs || []) {
    const name = l.exercise?.name || l.exercise_name
    for (const s of l.set_data || []) {
      const v = e1rm(s.load, s.reps)
      const k = norm(name)
      if (v > 0 && (!out[k] || (out[k].source === 'séances' && v > out[k].value))) out[k] = { value: Math.round(v), source: 'séances' }
    }
  }
  // les tests (plus récents d'abord) priment sur l'estimation
  const seen = new Set()
  for (const t of [...(tests || [])].sort((a, b) => String(b.tested_at).localeCompare(String(a.tested_at)))) {
    if (!t.test_key?.startsWith('rm:')) continue
    const k = norm(t.test_key.slice(3))
    if (seen.has(k)) continue
    seen.add(k)
    out[k] = { value: Math.round(t.reps > 1 ? e1rm(t.value, t.reps) : Number(t.value)), source: t.reps > 1 ? `test ${t.reps}RM` : 'test 1RM', date: t.tested_at }
  }
  return out
}
