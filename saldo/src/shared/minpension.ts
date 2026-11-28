/**
 * Avläsning av minPension. Sidan saknar öppet API, så vi läser det användaren själv ser när hen är inloggad:
 *  1. JSON-svar som minPensions webbapp hämtar (fångas i main-processen via Chrome DevTools-protokollet).
 *  2. Den synliga sidan: textblock runt varje belopp (extractPage körs i minPension-fönstret).
 * Tolkningen är medvetet oberoende av exakta CSS-klasser, eftersom de kan ändras utan förvarning.
 */

export type ScrapedKind = 'Allmän' | 'Tjänste' | 'Privat'

export interface ScrapedPension {
  name: string
  company: string
  value: number
  valueDate: string | null
  kind: ScrapedKind
  via: 'json' | 'sida'
}

export interface PageSnapshot {
  url: string
  title: string
  blocks: string[][]
  text: string
}

export interface CapturedJson {
  url: string
  body: unknown
}

export interface ReadResult {
  pensions: ScrapedPension[]
  total: number | null // ”Totalt pensionskapital” om sidan visar det
  url: string
  title: string
  loggedIn: boolean
  jsonCount: number
}

/* ------------------------------------------------------------------ */
/* Körs inne i minPension-fönstret. Får inte referera något utanför sig själv. */
export function extractPage(): PageSnapshot {
  const AMT = /\d{1,3}(?:[   .]\d{3})+(?:,\d+)?\s*(?:kronor|kr|SEK)(?![a-zåäö])|\d{4,}(?:,\d+)?\s*(?:kronor|kr|SEK)(?![a-zåäö])/g
  const count = (t: string) => (t.match(AMT) || []).length
  const lines = (t: string) =>
    t
      .split(/\n|\t/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  const seen = new Set<string>()
  const blocks: string[][] = []
  const all = Array.from(document.querySelectorAll<HTMLElement>('body *'))
  for (const el of all) {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue
    const t = el.innerText || ''
    if (t.length > 160 || count(t) !== 1) continue
    // Bara det innersta elementet som innehåller beloppet.
    if (Array.from(el.children).some((c) => count((c as HTMLElement).innerText || '') === 1)) continue
    // Väx uppåt till ett ”kort”: så länge föräldern bara innehåller ett par belopp och är kort.
    let box: HTMLElement = el
    for (let i = 0; i < 8 && box.parentElement; i++) {
      const p = box.parentElement
      const pt = p.innerText || ''
      if (pt.length > 700 || count(pt) > 3) break
      box = p
    }
    const key = box.innerText
    if (seen.has(key)) continue
    seen.add(key)
    blocks.push(lines(key))
  }
  // Tabellrader som egna block.
  document.querySelectorAll('tr').forEach((tr) => {
    const t = (tr as HTMLElement).innerText || ''
    if (count(t) >= 1 && count(t) <= 3 && !seen.has(t)) {
      seen.add(t)
      blocks.push(lines(t.replace(/\t/g, '\n')))
    }
  })
  return { url: location.href, title: document.title, blocks, text: (document.body.innerText || '').slice(0, 300000) }
}
/* ------------------------------------------------------------------ */

const MONTHS: Record<string, string> = {
  januari: '01', februari: '02', mars: '03', april: '04', maj: '05', juni: '06',
  juli: '07', augusti: '08', september: '09', oktober: '10', november: '11', december: '12'
}

export const COMPANIES = [
  'Pensionsmyndigheten', 'Alecta', 'AMF', 'Collectum', 'SEB', 'Skandia', 'Folksam', 'KPA', 'SPP', 'Storebrand',
  'Länsförsäkringar', 'Avanza', 'Nordnet', 'Swedbank', 'Handelsbanken', 'Nordea', 'Danske Bank', 'Movestic',
  'Futur', 'Danica', 'Euroaccident', 'Fora', 'Statens tjänstepensionsverk', 'SPV', 'Valcentralen', 'Max Matthiessen',
  'Söderberg', 'PFA', 'Lärarförsäkringar', 'Brummer', 'Garantum', 'Nordea Liv', 'If', 'Trygg-Hansa', 'Svenska kyrkans pensionskassa',
  'PRI', 'Bliwa', 'Unionen', 'Gouda', 'Lysa', 'Mangold', 'ICA Banken', 'Ikano', 'Sparbanken'
]

const NAME_RE =
  /(inkomstpension|premiepension|garantipension|tilläggspension|ATP|tjänstepension|ITPK|ITP ?1|ITP ?2|ITP|SAF-?LO|AKAP-?KR|AKAP-?KL|KAP-?KL|PA ?16|PA-?03|PISA|PFA ?\d*|avtalspension|privat pensionssparande|pensionssparande|IPS|pensionsförsäkring|fondförsäkring|traditionell (?:pensions)?försäkring|kapitalförsäkring|efterlevandeskydd|PPM)/i
const VALUE_LABEL = /(värde|behållning|kapital|saldo|marknadsvärde|fondvärde|försäkringskapital|återköpsvärde|summa sparat)/i
const MONTHLY = /(\/\s*mån|per månad|i månaden|kr\s*\/\s*mån|månadsbelopp|utbetalning|prognos|per år|\/\s*år|livsvarig|från \d{2} år)/i
const TOTAL = /(totalt|summa|sammanlagt|total)/i
const AMT_RE = /(\d{1,3}(?:[   .]\d{3})+|\d{4,}|\d{1,3})(?:,(\d{1,2}))?\s*(?:kronor|kr|SEK)(?![a-zåäö])/g

export function parseKr(s: string): number[] {
  const out: number[] = []
  for (const m of s.matchAll(AMT_RE)) {
    const v = Number(m[1].replace(/[   .]/g, '') + (m[2] ? '.' + m[2] : ''))
    if (Number.isFinite(v)) out.push(v)
  }
  return out
}

export function parseSwedishDate(s: string): string | null {
  let m = s.match(/(20\d{2}|19\d{2})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/(\d{1,2}) (januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december) (\d{4})/i)
  if (m) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export function findCompany(s: string): string | null {
  // Längsta träff först (”Nordea Liv” före ”Nordea”).
  const hits = COMPANIES.filter((c) => new RegExp(`(^|[^A-Za-zÅÄÖåäö])${c.replace(/[-]/g, '\\-')}($|[^A-Za-zÅÄÖåäö])`, 'i').test(s)).sort((a, b) => b.length - a.length)
  return hits[0] ?? null
}

export function classify(name: string, company: string): ScrapedKind {
  const s = `${name} ${company}`
  if (/inkomstpension|premiepension|garantipension|tilläggspension|\bATP\b|PPM|allmän pension|pensionsmyndigheten/i.test(s)) return 'Allmän'
  if (/privat|IPS|individuellt pensionssparande|kapitalförsäkring/i.test(s)) return 'Privat'
  return 'Tjänste'
}

const isLabel = (l: string) => /^(värde|behållning|kapital|värdedatum|datum|bolag|förvaltare|försäkringsbolag|typ|status|visa|mer|läs mer|detaljer|se detaljer|fonder|avgift)\b/i.test(l)

/** Tolkar ett textblock (ett ”kort” eller en tabellrad) till en pension. */
export function parseBlock(lines: string[]): Omit<ScrapedPension, 'via'> | null {
  const joined = lines.join('\n')
  if (TOTAL.test(lines[0] ?? '') && !NAME_RE.test(lines[0])) return null
  let value: number | null = null
  let labelled = false
  lines.forEach((l, i) => {
    const amts = parseKr(l)
    if (!amts.length) return
    const ctx = `${lines[i - 1] ?? ''} ${l}`
    if (MONTHLY.test(l) || (MONTHLY.test(lines[i - 1] ?? '') && !VALUE_LABEL.test(lines[i - 1] ?? ''))) return
    if (TOTAL.test(l) && !NAME_RE.test(l)) return
    const isLab = VALUE_LABEL.test(ctx)
    if (value === null || (isLab && !labelled)) {
      value = amts[0]
      labelled = isLab
    }
  })
  if (value === null || value < 100) return null
  const short = findCompany(joined) ?? ''
  // Hela bolagsraden om den står för sig själv (”SEB Pension och Försäkring”).
  const company = (short && lines.find((l) => l.includes(short) && !parseKr(l).length && l.length <= 50 && !NAME_RE.test(l))) || short
  const nameLine = lines.find((l) => NAME_RE.test(l) && parseKr(l).length === 0) ?? lines.find((l) => NAME_RE.test(l))
  const fallback = lines.find((l) => /[A-Za-zÅÄÖåäö]{3,}/.test(l) && !parseKr(l).length && !parseSwedishDate(l) && !isLabel(l) && l !== company && l.length < 80)
  let name = (nameLine ?? fallback ?? '').replace(AMT_RE, '').replace(company, '').replace(/\s+/g, ' ').trim()
  if (!name && company) name = company
  if (!name || (!company && !NAME_RE.test(joined))) return null
  if (name.length > 70) name = name.slice(0, 70)
  return { name, company, value, valueDate: parseSwedishDate(joined), kind: classify(name, company) }
}

/** ”Totalt pensionskapital 2 184 300 kr” om sidan visar en summa. */
export function findTotal(text: string): number | null {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (/^totalt?\b|total[t]?.*(pension|kapital|värde|sparat)|(pension|kapital).*total/i.test(l)) {
      const next = lines[i + 1] ?? ''
      if (MONTHLY.test(l) || (!parseKr(l).length && MONTHLY.test(next))) continue
      const a = parseKr(l)[0] ?? parseKr(next)[0]
      if (a && a > 1000) return a
    }
  }
  return null
}

/* JSON ---------------------------------------------------------------- */
const VKEY = /^(value|varde|värde|behallning|behållning|kapital|capital|balance|amount|marketvalue|marknadsvarde|marknadsvärde|totalvalue|insurancevalue|fondvarde|fundvalue|currentvalue|savedamount|sparatbelopp|vardesumma)$/i
const NKEY = /^(name|namn|title|titel|productname|produktnamn|produkt|benamning|benämning|pensionname|pensionsnamn|displayname|description|beskrivning|typ|type|avtal|agreementname)$/i
const CKEY = /^(company|companyname|bolag|bolagsnamn|insurer|insurancecompany|forsakringsgivare|försäkringsgivare|provider|providername|institute|institut|organisation|organization|forvaltare|förvaltare|issuer|aktor|aktör)$/i
const DKEY = /(valuedate|vardedatum|värdedatum|date|datum|asof|updated)/i

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const k = parseKr(v.includes('kr') ? v : `${v} kr`)[0]
    if (k !== undefined) return k
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of ['amount', 'value', 'belopp', 'varde']) if (typeof o[k] === 'number') return o[k] as number
  }
  return null
}
function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim() && v.length < 120) return v.trim()
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    for (const k of ['name', 'namn', 'title', 'displayName']) if (typeof o[k] === 'string') return (o[k] as string).trim()
  }
  return null
}

