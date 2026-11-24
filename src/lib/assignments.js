import { supabase } from './supabase'

// Un programme peut être suivi par plusieurs clients ; chaque client a un seul programme actif.

// Programme actif du client connecté (ou d'un client donné), avec la sélection demandée.
export async function loadClientProgram(clientId, select = '*') {
  const { data } = await supabase.from('program_assignments')
    .select(`program_id, assigned_at, program:programs(${select})`)
    .eq('client_id', clientId).maybeSingle()
  return data?.program || null
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
