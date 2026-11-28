import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Topbar } from '@/components/layout/Topbar'
import { TipBox, axisProps, gridProps } from '@/components/charts/ChartTooltip'
import { Icon } from '@/components/ui/icon'
import { Button, Card, Segmented } from '@/components/ui/primitives'
import { monthFlows } from '@/lib/analytics'
import { formatNumber, isoDate, monthKey, parseAmount, shiftMonth } from '@/lib/format'
import { useCats, useMoney, useWidth } from '@/lib/hooks'
import { KOMMUNER, PENSION_NAMES, simulate, warnings, type Scenario, type SimInput, type SimRow } from '@/lib/pension-sim'
import { useData, useStore } from '@/store'
import { savingsAccounts } from './PensionOversikt'
import { pensionBuckets } from '@/lib/pension-map'

const PC = ['#2E7D8C', '#3E95CF', '#D9822B', '#8A5CC2']
const WEALTH: [keyof SimRow, string, string][] = [
  ['penA', 'Allmän pension', '#2E7D8C'],
  ['penT', 'Tjänste- och privat pension', '#D9822B'],
  ['hold', 'Holdingbolag', '#8A5CC2'],
  ['isk', 'ISK', '#3E95CF'],
  ['sp', 'Sparkonto', '#3F9B5F']
]
const CF: [keyof SimRow, string, string, number][] = [
  ['nEmp', 'Lön, anställning', '#7A8691', 1],
  ['nHSal', 'Lön från bolaget', '#8A5CC2', 1],
  ['nDiv', 'Utdelning', '#B5932A', 1],
  ['nPen', 'Pension', '#2E7D8C', 1],
  ['draw', 'Uttag ur sparande', '#3E95CF', 0.55]
]

