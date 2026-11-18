import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const cache = new Map()

// Photo stockée dans l'espace privé « client-photos » : lien temporaire (1 h) visible uniquement par le client et son coach.
export async function photoUrl(value) {
  if (!value) return null
  if (/^https?:\/\//.test(value)) {
    // anciens liens publics : on retrouve le chemin du fichier
    const m = value.match(/client-photos\/(.+)$/)
    if (!m) return value
    value = decodeURIComponent(m[1])
  }
  const hit = cache.get(value)
  if (hit && hit.exp > Date.now()) return hit.url
  const { data } = await supabase.storage.from('client-photos').createSignedUrl(value, 3600)
  if (data?.signedUrl) cache.set(value, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
  return data?.signedUrl || null
}

export default function PrivatePhoto({ value, alt = '', className, style }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { let on = true; photoUrl(value).then(u => on && setSrc(u)); return () => { on = false } }, [value])
  if (!src) return <div className={className} style={{ ...style, background: 'var(--fill)' }} />
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" />
}
