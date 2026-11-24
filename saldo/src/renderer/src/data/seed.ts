import { defaultScenarios } from '@/lib/pension-sim'
import { addDays, isoDate } from '@/lib/format'
import { autoCategorize, normalizeMerchant } from '@/lib/categorize'
import { rng } from '@/lib/utils'
import type { Account, AppData, Category, CatSource, PensionItem, Rule, Settings, Suggestion, Transaction } from '@/lib/types'

/** Påhittad men realistisk exempeldata: två år, Vallentuna. */

export const CATEGORIES: Category[] = [
  { id: 'boende', name: 'Boende', parentId: null, color: 0, icon: 'home', type: 'utgift', excluded: false },
  { id: 'bolan', name: 'Bolån och ränta', parentId: 'boende', color: 0, icon: 'home', type: 'utgift', excluded: false },
  { id: 'el', name: 'El', parentId: 'boende', color: 0, icon: 'home', type: 'utgift', excluded: false },
  { id: 'va', name: 'Vatten och avfall', parentId: 'boende', color: 0, icon: 'home', type: 'utgift', excluded: false },
  { id: 'hem', name: 'Hem och trädgård', parentId: 'boende', color: 0, icon: 'home', type: 'utgift', excluded: false },
  { id: 'mat', name: 'Mat och dryck', parentId: null, color: 1, icon: 'cart', type: 'utgift', excluded: false },
  { id: 'liv', name: 'Livsmedel', parentId: 'mat', color: 1, icon: 'cart', type: 'utgift', excluded: false },
  { id: 'rest', name: 'Restaurang och café', parentId: 'mat', color: 1, icon: 'cart', type: 'utgift', excluded: false },
  { id: 'alk', name: 'Alkohol', parentId: 'mat', color: 1, icon: 'cart', type: 'utgift', excluded: false },
  { id: 'transport', name: 'Transport', parentId: null, color: 2, icon: 'car', type: 'utgift', excluded: false },
  { id: 'sl', name: 'Kollektivtrafik', parentId: 'transport', color: 2, icon: 'car', type: 'utgift', excluded: false },
  { id: 'drv', name: 'Drivmedel', parentId: 'transport', color: 2, icon: 'car', type: 'utgift', excluded: false },
  { id: 'bil', name: 'Bil och verkstad', parentId: 'transport', color: 2, icon: 'car', type: 'utgift', excluded: false },
  { id: 'noje', name: 'Nöje och streaming', parentId: null, color: 6, icon: 'play', type: 'utgift', excluded: false },
  { id: 'str', name: 'Streaming', parentId: 'noje', color: 6, icon: 'play', type: 'utgift', excluded: false },
  { id: 'evt', name: 'Evenemang', parentId: 'noje', color: 6, icon: 'play', type: 'utgift', excluded: false },
  { id: 'halsa', name: 'Hälsa', parentId: null, color: 4, icon: 'heart', type: 'utgift', excluded: false },
  { id: 'apo', name: 'Apotek', parentId: 'halsa', color: 4, icon: 'heart', type: 'utgift', excluded: false },
  { id: 'trn', name: 'Träning', parentId: 'halsa', color: 4, icon: 'heart', type: 'utgift', excluded: false },
  { id: 'resor', name: 'Resor', parentId: null, color: 7, icon: 'plane', type: 'utgift', excluded: false },
  { id: 'klader', name: 'Kläder och prylar', parentId: null, color: 5, icon: 'bag', type: 'utgift', excluded: false },
  { id: 'ovrigt', name: 'Övrigt', parentId: null, color: 9, icon: 'dots', type: 'utgift', excluded: false },
  { id: 'ink', name: 'Inkomster', parentId: null, color: 4, icon: 'coin', type: 'inkomst', excluded: false },
  { id: 'lon', name: 'Lön', parentId: 'ink', color: 4, icon: 'coin', type: 'inkomst', excluded: false },
  { id: 'ranta', name: 'Ränta', parentId: 'ink', color: 4, icon: 'coin', type: 'inkomst', excluded: false },
  { id: 'ovrink', name: 'Övriga inkomster', parentId: 'ink', color: 4, icon: 'coin', type: 'inkomst', excluded: false },
  { id: 'ovf', name: 'Överföringar', parentId: null, color: 9, icon: 'arrows', type: 'överföring', excluded: true },
  { id: 'egna', name: 'Mellan egna konton', parentId: 'ovf', color: 9, icon: 'arrows', type: 'överföring', excluded: true }
]

const R = (id: string, categoryId: string, kind: Rule['kind'], value: string, accountId: string | null = null): Rule => ({
  id,
  categoryId,
  kind,
  value,
  accountId,
  createdAt: '2024-11-30'
})

