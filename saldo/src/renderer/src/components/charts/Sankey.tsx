import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey'
import { useMemo, useState } from 'react'
import { useWidth } from '@/lib/hooks'

export interface SankeyNodeIn {
  id: string
  name: string
  color: string
  label: string
}
export interface SankeyLinkIn {
  source: string
  target: string
  value: number
}

type N = SankeyNodeIn & { x0?: number; x1?: number; y0?: number; y1?: number; depth?: number }
type L = { source: N; target: N; value: number; width?: number; y0?: number; y1?: number }

/** Sankey från inkomster till kategorier (d3-sankey). */
export function Sankey({ nodes, links, height = 260, onPick }: { nodes: SankeyNodeIn[]; links: SankeyLinkIn[]; height?: number; onPick?: (id: string) => void }) {
  const [ref, W] = useWidth<HTMLDivElement>()
  const [hov, setHov] = useState<number | null>(null)
  const g = useMemo(() => {
    if (!links.length || W < 300) return null
    const gen = sankey<N, L>()
      .nodeId((d) => d.id)
      .nodeWidth(12)
      .nodePadding(8)
      .nodeAlign(sankeyJustify)
      .nodeSort(null as never)
      .extent([
        [140, 4],
        [W - 220, height - 4]
      ])
    return gen({ nodes: nodes.map((n) => ({ ...n })), links: links.map((l) => ({ ...l })) as unknown as L[] })
  }, [nodes, links, height, W])
  const path = sankeyLinkHorizontal()
  const maxDepth = g ? Math.max(...g.nodes.map((n) => n.depth ?? 0)) : 0
  const mid = (n: N) => (n.depth ?? 0) > 0 && (n.depth ?? 0) < maxDepth
  return (
    <div ref={ref} style={{ height }}>
      {!g ? (
        <div className="flex h-full items-center justify-center text-text2">{links.length ? '' : 'Ingen inkomst i perioden.'}</div>
      ) : (
    <svg width={W} height={height} role="img" aria-label="Flöde från inkomster till kategorier" className="block">
      {g.links.map((l, i) => (
        <path
          key={i}
          d={path(l as never) ?? ''}
          fill="none"
          stroke={(l.target as N).id === 'inc' ? 'var(--text3)' : (l.target as N).color}
          strokeOpacity={hov === i ? 0.55 : 0.3}
          strokeWidth={Math.max(1, l.width ?? 1)}
          onMouseEnter={() => setHov(i)}
          onMouseLeave={() => setHov(null)}
        >
          <title>{`${(l.source as N).name} → ${(l.target as N).name}: ${(l.target as N).label}`}</title>
        </path>
      ))}
      {g.nodes.map((n) => {
        const left = (n.depth ?? 0) === 0
        const h = Math.max(1.5, (n.y1 ?? 0) - (n.y0 ?? 0))
        return (
          <g key={n.id} onClick={() => onPick?.(n.id)} style={{ cursor: onPick ? 'pointer' : undefined }}>
            <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={h} rx={2} fill={n.color} />
            <text
              x={left ? (n.x0 ?? 0) - 8 : mid(n) ? (n.x0 ?? 0) - 6 : (n.x1 ?? 0) + 8}
              y={mid(n) ? (n.y0 ?? 0) + 10 : (n.y0 ?? 0) + h / 2}
              dy="0.35em"
              textAnchor={left || mid(n) ? 'end' : 'start'} fontSize={12} fill="var(--text)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <tspan fontWeight={600}>{n.name}</tspan>
              <tspan fill="var(--text2)"> {n.label}</tspan>
            </text>
          </g>
        )
      })}
    </svg>
      )}
    </div>
  )
}
