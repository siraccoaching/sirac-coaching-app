import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/hooks'
import { Send, Paperclip, Mic, Square } from 'lucide-react'
import { PageLayout } from '../components/Layout'

// ─── Shared conversation view ────────────────────────────────────
const MAX_MB = 50
const kindOf = type => type.startsWith('image/') ? 'image' : type.startsWith('video/') ? 'video' : type.startsWith('audio/') ? 'audio' : null

export function ConversationView({ otherId, otherName }) {
  const { profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [rec, setRec] = useState(null) // { recorder, start, chunks }
  const [recSecs, setRecSecs] = useState(0)
  const bottomRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!profile?.id || !otherId) return
    loadMessages()
    markRead()
    // nouveaux messages reçus en direct
    const ch = supabase.channel('conv-' + profile.id + '-' + otherId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${profile.id}` }, ({ new: m }) => {
        if (m.sender_id !== otherId) return
        setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m]); markRead()
      }).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.id, otherId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setRecSecs(Math.round((Date.now() - rec.start) / 1000)), 250)
    return () => clearInterval(t)
  }, [rec])

  function markRead() {
    supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherId).eq('receiver_id', profile.id).is('read_at', null).then(() => {})
  }

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase.from('messages').select('*')
      .or(`sender_id.eq.${otherId},receiver_id.eq.${otherId}`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setLoading(false)
  }

  async function insertMessage(row) {
    const { data, error: e } = await supabase.from('messages').insert({ sender_id: profile.id, receiver_id: otherId, ...row }).select().single()
    if (e) { setError("Message non envoyé : " + e.message); return false }
    setMessages(prev => [...prev, data])
    return true
  }

  async function sendMessage() {
    const content = text.trim()
    if (!content || !profile?.id || !otherId) return
    setText('')
    if (!(await insertMessage({ content }))) setText(content)
  }

  // Photo, vidéo ou vocal : envoi dans l'espace privé de la conversation, puis message
  async function sendFile(file, forcedKind) {
    setError('')
    const ext0 = (file.name?.split('.').pop() || '').toLowerCase()
    const guessed = file.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', mov: 'video/quicktime', mp4: 'video/mp4', m4a: 'audio/mp4' })[ext0] || ''
    if (guessed && guessed !== file.type) file = new File([file], file.name, { type: guessed })
    const kind = forcedKind || kindOf(file.type || '')
    if (!kind) { setError('Format non pris en charge (photo, vidéo ou audio).'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`Fichier trop lourd (${Math.round(file.size / 1048576)} Mo). Maximum ${MAX_MB} Mo.`); return }
    setUploading(true)
    const ext = (file.name?.split('.').pop() || (file.type.split('/')[1] || 'bin').split(';')[0]).toLowerCase().slice(0, 5)
    const path = `${profile.id}/${otherId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error: upErr } = await supabase.storage.from('message-media').upload(path, file, { contentType: file.type.split(';')[0] || undefined })
    if (upErr) { setError("Envoi impossible : " + upErr.message); setUploading(false); return }
    await insertMessage({ content: text.trim(), attachment_path: path, attachment_type: kind })
    setText('')
    setUploading(false)
  }

  async function toggleRecord() {
    if (rec) { rec.recorder.stop(); return }
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks = []
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data)
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const type = (recorder.mimeType || mime || 'audio/webm').split(';')[0]
        const blob = new Blob(chunks, { type })
        setRec(null); setRecSecs(0)
        if (blob.size > 0) sendFile(new File([blob], 'vocal.' + (type.includes('mp4') ? 'm4a' : 'webm'), { type }), 'audio')
      }
      recorder.start()
      setRec({ recorder, start: Date.now() })
    } catch {
      setError("Micro inaccessible : autorise le micro pour l'app dans les réglages du téléphone.")
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const fmt = (ts) => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const iconBtn = { width: 40, height: 40, borderRadius: 20, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%', minHeight:0}}>
      <div style={{flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:8}}>
        {loading ? (
          <div style={{textAlign:'center', color:'var(--label3)', fontSize:13, paddingTop:20}}>Chargement...</div>
        ) : messages.length === 0 ? (
          <div style={{textAlign:'center', color:'var(--label3)', fontSize:13, paddingTop:40}}>
            <p>Aucun message.</p>
            <p style={{fontSize:12}}>Envoie le premier message, une photo, une vidéo ou un vocal !</p>
          </div>
        ) : messages.map(msg => {
          const isMe = msg.sender_id === profile.id
          return (
            <div key={msg.id} data-testid="message" style={{display:'flex', justifyContent: isMe ? 'flex-end' : 'flex-start'}}>
              <div style={{
                maxWidth: msg.attachment_type && msg.attachment_type !== 'audio' ? '78%' : '75%', padding: msg.attachment_type && msg.attachment_type !== 'audio' ? 4 : '9px 13px',
                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isMe ? '#6366f1' : 'var(--card)',
                color: isMe ? 'white' : 'var(--label)', fontSize:15, lineHeight:1.4, boxShadow: isMe ? 'none' : 'var(--card-shadow)'
              }}>
                {msg.attachment_path && <MessageMedia path={msg.attachment_path} type={msg.attachment_type} />}
                {msg.content && <p style={{margin: msg.attachment_type && msg.attachment_type !== 'audio' ? '6px 9px 0' : (msg.attachment_type ? '6px 0 0' : 0)}}>{msg.content}</p>}
                <p style={{margin: msg.attachment_type && msg.attachment_type !== 'audio' ? '4px 9px 4px' : '4px 0 0', fontSize:10, color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--label3)', textAlign:'right'}}>
                  {fmt(msg.created_at)}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef}/>
      </div>
      {error && <p role="alert" style={{margin:0, padding:'8px 16px', fontSize:13, color:'var(--red-text)', background:'var(--card)'}}>{error}</p>}
      <div style={{padding:'10px 12px', background:'var(--card)', flexShrink:0, display:'flex', gap:8, alignItems:'flex-end', borderTop:'0.5px solid var(--separator)'}}>
        <input ref={fileRef} type="file" accept="image/*,video/*" hidden data-testid="chat-file"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendFile(f) }} />
        {!rec && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Envoyer une photo ou une vidéo"
            style={{...iconBtn, background:'var(--fill)', color:'var(--accent-text)'}}><Paperclip size={18}/></button>
        )}
        {rec ? (
          <div data-testid="recording" style={{flex:1, height:40, borderRadius:12, background:'rgba(255,59,48,0.12)', color:'var(--red-text)', display:'flex', alignItems:'center', gap:8, padding:'0 14px', fontWeight:600, fontSize:14}}>
            <span className="rec-dot" /> Enregistrement… {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, '0')}
          </div>
        ) : (
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder={uploading ? 'Envoi en cours…' : `Message à ${otherName || '...'}...`}
            rows={1}
            style={{flex:1, minWidth:0, background:'var(--fill)', border:'1px solid var(--separator)', borderRadius:12, padding:'10px 14px',
              color:'var(--label)', fontSize:16, resize:'none', outline:'none', fontFamily:'inherit',
              WebkitTextFillColor:'var(--label)', WebkitBoxShadow:'0 0 0px 1000px var(--fill) inset'}}
          />
        )}
        {text.trim() && !rec ? (
          <button onClick={sendMessage} aria-label="Envoyer" style={{...iconBtn, background:'#6366f1', color:'white'}}><Send size={16}/></button>
        ) : (
          <button onClick={toggleRecord} disabled={uploading} aria-label={rec ? "Arrêter et envoyer le vocal" : "Enregistrer un message vocal"} data-testid="mic-btn"
            style={{...iconBtn, background: rec ? '#ff3b30' : 'var(--fill)', color: rec ? 'white' : 'var(--accent-text)'}}>
            {rec ? <Square size={15} fill="white"/> : <Mic size={18}/>}
          </button>
        )}
      </div>
    </div>
  )
}

