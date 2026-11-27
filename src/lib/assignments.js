import { supabase } from './supabase'
import { cacheGet, cacheSet, isNetworkError, isOffline } from './offline'

// Un programme peut être suivi par plusieurs clients ; chaque client a un seul programme actif.

// Programme actif du client connecté (ou d'un client donné), avec la sélection demandée.
export async function loadClientProgram(clientId, select = '*') {
  const key = 'program:' + clientId + ':' + select.replace(/\s+/g, '').length
  if (isOffline()) return cacheGet(key)
  const { data, error } = await supabase.from('program_assignments')
    .select(`program_id, assigned_at, start_date, program:programs(${select})`)
    .eq('client_id', clientId).maybeSingle()
  if (error && isNetworkError(error)) return cacheGet(key) // hors ligne : dernier programme connu
  // date de début du programme pour ce client (sert à calculer la phase et la semaine en cours)
  const prog = data?.program ? { ...data.program, _start: data.start_date || data.assigned_at?.slice(0, 10) } : null
  if (!error) cacheSet(key, prog)
  return prog
}

// Clients assignés à un programme
export async function loadProgramClients(programId) {
  const { data } = await supabase.from('program_assignments').select('client_id').eq('program_id', programId)
  return (data || []).map(a => a.client_id)
}

// Remplace la liste des clients d'un programme. Un client déjà sur un autre programme y est retiré.
export async function setProgramClients(programId, clientIds) {
  const ids = [...new Set(clientIds.filter(Boolean))]
  let q = supabase.from('program_assignments').delete().eq('program_id', programId)
  if (ids.length) q = q.not('client_id', 'in', `(${ids.join(',')})`)
  const { error: delErr } = await q
  if (delErr) throw delErr
  if (!ids.length) return
  const now = new Date().toISOString()
  const { error } = await supabase.from('program_assignments')
    .upsert(ids.map(client_id => ({ program_id: programId, client_id, updated_at: now })), { onConflict: 'client_id' })
  if (error) throw error
}

// Assigne un programme à un seul client sans toucher aux autres clients du programme.
export async function assignClient(programId, clientId) {
  if (!programId) {
    const { error } = await supabase.from('program_assignments').delete().eq('client_id', clientId)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('program_assignments')
    .upsert({ program_id: programId, client_id: clientId, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
  if (error) throw error
}

// Copie complète d'un programme (blocs, séances, exercices). Renvoie le nouveau programme et
// la correspondance « ancienne séance → nouvelle séance ».
export async function copyProgram(programId, coachId, name) {
  const { data: prog, error: pe } = await supabase.from('programs').select('*').eq('id', programId).single()
  if (pe) throw pe
  const { data: newProg, error } = await supabase.from('programs').insert({
    name: name || prog.name + ' (copie)', type: prog.type, description: prog.description, coach_id: coachId, is_active: true,
  }).select().single()
  if (error) throw error
  const blockMap = {}, sessionMap = {}
  const { data: blocks } = await supabase.from('program_blocks').select('*').eq('program_id', programId).order('order_index')
  for (const b of blocks || []) {
    const { data: nb, error: be } = await supabase.from('program_blocks').insert({
      program_id: newProg.id, name: b.name, description: b.description, duration_weeks: b.duration_weeks, week_labels: b.week_labels || {}, order_index: b.order_index,
    }).select().single()
    if (be) throw be
    blockMap[b.id] = nb.id
  }
  const { data: sessions } = await supabase.from('program_sessions').select('*, program_exercises(*)').eq('program_id', programId).order('order_index')
  for (const sess of sessions || []) {
    const { data: ns, error: se } = await supabase.from('program_sessions').insert({
      program_id: newProg.id, block_id: sess.block_id ? blockMap[sess.block_id] || null : null,
      name: sess.name, notes: sess.notes, day_number: sess.day_number, order_index: sess.order_index,
    }).select().single()
    if (se) throw se
    sessionMap[sess.id] = ns.id
    const exs = sess.program_exercises || []
    if (exs.length) {
      // toutes les colonnes de l'exercice (fourchettes, tempo, progression par semaine…) sauf ses identifiants
      const { error: ee } = await supabase.from('program_exercises').insert(exs.map(({ id, session_id, created_at, ...ex }) => ({ ...ex, session_id: ns.id })))
      if (ee) throw ee
    }
  }
  return { program: newProg, sessionMap }
}

// Programme partagé → version personnelle pour un seul client (son planning suit la copie).
export async function personalizeForClient(programId, clientId, clientName, coachId) {
  const { data: prog } = await supabase.from('programs').select('name').eq('id', programId).single()
  const { program, sessionMap } = await copyProgram(programId, coachId, `${prog?.name || 'Programme'} · ${clientName}`)
  await assignClient(program.id, clientId)
  const { error } = await supabase.rpc('remap_client_schedule', { p_client: clientId, p_map: sessionMap })
  if (error) throw error
  return program
}
