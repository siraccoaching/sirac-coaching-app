import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, ChevronLeft, Home, Users, Dumbbell, MessageCircle, TrendingUp, Calendar, Settings, User } from 'lucide-react'

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
    { icon: User, label: 'Profil', path: '/client/profile' },
  ]

  const navItems = isCoach ? coachNav : isClient ? clientNav : null

  function isActive(path) {
    if (path === '/coach' || path === '/client') return location.pathname === path
    return location.pathname.startsWith(path)
  }

  const showLogout = !back
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Barre de navigation translucide façon iOS */}
      <header style={{ flexShrink: 0, position: 'relative', zIndex: 20, background: 'var(--bar-bg)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', borderBottom: '0.5px solid var(--bar-border)', paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: back ? '10px 12px 10px 6px' : '14px 16px 10px', minHeight: 44 }}>
          {back && (
            <button onClick={() => navigate(back)} aria-label="Retour"
              style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '4px 6px 4px 0', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 17, flexShrink: 0 }}>
              <ChevronLeft size={28} strokeWidth={2.2} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: back ? 19 : 30, fontWeight: 700, letterSpacing: back ? '-0.02em' : '-0.025em', color: 'var(--label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.15 }}>{title}</h1>
            {subtitle && <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--label2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</p>}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
          {showLogout && (
            <button onClick={handleLogout} aria-label="Se déconnecter" title="Se déconnecter"
              style={{ padding: 8, borderRadius: 999, background: 'var(--fill)', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
              <LogOut size={16} color="var(--label2)" />
            </button>
          )}
        </div>
      </header>

      <main key={location.pathname} className="scrollbar-hide ios-page" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: navItems ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : 0 }}>
        {children}
      </main>

      {/* Barre d'onglets translucide façon iOS */}
      {navItems && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 'calc(56px + env(safe-area-inset-bottom, 0px))', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'var(--bar-bg)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderTop: '0.5px solid var(--bar-border)', display: 'flex', zIndex: 100,
        }}>
          {navItems.map(({ icon: Icon, label, path }) => {
            const active = isActive(path)
            return (
              <button key={path} onClick={() => navigate(path)} aria-current={active ? 'page' : undefined}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'transparent', border: 'none', cursor: 'pointer',
                  color: active ? 'var(--accent)' : 'var(--label3)', transition: 'color 0.2s' }}>
                <Icon size={23} strokeWidth={active ? 2.3 : 1.8} />
                <span style={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>{label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`bg-dark-800 rounded-2xl ${className}`}>{children}</div>
}

export function Badge({ color = 'gray', children }) {
  const colors = {
    gray: ['rgba(142,142,147,0.18)', 'var(--label2)'], green: ['rgba(52,199,89,0.16)', 'var(--green-text)'],
    blue: ['rgba(0,122,255,0.14)', 'var(--accent-text)'], orange: ['rgba(255,149,0,0.16)', 'var(--orange-text)'],
    purple: ['rgba(175,82,222,0.16)', 'var(--accent-text)'], red: ['rgba(255,59,48,0.14)', 'var(--red-text)'],
  }
  const [bg, fg] = colors[color] || colors.gray
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: bg, color: fg }}>{children}</span>
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
