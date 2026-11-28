import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { Waiting } from '@/components/ui/bankid'
import { Icon } from '@/components/ui/icon'
import { Banner, Button } from '@/components/ui/primitives'
import { toastError, toastOk } from '@/components/ui/toast'
import { minPensionReading } from '@/data/seed'
import { formatNumber, isoDate, isoDateTime, parseAmount } from '@/lib/format'
import { useMoney } from '@/lib/hooks'
import { matchItem, newItem } from '@/lib/pension-map'
import type { PensionItem } from '@/lib/types'
import { useData, useStore } from '@/store'
import type { ReadResult, ScrapedPension } from '../../../shared/minpension'
import { latestPension } from './PensionOversikt'

const STEPS = ['Instruktion', 'Logga in med BankID', 'Läser av', 'Granska och spara']

interface Row {
  key: string
  s: ScrapedPension
  item: PensionItem | null // befintlig pension som raden matchar
}

export function MinPension() {
  const d = useData()
  const update = useStore((s) => s.update)
  const { kr, hide } = useMoney()
  const nav = useNavigate()
  const bridge = window.saldo
  const [step, setStep] = useState(1)
  const [url, setUrl] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [result, setResult] = useState<ReadResult | null>(null)
  const [demo, setDemo] = useState(false)
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [excluded, setExcluded] = useState<Record<string, boolean>>({})
  const [fetchedAt, setFetchedAt] = useState('')
  const [phase, setPhase] = useState(0)
  const saving = useRef(false)
  const p = latestPension(d)

  // Händelser från minPension-fönstret.
  useEffect(() => {
    if (!bridge) return
    return bridge.onMinPension((ev, payload) => {
      if (ev === 'navigated' && payload) setUrl(payload)
      if (ev === 'closed' && !saving.current) {
        setStep((s) => (s === 2 || s === 3 ? 1 : s))
        setProblem((pr) => pr ?? 'minPension-fönstret stängdes. Öppna det igen när du vill läsa av.')
      }
    })
  }, [bridge])

  // Stäng fönstret om användaren lämnar vyn.
  useEffect(() => () => void bridge?.closeMinPension(), [bridge])

  const open = async () => {
    setProblem(null)
    setResult(null)
    setDemo(false)
    if (!bridge) return setStep(2)
    try {
      await bridge.openMinPension()
      setStep(2)
    } catch (e) {
      setProblem(`Kunde inte öppna minPension: ${(e as Error).message}`)
    }
  }

  const read = async () => {
    if (!bridge) return
    setProblem(null)
    setStep(3)
    setPhase(0)
    const t = setInterval(() => setPhase((x) => Math.min(x + 1, 2)), 400)
    const r = await bridge.readMinPension()
    clearInterval(t)
    if ('error' in r) {
      setStep(1)
      return setProblem(r.error)
    }
    if (!r.pensions.length) {
      setStep(2)
      return setProblem(
        r.loggedIn
          ? `Inga pensioner hittades på sidan ”${r.title || r.url}”. Gå till sidan som listar dina pensioner med belopp (översikten eller ”Mina pensioner”) och läs av igen.`
          : 'Det ser inte ut som att du är inloggad än. Logga in med BankID i minPension-fönstret och läs av när dina pensioner visas.'
      )
    }
    setResult(r)
    setEdits({})
    setExcluded({})
    setFetchedAt(isoDateTime(new Date()))
    setStep(4)
  }

  const showDemo = () => {
    const today = isoDate(new Date())
    const reading = minPensionReading(today, p.last?.values)
    const items = d.pensions
    setResult({
      pensions: reading.map((x) => {
        const it = items.find((i) => i.id === x.id)!
        return { name: it?.name ?? x.id, company: it?.company ?? '', value: x.value, valueDate: x.valueDate, kind: it?.kind ?? 'Tjänste', via: 'sida' }
      }),
      total: null,
      url: '',
      title: '',
      loggedIn: true,
      jsonCount: 0
    })
    setDemo(true)
    setFetchedAt(isoDateTime(new Date()))
    setStep(4)
  }

  const rows: Row[] = useMemo(() => {
    if (!result) return []
    const taken = new Set<string>()
    return result.pensions.map((s, i) => {
      const item = matchItem(d.pensions, s, taken)
      if (item) taken.add(item.id)
      return { key: `r${i}`, s, item }
    })
  }, [result, d.pensions])

  let total = 0
  let nInc = 0
  const view = rows.map((r) => {
    const v = edits[r.key] ?? r.s.value
    const inc = !excluded[r.key]
    if (inc) {
      total += v
      nInc++
    }
    const prev = r.item ? p.last?.values[r.item.id]?.value : undefined
    const changed = edits[r.key] != null && edits[r.key] !== r.s.value
    const status = changed ? 'Rättad av dig' : !r.item ? 'Ny pension' : prev == null ? 'Ny' : Math.abs(prev - r.s.value) < 1 ? 'Oförändrad' : 'Uppdaterad'
    return { ...r, v, inc, prev, changed, status }
  })
  const missing = p.last ? d.pensions.filter((it) => p.last!.values[it.id] && !rows.some((r) => r.item?.id === it.id)) : []
  const totalDiff = result?.total != null ? result.total - rows.reduce((s, r) => s + r.s.value, 0) : 0

  const save = async () => {
    saving.current = true
    update((x) => {
      const values: Record<string, { value: number; valueDate: string }> = {}
      view.filter((r) => r.inc).forEach((r) => {
        let id = r.item?.id
        if (!id) {
          const it = newItem(r.s, x.pensions)
          x.pensions.push(it)
          id = it.id
        }
        values[id] = { value: r.v, valueDate: r.s.valueDate ?? isoDate(new Date()) }
      })
      x.snapshots.push({ fetchedAt: fetchedAt || isoDateTime(new Date()), values })
    }, 'pensionshämtning')
    await bridge?.closeMinPension()
    toastOk(`Pensionerna sparades · totalt ${kr(total)}`)
    nav('/pension')
  }

  const discard = async () => {
    await bridge?.closeMinPension()
    setResult(null)
    setStep(1)
  }

  const saveDebug = async () => {
    if (!bridge) return
    try {
      const f = await bridge.saveMinPensionDebug()
      if (f) toastOk(`Sparade ${f}`)
    } catch (e) {
      toastError((e as Error).message)
    }
  }

  return (
    <>
      <Topbar title="Hämta från minPension" />
      <main className="flex-1 overflow-auto px-7 pb-7 pt-5">
        <div className="mx-auto flex max-w-[1060px] flex-col gap-4">
          <ol aria-label="Steg" className="m-0 flex list-none gap-2 p-0">
            {STEPS.map((n, i) => {
              const k = i + 1
              const on = k === step
              const done = k < step
              return (
                <li key={n} aria-current={on ? 'step' : undefined} className="flex flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px]" style={{ background: on ? 'var(--surface)' : 'transparent', fontWeight: on ? 600 : 400, color: on || done ? 'var(--text)' : 'var(--text3)' }}>
                  <span className="num inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: on ? 'var(--accent)' : done ? 'var(--posSoft)' : 'var(--surface2)', color: on ? 'var(--accentText)' : done ? 'var(--pos)' : 'var(--text3)' }}>
                    {done ? '✓' : k}
                  </span>
                  {n}
                </li>
              )
            })}
          </ol>

          {problem && (
            <Banner level="warn" title="Avläsningen gick inte hela vägen." action={bridge && step === 2 ? <Button onClick={saveDebug}>Spara felsökningsfil</Button> : undefined}>
              {problem}
            </Banner>
          )}

          {step === 1 && (
            <div className="card grid grid-cols-2 gap-7 px-7 py-6">
              <div>
                <h2 className="mb-2 mt-0 text-title2 font-semibold">Hämta dina pensioner</h2>
                <p className="mb-3.5 mt-0 text-text2">Saldo öppnar minPension i ett eget fönster. Du loggar in med BankID direkt hos minPension. När dina pensioner visas läser Saldo av sidan och visar vad som hittades innan något sparas.</p>
                <ol className="mb-[18px] mt-0 pl-[18px] leading-[1.8]">
                  <li>Logga in med BankID i fönstret som öppnas.</li>
                  <li>Gå till översikten där dina pensioner och deras värden visas.</li>
                  <li>Klicka på ”Läs av sidan” här i Saldo, granska och spara.</li>
                </ol>
                <Button variant="primary" className="h-[34px]" onClick={open}>
                  Öppna minPension
                </Button>
              </div>
              <div className="rounded-xl bg-surface2 px-[18px] py-4 text-[12.5px] leading-[1.6] text-text2">
                <div className="mb-1.5 font-semibold text-text">Bra att veta</div>
                Ditt BankID och dina inloggningsuppgifter passerar aldrig Saldo. Fönstret använder en tillfällig session som raderas när du stänger det. Saldo läser bara den sida du själv har framme, och sparar ingenting förrän du har granskat värdena. Inkomstpensionens värde uppdateras en gång per år.
                {p.last && (
                  <>
                    {' '}
                    Senaste hämtning: <span className="num">{p.last.fetchedAt.slice(0, 10)}</span>.
                  </>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="card overflow-hidden">
              <div className="flex h-[38px] items-center gap-2.5 border-b border-line bg-surface2 px-3">
                <Icon name="lock" size={11} stroke={2.2} />
                <span className="num flex-1 truncate text-label text-text2">{url ? url.replace(/^https?:\/\//, '') : 'www.minpension.se'}</span>
                <Button className="h-6" onClick={discard}>
                  Avbryt
                </Button>
              </div>
              {bridge ? (
                <div className="flex items-center gap-10 p-8">
                  <div className="flex h-[260px] w-[260px] flex-none flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line p-5 text-center text-text3">
                    <Icon d="M3 4h18v16H3zM3 9h18" size={28} stroke={1.5} />
                    <span className="text-[12.5px]">minPension är öppnat i ett eget fönster. Logga in där.</span>
                  </div>
                  <div className="max-w-[380px]">
                    <div className="text-[15px] font-semibold">Logga in och visa dina pensioner</div>
                    <p className="mb-3.5 mt-1.5 text-[12.5px] text-text2">Välj Mobilt BankID på minPensions sida. När översikten med dina pensioner och belopp syns i fönstret, klicka på knappen nedan.</p>
                    <Waiting>Väntar på att du loggar in…</Waiting>
                    <div className="mt-4 flex gap-2">
                      <Button variant="primary" className="h-8" onClick={read}>
                        Läs av sidan
                      </Button>
                      <Button onClick={() => bridge.openMinPension()}>Visa fönstret</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3 p-8">
                  <div className="text-[15px] font-semibold">Avläsning kräver Mac-appen</div>
                  <p className="m-0 max-w-[560px] text-[12.5px] text-text2">I webbläsarläget kan Saldo inte öppna minPension och läsa sidan. Starta appen med <code>npm run dev</code> för att hämta dina riktiga pensioner. Här kan du se hur granskningen ser ut med exempelvärden.</p>
                  <Button onClick={showDemo}>Visa med exempelvärden</Button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="card mx-auto w-full max-w-[560px] px-7 py-6">
              <h2 className="mb-3.5 mt-0 text-[16px] font-semibold">Läser av minPension</h2>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-live="polite">
                {['Läser sidan som visas', 'Tolkar svar från minPension', 'Matchar mot dina sparade pensioner'].map((n, i) => (
                  <li key={n} className="flex items-center gap-2.5" style={{ color: i <= phase ? 'var(--text)' : 'var(--text3)' }}>
                    {i < phase ? <span className="text-pos">✓</span> : i === phase ? <span className="spinner" /> : <span className="inline-block h-[14px] w-[14px] rounded-full border border-line" />}
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 4 && result && (
            <>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <h2 className="m-0 text-title2 font-semibold">Det här hittade vi</h2>
                  <div className="num text-[12.5px] text-text2">
                    {rows.length} pensioner hos {new Set(rows.map((r) => r.s.company).filter(Boolean)).size} bolag · läst {fetchedAt}
                    {demo ? ' · exempelvärden' : result.jsonCount ? ` · ${result.jsonCount} svar från minPension` : ''} · rätta värden innan du sparar
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-label text-text2">Totalt efter rättning</div>
                  <div className="num text-[20px] font-semibold">{kr(total)}</div>
                </div>
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="th w-[30px] pl-4"><span className="sr-only">Ta med</span></th>
                      <th className="th">Pension</th>
                      <th className="th">Bolag</th>
                      <th className="th">Värdedatum</th>
                      <th className="th text-right">Tidigare</th>
                      <th className="th w-[150px] text-right">Värde</th>
                      <th className="th pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.map((r) => (
                      <tr key={r.key} style={{ background: r.inc ? undefined : 'var(--surface2)' }}>
                        <td className="td h-[52px] pl-4">
                          <input type="checkbox" checked={r.inc} onChange={() => setExcluded({ ...excluded, [r.key]: !excluded[r.key] })} aria-label={`Ta med ${r.s.name}`} />
                        </td>
                        <td className="td h-[52px]">
                          <div className="font-medium">{r.item?.name ?? r.s.name}</div>
                          <div className="max-w-[260px] truncate text-small text-text3">
                            {r.s.kind === 'Allmän' ? 'Allmän pension' : r.s.kind === 'Tjänste' ? 'Tjänstepension' : 'Privat pension'}
                            {r.item && r.item.name !== r.s.name ? ` · ”${r.s.name}” på minPension` : ''}
                          </div>
                        </td>
                        <td className="td h-[52px] max-w-[180px] truncate">{r.s.company || <span className="text-text3">Okänt</span>}</td>
                        <td className="td num h-[52px] text-text2">{r.s.valueDate ?? '–'}</td>
                        <td className="td num h-[52px] text-right text-text2">{r.prev != null ? kr(r.prev) : '–'}</td>
                        <td className="td h-[52px] text-right">
                          <label className="flex items-center justify-end gap-1.5">
                            <span className="sr-only">Värde för {r.s.name}</span>
                            <input
                              key={hide ? 'h' : 'v'}
                              className="f num w-[104px] text-right font-semibold"
                              type="text"
                              inputMode="numeric"
                              defaultValue={hide ? '••••' : formatNumber(r.v)}
                              disabled={hide}
                              onBlur={(e) => {
                                const n = parseAmount(e.target.value)
                                if (n !== null) setEdits({ ...edits, [r.key]: n })
                              }}
                              style={{ borderColor: r.changed ? 'var(--accent)' : !r.s.valueDate || !r.s.company ? 'var(--warn)' : 'var(--line)' }}
                            />
                            <span className="text-text2">kr</span>
                          </label>
                        </td>
                        <td className="td h-[52px] pr-4 text-label" style={{ color: r.changed ? 'var(--accent)' : r.status === 'Ny pension' ? 'var(--pos)' : 'var(--text2)' }}>
                          {r.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.total != null && Math.abs(totalDiff) >= 1 && (
                <Banner level="warn" title="Summan stämmer inte med minPension.">
                  minPension visar totalt {kr(result.total)}, men raderna ovan blir {kr(result.total - totalDiff)}. Det kan saknas en pension, eller så har en rad lästs fel. Kontrollera innan du sparar.
                </Banner>
              )}
              {result.total != null && Math.abs(totalDiff) < 1 && (
                <Banner level="info" title="Summan stämmer.">
                  Raderna blir tillsammans {kr(result.total)}, samma som minPension visar.
                </Banner>
              )}
              {missing.length > 0 && (
                <Banner level="warn" title={`${missing.length === 1 ? 'En pension' : `${missing.length} pensioner`} från förra hämtningen hittades inte:`}>
                  {missing.map((m) => m.name).join(', ')}. De ingår inte i den här hämtningen om du sparar.
                </Banner>
              )}
              {view.some((r) => !r.s.valueDate || !r.s.company) && (
                <div className="text-label text-text3">Gult fält: värdedatum eller bolag kunde inte läsas från sidan. Kontrollera beloppet.</div>
              )}
              <div className="flex items-center justify-end gap-2">
                {bridge && !demo && (
                  <>
                    <Button variant="ghost" onClick={saveDebug}>
                      Spara felsökningsfil
                    </Button>
                    <span className="flex-1" />
                    <Button onClick={() => (setStep(2), bridge.openMinPension())}>Läs av igen</Button>
                  </>
                )}
                <Button onClick={discard}>Kasta</Button>
                <Button variant="primary" className="h-8" disabled={!nInc || demo} title={demo ? 'Exempelvärden sparas inte' : undefined} onClick={save}>
                  Spara {nInc} pensioner
                </Button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  )
}
