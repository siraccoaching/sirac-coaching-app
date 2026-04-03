import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email ou mot de passe incorrect.')
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, email, name, role: 'client' })
      }
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col h-full items-center justify-center bg-dark-900 px-6">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 bg-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-600/30">
          <span className="text-4xl">🏈</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Sirac Coaching</h1>
        <p className="text-gray-400 text-sm mt-1">Plateforme de suivi athlètes</p>
      </div>
      <div className="w-full max-w-sm bg-dark-800 rounded-3xl border border-white/10 p-6">
        <h2 className="text-lg font-semibold text-white mb-5">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && <div><label className="block text-sm text-gray-400 mb-1.5">Nom complet</label><input type="text" value={name} onChange={e => setName(e.target.value)} required autoComplete="name" placeholder="Ton prénom et nom" className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors" /></div>}
          <div><label className="block text-sm text-gray-400 mb-1.5">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" placeholder="ton@email.com" className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors" /></div>
          <div><label className="block text-sm text-gray-400 mb-1.5">Mot de passe</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" className="w-full bg-dark-900 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 transition-colors" /></div>
          <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors mt-2">{loading ? 'Connexion…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button>
        </form>
        <p className="text-center text-gray-500 text-sm mt-5">{mode === 'login' ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}<button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-brand-400 hover:text-brand-300 font-medium">{mode === 'login' ? "S'inscrire" : 'Se connecter'}</button></p>
      </div>
    </div>
  )
}
