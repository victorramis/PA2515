import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

type Variant = 'default' | 'primary' | 'danger' | 'ghost'
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }>(function Button(
  { variant = 'default', className, type = 'button', ...p },
  ref
) {
  return <button ref={ref} type={type} className={cn('btn', variant === 'primary' && 'btn-primary', variant === 'danger' && 'btn-danger', variant === 'ghost' && 'btn-ghost', className)} {...p} />
})

export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' }) {
  return (
    <section className={cn('card', className)} {...p}>
      {children}
    </section>
  )
}

export function CardTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-3', className)}>
      <h2 className="m-0 flex-1 text-[13px] font-semibold">{children}</h2>
      {right}
    </div>
  )
}

export function Banner({ level, title, children, action }: { level: 'warn' | 'neg' | 'info'; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  const bg = level === 'neg' ? 'var(--negSoft)' : level === 'warn' ? 'var(--warnSoft)' : 'var(--accentSoft)'
  const fg = level === 'neg' ? 'var(--neg)' : level === 'warn' ? 'var(--warn)' : 'var(--accent)'
  return (
    <div role={level === 'info' ? 'status' : 'alert'} className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-2.5" style={{ background: bg }}>
      <span style={{ color: fg }} className="flex">
        <Icon name={level === 'neg' ? 'error' : level === 'warn' ? 'warn' : 'check'} stroke={2} />
      </span>
      <span className="flex-1">
        <strong className="font-semibold">{title}</strong> {children && <span className="num text-text2">{children}</span>}
      </span>
      {action}
    </div>
  )
}

export function Switch({ checked, onChange, labelledBy, label }: { checked: boolean; onChange: (v: boolean) => void; labelledBy?: string; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-5 w-[34px] flex-none cursor-pointer rounded-full border-0 transition-colors"
      style={{ background: checked ? 'var(--accent)' : 'var(--line)' }}
    >
      <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" style={{ left: checked ? 16 : 2 }} />
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label, role = 'radiogroup' }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string; role?: 'radiogroup' | 'tablist' }) {
  return (
    <div className="seg" role={role} aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role={role === 'tablist' ? 'tab' : 'radio'} {...(role === 'tablist' ? { 'aria-selected': o.value === value } : { 'aria-checked': o.value === value })} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Dot({ color, size = 8, round = false }: { color: string; size?: number; round?: boolean }) {
  return <span aria-hidden="true" className="inline-block flex-none" style={{ width: size, height: size, borderRadius: round ? '50%' : 2, background: color }} />
}

export function Bar({ pct, color = 'var(--accent)', h = 4 }: { pct: number; color?: string; h?: number }) {
  return (
    <div aria-hidden="true" className="relative overflow-hidden rounded-sm bg-surface2" style={{ height: h }}>
      <div className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  )
}

export function EmptyState({ icon, title, children, actions }: { icon: Parameters<typeof Icon>[0]['name']; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card px-8 py-14 text-center">
      <div aria-hidden="true" className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent-soft text-accent">
        <Icon name={icon} size={24} />
      </div>
      <h2 className="mb-1.5 mt-4 text-title2 font-semibold">{title}</h2>
      <p className="mx-auto mb-[18px] mt-0 max-w-[360px] text-text2">{children}</p>
      {actions && <div className="flex justify-center gap-2">{actions}</div>}
    </div>
  )
}

export function Skeleton({ w, h, className }: { w?: number | string; h: number; className?: string }) {
  return <div className={cn('sk', className)} style={{ width: w, height: h }} />
}

export function SuccessMark({ size = 44 }: { size?: number }) {
  return (
    <span className="mx-auto flex items-center justify-center rounded-full bg-pos-soft text-pos" style={{ width: size, height: size }}>
      <Icon name="check" size={size / 2.2} stroke={2.4} />
    </span>
  )
}

export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1 text-label text-text2', className)}>
      {label}
      {children}
    </label>
  )
}
