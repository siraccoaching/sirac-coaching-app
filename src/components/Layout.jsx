import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, ChevronLeft, Home, Users, Dumbbell, MessageCircle, TrendingUp, Calendar, Settings } from 'lucide-react'

export function PageLayout({ children, title, subtitle, back, action }) {
  const navigate = useNavigate()
  const location = useLocation()

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isCoach = location.pathname.startsWith('/coach')
  const isClient = location.pathname.startsWith('/client')

  const coachNav = [
    { icon: Users, label: 'Clients', path: '/coach' },
    { icon: Dumbbell, label: 'Programmes', path: '/coach/programs' },
    { icon: Calendar, label: 'Agenda', path: '/coach/calendar' },
    { icon: MessageCircle, label: 'Messages', path: '/coach/messages' },
    { icon: Settings, label: 'R\u00e9glages', path: '/coach/settings' },
  ]

  const clientNav = [
    { icon: Home, label: 'Accueil', path: '/client' },
    { icon: Dumbbell, label: 'Programme', path: '/client/program' },
    { icon: TrendingUp, label: 'Progr\u00e8s', path: '/client/progress' },
    { icon: MessageCircle, label: 'Coach', path: '/client/messages' },
  ]

  const navItems = isCoach ? coachNav : isClient ? clientNav : null

  function isActive(path) {
    if (path === '/coach' || path === '/client') return location.pathname === path
    return location.pathname.startsWith(path)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d1a', overflow: 'hidden' }}>
      <header style={{ flexShrink: 0, background: 'linear-gradient(180deg,#14142a,#111124)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px' }}>
          {back && (
            <button onClick={() => navigate(back)}
              style={{ padding: 6, marginLeft: -6, borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
              <ChevronLeft size={22} color="#999" />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h1>
            {subtitle && <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.38)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{subtitle}</p>}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
          <button onClick={handleLogout}
            style={{ padding: 7, borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
            <LogOut size={16} color="rgba(255,255,255,0.25)" />
          </button>
        </div>
      </header>

      <main className="scrollbar-hide" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: navItems ? 68 : 0 }}>
        {children}
      </main>

      {navItems && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 60,
          background: 'rgba(13,13,26,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', zIndex: 100,
        }}>
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = isActive(path)
            return (
              <button key={path} onClick={() => navigate(path)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 3, background: 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? '#818cf8' : 'rgba(255,255,255,0.28)',
                  transition: 'color 0.15s',
                }}>
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>{label}</span>
                {active && <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#818cf8', marginTop: 1 }} />}
              </button>
            )
          })}
        </nav>
      )}
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
  const icons = {
    'Football US': '\u{1F3C8}', 'Rugby': '\u{1F3C9}', 'Basket': '\u{1F3C0}', 'Basketball': '\u{1F3C0}',
    'Athl\u00e9tisme': '\u{1F3C3}', 'Athletisme': '\u{1F3C3}', 'Fitness': '\u{1F4AA}',
    'Fitness / Musculation': '\u{1F4AA}', 'Football': '\u26BD', 'Tennis': '\u{1F3BE}',
    'Natation': '\u{1F3CA}', 'Cyclisme': '\u{1F6B4}', 'CrossFit': '\u{1F3CB}\uFE0F', 'Arts martiaux': '\u{1F94B}',
  }
  return <span>{icons[sport] || '\u{1F3C5}'}</span>
}
