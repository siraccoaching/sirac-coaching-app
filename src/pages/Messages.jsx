import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/hooks'
import { ArrowLeft, Send } from 'lucide-react'

// Shared conversation view used by both coach and client
export function ConversationView({ otherId, otherName }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    loadMessages()
    // Real-time subscription
    const channel = supabase.channel('messages_' + otherId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new
        if ((m.sender_id === profile.id && m.receiver_id === otherId) ||
            (m.sender_id === otherId && m.receiver_id === profile.id)) {
          setMessages(prev => [...prev, m])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [otherId])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [messages])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or('and(sender_id.eq.' + profile.id + ',receiver_id.eq.' + otherId + '),and(sender_id.eq.' + otherId + ',receiver_id.eq.' + profile.id + ')')
      .order('created_at', { ascending: true })
    setMessages(data || [])
    // Mark unread as read
    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('receiver_id', profile.id).eq('sender_id', otherId).is('read_at', null)
    setLoading(false)
  }

  async function sendMessage() {
    const content = text.trim()
    if (!content) return
    setText('')
    await supabase.from('messages').insert({ sender_id: profile.id, receiver_id: otherId, content })
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const formatDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Group messages by date
  const grouped = []
  let lastDate = null
  for (const m of messages) {
    const d = new Date(m.created_at).toDateString()
    if (d !== lastDate) { grouped.push({ type: 'date', label: formatDate(m.created_at) }); lastDate = d }
    grouped.push({ type: 'msg', ...m })
  }

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%'}}>
      <div style={{flex:1, overflowY:'auto', padding:'12px 16px'}}>
        {loading ? <p style={{color:'#888', textAlign:'center', marginTop:40}}>Chargement...</p> : null}
        {grouped.map((item, i) => {
          if (item.type === 'date') return (
            <div key={'d'+i} style={{textAlign:'center', margin:'12px 0'}}>
              <span style={{fontSize:11, color:'#666', background:'#1a1a2e', padding:'3px 10px', borderRadius:20}}>{item.label}</span>
            </div>
          )
          const mine = item.sender_id === profile.id
          return (
            <div key={item.id} style={{display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom:6}}>
              <div style={{maxWidth:'75%', background: mine ? '#6366f1' : '#1e1e2e', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding:'10px 14px'}}>
                <p style={{margin:0, fontSize:14, color:'white', lineHeight:1.4}}>{item.content}</p>
                <p style={{margin:'4px 0 0', fontSize:10, color: mine ? 'rgba(255,255,255,0.6)' : '#666', textAlign:'right'}}>{formatTime(item.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef}/>
      </div>

      <div style={{padding:'10px 16px 24px', background:'#1e1e2e', borderTop:'1px solid #2a2a3e', display:'flex', gap:10, alignItems:'flex-end'}}>
        <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
          placeholder={"Message Ã  " + otherName + "..."}
          rows={1} style={{flex:1, background:'#2a2a3e', border:'1px solid #3a3a4e', borderRadius:12, padding:'10px 14px',
            color:'white', fontSize:14, resize:'none', outline:'none',
            WebkitTextFillColor:'white', WebkitBoxShadow:'0 0 0px 1000px #2a2a3e inset'}}/>
        <button onClick={sendMessage} disabled={!text.trim()}
          style={{background: text.trim() ? '#6366f1' : '#2a2a3e', border:'none', borderRadius:12, padding:'10px 12px',
            color:'white', cursor: text.trim() ? 'pointer' : 'default', flexShrink:0}}>
          <Send size={18}/>
        </button>
      </div>
    </div>
  )
}

// Coach view: list all clients, click to open conversation
export function CoachMessages() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { clientId } = useParams()
  const [clients, setClients] = useState([])
  const [unread, setUnread] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    const { data: cls } = await supabase.from('profiles').select('id, full_name, sport, position').eq('coach_id', profile.id).order('full_name')
    setClients(cls || [])
    if (cls?.length > 0) {
      const { data: unreadMsgs } = await supabase.from('messages').select('sender_id').eq('receiver_id', profile.id).is('read_at', null)
      const counts = {}
      for (const m of unreadMsgs || []) { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1 }
      setUnread(counts)
    }
    setLoading(false)
  }

  const selectedClient = clients.find(c => c.id === clientId)

  if (clientId && selectedClient) {
    return (
      <div style={{minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column'}}>
        <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
          <button onClick={() => navigate('/coach/messages')} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><ArrowLeft size={20}/></button>
          <div>
            <p style={{margin:0, fontWeight:700, fontSize:16, color:'white'}}>{selectedClient.full_name}</p>
            {selectedClient.sport && <p style={{margin:0, fontSize:12, color:'#888'}}>{selectedClient.sport}</p>}
          </div>
        </div>
        <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
          <ConversationView otherId={clientId} otherName={selectedClient.full_name}/>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', color:'white', paddingBottom:80}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={() => navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><ArrowLeft size={20}/></button>
        <h2 style={{margin:0, fontSize:18}}>Messages</h2>
        {Object.values(unread).reduce((a,b)=>a+b,0) > 0 && (
          <span style={{background:'#ef4444', borderRadius:20, padding:'2px 8px', fontSize:12, fontWeight:700}}>{Object.values(unread).reduce((a,b)=>a+b,0)}</span>
        )}
      </div>
      <div style={{padding:'12px 16px'}}>
        {loading ? <p style={{color:'#888', textAlign:'center', marginTop:40}}>Chargement...</p> :
         clients.length === 0 ? <p style={{color:'#888', textAlign:'center', marginTop:40}}>Aucun client</p> : (
          clients.map(c => (
            <button key={c.id} onClick={() => navigate('/coach/messages/' + c.id)}
              style={{width:'100%', background:'#1e1e2e', border:'none', borderRadius:12, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, cursor:'pointer', textAlign:'left'}}>
              <div style={{width:40, height:40, borderRadius:'50%', background:'#6366f133', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                <span style={{color:'#6366f1', fontWeight:700, fontSize:16}}>{c.full_name[0]}</span>
              </div>
              <div style={{flex:1}}>
                <p style={{margin:0, fontWeight:600, color:'white', fontSize:15}}>{c.full_name}</p>
                {c.sport && <p style={{margin:0, fontSize:12, color:'#888'}}>{c.sport}{c.position ? ' Â· ' + c.position : ''}</p>}
              </div>
              {unread[c.id] > 0 && (
                <span style={{background:'#6366f1', color:'white', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0}}>{unread[c.id]}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// Client view: conversation with coach
export function ClientMessages() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [coachId, setCoachId] = useState(null)
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getCoach() {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('id', profile.coach_id).single()
      if (data) { setCoachId(data.id); setCoachName(data.full_name) }
      setLoading(false)
    }
    if (profile?.coach_id) getCoach()
    else setLoading(false)
  }, [profile])

  return (
    <div style={{minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column'}}>
      <div style={{background:'#1e1e2e', padding:'16px 20px', display:'flex', alignItems:'center', gap:12}}>
        <button onClick={() => navigate(-1)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><ArrowLeft size={20}/></button>
        <h2 style={{margin:0, fontSize:18}}>Mon coach {coachName ? 'â ' + coachName : ''}</h2>
      </div>
      {loading ? <p style={{color:'#888', textAlign:'center', marginTop:40}}>Chargement...</p> :
       !coachId ? <p style={{color:'#888', textAlign:'center', marginTop:40}}>Aucun coach associÃ©</p> : (
        <div style={{flex:1, overflow:'hidden', display:'flex', flexDirection:'column'}}>
          <ConversationView otherId={coachId} otherName={coachName}/>
        </div>
      )}
    </div>
  )
}