// Pièce jointe privée : lien temporaire signé
function MessageMedia({ path, type }) {
  const [url, setUrl] = useState(null)
  const [full, setFull] = useState(false)
  useEffect(() => {
    let alive = true
    supabase.storage.from('message-media').createSignedUrl(path, 3600).then(({ data }) => { if (alive) setUrl(data?.signedUrl || null) })
    return () => { alive = false }
  }, [path])
  if (!url) return <div style={{width: type === 'audio' ? 220 : 220, height: type === 'audio' ? 40 : 160, borderRadius:12, background:'rgba(127,127,127,0.2)'}} />
  if (type === 'image') return (
    <>
      <img src={url} alt="Photo" data-testid="msg-image" onClick={() => setFull(true)} style={{display:'block', maxWidth:'100%', maxHeight:300, borderRadius:12, cursor:'zoom-in'}} />
      {full && <div onClick={() => setFull(false)} style={{position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <img src={url} alt="Photo" style={{maxWidth:'100%', maxHeight:'100%'}} /></div>}
    </>
  )
  if (type === 'video') return <video src={url} controls playsInline preload="metadata" data-testid="msg-video" style={{display:'block', maxWidth:'100%', maxHeight:320, borderRadius:12, background:'#000'}} />
  return <audio src={url} controls preload="metadata" data-testid="msg-audio" style={{display:'block', width:230, maxWidth:'100%', height:40}} />
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
