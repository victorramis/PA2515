import type { AppData, Rule, Suggestion, Transaction } from './types'

/** Prioritet: manuell > regel > inlärd > AI. */
export const SOURCE_RANK = { manual: 4, rule: 3, learned: 2, ai: 1 } as const
export const SOURCE_LABEL = { manual: 'M', rule: 'R', learned: 'I', ai: 'AI' } as const
export const SOURCE_TITLE = { manual: 'Manuell', rule: 'Regel', learned: 'Inlärd', ai: 'AI-förslag' } as const

export const UNCERTAIN_BELOW = 70

/** Normaliserad handlare: gemener, utan siffror, kortnummer och vanliga prefix. */
export function normalizeMerchant(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/^(kortköp|köp|reservation|swish betalning)\s+/i, '')
    .replace(/\*/g, ' ')
    .replace(/\b\d[\d\s-]*\b/g, ' ')
    .replace(/[^a-zåäöéü&.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function ruleMatches(rule: Rule, tx: Pick<Transaction, 'description' | 'raw' | 'accountId'>): boolean {
  if (rule.accountId && rule.accountId !== tx.accountId) return false
  const v = rule.value.toLowerCase()
  const hay = [tx.description.toLowerCase(), tx.raw.toLowerCase()]
  if (rule.kind === 'contains') {
    // Matchar från ordgräns: ”ICA” träffar ”ICA Kvantum” men inte ”Allica”.
    const re = new RegExp(`(^|[^a-z0-9åäöéü])${escapeRe(v)}`, 'i')
    return hay.some((h) => re.test(h))
  }
  if (rule.kind === 'startsWith') return hay.some((h) => h.startsWith(v))
  return hay.some((h) => h === v) || normalizeMerchant(tx.description) === normalizeMerchant(rule.value)
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function ruleLabel(rule: Rule): string {
  const k = { contains: 'innehåller', startsWith: 'börjar med', equals: 'är' }[rule.kind]
  return `Beskrivning ${k} ”${rule.value}”`
}

/** Lokal AI-liknande förslagsmotor (nyckelord + belopp). Byts mot en språkmodell i main-processen. */
const HINTS: { re: RegExp; cat: string; pct: number; why: string }[] = [
  { re: /mathem|\bica\b|willys|coop|lidl|hemköp|city gross/, cat: 'liv', pct: 93, why: 'Matbutik' },
  { re: /restaurang|pizz|sushi|burger|max |café|cafe|espresso|bistro|thai|pong|vapiano/, cat: 'rest', pct: 86, why: 'Restaurang eller café' },
  { re: /pressbyr|7-eleven|seven eleven/, cat: 'rest', pct: 48, why: 'Kaffe och mackor' },
  { re: /systembolaget/, cat: 'alk', pct: 96, why: 'Systembolaget' },
  { re: /stadium|h&m|åhléns|zalando|lindex|kappahl|intersport|clas ohlson/, cat: 'klader', pct: 64, why: 'Handlaren säljer kläder och prylar' },
  { re: /\bsas\b|norwegian|\bsj\b|hotell|hotel|booking|airbnb|scandic|ving/, cat: 'resor', pct: 87, why: 'Resa eller boende' },
  { re: /apple\.com|netflix|spotify|hbo|viaplay|disney|youtube|steam/, cat: 'str', pct: 77, why: 'Prenumeration' },
  { re: /bil &|bil o|däck|dack|biltema|mekonomen|bilia|besikt/, cat: 'bil', pct: 89, why: 'Bilverkstad eller biltillbehör' },
  { re: /circle k|preem|okq8|st1|ingo/, cat: 'drv', pct: 92, why: 'Bensinstation' },
  { re: /\bsl\b|sl app|uber|bolt|taxi/, cat: 'sl', pct: 74, why: 'Resor i vardagen' },
  { re: /apotek|kronans|hjärtat/, cat: 'apo', pct: 95, why: 'Apotek' },
  { re: /sats|friskis|nordic wellness|gym/, cat: 'trn', pct: 90, why: 'Träning' },
  { re: /bauhaus|jula|ikea|byggmax|plantagen|tradera/, cat: 'hem', pct: 71, why: 'Hem och trädgård' },
  { re: /tickster|filmstaden|ticketmaster|biljett/, cat: 'evt', pct: 82, why: 'Evenemang' },
  { re: /swish/, cat: 'ovrigt', pct: 41, why: 'Vanligast för Swish' }
]

export function aiSuggest(tx: Pick<Transaction, 'description' | 'raw' | 'amount'>): Suggestion[] {
  const h = `${tx.description} ${tx.raw}`.toLowerCase()
  const out: Suggestion[] = []
  for (const x of HINTS) {
    if (x.re.test(h) && !out.some((o) => o.categoryId === x.cat)) out.push({ categoryId: x.cat, pct: x.pct, why: x.why })
  }
  const fill: Suggestion[] = [
    { categoryId: 'ovrigt', pct: 0, why: '' },
    { categoryId: 'rest', pct: 0, why: 'Belopp liknar delade notor' },
    { categoryId: 'noje', pct: 0, why: '' },
    { categoryId: 'liv', pct: 0, why: '' }
  ]
  for (const f of fill) if (out.length < 3 && !out.some((o) => o.categoryId === f.categoryId)) out.push(f)
  let rest = 100 - out[0].pct
  if (out[0].pct === 0) {
    out[0].pct = 35
    rest = 65
  }
  out[1].pct = out[1].pct || Math.round(rest * 0.45)
  out[2].pct = out[2].pct || Math.round(rest * 0.2)
  return out.slice(0, 3).sort((a, b) => b.pct - a.pct)
}

export interface AutoResult {
  categoryId: string | null
  source: Transaction['source']
  ruleId?: string
  aiConfidence?: number
  suggestions?: Suggestion[]
}

/** Sätter kategori på en ny transaktion enligt inställningar och prioritet. */
export function autoCategorize(tx: Pick<Transaction, 'description' | 'raw' | 'accountId' | 'amount'>, data: Pick<AppData, 'rules' | 'learned' | 'settings'>): AutoResult {
  if (data.settings.rules) {
    const r = data.rules.find((x) => ruleMatches(x, tx))
    if (r) return { categoryId: r.categoryId, source: 'rule', ruleId: r.id }
  }
  if (data.settings.learn) {
    const l = data.learned[normalizeMerchant(tx.description)]
    if (l) return { categoryId: l, source: 'learned' }
  }
  if (data.settings.ai) {
    const s = aiSuggest(tx)
    if (s[0].pct >= UNCERTAIN_BELOW) return { categoryId: s[0].categoryId, source: 'ai', aiConfidence: s[0].pct, suggestions: s }
    return { categoryId: null, source: null, suggestions: s }
  }
  return { categoryId: null, source: null }
}

export function needsReview(t: Transaction): boolean {
  if (t.skipped) return false
  if (!t.categoryId) return true
  return t.source === 'ai' && (t.aiConfidence ?? 100) < UNCERTAIN_BELOW
}

/** Antal liknande transaktioner (samma normaliserade handlare). */
export function similarTo(t: Transaction, all: Transaction[]): Transaction[] {
  const m = normalizeMerchant(t.description)
  return all.filter((x) => x.id !== t.id && normalizeMerchant(x.description) === m)
}

/** Regelns värde för ”Alla liknande”: beskrivningen utan butiksnummer på slutet. */
export function merchantKey(desc: string): string {
  return desc.replace(/\s+\d{1,4}$/, '').trim()
}
