import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LogOut, ChevronLeft, Home, UsersRound, Dumbbell, LineChart, Settings, ClipboardList, LibraryBig, MessagesSquare, MessageCircleHeart, CircleUserRound } from 'lucide-react'

let lastPath = null
function navClass(path) {
  const depth = p => (p || '').split('/').filter(Boolean).length
  const prev = lastPath; lastPath = path
  if (!prev || prev === path) return 'ios-page'
  return depth(path) > depth(prev) ? 'nav-push' : depth(path) < depth(prev) ? 'nav-back' : 'ios-page'
}

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
    { icon: UsersRound, emoji: '👥', color: '#007aff', label: 'Clients', path: '/coach' },
    { icon: ClipboardList, emoji: '📋', color: '#5e5ce6', label: 'Programmes', path: '/coach/programs' },
    { icon: LibraryBig, emoji: '📚', color: '#ff9500', label: 'Biblioth\u00e8que', path: '/coach/exercises' },
    { icon: MessagesSquare, emoji: '💬', color: '#34c759', label: 'Messages', path: '/coach/messages' },
    { icon: Settings, emoji: '⚙️', color: '#8e8e93', label: 'R\u00e9glages', path: '/coach/settings' },
  ]

  const clientNav = [
    { icon: Home, emoji: '🏠', color: '#007aff', label: 'Accueil', path: '/client' },
    { icon: Dumbbell, emoji: '🏋️', color: '#5e5ce6', label: 'Programme', path: '/client/program' },
    { icon: LineChart, emoji: '📈', color: '#ff9500', label: 'Progr\u00e8s', path: '/client/progress' },
    { icon: MessageCircleHeart, emoji: '💬', color: '#34c759', label: 'Coach', path: '/client/messages' },
    { icon: CircleUserRound, emoji: '👤', color: '#8e8e93', label: 'Profil', path: '/client/profile' },
  ]

  const navItems = isCoach ? coachNav : isClient ? clientNav : null

  function isActive(path) {
    if (path === '/coach' || path === '/client') return location.pathname === path
    return location.pathname.startsWith(path)
  }

  const showLogout = !back
  const [anim] = useState(() => navClass(location.pathname))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      {/* Barre de navigation translucide façon iOS */}
      <header style={{ flexShrink: 0, position: 'relative', zIndex: 20, background: 'var(--bar-bg)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)', borderBottom: '0.5px solid var(--bar-border)' }}>
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

      <main key={location.pathname} className={'scrollbar-hide ' + anim} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', paddingBottom: navItems ? 'calc(72px + var(--sab))' : 'var(--sab)' }}>
        {children}
      </main>

      {/* Barre d'onglets translucide façon iOS */}
      {navItems && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 'calc(56px + var(--sab))', paddingBottom: 'var(--sab)',
          background: 'var(--bar-bg)', backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderTop: '0.5px solid var(--bar-border)', display: 'flex', zIndex: 100,
        }}>
          {navItems.map(item => <TabItem key={item.path} item={item} active={isActive(item.path)} onClick={() => navigate(item.path)} />)}
        </nav>
      )}
    </div>
  )
}

// Style des icônes de la barre du bas : 'apple' (contour + pastille), 'color' (carrés colorés), 'emoji'
function tabStyle() { try { return localStorage.getItem('sirac-tabstyle') || 'apple' } catch { return 'apple' } }

function TabItem({ item, active, onClick }) {
  const { icon: Icon, emoji, color, label } = item
  const style = tabStyle()
  let glyph
  if (style === 'emoji') {
    glyph = <span style={{ fontSize: 23, lineHeight: 1, filter: active ? 'none' : 'grayscale(.9) opacity(.55)', transform: active ? 'scale(1.15)' : 'none', transition: 'transform .25s cubic-bezier(.2,1.4,.4,1), filter .2s' }}>{emoji}</span>
  } else if (style === 'color') {
    glyph = (
      <span style={{ width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? color : 'var(--fill)',
        boxShadow: active ? `0 4px 12px ${color}55` : 'none', transform: active ? 'translateY(-1px) scale(1.06)' : 'none', transition: 'all .25s cubic-bezier(.2,1.4,.4,1)' }}>
        <Icon size={17} strokeWidth={2.2} color={active ? 'white' : 'var(--label3)'} />
      </span>
    )
  } else {
    glyph = (
      <span style={{ width: 56, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--accent-soft)' : 'transparent', transition: 'background .25s' }}>
        <Icon size={23} strokeWidth={active ? 2.4 : 1.8} />
      </span>
    )
  }
  return (
    <button onClick={onClick} aria-current={active ? 'page' : undefined} aria-label={label}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'transparent', border: 'none', cursor: 'pointer',
        color: active ? (style === 'apple' ? 'var(--accent)' : 'var(--label)') : 'var(--label3)', transition: 'color 0.2s' }}>
      {glyph}
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{label}</span>
    </button>
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
