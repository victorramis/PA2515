import { monthKey, shiftMonth } from './format'
import type { Account, AppData, Category, Transaction } from './types'

/** Pseudokategori för okategoriserade utflöden i diagram. */
export const UNCAT = '__okat'

export interface CatIndex {
  byId: Map<string, Category>
  main: (id: string | null) => Category | null
  color: (id: string | null) => number
}

export function catIndex(cats: Category[]): CatIndex {
  const byId = new Map(cats.map((c) => [c.id, c]))
  const main = (id: string | null) => {
    if (!id) return null
    const c = byId.get(id)
    if (!c) return null
    return c.parentId ? byId.get(c.parentId) ?? c : c
  }
  const color = (id: string | null) => main(id)?.color ?? 9
  return { byId, main, color }
}

/** Utgift: kategori av typen utgift som räknas som utgift. Okategoriserade utflöden räknas som utgift. */
export function isExpense(t: Transaction, ci: CatIndex): boolean {
  if (!t.categoryId) return t.amount < 0
  const c = ci.byId.get(t.categoryId)
  const m = ci.main(t.categoryId)
  if (!c || !m) return false
  return m.type === 'utgift' && !c.excluded && !m.excluded
}

export function isIncome(t: Transaction, ci: CatIndex): boolean {
  if (!t.categoryId) return false
  const c = ci.byId.get(t.categoryId)
  const m = ci.main(t.categoryId)
  return !!m && !!c && m.type === 'inkomst' && !c.excluded && !m.excluded
}

export interface MonthFlow {
  key: string
  inc: number
  exp: number
  net: number
}

export function monthFlows(txs: Transaction[], ci: CatIndex, endKey: string, n = 12): MonthFlow[] {
  const keys = Array.from({ length: n }, (_, i) => shiftMonth(endKey, i - n + 1))
  const map = new Map(keys.map((k) => [k, { key: k, inc: 0, exp: 0, net: 0 }]))
  for (const t of txs) {
    const f = map.get(monthKey(t.date))
    if (!f) continue
    if (isIncome(t, ci)) f.inc += t.amount
    else if (isExpense(t, ci)) f.exp += -t.amount
  }
  return keys.map((k) => {
    const f = map.get(k)!
    f.net = f.inc - f.exp
    return f
  })
}

/** Utgifter per huvudkategori för en månad (eller flera). */
export function spendByMain(txs: Transaction[], ci: CatIndex, keys: string[]): Map<string, number> {
  const set = new Set(keys)
  const out = new Map<string, number>()
  for (const t of txs) {
    if (!set.has(monthKey(t.date)) || !isExpense(t, ci)) continue
    const m = ci.main(t.categoryId)?.id ?? UNCAT
    out.set(m, (out.get(m) ?? 0) - t.amount)
  }
  return out
}

export function spendBySub(txs: Transaction[], ci: CatIndex, keys: string[]): Map<string, number> {
  const set = new Set(keys)
  const out = new Map<string, number>()
  for (const t of txs) {
    if (!set.has(monthKey(t.date)) || !t.categoryId) continue
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) - t.amount)
  }
  return out
}

export function accountBalance(a: Account, txs: Transaction[]): number {
  if (a.kind === 'manual') return a.manualBalance ?? 0
  return a.openingBalance + txs.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0)
}

export function totalBalance(d: AppData): number {
  return d.accounts.reduce((s, a) => s + accountBalance(a, d.transactions), 0)
}

/** Saldo vid ett datum (för ”mot 31 okt”). */
export function balanceAt(d: AppData, iso: string): number {
  return d.accounts.reduce((s, a) => {
    if (a.kind === 'manual') return s + (a.manualBalance ?? 0)
    return s + a.openingBalance + d.transactions.filter((t) => t.accountId === a.id && t.date <= iso).reduce((x, t) => x + t.amount, 0)
  }, 0)
}

export interface Merchant {
  name: string
  amount: number
  count: number
  categoryId: string | null
}

export function topMerchants(txs: Transaction[], ci: CatIndex, keys: string[], n = 8): Merchant[] {
  const set = new Set(keys)
  const map = new Map<string, Merchant>()
  for (const t of txs) {
    if (!set.has(monthKey(t.date)) || !isExpense(t, ci) || t.amount >= 0) continue
    const name = merchantName(t.description)
    const m = map.get(name) ?? { name, amount: 0, count: 0, categoryId: t.categoryId }
    m.amount += -t.amount
    m.count += 1
    map.set(name, m)
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount).slice(0, n)
}

/** Visningsnamn för handlare: ”SAS Plus ARN–CPH” → ”SAS”, ”Swish till 07…” → ”Swish”. */
export function merchantName(desc: string): string {
  if (/^swish/i.test(desc)) return 'Swish'
  if (/^sas\b/i.test(desc)) return 'SAS'
  if (/^sj\b/i.test(desc)) return 'SJ'
  if (/^sl\b/i.test(desc)) return 'SL'
  if (/^skistar/i.test(desc)) return 'SkiStar'
  if (/^circle k/i.test(desc)) return 'Circle K'
  if (/^systembolaget/i.test(desc)) return 'Systembolaget'
  if (/^vattenfall/i.test(desc)) return 'Vattenfall'
  return desc.replace(/\s+\d.*$/, '')
}

export function ownTransfers(t: Transaction, ci: CatIndex): boolean {
  return ci.main(t.categoryId)?.type === 'överföring'
}
