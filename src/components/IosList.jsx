import { ChevronRight } from 'lucide-react'

// Liste groupée façon Réglages iOS : icône colorée, libellé, détail, chevron.
export function IosList({ title, items, footer }) {
  return (
    <div>
      {title && <p className="ios-section-title">{title}</p>}
      <div className="ios-group" style={{ overflow: 'hidden' }}>
        {items.map((it, i) => {
          const Icon = it.icon
          return (
            <button key={it.label} onClick={it.onClick}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 0 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              {Icon && (
                <span style={{ width: 30, height: 30, borderRadius: 8, background: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} color="white" strokeWidth={2.2} />
                </span>
              )}
              <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px 13px 0', borderBottom: i < items.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 16, color: 'var(--label)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.label}</span>
                {it.badge > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#ff3b30', color: 'white', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.badge}</span>}
                {it.detail && <span style={{ fontSize: 15, color: 'var(--label2)', whiteSpace: 'nowrap' }}>{it.detail}</span>}
                <ChevronRight size={18} color="var(--label3)" style={{ flexShrink: 0 }} />
              </span>
            </button>
          )
        })}
      </div>
      {footer && <p style={{ margin: '6px 16px 0', fontSize: 13, color: 'var(--label2)' }}>{footer}</p>}
    </div>
  )
}
