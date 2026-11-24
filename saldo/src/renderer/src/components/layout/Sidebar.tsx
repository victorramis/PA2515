import { NavLink, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '@/components/ui/icon'
import { needsReview } from '@/lib/categorize'
import { useStore } from '@/store'

interface Item {
  to: string
  label: string
  icon: IconName
  badge?: number
  match?: (p: string) => boolean
}

function NavItem({ it }: { it: Item }) {
  const loc = useLocation()
  const on = it.match ? it.match(loc.pathname) : loc.pathname === it.to
  return (
    <NavLink
      to={it.to}
      aria-current={on ? 'page' : undefined}
      className="flex h-[30px] items-center gap-2.5 rounded-md px-2.5 text-[13px] no-underline"
      style={{ background: on ? 'var(--accentSoft)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text)', fontWeight: on ? 600 : 400 }}
    >
      <Icon name={it.icon} />
      <span className="flex-1">{it.label}</span>
      {!!it.badge && (
        <span className="num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-text">{it.badge}</span>
      )}
    </NavLink>
  )
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <div aria-hidden="true" className="flex flex-none items-end justify-center gap-[3px] rounded-[7px] bg-accent" style={{ width: size, height: size, paddingBottom: size * 0.23 }}>
      {[6, 10, 14].map((h) => (
        <span key={h} className="w-[3px] rounded-[1px] bg-accent-text" style={{ height: (h * size) / 26 }} />
      ))}
    </div>
  )
}

export function Sidebar() {
  const queue = useStore((s) => s.data?.transactions.filter(needsReview).length ?? 0)
  const main: Item[] = [
    { to: '/', label: 'Översikt', icon: 'overview' },
    { to: '/transaktioner', label: 'Transaktioner', icon: 'list' },
    { to: '/granska', label: 'Att granska', icon: 'inbox', badge: queue },
    { to: '/analys', label: 'Analys', icon: 'chart' },
    { to: '/kategorier', label: 'Kategorier', icon: 'tag' },
    { to: '/konton', label: 'Konton', icon: 'bank' },
    { to: '/import', label: 'Import', icon: 'download' }
  ]
  const pension: Item[] = [
    { to: '/pension', label: 'Översikt', icon: 'pie', match: (p) => p === '/pension' || p === '/pension/hamta' },
    { to: '/pension/planera', label: 'Planera', icon: 'sliders' }
  ]
  return (
    <nav
      aria-label="Huvudnavigering"
      className="drag flex h-full w-[232px] flex-none flex-col border-r border-line"
      style={{ background: 'var(--side)', backdropFilter: 'blur(30px) saturate(1.6)', WebkitBackdropFilter: 'blur(30px) saturate(1.6)' }}
    >
      {/* Trafikljusen ritas av macOS (titleBarStyle hiddenInset). */}
      <div className="h-[52px] flex-none" />
      <div className="flex items-center gap-2.5 px-[18px] pb-4 pt-0.5">
        <Logo />
        <div className="flex flex-col leading-tight">
          <span className="text-[14px] font-[650]">Saldo</span>
          <span className="text-small text-text2">Victor · privatekonomi</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-px overflow-auto px-2.5">
        {main.map((it) => (
          <NavItem key={it.to} it={it} />
        ))}
        <div className="px-2.5 pb-1.5 pt-4 text-[11px] font-semibold tracking-[.02em] text-text3">Pension</div>
        {pension.map((it) => (
          <NavItem key={it.to} it={it} />
        ))}
      </div>
      <div className="border-t border-line p-2.5">
        <NavItem it={{ to: '/installningar', label: 'Inställningar', icon: 'gear' }} />
      </div>
    </nav>
  )
}
