import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { normalizeMerchant } from './categorize'
import { daysBetween, isoDate, parseAmount } from './format'
import type { ColumnMapping, ImportProfile, Transaction } from './types'

export type ColumnRole = 'Datum' | 'Beskrivning' | 'Belopp' | 'Saldo' | 'Ignorera'
export const ROLES: ColumnRole[] = ['Datum', 'Beskrivning', 'Belopp', 'Saldo', 'Ignorera']

export interface ParsedFile {
  fileName: string
  kind: 'csv' | 'xlsx'
  sheet?: string
  delimiter?: string
  headerRow: number // 1-baserad rad i filen
  headers: string[]
  rows: string[][]
}

export interface ColumnGuess {
  index: number
  letter: string
  header: string
  role: ColumnRole
  conf: number
}

export interface Detection {
  columns: ColumnGuess[]
  mapping: ColumnMapping
  signPlus: boolean
  signReason: string
}

export interface PreviewRow {
  date: string
  description: string
  extra: string[]
  rawAmount: string
  amount: number
  duplicate: boolean
  valid: boolean
}

export interface Preview {
  rows: PreviewRow[]
  total: number
  newCount: number
  dupCount: number
  invalid: number
  from: string
  to: string
  sumBuy: number
  sumPay: number
}

const letter = (i: number) => String.fromCharCode(65 + (i % 26))

function cellToString(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return isoDate(v)
  if (typeof v === 'number') return String(v)
  return String(v).trim()
}

/** Läser CSV (valfri avgränsare) eller Excel till en tabell av strängar. */
export function parseFile(fileName: string, data: ArrayBuffer | string): ParsedFile {
  const lower = fileName.toLowerCase()
  let table: string[][]
  let kind: 'csv' | 'xlsx' = 'csv'
  let sheet: string | undefined
  let delimiter: string | undefined
  if (/\.(xlsx|xls|xlsm)$/.test(lower)) {
    kind = 'xlsx'
    if (typeof data === 'string') throw new Error('Excel-filer måste läsas som binärdata.')
    const wb = XLSX.read(data, { type: 'array', cellDates: true })
    // Välj bladet med flest rader (Amex: ”Transaktionsdetaljer”).
    sheet = wb.SheetNames.reduce((best, n) => {
      const r = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1 }).length
      const b = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[best], { header: 1 }).length
      return r > b ? n : best
    }, wb.SheetNames[0])
    const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, raw: true, blankrows: true, defval: '' })
    table = raw.map((r) => (r as unknown[]).map(cellToString))
  } else if (/\.(csv|txt|tsv)$/.test(lower)) {
    let text = typeof data === 'string' ? data : decodeText(data)
    text = text.replace(/^﻿/, '')
    const res = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', delimitersToGuess: [';', ',', '\t', '|'] })
    delimiter = res.meta.delimiter
    table = res.data.map((r) => r.map((c) => (c ?? '').trim()))
  } else {
    throw new Error(`”${fileName}” är ingen CSV- eller Excel-fil. Exportera transaktionerna som .csv eller .xlsx från banken och försök igen.`)
  }
  const width = Math.max(0, ...table.map((r) => r.length))
  table = table.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
  const h = findHeaderRow(table)
  const headers = h >= 0 ? table[h].map((c, i) => c || `Kolumn ${letter(i)}`) : table[0].map((_, i) => `Kolumn ${letter(i)}`)
  const rows = table.slice(h + 1).filter((r) => r.some((c) => c !== ''))
  return { fileName, kind, sheet, delimiter, headerRow: h + 1, headers, rows }
}

function decodeText(buf: ArrayBuffer): string {
  const utf = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  // Svenska banker exporterar ibland i Windows-1252: ersättningstecken avslöjar det.
  if (utf.includes('�')) return new TextDecoder('windows-1252').decode(buf)
  return utf
}

/** Hittar rubrikraden: raden före första raden med ett datum och ett belopp. */
function findHeaderRow(t: string[][]): number {
  for (let i = 0; i < Math.min(t.length, 30); i++) {
    const r = t[i]
    const hasDate = r.some((c) => parseDate(c) !== null)
    const hasAmt = r.some((c) => parseDate(c) === null && parseAmount(c) !== null)
    if (hasDate && hasAmt) {
      const prev = t[i - 1]
      if (prev && prev.filter((c) => c && parseAmount(c) === null).length >= 2) return i - 1
      return -1
    }
  }
  return 0
}

