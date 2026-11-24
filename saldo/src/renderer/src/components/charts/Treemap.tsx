import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy'
import { useMemo, useState } from 'react'
import { useWidth } from '@/lib/hooks'

export interface TreeDatum {
  id: string
  name: string
  value: number
  color: string
  label: string
}

/** Treemap (d3-hierarchy, squarify) med klickbara rutor. */
export function Treemap({ data, height = 200, onPick, tip }: { data: TreeDatum[]; height?: number; onPick: (id: string) => void; tip: (d: TreeDatum) => string }) {
  const [ref, px] = useWidth<HTMLDivElement>()
  const W = px || 1000
  const [hov, setHov] = useState<string | null>(null)
  const leaves = useMemo(() => {
    const root = hierarchy<{ children?: TreeDatum[] } & Partial<TreeDatum>>({ children: data.filter((d) => d.value > 0) })
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    treemap<{ children?: TreeDatum[] } & Partial<TreeDatum>>().tile(treemapSquarify.ratio(1.2)).size([W, height]).paddingInner(0)(root)
    return root.leaves() as unknown as { x0: number; x1: number; y0: number; y1: number; data: TreeDatum }[]
  }, [data, height, W])
  return (
    <div ref={ref} className="relative overflow-hidden rounded-md" style={{ height }}>
      {leaves.map((l) => {
        const wpx = l.x1 - l.x0
        const tiny = wpx < 64 || l.y1 - l.y0 < 26
        const small = wpx < 80 || l.y1 - l.y0 < 44
        return (
          <button
            key={l.data.id}
            type="button"
            aria-label={tip(l.data)}
            title={tip(l.data)}
            onClick={() => onPick(l.data.id)}
            onMouseEnter={() => setHov(l.data.id)}
            onMouseLeave={() => setHov(null)}
            className="absolute cursor-pointer overflow-hidden border-2 border-surface p-2 text-left text-label leading-tight text-white"
            style={{ left: l.x0, top: l.y0, width: wpx, height: l.y1 - l.y0, background: l.data.color, filter: hov === l.data.id ? 'brightness(1.08)' : undefined }}
          >
            {!tiny && <span className="block truncate font-semibold">{l.data.name}</span>}
            {!small && <span className="num block opacity-90">{l.data.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
