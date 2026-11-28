import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Topbar } from '@/components/layout/Topbar'
import { TipBox, axisProps, gridProps } from '@/components/charts/ChartTooltip'
import { Dialog } from '@/components/ui/dialog'
import { Card, CardTitle, EmptyState, Button, Field } from '@/components/ui/primitives'
import { toastUndo } from '@/components/ui/toast'
import { accountBalance } from '@/lib/analytics'
import { formatNumber, formatPct, isoDate, parseAmount } from '@/lib/format'
import { useMoney } from '@/lib/hooks'
import type { AppData, PrivateAsset } from '@/lib/types'
import { useData, useStore } from '@/store'
import { pensionBuckets } from '@/lib/pension-map'

export function savingsAccounts(d: AppData) {
  const list = d.accounts.filter((a) => /spar/i.test(a.name))
  return { list, total: list.reduce((s, a) => s + accountBalance(a, d.transactions), 0) }
}

export function latestPension(d: AppData) {
  const snaps = d.snapshots
  const last = snaps[snaps.length - 1]
  const prev = snaps[snaps.length - 2]
  const tot = (s?: (typeof snaps)[number]) => (s ? Object.values(s.values).reduce((a, v) => a + v.value, 0) : 0)
  return { last, prev, total: tot(last), prevTotal: tot(prev), tot }
}

