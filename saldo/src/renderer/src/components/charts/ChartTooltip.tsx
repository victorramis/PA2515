import type { ReactNode } from 'react'

export function TipBox({ title, rows, foot, minWidth = 170 }: { title: ReactNode; rows: { label: ReactNode; value: ReactNode; color?: string }[]; foot?: { label: ReactNode; value: ReactNode; color?: string }; minWidth?: number }) {
  return (
    <div className="num pointer-events-none rounded-lg border border-line bg-surface px-2.5 py-2 text-label shadow-pop" style={{ minWidth }}>
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5 text-text2">
            {r.color && <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span>{r.value}</span>
        </div>
      ))}
      {foot && (
        <div className="mt-1 flex justify-between gap-3 border-t border-line pt-1 font-semibold">
          <span>{foot.label}</span>
          <span style={{ color: foot.color }}>{foot.value}</span>
        </div>
      )}
    </div>
  )
}

export const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 11, fill: 'var(--text3)' }
} as const

export const gridProps = { stroke: 'var(--line)', strokeDasharray: '3 3', vertical: false } as const
