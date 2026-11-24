import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Topbar } from '@/components/layout/Topbar'
import { TipBox, axisProps, gridProps } from '@/components/charts/ChartTooltip'
import { CategoryChip } from '@/components/ui/category-chip'
import { Banner, Bar as Meter, Card, CardTitle, EmptyState, Skeleton } from '@/components/ui/primitives'
import { accountBalance, balanceAt, monthFlows, spendByMain } from '@/lib/analytics'
import { needsReview } from '@/lib/categorize'
import { addDays, cap, daysBetween, formatPct, isoDate, monthKey, monthLabel, shiftMonth } from '@/lib/format'
import { useCats, useMoney } from '@/lib/hooks'
import { useData, useStore } from '@/store'

export function Oversikt() {
  const d = useData()
  const period = useStore((s) => s.period)
  const syncing = useStore((s) => s.syncing)
  const { kr, axis, hide } = useMoney()
  const c = useCats()
  const nav = useNavigate()
  const today = isoDate(new Date())
  const isCurrent = period === monthKey(today)

  const m = useMemo(() => {
    const flows = monthFlows(d.transactions, c, period, 12)
    const prev12 = monthFlows(d.transactions, c, shiftMonth(period, -1), 12)
    const cur = flows[flows.length - 1]
    const withData = prev12.filter((f) => f.exp > 0)
    const avg = withData.reduce((s, f) => s + f.exp, 0) / Math.max(1, withData.length)
    const inc12 = flows.reduce((s, f) => s + f.inc, 0)
    const exp12 = flows.reduce((s, f) => s + f.exp, 0)
    const cats = [...spendByMain(d.transactions, c, [period])].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 7)
    const endPrev = addDays(`${period}-01`, -1)
    const total = d.accounts.reduce((s, a) => s + accountBalance(a, d.transactions), 0)
    return { flows, cur, avg, rate: inc12 ? ((inc12 - exp12) / inc12) * 100 : 0, monthRate: cur.inc ? ((cur.inc - cur.exp) / cur.inc) * 100 : null, cats, total, deltaTotal: total - balanceAt(d, endPrev), endPrev }
  }, [d, c, period])

  const queue = d.transactions.filter(needsReview).length
  const soon = d.accounts.filter((a) => a.kind === 'bank' && a.consentUntil && daysBetween(today, a.consentUntil) <= d.settings.consentReminder)
  const recent = useMemo(() => [...d.transactions].filter((t) => monthKey(t.date) <= period).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6), [d.transactions, period])
  const monthName = monthLabel(period, 'name')
  const daysLeft = isCurrent ? daysBetween(today, isoDate(new Date(Number(period.slice(0, 4)), Number(period.slice(5)), 0))) : 0

  if (!d.transactions.length) {
    return (
      <>
        <Topbar title="Översikt" showPeriod />
        <main className="flex flex-1 flex-col gap-4 overflow-auto px-7 pb-7 pt-5">
          {syncing ? (
            <OverviewSkeleton label={syncing} />
          ) : (
            <EmptyState
              icon="overview"
              title="Här visas din ekonomi"
              actions={
                <>
                  <Link className="btn btn-primary h-8" to="/konton?lagg-till=1">
                    Koppla bank
                  </Link>
                  <Link className="btn h-8" to="/import">
                    Importera fil
                  </Link>
                </>
              }
            >
              Koppla din bank för att hämta upp till 24 månaders historik, eller importera en fil från Amex eller internetbanken.
            </EmptyState>
          )}
        </main>
      </>
    )
  }

  return (
    <>
      <Topbar title="Översikt" showPeriod />
      <main className="flex flex-1 flex-col gap-4 overflow-auto px-7 pb-7 pt-5">
        {soon.map((a) => {
          const left = daysBetween(today, a.consentUntil!)
          return left < 0 ? (
            <Banner key={a.id} level="neg" title="Bankkopplingen har gått ut – förnya med BankID." action={<Link className="btn btn-primary" to={`/konton?fornya=${a.id}`}>Förnya med BankID</Link>}>
              {a.name} har inte synkats sedan {a.consentUntil}.
            </Banner>
          ) : (
            <Banner key={a.id} level="warn" title={`Bankkopplingen till ${a.bank} löper ut ${left === 0 ? 'i dag' : `om ${left} ${left === 1 ? 'dag' : 'dagar'}`}`} action={<Link className="btn" to={`/konton?fornya=${a.id}`}>Förnya med BankID</Link>}>
              ({a.consentUntil}). Därefter hämtas inga nya transaktioner från {a.name.replace(a.bank + ' ', '')}.
            </Banner>
          )
        })}

        <div className="grid grid-cols-4 gap-4">
          <Card className="px-[18px] py-4">
            <div className="text-label text-text2">Totalt saldo</div>
            <div className="num mt-1 text-kpi font-semibold tracking-[-.01em]">{kr(m.total)}</div>
            <div className="num mt-0.5 text-label" style={{ color: m.deltaTotal >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              {kr(m.deltaTotal, { sign: true })} mot {Number(m.endPrev.slice(8))} {monthLabel(m.endPrev.slice(0, 7), 'short')}
            </div>
          </Card>
          <Card className="px-[18px] py-4">
            <div className="text-label text-text2">Utgifter i {monthName}</div>
            <div className="num mt-1 text-kpi font-semibold tracking-[-.01em]">{kr(m.cur.exp)}</div>
            <div className="mt-2">
              <Meter pct={(m.cur.exp / Math.max(1, m.avg)) * 100} color={m.cur.exp > m.avg ? 'var(--neg)' : 'var(--accent)'} />
            </div>
            <div className="num mt-1.5 text-label text-text2">
              {Math.round((m.cur.exp / Math.max(1, m.avg)) * 100)} % av snittet {kr(m.avg)}
              {isCurrent && ` · ${daysLeft} dagar kvar`}
            </div>
          </Card>
          <Card className="px-[18px] py-4">
            <div className="text-label text-text2">Sparkvot, 12 månader</div>
            <div className="num mt-1 text-kpi font-semibold tracking-[-.01em]">{formatPct(m.rate)}</div>
            <div className="num mt-0.5 text-label text-text2">
              {cap(monthName)} {isCurrent ? 'hittills' : ''} {m.monthRate === null ? '– ingen inkomst än' : formatPct(m.monthRate)}
            </div>
          </Card>
          <Link to="/granska" className="card block px-[18px] py-4 text-text no-underline hover:border-accent">
            <div className="text-label text-text2">Att granska</div>
            <div className="num mt-1 text-kpi font-semibold">
              {queue} <span className="text-[14px] font-medium text-text2">transaktioner</span>
            </div>
            <div className="mt-0.5 text-label text-accent">{queue ? 'Granska nu →' : 'Allt är granskat'}</div>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2 px-[18px] pb-3 pt-4" aria-label="Kassaflöde 12 månader">
            <CardTitle
              right={
                <div className="flex gap-4 text-label text-text2">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pos" />Inkomster</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-neg opacity-85" />Utgifter</span>
                  <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-text" />Netto</span>
                </div>
              }
            >
              Kassaflöde · 12 månader
            </CardTitle>
            <div className="mt-3.5 h-[220px]">
              <ResponsiveContainer>
                <ComposedChart data={m.flows.map((f) => ({ ...f, label: monthLabel(f.key, 'short') }))} barGap={3} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} onClick={(e) => e?.activeLabel && nav(`/transaktioner?manad=${m.flows[e.activeTooltipIndex ?? 0].key}`)}>
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} width={44} tickFormatter={axis} />
                  <Tooltip
                    cursor={{ fill: 'var(--surface2)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const f = payload[0].payload as (typeof m.flows)[number]
                      return <TipBox title={cap(monthLabel(f.key))} rows={[{ label: 'Inkomster', value: kr(f.inc) }, { label: 'Utgifter', value: kr(-f.exp) }]} foot={{ label: 'Netto', value: kr(f.net, { sign: true }) }} />
                    }}
                  />
                  <Bar dataKey="inc" fill="var(--pos)" radius={[2, 2, 0, 0]} maxBarSize={13} />
                  <Bar dataKey="exp" fill="var(--neg)" fillOpacity={0.85} radius={[2, 2, 0, 0]} maxBarSize={13} />
                  <Line dataKey="net" stroke="var(--text)" strokeWidth={1.6} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="px-[18px] py-4" aria-label="Största kategorier">
            <CardTitle right={<Link to="/analys" className="text-label">Analys</Link>}>Största kategorier</CardTitle>
            <div className="mt-3.5 flex flex-col gap-[11px]">
              {m.cats.length === 0 && <div className="text-text2">Inga utgifter i {monthName}.</div>}
              {m.cats.map(([id, v]) => (
                <Link key={id} to={`/transaktioner?kategori=${id}&manad=${period}`} className="block text-text no-underline">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="h-2 w-2 rounded-sm" style={{ background: c.hex(id) }} />
                    <span className="flex-1">{c.name(id)}</span>
                    <span className="num font-medium">{kr(v)}</span>
                  </div>
                  <div className="mt-[5px]">
                    <Meter pct={(v / m.cats[0][1]) * 100} color={c.hex(id)} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2 overflow-hidden" aria-label="Senaste transaktioner">
            <CardTitle className="px-[18px] pb-2.5 pt-3.5" right={<Link to="/transaktioner" className="text-label">Visa alla</Link>}>
              Senaste transaktioner
            </CardTitle>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th pl-[18px]">Datum</th>
                  <th className="th">Beskrivning</th>
                  <th className="th max-[1320px]:hidden">Konto</th>
                  <th className="th">Kategori</th>
                  <th className="th pr-[18px] text-right">Belopp</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} className="cursor-pointer hover:bg-surface2" onClick={() => nav(`/transaktioner?tx=${t.id}&manad=${monthKey(t.date)}`)}>
                    <td className="td num pl-[18px] text-text2">{t.date}</td>
                    <td className="td max-w-[220px] truncate font-medium">{t.description}</td>
                    <td className="td text-text2 max-[1320px]:hidden">{shortAcct(d.accounts.find((a) => a.id === t.accountId)?.name)}</td>
                    <td className="td"><CategoryChip tx={t} /></td>
                    <td className="td num pr-[18px] text-right font-medium" style={{ color: t.amount > 0 ? 'var(--pos)' : 'var(--text)' }}>
                      {kr(t.amount, { decimals: 2, sign: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Card className="px-[18px] py-4" aria-label="Konton">
            <CardTitle right={<Link to="/konton" className="text-label">Hantera</Link>}>Konton</CardTitle>
            <div className="mt-2 flex flex-col">
              {d.accounts.map((a) => {
                const bal = accountBalance(a, d.transactions)
                const warn = a.consentUntil && daysBetween(today, a.consentUntil) <= d.settings.consentReminder
                return (
                  <div key={a.id} className="flex h-10 items-center gap-2.5 border-b border-line last:border-b-0">
                    <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: a.kind === 'bank' ? (warn ? 'var(--warn)' : 'var(--pos)') : 'var(--text3)' }} />
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate text-[12.5px]">{a.name}{a.kind === 'manual' ? ' · manuellt' : ''}</div>
                      <div className="num text-[11px] text-text3">{acctSub(a, today, hide)}</div>
                    </div>
                    <span className="num text-[12.5px] font-medium" style={{ color: bal < 0 ? 'var(--neg)' : 'var(--text)' }}>{kr(bal)}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </main>
    </>
  )
}

export function shortAcct(name?: string) {
  if (!name) return ''
  if (name.startsWith('American Express')) return 'Amex'
  return name.replace(/^(Handelsbanken|SEB|Ikano)\s+/, '')
}

function acctSub(a: { kind: string; updatedAt: string; consentUntil?: string }, today: string, _hide: boolean) {
  const day = a.updatedAt.slice(0, 10)
  if (a.kind === 'bank') {
    if (a.consentUntil && daysBetween(today, a.consentUntil) <= 14) return `Samtycke t.o.m. ${a.consentUntil}`
    return day === today ? `Synkad ${a.updatedAt.slice(11, 16)}` : `Synkad ${day}`
  }
  if (a.kind === 'card' || a.kind === 'csv') return `Importerad ${day}`
  return `Uppdaterat ${day}`
}

export function OverviewSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label="Laddar översikt" className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card px-[18px] py-4">
            <Skeleton w={90} h={10} />
            <Skeleton w={150} h={22} className="mt-3" />
            <Skeleton w={110} h={10} className="mt-2.5" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="card col-span-2 px-[18px] py-4">
          <Skeleton w={160} h={12} />
          <div className="mt-4 flex h-[190px] items-end gap-3.5">
            {[70, 62, 58, 66, 60, 80, 72, 76, 61, 59, 64, 52].map((h, i) => (
              <div key={i} className="sk flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="card flex flex-col gap-3.5 px-[18px] py-4">
          <Skeleton w={120} h={12} />
          {[70, 55, 62, 48, 58, 40].map((w, i) => (
            <div key={i}>
              <Skeleton w={`${w}%`} h={10} />
              <Skeleton h={4} className="mt-1.5" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-label text-text2">
        <span className="spinner" style={{ width: 12, height: 12 }} />
        {label}
      </div>
    </div>
  )
}
