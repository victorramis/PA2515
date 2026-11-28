import type { ScrapedPension } from '../../../shared/minpension'
import type { AppData, PensionItem } from './types'

const norm = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9]/g, '')
const COLORS = ['#2E7D8C', '#3E95CF', '#D9822B', '#8A5CC2', '#3F9B5F', '#B5932A', '#C4537A', '#5B6BD6', '#A8674A', '#7A8691']

/** Hittar befintlig pension som en avläst rad motsvarar. */
export function matchItem(items: PensionItem[], s: Pick<ScrapedPension, 'name' | 'company' | 'kind'>, taken: Set<string> = new Set()): PensionItem | null {
  const free = items.filter((i) => !taken.has(i.id))
  const n = norm(s.name)
  const c = norm(s.company)
  const sameCompany = (i: PensionItem) => !c || norm(i.company).includes(c) || c.includes(norm(i.company))
  return (
    free.find((i) => norm(i.name) === n && sameCompany(i)) ??
    free.find((i) => (norm(i.name).includes(n) || n.includes(norm(i.name))) && n.length >= 3 && sameCompany(i)) ??
    (() => {
      const cands = free.filter((i) => i.kind === s.kind && c && sameCompany(i))
      return cands.length === 1 ? cands[0] : null
    })()
  )
}

export function newItem(s: Pick<ScrapedPension, 'name' | 'company' | 'kind'>, existing: PensionItem[]): PensionItem {
  const base = norm(`${s.name}-${s.company}`).slice(0, 24) || 'pension'
  let id = `p-${base}`
  for (let k = 2; existing.some((e) => e.id === id); k++) id = `p-${base}-${k}`
  const used = new Set(existing.map((e) => e.color))
  return {
    id,
    name: s.name,
    sub: s.kind === 'Allmän' ? 'Allmän pension' : s.kind === 'Tjänste' ? 'Tjänstepension' : 'Privat pension',
    company: s.company || 'Okänt bolag',
    kind: s.kind,
    color: COLORS.find((c) => !used.has(c)) ?? COLORS[existing.length % COLORS.length]
  }
}

/** Pensionskapital i de fyra hinkar som pensionsmodellen räknar med: inkomst, premie, tjänste, privat. */
export function pensionBuckets(d: AppData): number[] {
  const last = d.snapshots[d.snapshots.length - 1]
  const out = [0, 0, 0, 0]
  if (!last) return out
  for (const [id, v] of Object.entries(last.values)) {
    const it = d.pensions.find((p) => p.id === id)
    if (!it) continue
    const name = it.name.toLowerCase()
    const j = it.kind === 'Allmän' ? (/premie|ppm/.test(name) ? 1 : 0) : it.kind === 'Tjänste' ? 2 : 3
    out[j] += v.value
  }
  return out
}
