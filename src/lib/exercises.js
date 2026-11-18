import { supabase } from './supabase'

// Images de la base pré-remplie (free-exercise-db, domaine public) servies par le CDN jsDelivr.
const IMG_BASE = import.meta.env.VITE_EXERCISE_IMG_BASE
  || 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'

export function exerciseImageUrl(path) {
  if (!path) return null
  if (/^https?:\/\//.test(path)) return path
  return IMG_BASE + path
}

export function getEmbedUrl(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

export function isDirectVideo(url) {
  return !!url && /\.(mp4|webm|mov)(\?.*)?$/i.test(url)
}

export const CATEGORIES = ['Force', 'Gainage', 'Explosivité', 'Haltérophilie', 'Cardio', 'Mobilité', 'Strongman', 'Technique', 'Récupération']
export const MUSCLES = ['Pectoraux', 'Dorsaux', 'Haut du dos', 'Lombaires', 'Épaules', 'Trapèzes', 'Biceps', 'Triceps', 'Avant-bras',
  'Abdominaux', 'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Adducteurs', 'Abducteurs', 'Mollets', 'Cou', 'Corps entier']
export const EQUIPMENT = ['Poids du corps', 'Barre', 'Haltères', 'Kettlebell', 'Poulie', 'Machine', 'Élastiques', 'Barre EZ',
  'Médecine-ball', 'Swiss ball', 'Rouleau', 'Autre']
export const CAT_COLORS = {
  Force: '#6366f1', Cardio: '#ef4444', Mobilité: '#22c55e', Technique: '#f59e0b', Explosivité: '#f97316',
  Gainage: '#06b6d4', Récupération: '#8b5cf6', Haltérophilie: '#eab308', Strongman: '#a855f7',
}

export const LIST_COLUMNS = 'id, coach_id, slug, name, name_en, category, muscles, equipment, level, images, video_url, featured, description'

// Charge la base commune + les exercices perso du coach (ou du coach du client).
// Les exercices perso qui « personnalisent » un exercice commun le remplacent dans la liste.
export async function loadExerciseList() {
  const { data, error } = await supabase.from('exercises').select(LIST_COLUMNS).order('name').limit(2000)
  if (error) throw error
  const own = (data || []).filter(e => e.coach_id)
  const overridden = new Set(own.map(e => e.slug?.split('__custom__')[0]).filter(Boolean))
  return (data || []).filter(e => e.coach_id || !overridden.has(e.slug))
}

export function normalize(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function matchesSearch(ex, q) {
  if (!q) return true
  const n = normalize(q)
  return normalize(ex.name).includes(n) || normalize(ex.name_en).includes(n) || normalize(ex.muscles).includes(n) || normalize(ex.equipment).includes(n)
}

// Correspondance des noms utilisés dans les modèles de programmes -> exercice de la base (nom anglais).
const ALIASES = {
  'squat': 'Barbell Squat', 'deadlift': 'Barbell Deadlift', 'deadlift roumain': 'Romanian Deadlift',
  'hip thrust': 'Barbell Hip Thrust', 'developpe couche': 'Barbell Bench Press - Medium Grip',
  'developpe incline': 'Barbell Incline Bench Press - Medium Grip', 'developpe halteres': 'Dumbbell Bench Press',
  'developpe militaire': 'Standing Military Press', 'rowing barre': 'Bent Over Barbell Row',
  'rowing yates': 'Reverse Grip Bent-Over Rows', 'rowing haltere': 'One-Arm Dumbbell Row',
  'tractions': 'Pullups', 'tractions assistees': 'Band Assisted Pull-Up', 'box jump': 'Front Box Jump',
  'box step-up': 'Dumbbell Step Ups', 'calf raises': 'Standing Calf Raises', 'crunchs': 'Crunches',
  'fentes bulgares': 'Split Squat with Dumbbells', 'fentes marchees': 'Bodyweight Walking Lunge',
  'jump squat': 'Freehand Jump Squat', 'kettlebell swing': 'One-Arm Kettlebell Swings',
  'nordic curl': 'Natural Glute Ham Raise', 'planche': 'Plank', 'pompes': 'Pushups',
  'pont fessier': 'Butt Lift (Bridge)', 'squat goblet': 'Goblet Squat', 'sauts horizontaux': 'Standing Long Jump',
}

export function findLibraryMatch(list, name) {
  const n = normalize(name).trim()
  if (!n) return null
  const alias = ALIASES[n] && normalize(ALIASES[n])
  return list.find(e => normalize(e.name) === n || normalize(e.name_en) === n || (alias && normalize(e.name_en) === alias)) || null
}

// Relie automatiquement les exercices (par leur nom) à la base pour afficher les démos.
export function linkExercisesByName(prog, list) {
  const linkEx = ex => {
    if (ex.exercise_id || !ex.name) return ex
    const m = findLibraryMatch(list, ex.name)
    return m ? { ...ex, exercise_id: m.id, images: m.images, video_url: ex.video_url || m.video_url || '' } : ex
  }
  const linkSess = s => ({ ...s, exercises: s.exercises.map(linkEx) })
  return { ...prog, blocks: prog.blocks.map(b => ({ ...b, sessions: b.sessions.map(linkSess) })), simpleSessions: prog.simpleSessions.map(linkSess) }
}
