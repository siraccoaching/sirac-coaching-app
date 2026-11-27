// Périodisation : à partir de la date de début du programme d'un client, on sait dans quelle phase
// et quelle semaine il se trouve, et on applique la progression prévue pour cette semaine.
const DAY = 86400000
const toDate = d => (d instanceof Date ? d : new Date(String(d).slice(0, 10) + 'T12:00'))

// blocks : phases triées (order_index) avec duration_weeks
export function phaseAt(blocks, startDate, date = new Date()) {
  if (!startDate || !blocks?.length) return null
  const sorted = [...blocks].sort((a, b) => a.order_index - b.order_index)
  const w = Math.floor((toDate(date) - toDate(startDate)) / (7 * DAY))
  if (w < 0) return { before: true, startsIn: Math.ceil((toDate(startDate) - toDate(date)) / DAY) }
  let acc = 0
  for (const b of sorted) {
    const n = Math.max(1, Number(b.duration_weeks) || 1)
    if (w < acc + n) {
      const week = w - acc + 1
      return { block: b, blockId: b.id, week, weeks: n, globalWeek: w + 1, label: b.week_labels?.[week] || '' }
    }
    acc += n
  }
  return { finished: true, totalWeeks: acc }
}

// Dates de début et de fin de chaque phase
export function phaseDates(blocks, startDate) {
  if (!startDate) return []
  let cur = toDate(startDate)
  return [...(blocks || [])].sort((a, b) => a.order_index - b.order_index).map(b => {
    const n = Math.max(1, Number(b.duration_weeks) || 1)
    const start = new Date(cur), end = new Date(cur.getTime() + (n * 7 - 1) * DAY)
    cur = new Date(cur.getTime() + n * 7 * DAY)
    return { block: b, start, end }
  })
}

// Exercice tel que prévu pour la semaine donnée (progression semaine par semaine)
export function applyWeek(ex, week) {
  const o = week && ex?.week_overrides?.[week]
  if (!o) return ex
  const out = { ...ex, _week: week }
  for (const k of ['sets', 'sets_text', 'reps', 'load', 'rpe', 'rpe_text', 'rest_text']) if (o[k] !== undefined && o[k] !== '') out[k] = o[k]
  if (o.sets !== undefined && o.sets_text === undefined) out.sets_text = null
  if (o.note) out.week_note = o.note
  return out
}

// Jours relatifs au match : « J-1 » si le prochain match est demain, « J+1 » le lendemain d'un match
export function matchDayLabel(dateStr, matches) {
  const d = toDate(dateStr).getTime()
  let best = null
  for (const m of matches || []) {
    const diff = Math.round((toDate(m.date).getTime() - d) / DAY)
    if (diff === 0) return 'Match'
    if (diff > 0 && diff <= 6 && (best === null || diff < Math.abs(best))) best = -diff
    if (diff < 0 && diff >= -2 && best === null) best = -diff
  }
  return best === null ? '' : best < 0 ? 'J' + best : 'J+' + best
}

// Séances in-season nommées « (J-4) », « J+1 »… : décalage par rapport au match
export function sessionMatchOffset(name) {
  const m = String(name || '').match(/J\s*([+-])\s*(\d)/)
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : null
}
