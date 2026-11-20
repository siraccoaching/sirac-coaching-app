import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { ALLERGENS, EQUIPMENT, DIETS, DAY_OPTIONS, MEALS_OPTIONS } from '../src/lib/mealPlanOptions.js'

// Génère un plan alimentaire personnalisé avec Claude :
// objectif calorique du client + allergies + matériel de cuisine + régime.
// Le plan est enregistré dans ai_meal_plans (lisible par le client et son coach).
export const config = { maxDuration: 300 }

const MODEL = 'claude-opus-5-5'
const MAX_PER_DAY = 6

const MACROS = {
  type: 'object', additionalProperties: false,
  properties: { kcal: { type: 'integer' }, protein_g: { type: 'integer' }, carbs_g: { type: 'integer' }, fat_g: { type: 'integer' } },
  required: ['kcal', 'protein_g', 'carbs_g', 'fat_g'],
}
const SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'Deux phrases maximum qui présentent le plan.' },
    days: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          day: { type: 'string', description: 'Ex : « Jour 1 »' },
          meals: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                meal: { type: 'string', description: 'Petit-déjeuner, Déjeuner, Collation, Dîner…' },
                title: { type: 'string' },
                prep_minutes: { type: 'integer' },
                equipment: { type: 'array', items: { type: 'string' } },
                ingredients: {
                  type: 'array',
                  items: { type: 'object', additionalProperties: false, properties: { item: { type: 'string' }, quantity: { type: 'string' } }, required: ['item', 'quantity'] },
                },
                steps: { type: 'array', items: { type: 'string' } },
                macros: MACROS,
              },
              required: ['meal', 'title', 'prep_minutes', 'equipment', 'ingredients', 'steps', 'macros'],
            },
          },
          totals: MACROS,
        },
        required: ['day', 'meals', 'totals'],
      },
    },
    shopping_list: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { category: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } }, required: ['category', 'items'] },
    },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'days', 'shopping_list', 'tips'],
}

const SYSTEM = `Tu es diététicien du sport et tu prépares des plans alimentaires pour les clients d'un coach sportif, en français.

Règles impératives :
- Les allergies sont une question de santé. N'utilise JAMAIS un aliment allergène listé, ni un ingrédient qui en contient (sauces, pâtes à tartiner, laits, pains, biscuits, préparations industrielles…). En cas de doute sur un ingrédient, choisis-en un autre.
- Respecte le régime alimentaire indiqué.
- N'utilise que le matériel de cuisine disponible. Si aucun matériel n'est disponible, ne propose que des repas sans cuisson. Le champ "equipment" de chaque repas ne contient que du matériel de la liste disponible (vide si aucun).
- Chaque journée doit atteindre l'objectif calorique à ±5 % près, avec environ 1,8 g de protéines par kg de poids de corps si le poids est connu (sinon 25-30 % des calories en protéines).
- Les quantités sont précises (grammes, ml, pièces) et les calories cohérentes avec les quantités.
- Des repas simples, avec des ingrédients de supermarché français, variés d'un jour à l'autre. 3 à 5 étapes courtes par recette.
- La liste de courses regroupe les ingrédients de tous les jours par rayon, avec les quantités totales.
- 2 à 4 conseils pratiques (préparation à l'avance, hydratation…). Pas de conseil médical.`

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const EXCEPTIONS = {
  lait: ['lait de coco', "lait d'amande", "lait d'avoine", 'lait de soja', 'lait de riz', 'sans lactose', 'vegetal', 'beurre de cacahuete', 'beurre de cacahuete', "beurre d'amande", 'creme de coco'],
  fruits_coque: ['noix de coco', 'coco', 'muscade', 'noix de saint-jacques'],
  oeufs: [], gluten: ['sans gluten', 'pain de mie sans gluten'],
}