export function PensionOversikt() {
  const d = useData()
  const { kr, axis, hide } = useMoney()
  const [edit, setEdit] = useState<PrivateAsset | null>(null)
  const p = latestPension(d)
  const sav = savingsAccounts(d)

  if (!p.last)
    return (
      <>
        <Topbar title="Pension" />
        <main className="flex flex-1 flex-col gap-4 overflow-auto px-7 pb-7 pt-5">
          <EmptyState icon="pie" title="Inga pensioner hämtade" actions={<Link className="btn btn-primary h-8" to="/pension/hamta">Hämta från minPension</Link>}>
            Hämta allmän pension, tjänstepension och privat sparande från minPension med BankID.
          </EmptyState>
        </main>
      </>
    )

  const delta = p.total - p.prevTotal
  const B = pensionBuckets(d)
  const kinds = [
    { id: 'k0', name: 'Inkomstpension', color: '#2E7D8C', v: B[0] },
    { id: 'k1', name: 'Premiepension', color: '#3E95CF', v: B[1] },
    { id: 'k2', name: 'Tjänstepension', color: '#D9822B', v: B[2] },
    { id: 'k3', name: 'Privat pension', color: '#8A5CC2', v: B[3] }
  ]
  const shown = d.pensions.filter((x) => p.last.values[x.id] || p.prev?.values[x.id])
  const hist = d.snapshots.map((s) => ({ date: s.fetchedAt.slice(0, 10), total: p.tot(s), ...Object.fromEntries(d.pensions.map((x) => [x.id, s.values[x.id]?.value ?? 0])) }))
  const privTotal = sav.total + d.privateAssets.reduce((s, a) => s + a.value, 0)

  return (
    <>
      <Topbar title="Pension" />
      <main className="flex flex-1 flex-col gap-4 overflow-auto px-7 pb-7 pt-5">
        <div className="flex items-end gap-6">
          <div>
            <div className="text-label text-text2">Totalt pensionskapital</div>
            <div className="num text-display font-semibold tracking-[-.01em]">{kr(p.total)}</div>
          </div>
          {p.prev && (
            <div className="pb-[5px]">
              <div className="num text-[14px] font-semibold" style={{ color: delta >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                {kr(delta, { sign: true })} <span className="font-medium">({delta >= 0 ? '+' : ''}{formatPct((delta / p.prevTotal) * 100)})</span>
              </div>
              <div className="num text-label text-text2">sedan förra hämtningen {p.prev.fetchedAt.slice(0, 10)}</div>
            </div>
          )}
          <span className="flex-1" />
          <div className="num pb-1 text-right text-label text-text2">
            Senast hämtat från minPension
            <br />
            {p.last.fetchedAt}
          </div>
          <Link to="/pension/hamta" className="btn btn-primary h-8">
            Hämta från minPension
          </Link>
          <Link to="/pension/planera" className="btn h-8">
            Planera tidig pension
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {kinds.map((k) => (
            <Card key={k.id} className="px-4 py-3.5">
              <div className="flex items-center gap-2 text-label text-text2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: k.color }} />
                {k.name}
              </div>
              <div className="num mt-1 text-[20px] font-semibold">{kr(k.v)}</div>
              <div className="num text-label text-text3">{formatPct((k.v / p.total) * 100)} av totalen</div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2 overflow-hidden" aria-label="Mina pensioner">
            <div className="px-[18px] pb-2 pt-3.5">
              <h2 className="m-0 text-[13px] font-semibold">Mina pensioner</h2>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th pl-[18px]">Pension</th>
                  <th className="th">Bolag</th>
                  <th className="th max-[1500px]:hidden">Typ</th>
                  <th className="th text-right">Värde</th>
                  <th className="th text-right">Värdedatum</th>
                  <th className="th pr-[18px] text-right">Sedan förra</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((x) => {
                  const v = p.last.values[x.id]
                  const pv = p.prev?.values[x.id]
                  const dd = v && pv ? v.value - pv.value : 0
                  return (
                    <tr key={x.id}>
                      <td className="td h-[52px] pl-[18px]">
                        <div className="flex items-center gap-2.5">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: x.color }} />
                          <div>
                            <div className="font-medium">{x.name}</div>
                            <div className="text-small text-text3">{x.sub}</div>
                          </div>
                        </div>
                      </td>
                      <td className="td h-[52px] max-w-[200px] truncate">{x.company}</td>
                      <td className="td h-[52px] text-text2 max-[1500px]:hidden">{x.kind}</td>
                      <td className="td num h-[52px] text-right font-semibold">{kr(v?.value ?? 0)}</td>
                      <td className="td num h-[52px] text-right text-text2">{v?.valueDate}</td>
                      <td className="td num h-[52px] pr-[18px] text-right" style={{ color: dd > 0 ? 'var(--pos)' : dd < 0 ? 'var(--neg)' : 'var(--text3)' }}>
                        {!v ? 'Saknas i senaste' : !pv ? 'Ny' : dd === 0 ? 'Oförändrad' : kr(dd, { sign: true })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-[18px] py-2.5 text-small text-text3">Inkomstpensionens värde uppdateras en gång per år av Pensionsmyndigheten. Värdena är de som minPension visade vid hämtningen.</div>
          </Card>
          <Card className="px-[18px] py-4" aria-label="Utveckling mellan hämtningar">
            <h2 className="m-0 text-[13px] font-semibold">Utveckling mellan hämtningar</h2>
            <div className="mt-3 h-[250px]">
              <ResponsiveContainer>
                <BarChart data={hist} margin={{ top: 18, right: 0, bottom: 0, left: 0 }} barCategoryGap="22%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="date" {...axisProps} tick={{ fontSize: 10.5, fill: 'var(--text3)' }} interval="preserveStartEnd" minTickGap={8} tickFormatter={(v: string) => (hist.length > 4 ? v.slice(2) : v)} />
                  <YAxis {...axisProps} width={50} tickFormatter={axis} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface2)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const r = payload[0].payload as Record<string, number | string>
                      return <TipBox minWidth={210} title={`Hämtat ${r.date}`} rows={d.pensions.filter((x) => Number(r[x.id]) > 0).map((x) => ({ label: x.name, value: kr(Number(r[x.id])), color: x.color }))} foot={{ label: 'Totalt', value: kr(Number(r.total)) }} />
                    }}
                  />
                  {d.pensions.map((x, i) => (
                    <Bar key={x.id} dataKey={x.id} stackId="p" fill={x.color} stroke="var(--surface)" strokeWidth={1} radius={i === d.pensions.length - 1 ? [3, 3, 0, 0] : 0} isAnimationActive={false}>
                      {i === d.pensions.length - 1 && (
                        <LabelList
                          dataKey="total"
                          content={(lp) => {
                            const { x = 0, y = 0, width = 0, value } = lp as { x?: number; y?: number; width?: number; value?: number }
                            return (
                              <text x={Number(x) + Number(width) / 2} y={Number(y) - 6} textAnchor="middle" fontSize={11} fill="var(--text2)" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {hide ? '••••' : `${formatNumber(Number(value) / 1e6, 2)}\u00A0mn`}
                              </text>
                            )
                          }}
                        />
                      )}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <section aria-label="Kapital för tidig pension">
          <CardTitle className="mb-2" right={<><span className="num text-label text-text2">Totalt med pension {kr(p.total + privTotal)}</span><Link to="/pension/planera" className="text-label">Planera tidig pension</Link></>}>
            Kapital före 55 år · privat sparande och holdingbolag
          </CardTitle>
          <div className="grid grid-cols-4 gap-4">
            <Card className="px-4 py-3.5">
              <div className="flex items-center gap-2 text-label text-text2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#3F9B5F' }} />
                Sparkonton
              </div>
              <div className="num mt-1 text-[20px] font-semibold">{kr(sav.total)}</div>
              <div className="truncate text-label text-text3">{[...new Set(sav.list.map((a) => a.bank || a.name))].join(', ').replace(/, ([^,]*)$/, ' och $1') || 'Inga sparkonton'}</div>
            </Card>
            {d.privateAssets.map((a) => (
              <button key={a.id} type="button" onClick={() => setEdit(a)} className="card cursor-pointer px-4 py-3.5 text-left text-text hover:border-accent">
                <div className="flex items-center gap-2 text-label text-text2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                  {a.name}
                </div>
                <div className="num mt-1 text-[20px] font-semibold">{kr(a.value)}</div>
                <div className="num truncate text-label text-text3">{a.sub}</div>
              </button>
            ))}
          </div>
        </section>
      </main>
      {edit && <AssetDialog asset={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function AssetDialog({ asset, onClose }: { asset: PrivateAsset; onClose: () => void }) {
  const update = useStore((s) => s.update)
  const [v, setV] = useState(formatNumber(asset.value))
  const n = parseAmount(v)
  return (
    <Dialog open onClose={onClose} title={`Uppdatera ${asset.name}`} width={380}>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (n === null) return
          update((x) => {
            const a = x.privateAssets.find((y) => y.id === asset.id)!
            a.value = n
            a.sub = a.sub.replace(/\d{4}-\d{2}-\d{2}/, isoDate(new Date()))
          }, 'uppdaterat värde')
          toastUndo(`${asset.name} uppdaterad`)
          onClose()
        }}
      >
        <Field label="Värde i dag">
          <input className="f num h-[30px] text-right" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="primary" type="submit" disabled={n === null}>
            Spara
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
