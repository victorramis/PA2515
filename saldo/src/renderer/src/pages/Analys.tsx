import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Topbar } from '@/components/layout/Topbar'
import { TipBox, axisProps, gridProps } from '@/components/charts/ChartTooltip'
import { Sankey } from '@/components/charts/Sankey'
import { Treemap } from '@/components/charts/Treemap'
import { Button, Card, CardTitle, EmptyState } from '@/components/ui/primitives'
import { UNCAT, isExpense, isIncome, spendByMain, topMerchants } from '@/lib/analytics'
import { cap, formatNumber, isoDate, monthKey, monthLabel, shiftMonth } from '@/lib/format'
import { useCats, useMoney } from '@/lib/hooks'
import { PALETTE } from '@/lib/palette'
import { useData, useStore } from '@/store'

interface Filt {
  cat: string
  month: string
}

export function Analys() {
  const d = useData()
  const period = useStore((s) => s.period)
  const { kr, axis, hide } = useMoney()
  const c = useCats()
  const [filt, setFilt] = useState<Filt | null>(null)
  const [trendCat, setTrendCat] = useState<string>('mat')
  const today = isoDate(new Date())

  const months6 = useMemo(() => Array.from({ length: 6 }, (_, i) => shiftMonth(period, i - 5)), [period])
  const months12 = useMemo(() => Array.from({ length: 12 }, (_, i) => shiftMonth(period, i - 11)), [period])

  // Huvudkategorier som förekommer, sorterade efter total.
  const mains = useMemo(() => {
    const tot = spendByMain(d.transactions, c, months6)
    return [...tot].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [d.transactions, c, months6])

  const stack = useMemo(
    () =>
      months6.map((m) => {
        const s = spendByMain(d.transactions, c, [m])
        const row: Record<string, number | string> = { key: m, label: monthLabel(m, 'short') }
        let tot = 0
        mains.forEach((id) => {
          const v = Math.max(0, s.get(id) ?? 0)
          row[id] = v
          tot += v
        })
        row.total = tot
        return row
      }),
    [d.transactions, c, months6, mains]
  )

  // Jämförelse med föregående period (till och med samma dag när månaden pågår).
  const cmp = useMemo(() => {
    const cur = period === monthKey(today)
    const day = cur ? Number(today.slice(8)) : 31
    const prevKey = shiftMonth(period, -1)
    const sum = (key: string) => {
      const out = new Map<string, number>()
      d.transactions.forEach((t) => {
        if (monthKey(t.date) !== key || Number(t.date.slice(8)) > day || !isExpense(t, c)) return
        const m = c.main(t.categoryId)?.id ?? UNCAT
        out.set(m, (out.get(m) ?? 0) - t.amount)
      })
      return out
    }
    const a = sum(period)
    const b = sum(prevKey)
    const ids = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => (a.get(y) ?? 0) - (a.get(x) ?? 0))
    const totA = [...a.values()].reduce((s, v) => s + v, 0)
    const totB = [...b.values()].reduce((s, v) => s + v, 0)
    return { cur, day, prevKey, rows: ids.map((id) => ({ id, a: a.get(id) ?? 0, b: b.get(id) ?? 0 })), totA, totB }
  }, [d.transactions, c, period, today])

  const trend = useMemo(() => {
    const vals = months12.map((m) => ({ key: m, label: monthLabel(m, 'short'), v: Math.max(0, spendByMain(d.transactions, c, [m]).get(trendCat) ?? 0) }))
    const avg = vals.reduce((s, x) => s + x.v, 0) / 12
    return { vals, avg }
  }, [d.transactions, c, months12, trendCat])

  const tm = useMemo(() => {
    const s = spendByMain(d.transactions, c, [period])
    return [...s].filter(([, v]) => v > 0).map(([id, v]) => ({ id, name: c.name(id), value: v, color: c.hex(id), label: kr(v) }))
  }, [d.transactions, c, period, kr])

  const merch = useMemo(() => topMerchants(d.transactions, c, months12, 8), [d.transactions, c, months12])

  const sk = useMemo(() => {
    const inc = new Map<string, number>()
    d.transactions.forEach((t) => {
      if (monthKey(t.date) === period && isIncome(t, c)) inc.set(t.categoryId!, (inc.get(t.categoryId!) ?? 0) + t.amount)
    })
    const totInc = [...inc.values()].reduce((s, v) => s + v, 0)
    const all = [...spendByMain(d.transactions, c, [period])].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
    // Små poster slås ihop så att etiketterna inte krockar.
    const big = all.filter(([, v], i) => i < 6 || v >= totInc * 0.04)
    const smalls = all.filter((x) => !big.includes(x))
    const exp: [string, number][] = smalls.length > 1 ? [...big, ['__ovr', smalls.reduce((s, [, v]) => s + v, 0)]] : all
    const totExp = exp.reduce((s, [, v]) => s + v, 0)
    const save = totInc - totExp
    const nodes = [
      ...[...inc].map(([id, v]) => ({ id: `in-${id}`, name: c.name(id), color: 'var(--text2)', label: kr(v) })),
      { id: 'inc', name: 'Inkomster', color: 'var(--text)', label: kr(totInc) },
      ...(save > 0 ? [{ id: 'spar', name: 'Sparande', color: PALETTE[4], label: kr(save) }] : []),
      ...exp.map(([id, v]) => ({ id, name: id === '__ovr' ? `Övriga ${smalls.length} kategorier` : c.name(id), color: id === '__ovr' ? PALETTE[9] : c.hex(id), label: kr(v) }))
    ]
    // Utgifter större än inkomsten: skala ned flödet proportionellt så att Sankey går ihop.
    const k = totInc > 0 ? Math.min(1, totInc / Math.max(1, totExp)) : 0
    const links = totInc > 0 ? [...[...inc].map(([id, v]) => ({ source: `in-${id}`, target: 'inc', value: v })), ...(save > 0 ? [{ source: 'inc', target: 'spar', value: save }] : []), ...exp.map(([id, v]) => ({ source: 'inc', target: id, value: v * k }))] : []
    return { nodes, links, save, totInc }
  }, [d.transactions, c, period, kr])

  const filtRows = useMemo(() => {
    if (!filt) return []
    return d.transactions
      .filter((t) => monthKey(t.date) === filt.month && isExpense(t, c) && (c.main(t.categoryId)?.id ?? UNCAT) === filt.cat)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [filt, d.transactions, c])

  if (!d.transactions.length)
    return (
      <>
        <Topbar title="Analys" showPeriod />
        <main className="p-7">
          <EmptyState icon="chart" title="Inget att analysera än" actions={<Link className="btn btn-primary h-8" to="/import">Importera fil</Link>}>
            När du har transaktioner visas utgifter per kategori, trender, största handlare och flödet från inkomst till utgifter här.
          </EmptyState>
        </main>
      </>
    )

  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : 0)
  const deltaStr = (p: number) => (p > 0 ? '+' : p < 0 ? '−' : '±') + formatNumber(Math.abs(p), 1) + ' %'
  const totP = pct(cmp.totA, cmp.totB)
  const op = (id: string, m?: string) => (filt && (filt.cat !== id || (m && filt.month !== m)) ? 0.35 : 1)

  return (
    <>
      <Topbar title="Analys" showPeriod />
      <main className="flex flex-1 flex-col gap-4 overflow-auto px-6 pb-7 pt-4">
        {filt && (
          <Card className="border-accent px-4 py-3" aria-label="Filtrerade transaktioner">
            <div className="flex items-center gap-2.5">
              <span className="chip border-transparent bg-accent-soft font-semibold text-accent">
                {c.name(filt.cat)} · {monthLabel(filt.month)}
              </span>
              <span className="num flex-1 text-[12.5px] text-text2">
                {filtRows.length} transaktioner · {kr(-filtRows.reduce((s, t) => s - t.amount, 0), { decimals: 2 })}
              </span>
              <Link className="btn" to={`/transaktioner?kategori=${filt.cat}&manad=${filt.month}`}>
                Öppna i Transaktioner
              </Link>
              <Button onClick={() => setFilt(null)}>Rensa filter</Button>
            </div>
            <table className="mt-2 w-full border-collapse">
              <tbody>
                {filtRows.slice(0, 5).map((t) => (
                  <tr key={t.id}>
                    <td className="td num h-[30px] w-[100px] pl-0 text-text2">{t.date}</td>
                    <td className="td h-[30px]">{t.description}</td>
                    <td className="td h-[30px] text-text2">{c.name(t.categoryId)}</td>
                    <td className="td num h-[30px] pr-0 text-right">{kr(t.amount, { decimals: 2 })}</td>
                  </tr>
                ))}
                {filtRows.length > 5 && (
                  <tr>
                    <td colSpan={4} className="td h-[30px] pl-0 text-text3">
                      och {filtRows.length - 5} till
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2 px-[18px] py-4" aria-label="Utgifter per kategori och månad">
            <CardTitle right={<span className="text-label text-text3">Klicka på en del för att se transaktionerna</span>}>Utgifter per kategori och månad</CardTitle>
            <div className="mt-3.5 h-[232px]">
              <ResponsiveContainer>
                <BarChart data={stack} barCategoryGap="22%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} tick={(p) => <MonthTick {...p} totals={stack.map((s) => (hide ? '••••' : `${formatNumber(Number(s.total) / 1000, 1)} tkr`))} />} height={34} interval={0} />
                  <YAxis {...axisProps} width={44} tickFormatter={axis} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface2)' }}
                    shared={false}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const p = payload[0]
                      const row = p.payload as Record<string, number | string>
                      const id = String(p.dataKey)
                      const v = Number(row[id])
                      return <TipBox title={c.name(id)} rows={[{ label: cap(monthLabel(String(row.key))), value: kr(v), color: c.hex(id) }, { label: 'Andel av månaden', value: `${Math.round((v / Number(row.total)) * 100)} %` }]} />
                    }}
                  />
                  {mains.map((id, i) => (
                    <Bar
                      key={id}
                      dataKey={id}
                      stackId="a"
                      fill={c.hex(id)}
                      stroke="var(--surface)"
                      strokeWidth={1}
                      radius={i === mains.length - 1 ? [3, 3, 0, 0] : 0}
                      cursor="pointer"
                      onClick={(e: { payload?: { key: string } }) => e.payload && setFilt({ cat: id, month: e.payload.key })}
                      isAnimationActive={false}
                      shape={(props: unknown) => {
                        const p = props as { x: number; y: number; width: number; height: number; fill: string; payload: { key: string } }
                        return <rect x={p.x} y={p.y} width={p.width} height={Math.max(0, p.height)} fill={p.fill} opacity={op(id, p.payload.key)} stroke="var(--surface)" strokeWidth={1} />
                      }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5">
              {mains.map((id) => (
                <span key={id} className="flex items-center gap-1.5 text-label text-text2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.hex(id) }} />
                  {c.name(id)}
                </span>
              ))}
            </div>
          </Card>
          <Card className="px-[18px] py-4" aria-label="Jämförelse med föregående period">
            <h2 className="m-0 text-[13px] font-semibold">
              {cap(monthLabel(period, 'name'))} mot {monthLabel(cmp.prevKey, 'name')}
            </h2>
            <div className="mt-0.5 text-label text-text3">{cmp.cur ? `Till och med dag ${cmp.day} i båda månaderna` : 'Hela månaderna'}</div>
            <table className="mt-2.5 w-full border-collapse">
              <thead>
                <tr>
                  <th className="th pl-0">Kategori</th>
                  <th className="th text-right">{cap(monthLabel(period, 'short'))}</th>
                  <th className="th pr-0 text-right">Förändring</th>
                </tr>
              </thead>
              <tbody>
                {cmp.rows.slice(0, 8).map((r) => {
                  const p = pct(r.a, r.b)
                  return (
                    <tr key={r.id} className="cursor-pointer hover:bg-surface2" onClick={() => setFilt({ cat: r.id, month: period })}>
                      <td className="td h-8 pl-0">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: c.hex(r.id) }} />
                        {c.name(r.id)}
                      </td>
                      <td className="td num h-8 text-right">{kr(r.a)}</td>
                      <td className="td num h-8 pr-0 text-right font-medium" style={{ color: !r.b ? 'var(--text3)' : p > 3 ? 'var(--neg)' : p < -3 ? 'var(--pos)' : 'var(--text2)' }}>
                        {r.b ? deltaStr(p) : 'ny'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="num mt-2.5 flex justify-between font-semibold">
              <span>Totalt</span>
              <span>
                {kr(cmp.totA)} <span style={{ color: totP > 0 ? 'var(--neg)' : 'var(--pos)' }}>{deltaStr(totP)}</span>
              </span>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="px-[18px] py-4" aria-label="Trend för vald kategori">
            <div className="flex items-center gap-2">
              <h2 className="m-0 flex-1 text-[13px] font-semibold">Trend</h2>
              <label>
                <span className="sr-only">Kategori</span>
                <select className="f" value={trendCat} onChange={(e) => setTrendCat(e.target.value)}>
                  {c.cats.filter((x) => !x.parentId && x.type === 'utgift' && !x.excluded).map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="num mt-2.5 text-[22px] font-semibold">
              {kr(trend.avg)} <span className="text-label font-normal text-text2">snitt per månad</span>
            </div>
            <div className="mt-2.5 h-[140px]">
              <ResponsiveContainer>
                <AreaChart data={trend.vals} margin={{ top: 6, right: 12, bottom: 0, left: 12 }} onClick={(e) => e?.activePayload && setFilt({ cat: trendCat, month: (e.activePayload[0].payload as { key: string }).key })}>
                  <XAxis dataKey="label" {...axisProps} interval={2} />
                  <Tooltip cursor={{ stroke: 'var(--line)' }} content={({ active, payload }) => (active && payload?.length ? <TipBox title={cap(monthLabel((payload[0].payload as { key: string }).key))} rows={[{ label: c.name(trendCat), value: kr(Number(payload[0].value)), color: c.hex(trendCat) }]} /> : null)} />
                  <ReferenceLine y={trend.avg} stroke="var(--text3)" strokeDasharray="4 4" />
                  <Area dataKey="v" stroke={c.hex(trendCat)} strokeWidth={2} fill={c.hex(trendCat)} fillOpacity={0.12} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="px-[18px] py-4" aria-label={`Fördelning ${monthLabel(period, 'name')}`}>
            <h2 className="mb-3 mt-0 text-[13px] font-semibold">Fördelning · {monthLabel(period, 'name')}</h2>
            {tm.length ? <Treemap data={tm} height={200} onPick={(id) => setFilt({ cat: id, month: period })} tip={(t) => `${t.name} ${t.label}`} /> : <div className="text-text2">Inga utgifter.</div>}
          </Card>
          <Card className="px-[18px] py-4" aria-label="Största handlare">
            <h2 className="mb-2.5 mt-0 text-[13px] font-semibold">Största handlare · 12 månader</h2>
            <div className="flex flex-col gap-[7px]">
              {merch.map((m) => (
                <Link key={m.name} to={`/transaktioner?q=${encodeURIComponent(m.name)}`} className="grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 text-[12.5px] text-text no-underline">
                  <span className="truncate">
                    {m.name} <span className="text-small text-text3">· {m.count} köp</span>
                  </span>
                  <span className="num font-medium">{kr(m.amount)}</span>
                  <span aria-hidden="true" className="col-span-2 h-[3px] rounded-sm bg-surface2">
                    <span className="block h-[3px] rounded-sm" style={{ width: `${(m.amount / merch[0].amount) * 100}%`, background: c.hex(m.categoryId) }} />
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <Card className="px-[18px] py-4" aria-label="Från inkomster till kategorier">
          <CardTitle right={<span className="text-label text-text3">Sparande = inkomst minus utgifter</span>}>Från inkomst till kategorier · {monthLabel(period, 'name')}</CardTitle>
          <div className="mt-4">
            <Sankey nodes={sk.nodes} links={sk.links} height={260} onPick={(id) => !id.startsWith('in-') && !['inc', 'spar', '__ovr'].includes(id) && setFilt({ cat: id, month: period })} />
          </div>
        </Card>
      </main>
    </>
  )
}

function MonthTick(p: { x?: number; y?: number; payload?: { value: string; index: number }; totals: string[] }) {
  return (
    <g transform={`translate(${p.x},${p.y})`}>
      <text y={10} textAnchor="middle" fontSize={11} fill="var(--text3)">
        {p.payload?.value}
      </text>
      <text y={24} textAnchor="middle" fontSize={11} fill="var(--text2)" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {p.totals[p.payload?.index ?? 0]}
      </text>
    </g>
  )
}
