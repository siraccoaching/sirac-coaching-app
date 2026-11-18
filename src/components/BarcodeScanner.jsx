import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

// Scan de code-barre via la caméra (ZXing, compatible iPhone/Android), avec saisie manuelle en secours.
export default function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    let controls = null
    let cancelled = false
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Caméra non disponible sur cet appareil. Saisis le code-barre à la main.')
        return
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'), import('@zxing/library'),
        ])
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E])
        const reader = new BrowserMultiFormatReader(hints)
        if (cancelled) return
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (result && !cancelled) {
              cancelled = true
              controls?.stop()
              if (navigator.vibrate) navigator.vibrate(80)
              onDetected(result.getText())
            }
          },
        )
      } catch (e) {
        setError(e?.name === 'NotAllowedError'
          ? 'Accès à la caméra refusé. Autorise la caméra dans les réglages, ou saisis le code à la main.'
          : 'Impossible de démarrer la caméra. Saisis le code-barre à la main.')
      }
    }
    start()
    return () => { cancelled = true; controls?.stop() }
  }, [])

  return (
    <div data-testid="barcode-scanner" style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1200, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', color: 'white' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Scanner un code-barre</p>
        <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={22} /></button>
      </div>
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', left: '10%', right: '10%', top: '38%', height: '22%', border: '3px solid #22c55e', borderRadius: 16, boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
        {error && <p style={{ position: 'absolute', top: 16, left: 16, right: 16, margin: 0, background: 'rgba(239,68,68,0.9)', color: 'white', padding: '10px 12px', borderRadius: 12, fontSize: 13 }}>{error}</p>}
      </div>
      <form onSubmit={e => { e.preventDefault(); if (manual.trim()) onDetected(manual.trim()) }}
        style={{ display: 'flex', gap: 8, padding: '14px 16px 28px', background: '#111' }}>
        <input value={manual} onChange={e => setManual(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Ou tape le code (ex : 3017620422003)"
          style={{ flex: 1, minWidth: 0, background: '#222', border: '1px solid #333', borderRadius: 10, padding: '10px 12px', color: 'white', WebkitTextFillColor: 'white' }} />
        <button type="submit" style={{ background: '#22c55e', border: 'none', borderRadius: 10, padding: '0 16px', color: 'white', fontWeight: 700, cursor: 'pointer' }}>OK</button>
      </form>
    </div>
  )
}