export function PensionPlanera() {
  const d = useData()
  const update = useStore((s) => s.update)
  const { kr, hide, axis } = useMoney()
  const [phRef, phW] = useWidth<HTMLDivElement>()
  const c = useCats()
  const keys = Object.keys(d.scenarios)
  const [act, setAct] = useState(keys.includes('a50') ? 'a50' : keys[0])
  const [cmpOn, setCmpOn] = useState(false)
  const [kAge, setKAge] = useState(60)
  const [wView, setWView] = useState<'wealth' | 'pension'>('wealth')
  const [cView, setCView] = useState<'cash' | 'payout'>('cash')
  const [tableOpen, setTableOpen] = useState(false)
  const [tableView, setTableView] = useState<'hushall' | 'pension'>('hushall')
  const A = d.scenarios[act]

  const age = new Date().getFullYear() - d.settings.birthYear
  const inp: SimInput = useMemo(
    () => ({
      birthYear: d.settings.birthYear,
      currentAge: age,
      capital: pensionBuckets(d),
      churchFee: d.settings.churchFee,
      stateTaxThreshold: d.settings.stateTaxThreshold
    }),
    [d, age]
  )
  const S = useMemo(() => simulate(A, inp), [A, inp])
  const rows = S.rows
  const ix = (a: number) => Math.min(rows.length - 1, Math.max(0, a - age))
  const kr0 = (n: number) => kr(n)
  const mn = (n: number) => (hide ? '••••' : `${formatNumber(n / 1e6, 1)} mn`)
  const warns = useMemo(() => warnings(A, S, inp, kr0), [A, S, inp, hide]) // eslint-disable-line react-hooks/exhaustive-deps

  const avg12 = useMemo(() => {
    const cur = monthKey(isoDate(new Date()))
    const f = monthFlows(d.transactions, c, shiftMonth(cur, -1), 12).filter((x) => x.exp > 0)
    return Math.round(f.reduce((s, x) => s + x.exp, 0) / Math.max(1, f.length) / 50) * 50
  }, [d.transactions, c])
  const sav = savingsAccounts(d)

  useEffect(() => {
    if (!d.scenarios[act]) setAct(keys[0])
  }, [act, d.scenarios, keys])

  const set = (fn: (x: Scenario) => void) => update((x) => fn(x.scenarios[act]))

  // KPI
  const rk = rows[ix(kAge)]
  const rR = rows[ix(A.R) - 1] ?? rows[0]
  const after = rows.slice(ix(A.R))
  const minAfter = after.reduce((m, r) => (r.liq < m.liq ? r : m), after[0] ?? rows[0])

  // Livsfaser
  const span = 95 - age
  const P = (a: number) => ((Math.min(95, Math.max(age, a)) - age) / span) * 100
  const firstPen = Math.min(...A.p.map((x) => x.start))
  const bridgeEnd = Math.max(A.R, Math.min(55, firstPen))
  const phases = [{ n: `Arbete · ${age}–${A.R - 1}`, w: P(A.R) - P(age), bg: 'var(--surface2)', fg: 'var(--text)' }]
  if (bridgeEnd > A.R) phases.push({ n: 'Brygga · sparande och bolag', w: P(bridgeEnd) - P(A.R), bg: '#8A5CC2', fg: '#fff' })
  phases.push({ n: `Pension · från ${bridgeEnd}`, w: 100 - P(bridgeEnd), bg: '#2E7D8C', fg: '#fff' })
  // Markörer läggs i rader så att etiketterna inte överlappar.
  const marks = [
    { n: `Försäljning ${A.saleAge} år · ${mn(A.salePrice)}`, x: P(A.saleAge), top: 0, c: '#8A5CC2' },
    { n: `Uttag bolag ${A.hFrom}–${A.hTo}`, x: P(A.hFrom), top: 0, c: '#B5932A' },
    { n: `Tjänste ${A.p[2].start} · Privat ${A.p[3].start}`, x: P(Math.min(A.p[2].start, A.p[3].start)), top: 0, c: '#D9822B' },
    { n: `Allmän pension ${A.p[0].start}`, x: P(A.p[0].start), top: 0, c: '#2E7D8C' }
  ].sort((a, b) => a.x - b.x)
  const rowEnd: number[] = []
  marks.forEach((m) => {
    const wPct = ((m.n.length * 6.4 + 12) / Math.max(400, phW)) * 100
    let r = rowEnd.findIndex((e) => e <= m.x)
    if (r < 0) r = rowEnd.length
    rowEnd[r] = Math.min(m.x, 100 - wPct) + wPct
    m.top = r * 17
  })
  const markRows = Math.max(2, rowEnd.length)

  const compare = useMemo(
    () =>
      keys.map((k) => {
        const Z = d.scenarios[k]
        const T = simulate(Z, inp)
        const rr = T.rows
        const at = (a: number) => rr[Math.min(rr.length - 1, Math.max(0, a - age))]
        const rz = rr[Math.max(0, Z.R - age - 1)] ?? rr[0]
        return { k, name: Z.name, R: `${Z.R} år`, sale: `${Z.saleAge} år · ${mn(Z.salePrice)}`, last: T.broke === null ? 'Till 95 år' : `Slut vid ${T.broke}`, wR: kr(rz.w), l55: kr(at(55).liq), i60: kr(at(60).net / 12), p67: kr(at(67).penGross / 12), w80: kr(at(80).w) }
      }),
    [keys, d.scenarios, inp, hide] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const chartRows = rows.map((r) => ({ ...r, cap0: r.cap[0], cap1: r.cap[1], cap2: r.cap[2], cap3: r.cap[3], pay0: r.payG[0] / 12, pay1: r.payG[1] / 12, pay2: r.payG[2] / 12, pay3: r.payG[3] / 12, penNet: r.nPen / 12, expM: r.exp / 12, ...Object.fromEntries(CF.map(([k]) => [`m_${k}`, Math.max(0, Number(r[k])) / 12])) }))

  return (
    <>
      <Topbar title="Planera pension och tidig pension" />
      <div className="flex min-h-0 flex-1">
        <aside aria-label="Antaganden" className="w-[340px] flex-none overflow-auto border-r border-line bg-surface px-[18px] pb-6 pt-2">
          <div className="pb-0.5 pt-1.5 text-small text-text3">
            Född {d.settings.birthYear} · {age} år · scenario ”{A.name}” · belopp i dagens penningvärde
          </div>
          <Section title="Arbete och utgifter" color="#7A8691" sum={`slutar ${A.R} år`}>
            <RangeField label="Ålder när jag slutar jobba" v={A.R} min={age + 1} max={70} step={1} unit="år" onChange={(v) => set((x) => ((x.R = v), x.hFrom === A.R && (x.hFrom = v)))} />
            <RangeField label="Nettolön per månad, anställning" v={A.netEmp} min={0} max={150000} step={500} unit="kr" w={84} onChange={(v) => set((x) => void (x.netEmp = v))} />
            <RangeField label="Utgifter per månad medan jag jobbar" v={A.expW} min={5000} max={120000} step={500} unit="kr" w={84} onChange={(v) => set((x) => void (x.expW = v))} />
            {avg12 > 0 && (
              <Button className="h-6 self-start text-label" onClick={() => set((x) => void (x.expW = avg12))}>
                Använd snitt senaste 12 mån: {kr(avg12)}
              </Button>
            )}
            <RangeField label="Utgifter per månad efter att jag slutat" v={A.expR} min={5000} max={120000} step={500} unit="kr" w={84} onChange={(v) => set((x) => void (x.expR = v))} />
            <RangeField label="Real avkastning, sparfas (ISK, pension)" v={A.rA} min={0} max={7} step={0.1} unit="%" onChange={(v) => set((x) => void (x.rA = v))} />
            <RangeField label="Real avkastning, uttagsfas (pension)" v={A.rP} min={0} max={5} step={0.1} unit="%" onChange={(v) => set((x) => void (x.rP = v))} />
          </Section>
          <Section title="Privat sparande" color="#3E95CF" sum={kr(A.sp + A.isk)}>
            <RangeField label="Sparkonton i dag" v={A.sp} min={0} max={3000000} step={1000} unit="kr" w={96} hint={sav.total ? <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-small text-accent" onClick={() => set((x) => void (x.sp = Math.round(sav.total)))}>från Konton</button> : undefined} onChange={(v) => set((x) => void (x.sp = v))} />
            <RangeField label="Ränta sparkonto, real" v={A.rS} min={-2} max={4} step={0.1} unit="%" onChange={(v) => set((x) => void (x.rS = v))} />
            <RangeField label="Buffert som alltid ligger kvar" v={A.buf} min={0} max={500000} step={10000} unit="kr" w={96} onChange={(v) => set((x) => void (x.buf = v))} />
            <RangeField label="ISK i dag" v={A.isk} min={0} max={10000000} step={1000} unit="kr" w={96} onChange={(v) => set((x) => void (x.isk = v))} />
            <Head label="Överskott sparas på ISK" hint="skatt 1,065 % över 300 000 kr" />
          </Section>
          <Section title="Holdingbolag" color="#8A5CC2" sum={kr(A.hc + A.sh0)}>
            <RangeField label="Likvida medel i bolaget" v={A.hc} min={0} max={5000000} step={10000} unit="kr" w={96} onChange={(v) => set((x) => void (x.hc = v))} />
            <RangeField label="Onoterade aktier, värde i dag" v={A.sh0} min={0} max={50000000} step={100000} unit="kr" w={96} hint="uppskattat" onChange={(v) => set((x) => void (x.sh0 = v))} />
            <RangeField label="Försäljning vid ålder" v={A.saleAge} min={age + 1} max={70} step={1} unit="år" onChange={(v) => set((x) => void (x.saleAge = v))} />
            <RangeField label="Förväntat pris till bolaget" v={A.salePrice} min={0} max={50000000} step={100000} unit="kr" w={96} hint="skattefritt" onChange={(v) => set((x) => void (x.salePrice = v))} />
            <RangeField label="Real avkastning i bolaget" v={A.rH} min={0} max={6} step={0.1} unit="%" onChange={(v) => set((x) => void (x.rH = v))} />
            <Head label="Uttag till mig" hint="lön och utdelning" />
            <RangeField label="Uttag från ålder" v={A.hFrom} min={age + 1} max={80} step={1} unit="år" onChange={(v) => set((x) => void (x.hFrom = v))} />
            <RangeField label="Uttag till och med ålder" v={A.hTo} min={age + 1} max={90} step={1} unit="år" onChange={(v) => set((x) => void (x.hTo = v))} />
            <RangeField label="Lön per månad, brutto" v={A.hSal} min={0} max={100000} step={1000} unit="kr" w={84} onChange={(v) => set((x) => void (x.hSal = v))} />
            <RangeField label="Utdelning per år" v={A.hDiv} min={0} max={3000000} step={10000} unit="kr" w={96} onChange={(v) => set((x) => void (x.hDiv = v))} />
            <RangeField label="Gränsbelopp per år (grundbelopp)" v={A.gb} min={0} max={1000000} step={1000} unit="kr" w={96} hint="4 IBB 2026" onChange={(v) => set((x) => void (x.gb = v))} />
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={A.gbSave} onChange={() => set((x) => void (x.gbSave = !x.gbSave))} /> Spara outnyttjat gränsbelopp till senare år
            </label>
            <RangeField label="Arbetsgivaravgift" v={A.aga} min={0} max={40} step={0.01} unit="%" onChange={(v) => set((x) => void (x.aga = v))} />
          </Section>
          <Section title="Pensioner" color="#2E7D8C" sum={kr(inp.capital.reduce((a, b) => a + b, 0))}>
            {A.p.map((pp, j) => (
              <div key={j} className="flex flex-col gap-[9px]">
                <Head label={PENSION_NAMES[j]} hint={kr(inp.capital[j])} color={PC[j]} />
                <RangeField label="Insättning per månad (upphör när du slutar)" v={pp.dep} min={0} max={15000} step={100} unit="kr" w={72} onChange={(v) => set((x) => void (x.p[j].dep = v))} />
                <RangeField label="Startålder för uttag" v={pp.start} min={55} max={75} step={1} unit="år" hint={j < 2 ? 'tidigast 63' : 'tidigast 55'} onChange={(v) => set((x) => void (x.p[j].start = v))} />
                <label className="flex items-center justify-between gap-2 text-small text-text2">
                  Uttagstid
                  <select className="f h-[26px] w-[146px]" value={String(pp.yrs)} onChange={(e) => set((x) => void (x.p[j].yrs = Number(e.target.value)))}>
                    <option value="0">Livsvarigt</option>
                    {[5, 10, 15, 20, 25].map((y) => (
                      <option key={y} value={y}>{y} år</option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </Section>
          <details className="pb-3" open>
            <summary>
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-text3" />
              <span className="flex-1">Skatt</span>
              <span className="num text-label font-normal text-text3">{formatNumber(A.tax + (A.kyrka ? d.settings.churchFee : 0), 2)} %</span>
            </summary>
            <div className="grid grid-cols-[1fr_84px] items-end gap-2">
              <label className="flex flex-col gap-1 text-small text-text2">
                Kommun
                <select className="f" value={A.kom} onChange={(e) => set((x) => ((x.kom = e.target.value), (x.tax = KOMMUNER[e.target.value] ?? x.tax)))}>
                  {Object.keys(KOMMUNER).map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-small text-text2">
                Skattesats
                <NumInput v={A.tax} min={20} max={40} step={0.01} onCommit={(v) => set((x) => void (x.tax = v))} />
              </label>
            </div>
            <label className="mt-2 flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" checked={A.kyrka} onChange={() => set((x) => void (x.kyrka = !x.kyrka))} /> Kyrkoavgift ({formatNumber(d.settings.churchFee, 2)} %)
            </label>
          </details>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-3.5 overflow-auto px-6 pb-7 pt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented label="Scenario" value={act} onChange={setAct} options={keys.map((k) => ({ value: k, label: d.scenarios[k].name }))} />
            <Button aria-pressed={cmpOn} onClick={() => setCmpOn(!cmpOn)}>
              {cmpOn ? 'Dölj jämförelse' : 'Jämför scenarier'}
            </Button>
            <span className="flex-1" />
            <label className="flex items-center gap-1.5 text-label text-text2">
              Visa år vid
              <select className="f" value={kAge} onChange={(e) => setKAge(Number(e.target.value))}>
                {[45, 50, 55, 60, 63, 65, 67, 70, 75].filter((a) => a > age).map((a) => (
                  <option key={a} value={a}>{a} år</option>
                ))}
              </select>
            </label>
          </div>

          <Card className="px-4 pb-2.5 pt-3" aria-label="Livsfaser">
            <div className="relative flex h-[26px] overflow-hidden rounded-md">
              {phases.map((ph) => (
                <div key={ph.n} className="flex items-center overflow-hidden whitespace-nowrap px-2 text-small font-semibold" style={{ width: `${ph.w}%`, background: ph.bg, color: ph.fg }}>
                  {ph.n}
                </div>
              ))}
            </div>
            <div ref={phRef} className="relative mt-1" style={{ height: markRows * 17 }}>
              {marks.map((m) => (
                <div key={m.n} className="num absolute whitespace-nowrap pl-1 text-[11px] leading-[14px] text-text2" style={{ left: `${Math.min(m.x, 100 - ((m.n.length * 6.4 + 12) / Math.max(400, phW)) * 100)}%`, top: m.top, borderLeft: `1.5px solid ${m.c}` }}>
                  {m.n}
                </div>
              ))}
            </div>
          </Card>

          {warns.map((w) => (
            <div key={w.t} role="alert" className="flex items-start gap-2.5 rounded-lg px-3 py-[9px] text-[12.5px]" style={{ background: w.level === 'neg' ? 'var(--negSoft)' : 'var(--warnSoft)' }}>
              <span className="mt-px" style={{ color: w.level === 'neg' ? 'var(--neg)' : 'var(--warn)' }}>
                <Icon name="warn" size={15} stroke={2} />
              </span>
              <span>
                <strong className="font-semibold">{w.t}</strong> {w.b}
              </span>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3 min-[1360px]:grid-cols-4">
            <Card className="px-3.5 py-3" style={{ borderColor: S.broke === null ? 'var(--pos)' : 'var(--neg)' }}>
              <div className="text-label text-text2">Pengarna räcker</div>
              <div className="num mt-0.5 text-[21px] font-semibold" style={{ color: S.broke === null ? 'var(--pos)' : 'var(--neg)' }}>
                {S.broke === null ? 'Hela vägen till 95 år' : `Tar slut vid ${S.broke} år`}
              </div>
              <div className="num text-small text-text3">
                Lägsta likvida sparande {kr(minAfter.liq)} vid {minAfter.a} år
              </div>
            </Card>
            <Card className="px-3.5 py-3">
              <div className="text-label text-text2">Förmögenhet när du slutar ({A.R} år)</div>
              <div className="num mt-0.5 text-[21px] font-semibold">{kr(rR.w)}</div>
              <div className="num text-small text-text3">
                varav likvidt {kr(rR.liq)}, bolaget {kr(rR.hold)}
              </div>
            </Card>
            <Card className="px-3.5 py-3">
              <div className="text-label text-text2">Pension per månad vid {kAge} år</div>
              <div className="num mt-0.5 text-[21px] font-semibold">
                {kr(rk.nPen / 12)} <span className="text-label font-normal text-text2">efter skatt</span>
              </div>
              <div className="num text-small text-text3">{kr(rk.penGross / 12)} före skatt</div>
            </Card>
            <Card className="border-accent px-3.5 py-3">
              <div className="text-label text-text2">Inkomst efter skatt vid {kAge} år</div>
              <div className="num mt-0.5 text-[21px] font-semibold text-accent">
                {kr(rk.net / 12)} <span className="text-label font-normal text-text2">/mån</span>
              </div>
              <div className="num text-small text-text3">
                Utgifter {kr(rk.exp / 12)} · {rk.exp ? Math.round((rk.net / rk.exp) * 100) : 0} % täckt utan uttag
              </div>
            </Card>
          </div>

          {cmpOn && (
            <Card className="overflow-hidden" aria-label="Jämför scenarier">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="th pl-4">Jämför</th>
                    {compare.map((x) => (
                      <th key={x.k} className="th text-right" style={{ color: x.k === act ? 'var(--accent)' : 'var(--text2)' }}>
                        {x.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ['Slutar jobba', 'R'],
                      ['Försäljning av aktierna', 'sale'],
                      ['Pengarna räcker', 'last'],
                      ['Förmögenhet när du slutar', 'wR'],
                      ['Likvidt sparande vid 55 år', 'l55'],
                      ['Inkomst efter skatt vid 60 år, per månad', 'i60'],
                      ['Pension före skatt vid 67 år, per månad', 'p67'],
                      ['Förmögenhet vid 80 år', 'w80']
                    ] as const
                  ).map(([l, k]) => (
                    <tr key={k}>
                      <td className="td h-[30px] pl-4 text-text2">{l}</td>
                      {compare.map((x) => (
                        <td key={x.k} className="td num h-[30px] text-right font-medium">
                          {x[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <Card className="px-4 py-3.5" aria-label="Förmögenhet över tid">
            <div className="flex items-center gap-3">
              <h2 className="m-0 flex-1 text-[13px] font-semibold">{wView === 'wealth' ? 'Förmögenhet över tid' : 'Kapital per pension över ålder'}</h2>
              <Segmented label="Visa" value={wView} onChange={setWView} options={[{ value: 'wealth', label: 'Allt' }, { value: 'pension', label: 'Pensioner' }]} />
            </div>
            <div className="mt-3 h-[200px]">
              <ResponsiveContainer>
                <AreaChart data={chartRows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="a" {...axisProps} ticks={[age, 45, 55, 65, 75, 85, 95].filter((x) => x >= age)} tickFormatter={(a) => (a === age || a === 95 ? `${a} år` : String(a))} />
                  <YAxis {...axisProps} width={52} tickFormatter={axis} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const r = payload[0].payload as SimRow & Record<string, number>
                      const lines = wView === 'wealth' ? WEALTH.map(([k, n, col]) => ({ label: n, value: kr(Number(r[k])), color: col })) : PENSION_NAMES.map((n, j) => ({ label: n, value: kr(r[`cap${j}`]), color: PC[j] }))
                      return <TipBox minWidth={230} title={`${r.a} år (${r.y})`} rows={lines.reverse()} foot={{ label: 'Totalt', value: kr(wView === 'wealth' ? r.w : r.cap.reduce((a, b) => a + b, 0)) }} />
                    }}
                  />
                  {wView === 'wealth'
                    ? WEALTH.map(([k, , col]) => <Area key={k} dataKey={k} stackId="w" stroke="none" fill={col} fillOpacity={0.88} isAnimationActive={false} />)
                    : PC.map((col, j) => <Area key={j} dataKey={`cap${j}`} stackId="p" stroke="none" fill={col} fillOpacity={0.88} isAnimationActive={false} />)}
                  <ReferenceLine x={A.R} stroke="var(--text)" strokeDasharray="3 3" />
                  <ReferenceLine x={55} stroke="var(--text3)" strokeDasharray="2 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <Legend items={wView === 'wealth' ? WEALTH.map(([, n, col]) => ({ n, col })) : PENSION_NAMES.map((n, j) => ({ n, col: PC[j] }))} extra={<span className="text-text3">Streckat: slutar jobba ({A.R} år) och 55 år</span>} />
          </Card>

          <Card className="px-4 py-3.5" aria-label="Kassaflöde per år">
            <div className="flex items-center gap-3">
              <h2 className="m-0 flex-1 text-[13px] font-semibold">{cView === 'cash' ? 'Kassaflöde · per månad, snitt per år' : 'Pension per månad och källa'}</h2>
              <Segmented label="Visa" value={cView} onChange={setCView} options={[{ value: 'cash', label: 'Kassaflöde' }, { value: 'payout', label: 'Pension' }]} />
            </div>
            <div className="mt-3 h-[190px]">
              <ResponsiveContainer>
                <ComposedChart data={chartRows} barCategoryGap={1} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="a" {...axisProps} ticks={[age, 45, 55, 65, 75, 85, 95].filter((x) => x >= age)} tickFormatter={(a) => (a === age || a === 95 ? `${a} år` : String(a))} />
                  <YAxis {...axisProps} width={52} tickFormatter={axis} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface2)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const r = payload[0].payload as SimRow & Record<string, number>
                      if (cView === 'payout')
                        return <TipBox minWidth={240} title={`${r.a} år (${r.y}) · per månad`} rows={[...PENSION_NAMES.map((n, j) => ({ label: n, value: kr(r[`pay${j}`]), color: PC[j] })), { label: 'Skatt', value: kr(-r.penTax / 12) }]} foot={{ label: 'Netto efter skatt', value: kr(r.penNet) }} />
                      const b = r.net - r.exp
                      return (
                        <TipBox
                          minWidth={240}
                          title={`${r.a} år (${r.y}) · per månad`}
                          rows={[...CF.filter(([k]) => Number(r[k]) > 0.5).map(([k, n, col]) => ({ label: n, value: kr(Number(r[k]) / 12), color: col })), { label: 'Utgifter', value: kr(-r.exp / 12) }, { label: 'Skatt totalt', value: kr(r.tax / 12) }]}
                          foot={{ label: b >= 0 ? 'Sparas på ISK' : r.short > 1 ? 'Saknas' : 'Tas ur sparande', value: kr(Math.abs(b >= 0 ? b : r.short > 1 ? r.short : b) / 12), color: b >= 0 ? 'var(--pos)' : r.short > 1 ? 'var(--neg)' : undefined }}
                        />
                      )
                    }}
                  />
                  {cView === 'cash'
                    ? CF.map(([k, , col, o]) => <Bar key={k} dataKey={`m_${k}`} stackId="c" fill={col} fillOpacity={o} isAnimationActive={false} />)
                    : PC.map((col, j) => <Bar key={j} dataKey={`pay${j}`} stackId="c" fill={col} isAnimationActive={false} />)}
                  <Line dataKey={cView === 'cash' ? 'expM' : 'penNet'} stroke={cView === 'cash' ? 'var(--neg)' : 'var(--text)'} strokeWidth={1.8} dot={false} isAnimationActive={false} type="stepAfter" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <Legend
              items={cView === 'cash' ? CF.map(([, n, col, o]) => ({ n, col, o })) : PENSION_NAMES.map((n, j) => ({ n, col: PC[j] }))}
              extra={
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3.5" style={{ background: cView === 'cash' ? 'var(--neg)' : 'var(--text)' }} />
                  {cView === 'cash' ? 'Utgifter' : 'Netto efter skatt'}
                </span>
              }
            />
          </Card>

          <Card className="overflow-hidden" aria-label="Årstabell">
            <div className="flex items-center gap-2 px-4 py-3">
              <button type="button" onClick={() => setTableOpen(!tableOpen)} aria-expanded={tableOpen} className="flex flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left font-semibold text-text">
                <span aria-hidden="true" className="text-[10px] text-text3">{tableOpen ? '▾' : '▸'}</span>
                Årstabell
                <span className="text-label font-normal text-text3">· {age}–95 år, belopp per år</span>
              </button>
              {tableOpen && <Segmented label="Tabell" value={tableView} onChange={setTableView} options={[{ value: 'hushall', label: 'Hushåll' }, { value: 'pension', label: 'Pension' }]} />}
            </div>
            {tableOpen && (
              <div className="sticky-head max-h-[320px] overflow-auto border-t border-line">
                <table className="w-full border-collapse text-label">
                  <thead>
                    {tableView === 'hushall' ? (
                      <tr>
                        <th className="th pl-4">Ålder</th>
                        <th className="th">År</th>
                        <th className="th text-right">Inkomst netto</th>
                        <th className="th text-right">Utgifter</th>
                        <th className="th text-right">Sparat / uttaget</th>
                        <th className="th text-right">Sparkonto + ISK</th>
                        <th className="th text-right">Bolaget</th>
                        <th className="th text-right">Pensionskapital</th>
                        <th className="th pr-4 text-right">Förmögenhet</th>
                      </tr>
                    ) : (
                      <tr>
                        <th className="th pl-4">Ålder</th>
                        <th className="th">År</th>
                        <th className="th text-right">Insättning</th>
                        <th className="th text-right">Avkastning</th>
                        <th className="th text-right">Kapital</th>
                        <th className="th text-right">Uttag</th>
                        <th className="th text-right">Skatt</th>
                        <th className="th pr-4 text-right">Netto</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const hl = r.a === A.R || r.a === A.saleAge || r.a === 55 ? 'var(--accentSoft)' : undefined
                      const cell = 'td num h-7 text-right'
                      return tableView === 'hushall' ? (
                        <tr key={r.a} style={{ background: hl }}>
                          <td className="td num h-7 pl-4">{r.a}</td>
                          <td className="td num h-7 text-text2">{r.y}</td>
                          <td className={cell}>{kr(r.net)}</td>
                          <td className={cell}>{kr(-r.exp)}</td>
                          <td className={cell} style={{ color: r.short > 1 ? 'var(--neg)' : r.diff >= 0 ? 'var(--pos)' : 'var(--text)' }}>
                            {r.diff >= 0 ? kr(r.diff, { sign: true }) : kr(-r.draw, { sign: true })}
                          </td>
                          <td className={cell}>{kr(r.liq)}</td>
                          <td className={cell}>{kr(r.hold)}</td>
                          <td className={cell}>{kr(r.penA + r.penT)}</td>
                          <td className={`${cell} pr-4 font-semibold`}>{kr(r.w)}</td>
                        </tr>
                      ) : (
                        <tr key={r.a} style={{ background: hl }}>
                          <td className="td num h-7 pl-4">{r.a}</td>
                          <td className="td num h-7 text-text2">{r.y}</td>
                          <td className={cell}>{kr(r.dep)}</td>
                          <td className={cell}>{kr(r.ret)}</td>
                          <td className={cell}>{kr(r.cap.reduce((a, b) => a + b, 0))}</td>
                          <td className={cell}>{kr(r.penGross)}</td>
                          <td className={cell}>{kr(-r.penTax)}</td>
                          <td className={`${cell} pr-4 font-semibold`}>{kr(r.nPen)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <p className="m-0 text-small leading-[1.5] text-text3">
            Förenklad modell i dagens penningvärde, inte rådgivning. Överskott sparas på ISK; underskott tas från sparkonto ovanför bufferten, sedan ISK. ISK: schablonskatt 1,065 % på kapital över 300 000 kr (2026). Bolaget: försäljning av näringsbetingade andelar antas skattefri; lön kostar lön plus arbetsgivaravgift; utdelning inom gränsbelopp 20 %, över gränsbelopp som lön. Skatt på lön och pension efter schablonmässigt grundavdrag, utan jobbskatteavdrag. Livsvarigt uttag räknas med förväntad livslängd 92 år.
          </p>
        </main>
      </div>
    </>
  )
}

function Legend({ items, extra }: { items: { n: string; col: string; o?: number }[]; extra?: React.ReactNode }) {
  return (
    <div className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1.5 text-label text-text2">
      {items.map((l) => (
        <span key={l.n} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.col, opacity: l.o ?? 1 }} />
          {l.n}
        </span>
      ))}
      {extra}
    </div>
  )
}

function Section({ title, color, sum, children }: { title: string; color: string; sum: string; children: React.ReactNode }) {
  return (
    <details open className="border-b border-line pb-3">
      <summary>
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
        <span className="flex-1">{title}</span>
        <span className="num text-label font-normal text-text3">{sum}</span>
      </summary>
      <div className="flex flex-col gap-[9px]">{children}</div>
    </details>
  )
}

function Head({ label, hint, color }: { label: string; hint: string; color?: string }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 border-t border-dashed border-line pt-2 text-[12.5px] font-semibold">
      {color && <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: color }} />}
      <span className="flex-1">{label}</span>
      <span className="num text-label font-normal text-text3">{hint}</span>
    </div>
  )
}

let fieldId = 0

/** Reglage och sifferfält bundna till samma värde. Sifferfältet valideras på blur. */
function RangeField({ label, v, min, max, step, unit, w = 64, hint, onChange }: { label: string; v: number; min: number; max: number; step: number; unit: string; w?: number; hint?: React.ReactNode; onChange: (v: number) => void }) {
  const [id] = useState(() => `rf-${++fieldId}`)
  return (
    <div>
      <label htmlFor={id} className="mb-0.5 flex justify-between text-small text-text2">
        <span>{label}</span>
        <span className="text-text3">{hint}</span>
      </label>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, v))} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="flex-1" />
        <NumInput id={id} v={v} min={min} max={max} step={step} w={w} onCommit={onChange} />
        <span className="w-[22px] text-small text-text2">{unit}</span>
      </div>
    </div>
  )
}

function NumInput({ id, v, min, max, step, w, onCommit }: { id?: string; v: number; min: number; max: number; step: number; w?: number; onCommit: (v: number) => void }) {
  const dec = step < 1 ? (step < 0.1 ? 2 : 1) : 0
  const fmt = (n: number) => formatNumber(n, dec)
  const [text, setText] = useState(fmt(v))
  const [focus, setFocus] = useState(false)
  useEffect(() => {
    if (!focus) setText(fmt(v))
  }, [v, focus]) // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    const n = parseAmount(text)
    if (n === null) return setText(fmt(v))
    const c = Math.min(max, Math.max(min, Math.round(n / step) * step))
    const r = Number(c.toFixed(dec))
    setText(fmt(r))
    if (r !== v) onCommit(r)
  }
  return (
    <input
      id={id}
      className="f num h-[26px] text-right"
      style={{ width: w ?? '100%' }}
      inputMode="decimal"
      value={text}
      onFocus={() => setFocus(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => (setFocus(false), commit())}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
    />
  )
}
