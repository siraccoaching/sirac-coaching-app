import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, ChevronLeft } from 'lucide-react'

export function PageLayout({ children, title, subtitle, back, action }) {
  const navigate = useNavigate()
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }
  return (
    <div className="flex flex-col h-full bg-dark-900 overflow-hidden">
      <header className="flex-shrink-0 bg-dark-800 border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          {back && <button onClick={() => navigate(back)} className="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10"><ChevronLeft size={22} className="text-gray-300" /></button>}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{title}</h1>
            {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
          <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/10 ml-1"><LogOut size={18} className="text-gray-400" /></button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto scrollbar-hide">{children}</main>
    </div>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`bg-dark-800 rounded-2xl border border-white/10 ${className}`}>{children}</div>
}

export function Badge({ color = 'gray', children }) {
  const colors = { gray: 'bg-gray-500/20 text-gray-300', green: 'bg-green-500/20 text-green-400', blue: 'bg-blue-500/20 text-blue-400', orange: 'bg-orange-500/20 text-orange-400', purple: 'bg-purple-500/20 text-purple-400', red: 'bg-red-500/20 text-red-400' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>
}

export function SportIcon({ sport }) {
  const icons = { 'Football US': 'ðÅ¸', 'Rugby': 'ðÅ¸â°', 'Basket': 'ðÅ¸â¬', 'Athlétisme': 'ðÅ¸Æ', 'Fitness': 'ðÅ¸âª', 'Football': 'âÅ¾½' }
  return <span>{icons[sport] || 'ðÅ¸Å½¯'}</span>
}