export const RULES: Rule[] = [
  R('r-ica', 'liv', 'contains', 'ICA'),
  R('r-willys', 'liv', 'contains', 'Willys'),
  R('r-coop', 'liv', 'startsWith', 'Coop'),
  R('r-rest', 'rest', 'contains', 'Restaurang'),
  R('r-system', 'alk', 'contains', 'Systembolaget'),
  R('r-circle', 'drv', 'contains', 'Circle K'),
  R('r-sl', 'sl', 'startsWith', 'SL '),
  R('r-spotify', 'str', 'contains', 'Spotify'),
  R('r-netflix', 'str', 'contains', 'Netflix'),
  R('r-vattenfall', 'el', 'contains', 'VATTENFALL', 'hb-allkonto'),
  R('r-bolan', 'bolan', 'contains', 'Bolånebetalning', 'hb-allkonto'),
  R('r-va', 'va', 'contains', 'Vallentuna kommun'),
  R('r-forsak', 'hem', 'contains', 'Hemförsäkring'),
  R('r-sats', 'trn', 'contains', 'SATS'),
  R('r-lon', 'lon', 'startsWith', 'Lön'),
  R('r-ranta', 'ranta', 'startsWith', 'Ränta'),
  R('r-ovf', 'egna', 'contains', 'Överföring'),
  R('r-amexbet', 'egna', 'contains', 'AMEX BETALNING', 'hb-allkonto'),
  R('r-amexmot', 'egna', 'contains', 'BETALNING MOTTAGEN', 'amex')
]

export const PENSION_ITEMS: PensionItem[] = [
  { id: 'inkomst', name: 'Inkomstpension', sub: 'Allmän pension', company: 'Pensionsmyndigheten', kind: 'Allmän', color: '#2E7D8C' },
  { id: 'premie', name: 'Premiepension', sub: 'Allmän pension · 3 fonder', company: 'Pensionsmyndigheten', kind: 'Allmän', color: '#3E95CF' },
  { id: 'itp', name: 'Tjänstepension ITP 1', sub: 'Fondförsäkring', company: 'SEB Pension och Försäkring', kind: 'Tjänste', color: '#D9822B' },
  { id: 'ips', name: 'Privat pensionssparande', sub: 'IPS', company: 'Avanza Pension', kind: 'Privat', color: '#8A5CC2' }
]

export const DEFAULT_SETTINGS: Settings = {
  birthYear: 1989,
  municipality: 'Vallentuna',
  taxRate: 30.98,
  churchFee: 1.02,
  church: false,
  stateTaxThreshold: 643100,
  dataMode: 'bank',
  ai: true,
  learn: true,
  rules: true,
  touchId: true,
  hideOnStart: false,
  lockAfter: '5 minuter',
  syncEvery: 'Var 6:e timme',
  consentReminder: 14,
  backup: 'Varje natt',
  keepBackups: '30 senaste',
  csvReminder: 'Varje månad, den 1:a',
  watchFolder: '~/Downloads'
}

interface Draft {
  date: string
  description: string
  raw: string
  accountId: string
  amount: number
  categoryId?: string | null
  source?: CatSource | null
  aiConfidence?: number
  suggestions?: Suggestion[]
  context?: string
}

export function emptyData(today: string): AppData {
  return {
    version: 1,
    seededAt: today,
    accounts: [],
    categories: CATEGORIES.map((c) => ({ ...c })),
    transactions: [],
    rules: [],
    learned: {},
    profiles: [],
    imports: [],
    pensions: PENSION_ITEMS.map((x) => ({ ...x })),
    snapshots: [],
    privateAssets: [],
    scenarios: defaultScenarios(),
    settings: { ...DEFAULT_SETTINGS }
  }
}

