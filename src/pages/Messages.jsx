import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/hooks'
import { Send } from 'lucide-react'
import { PageLayout } from '../components/Layout'

// ─── Shared conversation view ────────────────────────────────────
export function ConversationView({ otherId, otherName }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (profile?.id && otherId) {
      loadMessages()
      // Mark received messages as read
      supabase.from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', otherId)
        .eq('receiver_id', profile.id)
        .is('read_at', null)
        .then(() => {})
    }
  }, [profile?.id, otherId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${otherId},receiver_id.eq.${otherId}`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }

  async function sendMessage() {
    const content = text.trim()
    if (!content || !profile?.id || !otherId) return
    setText('')
    const { error } = await supabase.from('messages').insert({
      sender_id: profile.id,
      receiver_id: otherId,
      content
    })
    if (!error) await loadMessages()
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const fmt = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%', minHeight:0}}>
      {/* Messages list */}
      <div style={{flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8}}>
        {loading ? (
          <div style={{textAlign:'center', color:'var(--label3)', fontSize:13, paddingTop:20}}>Chargement...</div>
        ) : messages.length === 0 ? (
          <div style={{textAlign:'center', color:'var(--label3)', fontSize:13, paddingTop:40}}>
            <p>Aucun message.</p>
            <p style={{fontSize:12}}>Envoie le premier message !</p>
          </div>
        ) : messages.map(msg => {
          const isMe = msg.sender_id === profile.id
          return (
            <div key={msg.id} style={{display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start'}}>
              <div style={{
                maxWidth:'72%', padding:'9px 13px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isMe ? '#6366f1' : 'var(--card)',
                color: isMe ? 'white' : 'var(--label)', fontSize:15, lineHeight:1.4, boxShadow: isMe ? 'none' : 'var(--card-shadow)'
              }}>
                <p style={{margin:0}}>{msg.content}</p>
                <p style={{margin:'4px 0 0', fontSize:10, color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--label3)', textAlign:'right'}}>
                  {fmt(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef}/>
      </div>
      {/* Input */}
      <div style={{padding:'10px 16px', background:'var(--card)', flexShrink:0, display:'flex', gap:8, alignItems:'flex-end', borderTop:'0.5px solid var(--separator)'}}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Message à ${otherName || '...'}...`}
          rows={1}
          style={{flex:1, background:'var(--fill)', border:'1px solid var(--separator)', borderRadius:12, padding:'10px 14px',
            color:'var(--label)', fontSize:14, resize:'none', outline:'none', fontFamily:'inherit',
            WebkitTextFillColor:'var(--label)', WebkitBoxShadow:'0 0 0px 1000px var(--fill) inset'}}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim()}
          style={{width:40, height:40, borderRadius:20, background: text.trim() ? '#6366f1' : 'var(--fill)',
            border:'none', color: text.trim() ? 'white' : 'var(--label3)', cursor: text.trim() ? 'pointer' : 'default',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
            transition:'background 0.2s'}}>
          <Send size={16}/>
        </button>
      </div>
    </div>
  )
}

// ─── Coach: list of clients + conversation ───────────────────────
export function CoachMessages() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { clientId } = useParams()
  const [clients, setClients] = useState([])
  const [unread, setUnread] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) loadClients() }, [profile?.id])

  async function loadClients() {
    setLoading(true)
    const { data: cls } = await supabase
      .from('profiles')
      .select('id, name, sport, position')
      .eq('coach_id', profile.id)
      .order('name')
    setClients(cls || [])

    if (cls?.length > 0) {
      const { data: unreadMsgs } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('receiver_id', profile.id)
        .is('read_at', null)
      const counts = {}
      for (const m of unreadMsgs || []) {
        counts[m.sender_id] = (counts[m.sender_id] || 0) + 1
      }
      setUnread(counts)
    }
    setLoading(false)
  }

  const selectedClient = clients.find(c => c.id === clientId)

  // ── Conversation view ──
  if (clientId) {
    return (
      <PageLayout fill back="/coach/messages" title={selectedClient ? selectedClient.name : 'Conversation'} subtitle={selectedClient?.sport}>
        {selectedClient || !loading ? (
          <ConversationView otherId={clientId} otherName={selectedClient?.name || ''}/>
        ) : (
          <div style={{textAlign:'center', color:'var(--label3)', padding:40}}>Chargement...</div>
        )}
      </PageLayout>
    )
  }

  // ── Client list ──
  return (
    <PageLayout title="Messages">
      <div style={{padding:'12px 16px'}}>
        {loading ? (
          [1,2,3].map(i => (
            <div key={i} style={{height:64, background:'var(--card)', borderRadius:12, marginBottom:8, opacity:0.5}}/>
          ))
        ) : clients.length === 0 ? (
          <div style={{textAlign:'center', color:'var(--label2)', paddingTop:60}}>
            <p style={{fontSize:15}}>Aucun client</p>
            <p style={{fontSize:12}}>Ajoute des clients pour leur envoyer des messages.</p>
          </div>
        ) : clients.map(client => (
          <button key={client.id}
            onClick={() => navigate(`/coach/messages/${client.id}`)}
            style={{display:'flex', alignItems:'center', gap:12, width:'100%', background:'var(--card)',
              border:'none', borderRadius:12, padding:'12px 16px', marginBottom:8, boxShadow:'var(--card-shadow)',
              color:'var(--label)', cursor:'pointer', textAlign:'left'}}>
            <div style={{width:40, height:40, borderRadius:20, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white',
              display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:16, flexShrink:0}}>
              {client.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <p style={{margin:0, fontWeight:600, fontSize:15}}>{client.name}</p>
              {client.sport && <p style={{margin:0, fontSize:13, color:'var(--label2)'}}>{client.sport}</p>}
            </div>
            {unread[client.id] > 0 && (
              <div style={{background:'#ef4444', borderRadius:10, padding:'2px 7px', fontSize:11, fontWeight:700, color:'white', flexShrink:0}}>
                {unread[client.id]}
              </div>
            )}
          </button>
        ))}
      </div>
    </PageLayout>
  )
}

// ─── Client: conversation with coach ────────────────────────────
export function ClientMessages() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [coach, setCoach] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (profile?.id) getCoach() }, [profile?.id])

  async function getCoach() {
    setLoading(true)
    if (profile?.coach_id) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('id', profile.coach_id)
        .single()
      setCoach(data || null)
    }
    setLoading(false)
  }

  if (loading) {
    return <PageLayout title="Coach"><div style={{textAlign:'center', color:'var(--label3)', padding:40}}>Chargement...</div></PageLayout>
  }

  if (!coach) {
    return (
      <PageLayout title="Coach">
        <div style={{display:'flex', flexDirection:'column', alignItems:'center', color:'var(--label2)', padding:'60px 32px'}}>
          <p style={{fontSize:15, marginBottom:8}}>Aucun coach assigné</p>
          <p style={{fontSize:13, textAlign:'center'}}>Tu n'as pas encore de coach. Contacte ton coach pour qu'il t'ajoute.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout fill title={coach.name} subtitle="Ton coach">
      <ConversationView otherId={coach.id} otherName={coach.name}/>
    </PageLayout>
  )
}
