/**
 * Pensionsmodell (årsvis, i dagens penningvärde). Portad från artboarden ”Pension – Planera”
 * och anteckningarna i ”Överlämning”. Förenklad modell, inte rådgivning.
 */

export interface PensionPlan {
  dep: number // insättning per månad (upphör när du slutar jobba)
  start: number // startålder för uttag
  yrs: number // 0 = livsvarigt
}

export interface Scenario {
  name: string
  R: number // ålder när jag slutar jobba
  netEmp: number // nettolön per månad
  expW: number // utgifter per månad medan jag jobbar
  expR: number // utgifter per månad efter att jag slutat
  rA: number // real avkastning sparfas %, ISK och pension
  rP: number // real avkastning uttagsfas %, pension
  sp: number // sparkonton i dag
  rS: number // ränta sparkonto real %
  buf: number // buffert som alltid ligger kvar
  isk: number
  hc: number // likvida medel i holdingbolaget
  sh0: number // onoterade aktier, värde i dag
  saleAge: number
  salePrice: number
  rH: number // real avkastning i bolaget %
  hFrom: number
  hTo: number
  hSal: number // lön från bolaget per månad, brutto
  hDiv: number // utdelning per år
  gb: number // gränsbelopp per år
  gbSave: boolean
  aga: number // arbetsgivaravgift %
  kom: string
  tax: number // kommunal skattesats %
  kyrka: boolean
  p: PensionPlan[] // inkomstpension, premiepension, ITP 1, IPS
}

export interface SimInput {
  birthYear: number
  currentAge: number
  capital: number[] // pensionskapital i dag, samma ordning som p
  churchFee?: number // %
  stateTaxThreshold?: number
  iskFree?: number
  iskRate?: number
  lifeExpectancy?: number
  endAge?: number
}

export interface SimRow {
  a: number
  y: number
  liq: number
  sp: number
  isk: number
  hold: number
  penA: number
  penT: number
  cap: number[] // kapital per pension
  payG: number[] // utbetalning per pension, brutto per år
  dep: number // insättning pension per år
  ret: number // avkastning pension per år
  nEmp: number
  nPen: number
  nHSal: number
  nDiv: number
  penGross: number
  penTax: number
  draw: number
  short: number
  exp: number
  net: number
  tax: number
  diff: number
  divHigh: number
  w: number
}

export interface SimResult {
  rows: SimRow[]
  broke: number | null
  cashOut: number | null
}

export const KOMMUNER: Record<string, number> = { Vallentuna: 30.98, Täby: 29.63, Stockholm: 30.55, Norrtälje: 32.83, Danderyd: 30.08, Sollentuna: 31.2 }

export const PENSION_NAMES = ['Inkomstpension', 'Premiepension', 'Tjänstepension', 'Privat pension (IPS)']