export function parseJson(bodies: CapturedJson[]): Omit<ScrapedPension, 'via'>[] {
  const out: Omit<ScrapedPension, 'via'>[] = []
  const walk = (o: unknown, parentCompany: string | null, depth: number) => {
    if (depth > 12 || !o || typeof o !== 'object') return
    if (Array.isArray(o)) return o.forEach((x) => walk(x, parentCompany, depth + 1))
    const r = o as Record<string, unknown>
    const keys = Object.keys(r)
    let company = parentCompany
    for (const k of keys) if (CKEY.test(k) && str(r[k])) company = str(r[k])
    let value: number | null = null
    let name: string | null = null
    let date: string | null = null
    for (const k of keys) {
      if (value === null && VKEY.test(k)) value = num(r[k])
      if (name === null && NKEY.test(k)) name = str(r[k])
      if (date === null && DKEY.test(k) && typeof r[k] === 'string') date = parseSwedishDate(r[k] as string)
    }
    const looksPension = name && (NAME_RE.test(name) || company)
    if (value !== null && value >= 100 && looksPension && !TOTAL.test(name!)) {
      const comp = company ?? findCompany(name!) ?? ''
      out.push({ name: name!, company: comp, value, valueDate: date, kind: classify(name!, comp) })
    }
    for (const k of keys) walk(r[k], company, depth + 1)
  }
  bodies.forEach((b) => walk(b.body, null, 0))
  return out
}

