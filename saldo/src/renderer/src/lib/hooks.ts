import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '@/store'
import { catIndex, UNCAT } from './analytics'
import { formatAxis, formatKr, type KrOpts } from './format'
import { PALETTE } from './palette'

/** Beloppsformatering som respekterar ”Dölj belopp”. */
export function useMoney() {
  const hide = useStore((s) => s.hide)
  return useMemo(
    () => ({
      hide,
      kr: (n: number, o: Omit<KrOpts, 'hide'> = {}) => formatKr(n, { ...o, hide }),
      axis: (n: number) => formatAxis(n, hide)
    }),
    [hide]
  )
}

export function useCats() {
  const cats = useStore((s) => s.data?.categories ?? [])
  return useMemo(() => {
    const ci = catIndex(cats)
    return {
      ...ci,
      cats,
      hex: (id: string | null) => (id === UNCAT ? PALETTE[8] : id ? PALETTE[ci.color(id)] : PALETTE[9]),
      name: (id: string | null) => (id && id !== UNCAT ? ci.byId.get(id)?.name ?? 'Okänd' : 'Okategoriserad'),
      /** Valbara kategorier: alla underkategorier plus huvudkategorier utan barn. */
      leaves: cats.filter((c) => c.parentId || !cats.some((k) => k.parentId === c.id))
    }
  }, [cats])
}

/** Bredd på ett element (för SVG som inte ska skalas om, t.ex. text i Sankey). */
export function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver((e) => setW(Math.round(e[0].contentRect.width)))
    ro.observe(ref.current)
    setW(ref.current.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}