export function simulate(A: Scenario, inp: SimInput): SimResult {
  const start = inp.currentAge
  const end = inp.endAge ?? 95
  const life = inp.lifeExpectancy ?? 92
  const thr = inp.stateTaxThreshold ?? 643100
  const iskFree = inp.iskFree ?? 300000
  const iskR = (inp.iskRate ?? 1.065) / 100
  const rA = A.rA / 100
  const rP = A.rP / 100
  const rS = A.rS / 100
  const rH = A.rH / 100
  const aga = A.aga / 100
  const rate = (A.tax + (A.kyrka ? inp.churchFee ?? 1.02 : 0)) / 100
  // Skatt på förvärvsinkomst: schablonmässigt grundavdrag, statlig skatt över skiktgräns.
  const taxE = (G: number, a: number) => {
    const ga = a >= 66 ? 90000 : 40000
    return Math.max(0, G - ga) * rate + Math.max(0, G - thr) * 0.2
  }
  let sp = A.sp
  let isk = A.isk
  let hc = A.hc
  let gbS = 0
  let broke: number | null = null
  let cashOut: number | null = null
  const pc = inp.capital.slice()
  const ann = pc.map(() => 0)
  const rows: SimRow[] = []

  for (let a = start; a <= end; a++) {
    let penG = 0
    let depT = 0
    let retT = 0
    const pj = pc.map(() => 0)
    A.p.forEach((p, j) => {
      const n = p.yrs || Math.max(1, life - p.start)
      const dep = a < A.R ? p.dep * 12 : 0
      let c = pc[j] ?? 0
      let pay = 0
      if (a < p.start) {
        retT += c * rA
        c += c * rA + dep
      } else {
        if (a === p.start || (a === start && a > p.start)) ann[j] = rP ? (c * rP) / (1 - Math.pow(1 + rP, -n)) : c / n
        pay = (p.yrs ? a < p.start + p.yrs : true) ? ann[j] : 0
        retT += c * rP
        c = Math.max(0, c + c * rP + dep - pay)
      }
      depT += dep
      pc[j] = c
      pj[j] = pay
      penG += pay
    })

    hc *= 1 + rH
    if (a === A.saleAge) hc += A.salePrice
    const shares = a < A.saleAge ? A.sh0 + ((A.salePrice - A.sh0) * (a - start)) / Math.max(1, A.saleAge - start) : 0
    let hSal = 0
    let div = 0
    if (a >= A.hFrom && a <= A.hTo) {
      hSal = Math.min(A.hSal * 12, Math.max(0, hc) / (1 + aga))
      hc -= hSal * (1 + aga)
      div = Math.min(A.hDiv, Math.max(0, hc))
      hc -= div
      if (hSal + div < A.hSal * 12 + A.hDiv - 1 && cashOut === null) cashOut = a
    }
    const room = gbS + A.gb
    const divLow = Math.min(div, room)
    const divHigh = div - divLow
    gbS = A.gbSave ? room - divLow : 0
    const earned = penG + hSal + divHigh
    const tE = taxE(earned, a)
    const tD = divLow * 0.2
    const ts = earned ? tE / earned : 0
    const nEmp = a < A.R ? A.netEmp * 12 : 0
    const nPen = penG * (1 - ts)
    const nHSal = hSal * (1 - ts)
    const nDiv = divLow - tD + divHigh * (1 - ts)
    const net = nEmp + nPen + nHSal + nDiv
    const exp = (a < A.R ? A.expW : A.expR) * 12

    sp *= 1 + rS
    isk = isk * (1 + rA) - Math.max(0, isk - iskFree) * iskR
    const diff = net - exp
    let draw = 0
    let short = 0
    if (diff >= 0) isk += diff
    else {
      let need = -diff
      const t1 = Math.min(need, Math.max(0, sp - A.buf))
      sp -= t1
      need -= t1
      const t2 = Math.min(need, Math.max(0, isk))
      isk -= t2
      need -= t2
      const t3 = Math.min(need, Math.max(0, sp))
      sp -= t3
      need -= t3
      draw = -diff - need
      short = need
      if (need > 1 && broke === null) broke = a
    }
    const hold = Math.max(0, hc) + shares
    rows.push({
      a,
      y: inp.birthYear + a,
      liq: sp + isk,
      sp,
      isk,
      hold,
      penA: (pc[0] ?? 0) + (pc[1] ?? 0),
      penT: (pc[2] ?? 0) + (pc[3] ?? 0),
      cap: pc.slice(),
      payG: pj,
      dep: depT,
      ret: retT,
      nEmp,
      nPen,
      nHSal,
      nDiv,
      penGross: penG,
      penTax: penG * ts,
      draw,
      short,
      exp,
      net,
      tax: tE + tD,
      diff,
      divHigh,
      w: sp + isk + hold + pc.reduce((x, y) => x + y, 0)
    })
  }
  return { rows, broke, cashOut }
}

export interface Warning {
  t: string
  b: string
  level: 'warn' | 'neg'
}

