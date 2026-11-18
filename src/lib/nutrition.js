// Outils nutrition : dates locales, objectif calorique, recherche Open Food Facts.

export const DEFAULT_MEALS = ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner']

export function localDateStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const ACTIVITY_MULT = { sedentaire: 1.2, leger: 1.375, modere: 1.55, tres_actif: 1.725 }

// Estimation Mifflin-St Jeor si le coach n'a pas fixé d'objectif.
export function estimateTargets(profile) {
  if (!profile?.weight || !profile?.height || !profile?.birth_date || !profile?.sex) return null
  const b = new Date(profile.birth_date)
  const now = new Date()
  let age = now.getFullYear() - b.getFullYear()
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) age--
  const base = 10 * profile.weight + 6.25 * profile.height - 5 * age
  const bmr = profile.sex === 'homme' ? base + 5 : base - 161
  const kcal = Math.round(bmr * (ACTIVITY_MULT[profile.activity_level] || 1.375))
  const protein = Math.round(profile.weight * 1.8)
  const fat = Math.round((kcal * 0.27) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { calories_target: kcal, protein_target: protein, carbs_target: carbs, fat_target: fat, estimated: true }
}

export function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10
}

// Valeurs pour une quantité donnée à partir des valeurs pour 100 g/ml.
export function scaleFood(per100, grams) {
  const f = (Number(grams) || 0) / 100
  return {
    calories: Math.round((per100.calories || 0) * f),
    protein: round1((per100.protein || 0) * f),
    carbs: round1((per100.carbs || 0) * f),
    fat: round1((per100.fat || 0) * f),
  }
}

const OFF_FIELDS = 'code,product_name,product_name_fr,generic_name_fr,brands,nutriments,serving_quantity,serving_size,image_front_small_url,image_small_url,quantity'

function fromOff(p) {
  const n = p?.nutriments || {}
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null)
  if (kcal == null) return null
  const name = p.product_name_fr || p.product_name || p.generic_name_fr
  if (!name) return null
  return {
    source: 'openfoodfacts',
    barcode: p.code,
    name: name.trim(),
    brand: (p.brands || '').split(',')[0].trim() || null,
    image: p.image_front_small_url || p.image_small_url || null,
    calories: Math.round(kcal),
    protein: round1(n.proteins_100g),
    carbs: round1(n.carbohydrates_100g),
    fat: round1(n.fat_100g),
    portion_g: Number(p.serving_quantity) || null,
    portion_label: p.serving_size || null,
    unit: /\bml\b|\bcl\b|\bl\b/i.test(p.quantity || '') ? 'ml' : 'g',
  }
}

export async function fetchOffProduct(barcode) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error('Open Food Facts indisponible (' + res.status + ')')
  }
  const json = await res.json()
  if (json.status === 0 || !json.product) return null
  return fromOff({ ...json.product, code: json.product.code || barcode })
}

export async function searchOff(query, signal) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20&sort_by=unique_scans_n&lc=fr&cc=fr&fields=${OFF_FIELDS}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('Open Food Facts indisponible (' + res.status + ')')
  const json = await res.json()
  return (json.products || []).map(fromOff).filter(Boolean)
}