/** Datum i vanliga bankformat, Excel-serienummer inräknat. */
export function parseDate(v: string): string | null {
  const s = v.trim()
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T].*)?$/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    // Amex och svenska banker: dag först. Månad först bara när dagen inte kan vara en månad.
    return b > 12 ? valid(+m[3], a, b) : valid(+m[3], b, a)
  }
  m = s.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (m && +m[2] <= 12) return valid(2000 + +m[1], +m[2], +m[3])
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Number(s)
    if (n > 30000 && n < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000)
      return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
    }
  }
  return null
}

function valid(y: number, mo: number, d: number): string | null {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const HEAD = {
  date: /datum|date|bokf|transaktionsdag|valutadag|reskontra/i,
  desc: /beskriv|text|description|mottagare|meddelande|specifikation|benämning|rubrik|referens|händelse/i,
  amount: /belopp|amount|summa|kronor|sek/i,
  balance: /saldo|balance|behållning/i
}

/** Tolkar kolumner med säkerhet per kolumn. */
export function detect(p: ParsedFile): Detection {
  const sample = p.rows.slice(0, 80)
  const n = p.headers.length
  const stats = Array.from({ length: n }, (_, j) => {
    const vals = sample.map((r) => r[j]).filter((v) => v !== '')
    const filled = vals.length / Math.max(1, sample.length)
    const date = vals.filter((v) => parseDate(v) !== null).length / Math.max(1, vals.length)
    const amt = vals.filter((v) => parseDate(v) === null && parseAmount(v) !== null).length / Math.max(1, vals.length)
    const text = vals.filter((v) => parseAmount(v) === null && parseDate(v) === null && v.length > 2).length / Math.max(1, vals.length)
    const uniq = new Set(vals).size / Math.max(1, vals.length)
    const avgLen = vals.reduce((a, v) => a + v.length, 0) / Math.max(1, vals.length)
    return { j, filled, date, amt, text, uniq, avgLen, head: p.headers[j] }
  })
  const pick = (score: (s: (typeof stats)[number]) => number, taken: number[]) => {
    let best = -1
    let bs = 0.2
    stats.forEach((s) => {
      if (taken.includes(s.j)) return
      const v = score(s)
      if (v > bs) {
        bs = v
        best = s.j
      }
    })
    return { j: best, score: Math.min(1, bs) }
  }
  const d = pick((s) => s.date * s.filled + (HEAD.date.test(s.head) ? 0.3 : 0), [])
  const a = pick((s) => s.amt * s.filled + (HEAD.amount.test(s.head) ? 0.3 : 0) - (HEAD.balance.test(s.head) ? 0.5 : 0), [d.j])
  const b = pick((s) => (HEAD.balance.test(s.head) ? s.amt + 0.3 : 0), [d.j, a.j])
  const t = pick((s) => s.text * s.filled * (0.4 + 0.6 * s.uniq) * Math.min(1, s.avgLen / 10) + (HEAD.desc.test(s.head) ? 0.3 : 0), [d.j, a.j, b.j])

  const conf = (score: number, headMatch: boolean) => Math.max(45, Math.min(99, Math.round(score * 72 + (headMatch ? 27 : 8))))
  const columns: ColumnGuess[] = stats.map((s) => {
    let role: ColumnRole = 'Ignorera'
    let c: number
    if (s.j === d.j) {
      role = 'Datum'
      c = conf(s.date, HEAD.date.test(s.head))
    } else if (s.j === a.j) {
      role = 'Belopp'
      c = conf(s.amt, HEAD.amount.test(s.head))
    } else if (s.j === b.j) {
      role = 'Saldo'
      c = conf(s.amt, true)
    } else if (s.j === t.j) {
      role = 'Beskrivning'
      c = conf(s.text * (0.5 + 0.5 * s.uniq), HEAD.desc.test(s.head))
    } else {
      // Säker på att ignorera när kolumnen varken är datum, belopp eller unik text.
      const ambiguous = Math.max(s.date, s.amt, s.text * s.uniq)
      c = Math.round(95 - ambiguous * 40 - (s.avgLen < 4 ? 15 : 0))
    }
    return { index: s.j, letter: letter(s.j), header: s.head, role, conf: Math.max(45, Math.min(99, c)) }
  })
  const mapping: ColumnMapping = { date: d.j, description: t.j, amount: a.j, balance: b.j >= 0 ? b.j : null }
  const sg = guessSign(p, mapping)
  return { columns, mapping, ...sg }
}

/** Gissar teckenkonvention: köp som plus (kortfiler) eller minus (bankkonton). */
export function guessSign(p: ParsedFile, m: ColumnMapping): { signPlus: boolean; signReason: string } {
  if (m.amount < 0) return { signPlus: false, signReason: 'Ingen beloppskolumn hittades.' }
  const amts = p.rows.map((r) => parseAmount(r[m.amount])).filter((x): x is number => x !== null)
  const pos = amts.filter((x) => x > 0).length
  const payRow = p.rows.find((r) => /betalning mottagen|inbetalning|payment received|tack/i.test(r[m.description] ?? ''))
  const payNeg = payRow ? (parseAmount(payRow[m.amount]) ?? 0) < 0 : false
  const share = pos / Math.max(1, amts.length)
  if (share > 0.7 || payNeg) {
    return {
      signPlus: true,
      signReason: `Appen gissade ”plus”: ${pos} av ${amts.length} belopp är positiva${payNeg ? ' och raden ”' + payRow![m.description] + '” är negativ, som i kortfiler' : ''}.`
    }
  }
  return { signPlus: false, signReason: `Appen gissade ”minus”: ${amts.length - pos} av ${amts.length} belopp är negativa, som i vanliga kontoutdrag.` }
}

export function isDuplicate(c: { date: string; amount: number; description: string }, accountId: string, existing: Transaction[]): boolean {
  const nm = normalizeMerchant(c.description)
  return existing.some(
    (t) =>
      t.accountId === accountId &&
      Math.abs(t.amount - c.amount) < 0.005 &&
      Math.abs(daysBetween(t.date, c.date)) <= 1 &&
      (normalizeMerchant(t.description) === nm || normalizeMerchant(t.raw) === nm)
  )
}

export function buildPreview(p: ParsedFile, m: ColumnMapping, signPlus: boolean, accountId: string, existing: Transaction[]): Preview {
  const acct = existing.filter((t) => t.accountId === accountId)
  const rows: PreviewRow[] = p.rows.map((r) => {
    const date = m.date >= 0 ? parseDate(r[m.date] ?? '') : null
    const raw = m.amount >= 0 ? r[m.amount] ?? '' : ''
    const v = parseAmount(raw)
    const description = m.description >= 0 ? r[m.description] ?? '' : ''
    const amount = v === null ? 0 : signPlus ? -v : v
    const ok = !!date && v !== null && description !== ''
    const extra = r.filter((_, i) => i !== m.date && i !== m.amount && i !== m.description && i !== m.balance)
    const duplicate = ok && isDuplicate({ date: date!, amount, description }, accountId, acct)
    return { date: date ?? '', description, extra, rawAmount: raw, amount, duplicate, valid: ok }
  })
  const okRows = rows.filter((r) => r.valid)
  const fresh = okRows.filter((r) => !r.duplicate)
  const dates = okRows.map((r) => r.date).sort()
  return {
    rows,
    total: rows.length,
    newCount: fresh.length,
    dupCount: okRows.length - fresh.length,
    invalid: rows.length - okRows.length,
    from: dates[0] ?? '',
    to: dates[dates.length - 1] ?? '',
    sumBuy: fresh.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0),
    sumPay: fresh.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0)
  }
}

/** Matchar sparad profil på rubrikerna. */
export function matchProfile(p: ParsedFile, profiles: ImportProfile[]): ImportProfile | null {
  const hs = p.headers.map((h) => h.toLowerCase())
  return profiles.find((pr) => pr.headerMatch.length > 0 && pr.headerMatch.every((h) => hs.includes(h.toLowerCase()))) ?? null
}

export function mappingFromColumns(cols: ColumnGuess[]): ColumnMapping {
  const f = (r: ColumnRole) => cols.find((c) => c.role === r)?.index ?? -1
  const b = f('Saldo')
  return { date: f('Datum'), description: f('Beskrivning'), amount: f('Belopp'), balance: b >= 0 ? b : null }
}