/** Varningar när ett val bryter mot uttagsreglerna eller planen inte går ihop. */
export function warnings(A: Scenario, S: SimResult, inp: SimInput, kr: (n: number) => string): Warning[] {
  const W: Warning[] = []
  const ix = (a: number) => Math.min(S.rows.length - 1, Math.max(0, a - inp.currentAge))
  if (S.broke !== null) {
    const r = S.rows[ix(S.broke)]
    W.push({
      t: `Pengarna tar slut vid ${S.broke} år.`,
      b:
        `Sparkonto och ISK är tomma och det saknas ${kr(r.short / 12)} per månad.` +
        (r.hold > 100000 ? ` Bolaget har då ${kr(r.hold)} kvar: förläng uttagen från bolaget efter ${A.hTo} år.` : ' Sänk utgifterna eller jobba längre.'),
      level: 'neg'
    })
  }
  if (S.cashOut !== null)
    W.push({ t: `Bolagets kassa räcker till ${S.cashOut} år.`, b: 'Därefter går det inte att ta ut full lön och utdelning. Kontrollera försäljningsår och pris.', level: 'warn' })
  if (A.hFrom < A.saleAge && A.hc < (A.hSal * 12 * (1 + A.aga / 100) + A.hDiv) * (A.saleAge - A.hFrom))
    W.push({ t: 'Uttag från bolaget börjar före försäljningen.', b: `Fram till ${A.saleAge} år finns bara bolagets nuvarande kassa att ta ut från.`, level: 'warn' })
  const hi = S.rows.find((r) => r.divHigh > 1)
  if (hi) W.push({ t: `Utdelning över gränsbeloppet från ${hi.a} år.`, b: 'Den delen beskattas som lön. Sänk utdelningen eller spara gränsbelopp fler år.', level: 'warn' })
  ;[0, 1].forEach((j) => {
    if (A.p[j] && A.p[j].start < 63)
      W.push({ t: `${PENSION_NAMES[j]} från ${A.p[j].start} år går inte.`, b: `Allmän pension kan tas ut tidigast från 63 år i dag, för dig född ${inp.birthYear} troligen senare.`, level: 'warn' })
  })
  if (A.p[2] && A.p[2].start < 55) W.push({ t: 'Tjänstepension före 55 år går inte.', b: 'ITP och de flesta tjänstepensioner kan tidigast betalas ut från 55 år.', level: 'warn' })
  if (A.p[2] && A.p[2].yrs && A.p[2].yrs < 5) W.push({ t: 'Tjänstepension kräver minst 5 års uttag.', b: '', level: 'warn' })
  if (A.p[3] && A.p[3].start < 55) W.push({ t: 'IPS före 55 år går inte.', b: 'Privat pensionssparande kan tidigast betalas ut från 55 år.', level: 'warn' })
  if (A.p[3] && A.p[3].yrs && A.p[3].yrs < 5) W.push({ t: 'IPS måste betalas ut under minst 5 år.', b: '', level: 'warn' })
  const firstPen = Math.min(...A.p.map((p) => p.start))
  const gap = firstPen - A.R
  if (gap > 0 && A.hFrom > A.R && A.sp + A.isk < A.expR * 12 * gap)
    W.push({ t: `Inkomstglapp mellan ${A.R} och ${firstPen} år.`, b: 'Varken lön, bolag eller pension betalas ut och sparandet täcker inte hela glappet.', level: 'warn' })
  return W
}

export function defaultScenario(name: string, R: number, sale: number, hTo: number, p: PensionPlan[], base: Partial<Scenario> = {}): Scenario {
  return {
    name,
    R,
    netEmp: 62000,
    expW: 38000,
    expR: 34000,
    rA: 3.0,
    rP: 2.0,
    sp: 394117,
    rS: 0.5,
    buf: 100000,
    isk: 684300,
    hc: 310000,
    sh0: 4200000,
    saleAge: sale,
    salePrice: 9000000,
    rH: 2.5,
    hFrom: R,
    hTo,
    hSal: 30000,
    hDiv: 322400,
    gb: 322400,
    gbSave: true,
    aga: 31.42,
    kom: 'Vallentuna',
    tax: 30.98,
    kyrka: false,
    p,
    ...base
  }
}

export function defaultScenarios(): Record<string, Scenario> {
  return {
    a45: defaultScenario('Sluta vid 45', 45, 44, 54, [
      { dep: 4800, start: 65, yrs: 0 },
      { dep: 750, start: 65, yrs: 0 },
      { dep: 5200, start: 55, yrs: 20 },
      { dep: 0, start: 55, yrs: 5 }
    ]),
    a50: defaultScenario('Sluta vid 50', 50, 48, 54, [
      { dep: 4800, start: 65, yrs: 0 },
      { dep: 750, start: 65, yrs: 0 },
      { dep: 5200, start: 55, yrs: 15 },
      { dep: 0, start: 55, yrs: 5 }
    ]),
    a60: defaultScenario('Jobba till 60', 60, 55, 64, [
      { dep: 4800, start: 67, yrs: 0 },
      { dep: 750, start: 67, yrs: 0 },
      { dep: 5200, start: 60, yrs: 20 },
      { dep: 0, start: 60, yrs: 10 }
    ])
  }
}