// Vérification de sécurité : repère les ingrédients qui ressemblent à un allergène déclaré.
export function findAllergenHits(plan, allergyKeys) {
  const hits = []
  for (const key of allergyKeys) {
    const a = ALLERGENS.find(x => x.key === key)
    if (!a) continue
    for (const d of plan?.days || []) for (const m of d.meals || []) for (const ing of m.ingredients || []) {
      let t = ' ' + norm(ing.item) + ' '
      for (const ex of EXCEPTIONS[key] || []) t = t.split(norm(ex)).join(' ')
      if (a.words.some(w => new RegExp('(^|[^a-z])' + norm(w).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(t))) hits.push({ allergen: a.label, item: ing.item, meal: `${d.day} · ${m.meal}` })
    }
  }
  return hits
}

function cleanList(list, allowed) {
  return Array.isArray(list) ? [...new Set(list.filter(x => allowed.includes(x)))] : []
}

async function generate(client, prompt, extra) {
  const content = extra ? `${prompt}\n\nVoici un premier plan à corriger :\n${extra.previous}\n\n${extra.feedback}` : prompt
  const messages = [{ role: 'user', content }]
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM,
    messages,
  })
  const msg = await stream.finalMessage()
  if (msg.stop_reason === 'refusal') throw Object.assign(new Error('La génération a été refusée. Modifie tes préférences et réessaie.'), { status: 422 })
  if (msg.stop_reason === 'max_tokens') throw Object.assign(new Error('Le plan était trop long. Choisis moins de jours.'), { status: 422 })
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
  return { plan: JSON.parse(text), raw: text }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  if (!serviceRoleKey || !supabaseUrl) return res.status(500).json({ error: 'Server configuration error' })
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "Le générateur IA n'est pas encore activé (clé API manquante côté serveur)." })

  const token = (req.headers.authorization || '').replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Not authenticated' })
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid session' })

  const { data: profile } = await admin.from('profiles').select('id, role, weight, height, sex, birth_date, goals').eq('id', user.id).single()
  if (!profile || profile.role !== 'client') return res.status(403).json({ error: 'Réservé aux clients.' })

  // Limite d'usage (coût de l'IA)
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { count } = await admin.from('ai_meal_plans').select('id', { count: 'exact', head: true }).eq('client_id', user.id).gte('created_at', since)
  if ((count || 0) >= MAX_PER_DAY) return res.status(429).json({ error: `Tu as déjà généré ${MAX_PER_DAY} plans aujourd'hui. Réessaie demain.` })

  const b = req.body || {}
  const kcal = Math.round(Number(b.target_kcal))
  if (!(kcal >= 1000 && kcal <= 6000)) return res.status(400).json({ error: 'Objectif calorique invalide (entre 1000 et 6000 kcal).' })
  const days = DAY_OPTIONS.includes(Number(b.days)) ? Number(b.days) : 1
  const meals = MEALS_OPTIONS.includes(Number(b.meals_per_day)) ? Number(b.meals_per_day) : 4
  const allergies = cleanList(b.allergies, ALLERGENS.map(a => a.key))
  const equipment = cleanList(b.equipment, EQUIPMENT.map(e => e.key))
  const diet = DIETS.some(d => d.key === b.diet) ? b.diet : 'omnivore'
  const otherAllergies = String(b.other_allergies || '').slice(0, 200).trim()
  const dislikes = String(b.dislikes || '').slice(0, 200).trim()

  const label = (list, keys) => keys.map(k => list.find(x => x.key === k)?.label).filter(Boolean)
  const prompt = [
    `Objectif : ${kcal} kcal par jour.`,
    `Nombre de jours : ${days}. Repas par jour : ${meals}.`,
    profile.weight ? `Poids : ${profile.weight} kg.` : null,
    profile.sex ? `Sexe : ${profile.sex}.` : null,
    profile.goals ? `Objectif sportif du client : ${String(profile.goals).slice(0, 200)}.` : null,
    `Régime : ${DIETS.find(d => d.key === diet).label}.`,
    `Allergies (à exclure totalement) : ${[...label(ALLERGENS, allergies), otherAllergies].filter(Boolean).join(', ') || 'aucune'}.`,
    `Matériel de cuisine disponible : ${label(EQUIPMENT, equipment).join(', ') || 'aucun (repas sans cuisson uniquement)'}.`,
    dislikes ? `Aliments que le client n'aime pas (à éviter) : ${dislikes}.` : null,
  ].filter(Boolean).join('\n')

  const client = new Anthropic()
  try {
    let { plan, raw } = await generate(client, prompt)
    let hits = findAllergenHits(plan, allergies)
    if (hits.length) {
      // Une seconde passe en signalant précisément les ingrédients en cause
      const feedback = `Ce plan contient des ingrédients interdits pour les allergies du client : ${hits.map(h => `${h.item} (${h.allergen}, ${h.meal})`).join('; ')}. Renvoie le plan complet corrigé sans aucun de ces ingrédients.`
      ;({ plan } = await generate(client, prompt, { previous: raw, feedback }))
      hits = findAllergenHits(plan, allergies)
    }
    const preferences = { days, meals_per_day: meals, allergies, other_allergies: otherAllergies, equipment, diet, dislikes }
    const { data: saved, error: saveErr } = await admin.from('ai_meal_plans')
      .insert({ client_id: user.id, target_kcal: kcal, days, preferences, plan: { ...plan, warnings: hits } })
      .select().single()
    if (saveErr) return res.status(500).json({ error: saveErr.message })
    // Préférences mémorisées pour la prochaine fois
    await admin.from('profiles').update({ allergies, kitchen_equipment: equipment, diet, food_dislikes: dislikes || null }).eq('id', user.id)
    return res.status(200).json({ plan: saved })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'Le service IA est très sollicité. Réessaie dans une minute.' })
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: 'Clé API IA invalide côté serveur.' })
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: 'Le service IA est indisponible pour le moment.' })
    if (e instanceof SyntaxError) return res.status(502).json({ error: 'Réponse IA illisible, réessaie.' })
    return res.status(e.status || 500).json({ error: e.message || 'Erreur inconnue' })
  }
}