export function seedData(now = new Date()): AppData {
  const today = isoDate(now)
  const r = rng(20261124)
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const between = (a: number, b: number, dec = 2) => Number((a + r() * (b - a)).toFixed(dec))
  const drafts: Draft[] = []
  const add = (d: Draft) => {
    if (d.date <= today) drafts.push(d)
  }

  const end = new Date(now.getFullYear(), now.getMonth(), 1)
  const startMonth = new Date(end.getFullYear(), end.getMonth() - 23, 1)
  const recentCut = addDays(today, -13) // de senaste två veckorna är handskrivna nedan

  for (let m = 0; m < 24; m++) {
    const base = new Date(startMonth.getFullYear(), startMonth.getMonth() + m, 1)
    const y = base.getFullYear()
    const mo = base.getMonth() + 1
    const dim = new Date(y, mo, 0).getDate()
    const d = (day: number) => `${y}-${String(mo).padStart(2, '0')}-${String(Math.min(dim, day)).padStart(2, '0')}`
    const daily = (day: number, x: Draft) => {
      const date = d(day)
      if (date < recentCut) add({ ...x, date })
    }
    const raise = y > 2026 || (y === 2026 && mo >= 4)
    const salary = raise ? 48900 : 47200

    // Fasta inkomster och kostnader på Allkontot.
    add({ date: d(24), description: 'Lön Allica Bank', raw: `LÖN ${String(y).slice(2)}${String(mo).padStart(2, '0')} ALLICA`, accountId: 'hb-allkonto', amount: salary })
    if (mo === 6) add({ date: d(24), description: 'Semesterersättning Allica Bank', raw: 'SEMERS ALLICA', accountId: 'hb-allkonto', amount: 12300 })
    if (mo === 12) add({ date: d(18), description: 'Bonus Allica Bank', raw: 'BONUS ALLICA', accountId: 'hb-allkonto', amount: 3580 })
    if (mo === 1) add({ date: d(2), description: `Ränta ${y - 1}`, raw: 'RÄNTA', accountId: 'hb-spar', amount: 1250 })
    if (mo === 1) add({ date: d(2), description: `Ränta ${y - 1}`, raw: 'RÄNTEINSÄTTNING', accountId: 'seb-spar', amount: 3940 })
    add({ date: d(28), description: 'Bolånebetalning Handelsbanken', raw: 'BOLÅN 6142-883 112', accountId: 'hb-allkonto', amount: -6450 })
    const winter = [1, 2, 3, 11, 12].includes(mo) ? 1 : [4, 10].includes(mo) ? 0.6 : 0.3
    add({ date: d(14), description: 'Vattenfall AB', raw: 'BG 5050-1055 VATTENFALL', accountId: 'hb-allkonto', amount: -Math.round(620 + winter * between(700, 1050, 0)) })
    if ([3, 6, 9, 12].includes(mo)) add({ date: d(3), description: 'Vallentuna kommun VA', raw: 'BG 5371-0011 VALLENTUNA K', accountId: 'hb-allkonto', amount: -3411 })
    add({ date: d(1), description: 'Länsförsäkringar Hemförsäkring', raw: 'AG LANSFORSAKRINGAR', accountId: 'hb-allkonto', amount: -289 })
    add({ date: d(27), description: 'SATS Täby', raw: 'AG SATS SVERIGE', accountId: 'hb-allkonto', amount: -599 })

    // Överföringar mellan egna konton.
    daily(20, { date: '', description: 'Överföring till Enkla sparkontot', raw: 'ÖVF SEB 5357-XX XX', accountId: 'hb-allkonto', amount: -10000 })
    daily(20, { date: '', description: 'Överföring från Handelsbanken', raw: 'INSÄTTNING ÖVF', accountId: 'seb-spar', amount: 10000 })
    add({ date: d(26), description: 'Överföring till Sparkonto', raw: 'ÖVF EGET KONTO 904', accountId: 'hb-allkonto', amount: -5000 })
    add({ date: d(26), description: 'Överföring från Allkonto', raw: 'ÖVF EGET KONTO 218', accountId: 'hb-spar', amount: 5000 })

    // Abonnemang på Amex.
    daily(20, { date: '', description: 'Spotify', raw: 'SPOTIFY P2F4A1C STOCKHOLM', accountId: 'amex', amount: -139 })
    daily(5, { date: '', description: 'Netflix.com', raw: 'NETFLIX.COM AMSTERDAM', accountId: 'amex', amount: -149 })
    daily(17, { date: '', description: 'SL Mobilbiljett', raw: 'SL APP STOCKHOLM', accountId: 'amex', amount: y === 2024 || (y === 2025 && mo < 4) ? -970 : -1060 })
    if (y > 2025 || (y === 2025 && mo >= 3)) daily(14, { date: '', description: 'Apple.com/bill', raw: 'APPLE.COM/BILL ITUNES', accountId: 'amex', amount: -129, categoryId: 'str', source: 'learned' })

    // Vardagsköp.
    const card = () => (r() < 0.62 ? 'amex' : 'hb-allkonto')
    const groceries = [
      ['ICA Kvantum Vallentuna', 'ICA KVANTUM VALLENTUNA SE', 7, 320, 1150],
      ['Willys Arninge', 'WILLYS ARNINGE', 4, 520, 1350],
      ['Coop Vallentuna', 'COOP VALLENTUNA', 3, 180, 720],
      ['ICA Nära Lindholmen', 'ICA NARA LINDHOLMEN', 2, 60, 290]
    ] as const
    for (const [desc, raw, n, lo, hi] of groceries) {
      const k = Math.max(1, Math.round(n * (0.75 + r() * 0.5)))
      for (let i = 0; i < k; i++) daily(1 + Math.floor(r() * dim), { date: '', description: desc, raw, accountId: card(), amount: -between(lo, hi) })
    }
    for (let i = 0; i < 2; i++) daily(4 + Math.floor(r() * 24), { date: '', description: 'Systembolaget Täby C', raw: 'SYSTEMBOLAGET 0171', accountId: 'hb-allkonto', amount: -between(220, 640, 0) })
    for (let i = 0; i < 2 + Math.floor(r() * 2); i++) daily(1 + Math.floor(r() * dim), { date: '', description: 'Circle K Vallentuna', raw: 'CIRCLE K VALLENTUNA', accountId: 'amex', amount: -between(540, 910) })
    if (r() < 0.8) daily(1 + Math.floor(r() * dim), { date: '', description: 'Apoteket Vallentuna', raw: 'APOTEKET AB VALLENTUNA', accountId: 'amex', amount: -between(110, 460), categoryId: 'apo', source: r() < 0.5 ? 'manual' : 'learned' })
    const restaurants = [
      ['Restaurang Tranan', 'TRANAN STOCKHOLM', 700, 1450],
      ['Pizzeria Ciao Ciao', 'CIAO CIAO VALLENTUNA', 180, 420],
      ['Espresso House Täby C', 'ESPRESSO HOUSE 117', 55, 140],
      ['Max Burgers Arninge', 'MAX ARNINGE', 95, 260],
      ['Sushi Yama Vallentuna', 'SUSHI YAMA VALLENTUNA', 160, 380],
      ['Pong Täby', 'PONG TABY', 320, 690]
    ] as const
    for (let i = 0; i < 4 + Math.floor(r() * 5); i++) {
      const [desc, raw, lo, hi] = pick(restaurants as unknown as [string, string, number, number][])
      daily(1 + Math.floor(r() * dim), { date: '', description: desc, raw, accountId: 'amex', amount: -between(lo, hi, 0) })
    }
    if (r() < 0.55) {
      const [desc, raw, lo, hi] = pick([
        ['Stadium Täby', 'STADIUM TABY', 400, 1900],
        ['H&M Täby C', 'H&M 0457 TABY', 200, 900],
        ['Åhléns City', 'AHLENS CITY', 150, 800],
        ['Clas Ohlson Täby', 'CLAS OHLSON 058', 90, 600]
      ] as [string, string, number, number][])
      daily(1 + Math.floor(r() * dim), { date: '', description: desc, raw, accountId: card(), amount: -between(lo, hi, 0) })
    }
    if (r() < 0.35) {
      const [desc, raw, lo, hi] = pick([
        ['Filmstaden Täby', 'FILMSTADEN TABY', 260, 420],
        ['Tickster', 'TICKSTER AB', 450, 1100]
      ] as [string, string, number, number][])
      daily(1 + Math.floor(r() * dim), { date: '', description: desc, raw, accountId: 'amex', amount: -between(lo, hi, 0) })
    }
    if (r() < 0.45) daily(1 + Math.floor(r() * dim), { date: '', description: 'Bauhaus Arninge', raw: 'BAUHAUS 2107 TABY', accountId: 'hb-allkonto', amount: -between(180, 1600, 0) })
    for (let i = 0; i < Math.floor(r() * 3); i++) {
      const num = `07${Math.floor(r() * 10)} ${String(Math.floor(r() * 90 + 10))} ${String(Math.floor(r() * 90 + 10))} ${String(Math.floor(r() * 90 + 10))}`
      daily(1 + Math.floor(r() * dim), { date: '', description: `Swish till ${num}`, raw: `SWISH 4670${num.replace(/\s/g, '').slice(2)}`, accountId: 'hb-allkonto', amount: -between(100, 600, 0), categoryId: 'ovrigt', source: 'manual' })
    }
    if (mo === 4) daily(9, { date: '', description: 'Vallentuna Bil & Däck', raw: 'VALLENTUNA BIL O DACK', accountId: 'hb-allkonto', amount: -2980, categoryId: 'bil', source: 'manual' })
    if (mo === 10 && y === 2025) daily(8, { date: '', description: 'Vallentuna Bil & Däck', raw: 'VALLENTUNA BIL O DACK', accountId: 'hb-allkonto', amount: -3200, categoryId: 'bil', source: 'manual' })

    // Resor.
    const trips: Record<string, [string, string, number][]> = {
      '2025-02': [['SkiStar Sälen', 'SKISTAR SALEN', 6400], ['Circle K Mora', 'CIRCLE K MORA', 890]],
      '2025-07': [['SAS Plus ARN–NCE', 'SAS SCANDINAVIAN AIRL', 6980], ['Booking.com Nice', 'BOOKING.COM HOTEL', 7420], ['Restaurang La Petite Maison', 'LA PETITE MAISON NICE', 1460]],
      '2025-12': [['SJ Stockholm–Göteborg', 'SJ AB', 1290]],
      '2026-02': [['SkiStar Åre', 'SKISTAR ARE', 7900], ['SJ Stockholm–Åre', 'SJ AB', 2380]],
      '2026-06': [['Norwegian ARN–BCN', 'NORWEGIAN AIR', 4620], ['Hotel Casa Fuster', 'CASA FUSTER BARCELONA', 6830]],
      '2026-07': [['Ving Kreta', 'VING SVERIGE AB', 11450]],
      '2026-10': [['SAS Plus ARN–LHR', 'SAS SCANDINAVIAN AIRL', 2140], ['Hotel Strand London', 'STRAND PALACE LONDON', 1260]]
    }
    const tk = `${y}-${String(mo).padStart(2, '0')}`
    ;(trips[tk] ?? []).forEach(([desc, raw, amt], i) => daily(6 + i * 3, { date: '', description: desc, raw, accountId: 'amex', amount: -amt }))
  }

  // Senaste två veckorna (som i prototypen), relativt i dag.
  const rel = (k: number) => addDays(today, -k)
  const recent: Draft[] = [
    { date: rel(1), description: 'ICA Kvantum Vallentuna', raw: 'ICA KVANTUM VALLENTUNA SE', accountId: 'amex', amount: -642.3 },
    { date: rel(2), description: 'Restaurang Tranan', raw: 'TRANAN STOCKHOLM', accountId: 'amex', amount: -1284, categoryId: 'rest', source: 'ai', aiConfidence: 87 },
    { date: rel(2), description: 'Systembolaget Täby C', raw: 'SYSTEMBOLAGET 0171', accountId: 'hb-allkonto', amount: -489 },
    { date: rel(3), description: 'Circle K Vallentuna', raw: 'CIRCLE K VALLENTUNA', accountId: 'amex', amount: -812.45 },
    { date: rel(4), description: 'Överföring till Enkla sparkontot', raw: 'ÖVF SEB 5357-XX XX', accountId: 'hb-allkonto', amount: -10000 },
    { date: rel(4), description: 'Överföring från Handelsbanken', raw: 'INSÄTTNING ÖVF', accountId: 'seb-spar', amount: 10000 },
    { date: rel(4), description: 'Spotify', raw: 'SPOTIFY P2F4A1C STOCKHOLM', accountId: 'amex', amount: -139 },
    { date: rel(5), description: 'Willys Arninge', raw: 'WILLYS ARNINGE', accountId: 'hb-allkonto', amount: -1106.85, categoryId: 'liv', source: 'learned' },
    { date: rel(6), description: 'Apoteket Vallentuna', raw: 'APOTEKET AB VALLENTUNA', accountId: 'amex', amount: -326.5, categoryId: 'apo', source: 'manual' },
    { date: rel(7), description: 'SL Mobilbiljett', raw: 'SL APP STOCKHOLM', accountId: 'amex', amount: -1060 },
    { date: rel(8), description: 'Coop Vallentuna', raw: 'COOP VALLENTUNA', accountId: 'hb-allkonto', amount: -534.2 },
    { date: rel(10), description: 'Vattenfall AB', raw: 'BG 5050-1055 VATTENFALL', accountId: 'hb-allkonto', amount: -1243 },
    { date: rel(12), description: 'Betalning American Express', raw: 'AMEX BETALNING', accountId: 'hb-allkonto', amount: 0 },
    { date: rel(12), description: 'BETALNING MOTTAGEN – TACK', raw: 'BETALNING MOTTAGEN – TACK', accountId: 'amex', amount: 0 },
    { date: rel(13), description: 'Espresso House Täby C', raw: 'ESPRESSO HOUSE 117', accountId: 'amex', amount: -86 },
    { date: rel(9), description: 'SAS Plus ARN–CPH', raw: 'SAS SCANDINAVIAN AIRL', accountId: 'amex', amount: -2140, categoryId: 'resor', source: 'ai', aiConfidence: 87 },
    { date: rel(13), description: 'Pizzeria Ciao Ciao', raw: 'CIAO CIAO VALLENTUNA', accountId: 'amex', amount: -386, categoryId: 'rest', source: 'ai', aiConfidence: 82 }
  ]
  const S = (categoryId: string, pct: number, why = ''): Suggestion => ({ categoryId, pct, why })
  // Kön i Att granska: okategoriserade och osäkra.
  const queue: Draft[] = [
    { date: rel(3), description: 'Swish till 0739 41 22 08', raw: 'SWISH 46739412208', accountId: 'hb-allkonto', amount: -350, context: 'Ingen tidigare transaktion till det här numret.', suggestions: [S('ovrigt', 41, 'Vanligast för Swish'), S('rest', 22, 'Belopp liknar delade notor'), S('noje', 12, 'Fredag kväll')] },
    { date: rel(5), description: 'Klarna * Stadium', raw: 'KLARNA*STADIUM SE', accountId: 'amex', amount: -1299, context: 'Klarna döljer ibland handlaren. Stadium säljer sport- och fritidskläder.', suggestions: [S('klader', 64, 'Handlaren säljer kläder'), S('noje', 18, 'Sportutrustning'), S('ovrigt', 9)] },
    { date: rel(6), description: 'Mathem.se', raw: 'MATHEM I SVERIGE AB', accountId: 'amex', amount: -1486.4, context: 'Första köpet hos Mathem. Liknar dina ICA-köp i belopp.', suggestions: [S('liv', 93, 'Matbutik online'), S('ovrigt', 4), S('hem', 1)] },
    { date: rel(8), description: 'Bauhaus Arninge', raw: 'BAUHAUS 2107 TABY', accountId: 'hb-allkonto', amount: -2318, context: 'Senast hos Bauhaus valde du ”Hem och trädgård”.', suggestions: [S('hem', 71, 'Tidigare val'), S('ovrigt', 18), S('noje', 4)] },
    { date: rel(9), description: 'Pressbyrån Odenplan', raw: 'PRESSBYRAN 5512', accountId: 'amex', amount: -64, context: 'AI är osäker: kan vara mat eller tidning.', suggestions: [S('rest', 48, 'Kaffe och mackor'), S('liv', 31), S('noje', 9, 'Tidningar')], categoryId: 'rest', source: 'ai', aiConfidence: 48 },
    { date: rel(10), description: 'Apple.com/bill', raw: 'APPLE.COM/BILL ITUNES', accountId: 'amex', amount: -129, context: 'Återkommande månadsbelopp sedan 2025-03.', suggestions: [S('str', 77, 'Prenumeration'), S('ovrigt', 15), S('halsa', 2)] },
    { date: rel(11), description: 'Vallentuna Bil & Däck', raw: 'VALLENTUNA BIL O DACK', accountId: 'hb-allkonto', amount: -3450, context: 'Liknande belopp i april (däckbyte).', suggestions: [S('bil', 89, 'Bilverkstad'), S('ovrigt', 6), S('hem', 1)] },
    { date: rel(12), description: 'Swish från Jenny', raw: 'SWISH 46701234567', accountId: 'hb-allkonto', amount: 650, context: 'Inbetalning. Liknar tidigare delade notor.', suggestions: [S('ovrink', 52, 'Inbetalning'), S('rest', 20, 'Delad nota'), S('liv', 14)] },
    { date: rel(2), description: 'Tradera *Köp 4471', raw: 'TRADERA AB', accountId: 'amex', amount: -540, context: 'Begagnatköp. Tidigare Tradera-köp saknas.', suggestions: [S('hem', 46, 'Hem och prylar'), S('klader', 30), S('ovrigt', 15)] },
    { date: rel(4), description: 'Clas Ohlson Täby', raw: 'CLAS OHLSON 058', accountId: 'amex', amount: -389, context: 'Säljer både hem- och elektronikprylar.', suggestions: [S('hem', 58, 'Järnhandel'), S('klader', 28, 'Prylar'), S('ovrigt', 10)], categoryId: 'hem', source: 'ai', aiConfidence: 58 },
    { date: rel(6), description: 'Swish till 0708 22 31 90', raw: 'SWISH 46708223190', accountId: 'hb-allkonto', amount: -200, context: 'Tredje Swishen till numret i år.', suggestions: [S('ovrigt', 55, 'Tidigare Swish'), S('noje', 20), S('rest', 12)] },
    { date: rel(7), description: 'Paypal *Steam', raw: 'PAYPAL *STEAM GAMES', accountId: 'amex', amount: -219, context: 'Spelbutik via Paypal.', suggestions: [S('noje', 66, 'Spel'), S('str', 22), S('ovrigt', 8)] },
    { date: rel(9), description: 'Biltema Arninge', raw: 'BILTEMA ARNINGE', accountId: 'hb-allkonto', amount: -742, context: 'Biltillbehör eller hem: Biltema säljer båda.', suggestions: [S('bil', 62, 'Biltillbehör'), S('hem', 30), S('ovrigt', 5)], categoryId: 'bil', source: 'ai', aiConfidence: 62 },
    { date: rel(11), description: 'Uber *Trip', raw: 'UBER *TRIP HELP.UBER.COM', accountId: 'amex', amount: -312, context: 'Taxiresa.', suggestions: [S('sl', 74, 'Resor i vardagen'), S('resor', 18), S('noje', 4)] }
  ]
  drafts.push(...recent, ...queue.map((q) => ({ categoryId: null as string | null, source: null as CatSource | null, ...q })))

  // Amex-betalningar: förra månadens köp betalas den 12:e.
  drafts.sort((a, b) => (a.date < b.date ? -1 : 1))
  const amexByMonth = new Map<string, number>()
  drafts.filter((x) => x.accountId === 'amex' && x.amount < 0).forEach((x) => amexByMonth.set(x.date.slice(0, 7), (amexByMonth.get(x.date.slice(0, 7)) ?? 0) + x.amount))
  for (let m = 1; m < 24; m++) {
    const b = new Date(startMonth.getFullYear(), startMonth.getMonth() + m, 12)
    const prev = new Date(b.getFullYear(), b.getMonth() - 1, 1)
    const pk = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
    const amt = Math.round(-(amexByMonth.get(pk) ?? 0) * 100) / 100
    const date = isoDate(b)
    const isRecent = date === rel(12)
    if (isRecent) {
      drafts.forEach((x) => {
        if (x.date === date && x.raw === 'AMEX BETALNING') x.amount = -amt
        if (x.date === date && x.raw === 'BETALNING MOTTAGEN – TACK') x.amount = amt
      })
    } else if (date <= today) {
      drafts.push({ date, description: 'Betalning American Express', raw: 'AMEX BETALNING', accountId: 'hb-allkonto', amount: -amt })
      drafts.push({ date, description: 'BETALNING MOTTAGEN – TACK', raw: 'BETALNING MOTTAGEN – TACK', accountId: 'amex', amount: amt })
    }
  }
  // Om dagens 12:e inte infaller i ”recent” (t.ex. andra datum än 2026-11-24): ta bort nollrader.
  const cleaned = drafts.filter((x) => x.amount !== 0)
  cleaned.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const learned: Record<string, string> = {
    [normalizeMerchant('ICA Nära Lindholmen')]: 'liv',
    [normalizeMerchant('Espresso House Täby C')]: 'rest',
    [normalizeMerchant('Max Burgers Arninge')]: 'rest',
    [normalizeMerchant('Sushi Yama Vallentuna')]: 'rest',
    [normalizeMerchant('Pizzeria Ciao Ciao')]: 'rest',
    [normalizeMerchant('Apoteket Vallentuna')]: 'apo',
    [normalizeMerchant('Apple.com/bill')]: 'str',
    [normalizeMerchant('Bauhaus Arninge')]: 'hem',
    [normalizeMerchant('Filmstaden Täby')]: 'evt'
  }
  const settings = { ...DEFAULT_SETTINGS }
  const ctx = { rules: RULES, learned, settings }
  const transactions: Transaction[] = cleaned.map((x, i) => {
    const base = { id: `t${String(i).padStart(5, '0')}`, date: x.date, description: x.description, raw: x.raw, accountId: x.accountId, amount: x.amount }
    if (x.categoryId !== undefined || x.source !== undefined || x.suggestions) {
      return { ...base, categoryId: x.categoryId ?? null, source: x.source ?? null, aiConfidence: x.aiConfidence, suggestions: x.suggestions, context: x.context }
    }
    const a = autoCategorize(base, ctx)
    return { ...base, categoryId: a.categoryId, source: a.source, ruleId: a.ruleId, aiConfidence: a.aiConfidence, suggestions: a.suggestions }
  })
  // Inget okategoriserat i historiken utanför kön.
  transactions.forEach((t) => {
    if (!t.categoryId && !queue.some((q) => q.date === t.date && q.description === t.description)) {
      t.categoryId = t.amount > 0 ? 'ovrink' : 'ovrigt'
      t.source = 'manual'
    }
  })

  const ts = `${today}T06:42`
  const accounts: Account[] = [
    { id: 'hb-allkonto', name: 'Handelsbanken Allkonto', bank: 'Handelsbanken', logo: 'HB', logoBg: '#1F4E8C', kind: 'bank', meta: '6142-XXX XXX 218 · lönekonto', openingBalance: 0, updatedAt: ts, consentUntil: '2027-03-02' },
    { id: 'hb-spar', name: 'Handelsbanken Sparkonto', bank: 'Handelsbanken', logo: 'HB', logoBg: '#1F4E8C', kind: 'bank', meta: '6142-XXX XXX 904', openingBalance: 0, updatedAt: ts, consentUntil: '2027-03-02' },
    { id: 'seb-spar', name: 'SEB Enkla sparkontot', bank: 'SEB', logo: 'SEB', logoBg: '#3E7A3A', kind: 'bank', meta: '5357-XX XXX 61', openingBalance: 0, updatedAt: ts, consentUntil: addDays(today, 6) },
    { id: 'amex', name: 'American Express Platinum', bank: 'American Express', logo: 'AX', logoBg: '#2671B9', kind: 'card', meta: 'Kort ·••• 41009 · importprofil ”Amex”', openingBalance: 0, updatedAt: `${rel(4)}T07:10`, profileId: 'p-amex' },
    { id: 'ikano', name: 'Ikano Sparkonto', bank: 'Ikano Bank', logo: 'IK', logoBg: '#7A8691', kind: 'manual', meta: 'Manuellt konto', openingBalance: 0, manualBalance: 41617.23, updatedAt: `${rel(23)}T09:00` },
    { id: 'kontanter', name: 'Kontanter', bank: '', logo: 'KR', logoBg: '#7A8691', kind: 'manual', meta: 'Manuellt konto', openingBalance: 0, manualBalance: 1200, updatedAt: `${rel(43)}T18:20` }
  ]
  const target: Record<string, number> = { 'hb-allkonto': 31842.17, 'hb-spar': 142500, 'seb-spar': 210000 }
  accounts.forEach((a) => {
    const sum = transactions.filter((t) => t.accountId === a.id).reduce((s, t) => s + t.amount, 0)
    if (target[a.id] !== undefined) a.openingBalance = Math.round((target[a.id] - sum) * 100) / 100
  })

  return {
    version: 1,
    seededAt: today,
    accounts,
    categories: CATEGORIES.map((c) => ({ ...c })),
    transactions,
    rules: RULES.map((x) => ({ ...x })),
    learned,
    profiles: [
      { id: 'p-amex', name: 'Amex', format: 'xlsx', signPlus: true, accountId: 'amex', headerMatch: ['Datum', 'Beskrivning', 'Belopp'], mapping: { date: 0, description: 1, amount: 3, balance: null }, lastUsed: rel(4), lastRows: 47 },
      { id: 'p-ikano', name: 'Ikano CSV', format: 'csv', delimiter: ';', signPlus: false, accountId: 'ikano', headerMatch: ['Transaktionsdatum', 'Text', 'Belopp', 'Saldo'], mapping: { date: 0, description: 1, amount: 2, balance: 3 }, lastUsed: rel(23), lastRows: 3 }
    ],
    imports: [],
    pensions: PENSION_ITEMS.map((x) => ({ ...x })),
    snapshots: [
      snap('2025-11-18 19:02', [905000, 338200, 512300, 113400], ['2024-12-31', '2025-11-14', '2025-11-14', '2025-11-17']),
      snap('2026-02-12 07:48', [935400, 356900, 532800, 117200], ['2025-12-31', '2026-02-10', '2026-02-10', '2026-02-11']),
      snap('2026-05-20 21:15', [962100, 381300, 567600, 120700], ['2025-12-31', '2026-05-18', '2026-05-19', '2026-05-19']),
      snap('2026-08-14 06:55', [990800, 404100, 605490, 137700], ['2025-12-31', '2026-08-12', '2026-08-13', '2026-08-13']),
      snap(`${today} 06:31`, [1012400, 412900, 621700, 137300], [`${Number(today.slice(0, 4)) - 1}-12-31`, addDays(today, -4), addDays(today, -3), addDays(today, -3)])
    ],
    privateAssets: [
      { id: 'isk', name: 'ISK', value: 684300, sub: `Avanza · manuellt ${rel(4)}`, color: '#3E95CF' },
      { id: 'hold-cash', name: 'Holdingbolag, likvida medel', value: 310000, sub: 'Bolagskonto · manuellt', color: '#8A5CC2' },
      { id: 'hold-shares', name: 'Onoterade aktier i bolaget', value: 4200000, sub: 'Uppskattat värde · säljs för tidig pension', color: '#B5932A' }
    ],
    scenarios: defaultScenarios(),
    settings: { ...settings, key: { fileName: 'enable-banking-saldo.pem', importedAt: '2026-09-02', appId: 'a3f1c0e2-••••-••••-••••-7b42' } }
  }
}

function snap(fetchedAt: string, v: number[], dates: string[]) {
  const ids = ['inkomst', 'premie', 'itp', 'ips']
  return { fetchedAt, values: Object.fromEntries(ids.map((id, i) => [id, { value: v[i], valueDate: dates[i] }])) }
}

/** Det minPension ”hittar” vid nästa hämtning (simulerad avläsning, utgår från senaste hämtningen). */
export function minPensionReading(today: string, latest?: Record<string, { value: number }>) {
  const base: Record<string, number> = { inkomst: 1012400, premie: 412900, itp: 621700, ips: 137300 }
  const v = (id: string, g: number) => Math.round(((latest?.[id]?.value ?? base[id]) * g) / 100) * 100
  return [
    { id: 'inkomst', value: v('inkomst', 1), valueDate: `${Number(today.slice(0, 4)) - 1}-12-31`, flag: false },
    { id: 'premie', value: v('premie', 1.006), valueDate: addDays(today, -1), flag: false },
    { id: 'itp', value: v('itp', 1.004), valueDate: addDays(today, -1), flag: false },
    { id: 'ips', value: v('ips', 0.998), valueDate: addDays(today, -2), flag: true }
  ]
}
