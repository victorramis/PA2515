/** Svensk formatering: ”12 345 kr”, ”−1 234,50 kr”, datum 2026-11-24. */
export const MINUS = '−'
export const NBSP = ' '

const cache = new Map<number, Intl.NumberFormat>()
function nf(decimals: number): Intl.NumberFormat {
  let f = cache.get(decimals)
  if (!f) {
    f = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    cache.set(decimals, f)
  }
  return f
}

/** Tal utan valuta, med hårt mellanslag som tusentalsavgränsare och U+2212 som minus. */
export function formatNumber(n: number, decimals = 0): string {
  const abs = nf(decimals).format(Math.abs(n)).replace(/[\s ]/g, NBSP)
  const rounded = Number(Math.abs(n).toFixed(decimals))
  return (n < 0 && rounded !== 0 ? MINUS : '') + abs
}

export interface KrOpts {
  decimals?: number
  sign?: boolean // + för positiva (inflöden i listor)
  hide?: boolean
}

export function formatKr(n: number, { decimals = 0, sign = false, hide = false }: KrOpts = {}): string {
  if (hide) return `••••${NBSP}kr`
  const s = formatNumber(n, decimals)
  const plus = sign && Number(n.toFixed(decimals)) > 0 ? '+' : ''
  return `${plus}${s}${NBSP}kr`
}

/** Axel-etikett: ”60 tkr”, ”1,2 mn”. */
export function formatAxis(n: number, hide = false): string {
  if (hide) return '••••'
  const a = Math.abs(n)
  if (a >= 1e6) return `${formatNumber(n / 1e6, a >= 1e7 ? 0 : 1).replace(/,0$/, '')}${NBSP}mn`
  if (a >= 1000) return `${formatNumber(Math.round(n / 1000))}${NBSP}tkr`
  return formatNumber(n)
}

export function formatPct(n: number, decimals = 1): string {
  return `${formatNumber(n, decimals)}${NBSP}%`
}

/** Tolkar svenska belopp: ”1 234,50”, ”−1 234,50”, ”1234.5”, ”-12 940,00 kr”. */
export function parseAmount(input: string | number): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null
  let s = String(input).trim().replace(/kr|sek/gi, '').replace(/[\s  ]/g, '').replace(MINUS, '-').replace('–', '-')
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  if (s.endsWith('-')) {
    neg = true
    s = s.slice(0, -1)
  }
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma > -1) {
    s = s.replace(',', '.')
  }
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null
  const v = Number(s)
  return neg ? -Math.abs(v) : v
}

export const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
export const MONTHS_SHORT = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isoDateTime(d: Date): string {
  return `${isoDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}

/** Period = månad, nyckel ”2026-11”. */
export const monthKey = (iso: string) => iso.slice(0, 7)
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
export function monthLabel(key: string, style: 'long' | 'short' | 'name' = 'long'): string {
  const [y, m] = key.split('-').map(Number)
  if (style === 'short') return MONTHS_SHORT[m - 1]
  if (style === 'name') return MONTHS[m - 1]
  return `${MONTHS[m - 1]} ${y}`
}