/* Sammanställning ------------------------------------------------------- */
const norm = (s: string) => s.toLowerCase().replace(/[^a-zåäö0-9]/g, '')

export function dedupe(list: ScrapedPension[]): ScrapedPension[] {
  const out: ScrapedPension[] = []
  for (const p of list) {
    const same = out.find((o) => norm(o.name) === norm(p.name) && (norm(o.company) === norm(p.company) || !o.company || !p.company) && Math.abs(o.value - p.value) <= Math.max(1, o.value * 0.001))
    if (same) {
      if (!same.company && p.company) same.company = p.company
      if (!same.valueDate && p.valueDate) same.valueDate = p.valueDate
      continue
    }
    out.push({ ...p })
  }
  return out
}

export function buildResult(page: PageSnapshot | null, json: CapturedJson[]): ReadResult {
  const fromJson = parseJson(json).map((p) => ({ ...p, via: 'json' as const }))
  const fromPage = page ? (page.blocks.map(parseBlock).filter(Boolean) as Omit<ScrapedPension, 'via'>[]).map((p) => ({ ...p, via: 'sida' as const })) : []
  // JSON först: den är exaktare. Sidans block kompletterar.
  let pensions = dedupe([...fromJson, ...fromPage])
  // Ta bort rader som bara är summor av andra rader (t.ex. ”Allmän pension” = inkomst + premie).
  pensions = pensions.filter((p) => {
    const others = pensions.filter((o) => o !== p && o.kind === p.kind)
    const sum = others.reduce((s, o) => s + o.value, 0)
    return !(others.length >= 2 && Math.abs(sum - p.value) < 2 && !NAME_RE.test(p.name.replace(/allmän pension/i, '')))
  })
  const text = page?.text ?? ''
  const loggedIn = !!page && !/logga in|bankid/i.test(page.title) && (/logga ut/i.test(text) || pensions.length > 0)
  return { pensions, total: findTotal(text), url: page?.url ?? '', title: page?.title ?? '', loggedIn, jsonCount: json.length }
}
