import { merchantKey, normalizeMerchant, ruleMatches } from './categorize'
import { isoDate } from './format'
import type { AppData, Rule, Transaction } from './types'
import { uid } from './utils'

/** Manuell kategori på valda transaktioner (”Bara denna”, massmarkering). */
export function setManual(d: AppData, ids: string[], categoryId: string) {
  const set = new Set(ids)
  d.transactions.forEach((t) => {
    if (!set.has(t.id)) return
    t.categoryId = categoryId
    t.source = 'manual'
    t.ruleId = undefined
    t.aiConfidence = undefined
    t.skipped = false
  })
}

export function similarRule(tx: Transaction, categoryId: string): Rule {
  return { id: uid('r'), categoryId, kind: 'startsWith', value: merchantKey(tx.description), accountId: null, createdAt: isoDate(new Date()) }
}

export function countSimilar(d: AppData, tx: Transaction): number {
  const r = similarRule(tx, '')
  return d.transactions.filter((t) => t.id !== tx.id && ruleMatches(r, t)).length
}

/** ”Alla liknande, även framtida”: skapar regel och kör den på historiken. Manuella val ligger kvar. */
export function applySimilar(d: AppData, tx: Transaction, categoryId: string): { rule: Rule; changed: number } {
  const rule = similarRule(tx, categoryId)
  d.rules.unshift(rule)
  let changed = 0
  d.transactions.forEach((t) => {
    if (!ruleMatches(rule, t)) return
    if (t.source === 'manual' && t.id !== tx.id) return
    t.categoryId = categoryId
    t.source = 'rule'
    t.ruleId = rule.id
    t.aiConfidence = undefined
    t.skipped = false
    changed++
  })
  return { rule, changed }
}

/** ”Kom ihåg”: inlärning för handlaren, används direkt på andra okategoriserade från samma handlare. */
export function learn(d: AppData, tx: Transaction, categoryId: string) {
  const key = normalizeMerchant(tx.description)
  d.learned[key] = categoryId
  d.transactions.forEach((t) => {
    if (t.id !== tx.id && !t.categoryId && normalizeMerchant(t.description) === key) {
      t.categoryId = categoryId
      t.source = 'learned'
    }
  })
}

/** Kör en regel på befintliga transaktioner som inte satts manuellt. */
export function runRule(d: AppData, rule: Rule): number {
  let n = 0
  d.transactions.forEach((t) => {
    if (t.source === 'manual' || !ruleMatches(rule, t)) return
    t.categoryId = rule.categoryId
    t.source = 'rule'
    t.ruleId = rule.id
    t.aiConfidence = undefined
    n++
  })
  return n
}

export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(';')).join('\n')
}

export async function saveText(name: string, content: string): Promise<string | null> {
  if (window.saldo) return window.saldo.saveFile(name, content)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
  a.download = name
  a.click()
  return name
}
