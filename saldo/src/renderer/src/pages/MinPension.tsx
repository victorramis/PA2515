import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { Waiting } from '@/components/ui/bankid'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/primitives'
import { toastOk } from '@/components/ui/toast'
import { minPensionReading } from '@/data/seed'
import { formatNumber, isoDate, isoDateTime, parseAmount } from '@/lib/format'
import { useMoney } from '@/lib/hooks'
import { useData, useStore } from '@/store'
import { latestPension } from './PensionOversikt'

const STEPS = ['Instruktion', 'Logga in med BankID', 'Hämtar', 'Granska och spara']

export function MinPension() {
  const d = useData()
  const update = useStore((s) => s.update)
  const { kr, hide } = useMoney()
  const nav = useNavigate()
  const [step, setStep] = useState(1)
  const [prog, setProg] = useState(0)
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [excluded, setExcluded] = useState<Record<string, boolean>>({})
  const [fetchedAt, setFetchedAt] = useState('')
  const p = latestPension(d)
  const today = isoDate(new Date())
  const found = minPensionReading(today, p.last?.values)

  const PROG = [
    'Inloggad hos minPension',
    'Hämtar översikt',
    ...[...new Set(d.pensions.map((x) => `${x.kind === 'Allmän' ? 'Allmän pension' : x.kind === 'Tjänste' ? 'Tjänstepension' : 'Privat pension'} · ${x.company}`))],
    'Loggar ut'
  ]

  // Förlopp: stegar igenom avläsningen och visar resultatet.
  useEffect(() => {
    if (step !== 3) return
    setProg(0)
    const t = setInterval(() => setProg((x) => x + 1), 700)
    return () => clearInterval(t)
  }, [step])
  useEffect(() => {
    if (step === 3 && prog >= PROG.length) {
      setFetchedAt(isoDateTime(new Date()))
      setStep(4)
    }
  }, [prog, step, PROG.length])

  const open = async () => {
    setStep(2)
    if (window.saldo) {
      await window.saldo.openMinPension()
      setStep(3)
    }
  }

  let total = 0
  let nInc = 0
  const rows = d.pensions.map((x) => {
    const f = found.find((y) => y.id === x.id)!
    const prev = p.last?.values[x.id]?.value
    const v = edits[x.id] ?? f.value
    const inc = !excluded[x.id]
    if (inc) {
      total += v
      nInc++
    }
    const changed = edits[x.id] != null && edits[x.id] !== f.value
    return { x, f, prev, v, inc, changed }
  })

  const save = () => {
    update((x) => {
      x.snapshots.push({
        fetchedAt: fetchedAt || isoDateTime(new Date()),
        values: Object.fromEntries(rows.filter((r) => r.inc).map((r) => [r.x.id, { value: r.v, valueDate: r.f.valueDate }]))
      })
    }, 'pensionshämtning')
    toastOk(`Pensionerna sparades · totalt ${kr(total)}`)
    nav('/pension')
  }

  return (
    <>
      <Topbar title="Hämta från minPension" />
      <main className="flex-1 overflow-auto px-7 pb-7 pt-5">
        <div className="mx-auto max-w-[960px]">
          <ol aria-label="Steg" className="m-0 mb-5 flex list-none gap-2 p-0">
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

          {step === 1 && (
            <div className="card grid grid-cols-2 gap-7 px-7 py-6">
              <div>
                <h2 className="mb-2 mt-0 text-title2 font-semibold">Hämta dina pensioner</h2>
                <p className="mb-3.5 mt-0 text-text2">Saldo öppnar minPension i ett eget fönster. Du loggar in med BankID direkt hos minPension. Saldo läser sedan av översikten och visar vad som hittades innan något sparas.</p>
                <ol className="mb-[18px] mt-0 pl-[18px] leading-[1.8]">
                  <li>Logga in med BankID i fönstret som öppnas.</li>
                  <li>Vänta medan Saldo läser dina pensioner, ca 30 sekunder.</li>
                  <li>Granska och rätta värdena. Spara.</li>
                </ol>
                <Button variant="primary" className="h-[34px]" onClick={open}>
                  Öppna minPension
                </Button>
              </div>
              <div className="rounded-xl bg-surface2 px-[18px] py-4 text-[12.5px] leading-[1.6] text-text2">
                <div className="mb-1.5 font-semibold text-text">Bra att veta</div>
                Ditt lösenord eller BankID passerar aldrig Saldo. Fönstret använder en tillfällig session som raderas när hämtningen är klar. Inkomstpensionens värde uppdateras en gång per år.
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
            <div className="card overflow-hidden shadow-palette">
              <div className="flex h-[38px] items-center gap-2.5 border-b border-line bg-surface2 px-3">
                <span aria-hidden="true" className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                </span>
                <span className="flex flex-1 items-center justify-center gap-1.5 text-label text-text2">
                  <Icon name="lock" size={11} stroke={2.2} />
                  www.minpension.se
                </span>
                <Button className="h-6" onClick={() => setStep(1)}>
                  Avbryt
                </Button>
              </div>
              <div className="flex h-[440px] items-center justify-center gap-10 p-6">
                <div className="flex h-[340px] w-[300px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line p-5 text-center text-text3">
                  <Icon d="M3 4h18v16H3zM3 9h18" size={28} stroke={1.5} />
                  <span className="text-[12.5px]">{window.saldo ? 'minPension är öppnat i ett eget fönster. Stäng fönstret när du är inloggad och översikten visas.' : 'minPensions egen inloggningssida visas i ett eget fönster i Mac-appen.'}</span>
                </div>
                <div className="max-w-[300px]">
                  <div className="text-[15px] font-semibold">Logga in med BankID</div>
                  <p className="mb-3.5 mt-1.5 text-[12.5px] text-text2">Välj Mobilt BankID på minPensions sida och skanna QR-koden med BankID-appen.</p>
                  <Waiting>Väntar på inloggning…</Waiting>
                  <Button className="mt-4" onClick={() => setStep(3)}>
                    Simulera inloggad
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="card mx-auto max-w-[560px] px-7 py-6">
              <h2 className="mb-1 mt-0 text-[16px] font-semibold">Läser dina pensioner</h2>
              <div className="mb-3.5 text-[12.5px] text-text2">Låt fönstret vara öppet. Det tar ungefär 30 sekunder.</div>
              <div aria-hidden="true" className="mb-4 h-1.5 rounded-[3px] bg-surface2">
                <div className="h-1.5 rounded-[3px] bg-accent transition-all" style={{ width: `${(prog / PROG.length) * 100}%` }} />
              </div>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-live="polite">
                {PROG.map((n, i) => {
                  const st = i < prog ? 'done' : i === prog ? 'run' : 'wait'
                  return (
                    <li key={n} className="flex items-center gap-2.5" style={{ color: st === 'wait' ? 'var(--text3)' : 'var(--text)' }}>
                      <span aria-hidden="true" className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px]" style={{ background: st === 'done' ? 'var(--posSoft)' : 'transparent', color: st === 'done' ? 'var(--pos)' : 'var(--accent)', border: st === 'done' ? 0 : st === 'run' ? '2px solid var(--accent)' : '1px solid var(--line)' }}>
                        {st === 'done' ? '✓' : ''}
                      </span>
                      <span className="flex-1">{n}</span>
                    </li>
                  )
                })}
              </ul>
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setStep(1)}>Avbryt</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-3.5">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <h2 className="m-0 text-title2 font-semibold">Det här hittade vi</h2>
                  <div className="num text-[12.5px] text-text2">
                    {rows.length} pensioner hos {new Set(d.pensions.map((x) => x.company)).size} bolag · hämtat {fetchedAt} · rätta värden innan du sparar
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-label text-text2">Totalt efter rättning</div>
                  <div className="num text-[20px] font-semibold">{kr(total)}</div>
                </div>
              </div>
              <div className="card overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="th w-[30px] pl-4"><span className="sr-only">Ta med</span></th>
                      <th className="th">Pension</th>
                      <th className="th">Bolag</th>
                      <th className="th">Värdedatum</th>
                      <th className="th text-right">Tidigare</th>
                      <th className="th w-[170px] text-right">Värde</th>
                      <th className="th pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.x.id} style={{ background: r.inc ? undefined : 'var(--surface2)' }}>
                        <td className="td h-[52px] pl-4">
                          <input type="checkbox" checked={r.inc} onChange={() => setExcluded({ ...excluded, [r.x.id]: !excluded[r.x.id] })} aria-label={`Ta med ${r.x.name}`} />
                        </td>
                        <td className="td h-[52px]">
                          <div className="font-medium">{r.x.name}</div>
                          <div className="text-small text-text3">{r.x.sub}</div>
                        </td>
                        <td className="td h-[52px]">{r.x.company}</td>
                        <td className="td num h-[52px] text-text2">{r.f.valueDate}</td>
                        <td className="td num h-[52px] text-right text-text2">{r.prev != null ? kr(r.prev) : '–'}</td>
                        <td className="td h-[52px] text-right">
                          <label className="flex items-center justify-end gap-1.5">
                            <span className="sr-only">Värde för {r.x.name}</span>
                            <input
                              key={hide ? 'h' : 'v'}
                              className="f num w-[120px] text-right font-semibold"
                              type="text"
                              inputMode="numeric"
                              defaultValue={hide ? '••••' : formatNumber(r.v)}
                              disabled={hide}
                              onBlur={(e) => {
                                const n = parseAmount(e.target.value)
                                if (n !== null) setEdits({ ...edits, [r.x.id]: n })
                              }}
                              style={{ borderColor: r.changed ? 'var(--accent)' : r.f.flag ? 'var(--warn)' : 'var(--line)' }}
                            />
                            <span className="text-text2">kr</span>
                          </label>
                        </td>
                        <td className="td h-[52px] pr-4 text-label" style={{ color: r.changed ? 'var(--accent)' : r.f.flag ? 'var(--warn)' : 'var(--text2)' }}>
                          {r.changed ? 'Rättad av dig' : r.f.flag ? 'Kontrollera' : r.prev == null ? 'Ny' : r.f.value === r.prev ? 'Oförändrad' : 'Uppdaterad'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.some((r) => r.f.flag) && (
                <div className="flex items-start gap-2.5 rounded-lg bg-warn-soft px-3 py-2.5 text-[12.5px]">
                  <span className="mt-px text-warn">
                    <Icon name="warn" size={15} stroke={2} />
                  </span>
                  <span>
                    {rows.filter((r) => r.f.flag).map((r) => `${r.x.name} hos ${r.x.company}`).join(', ')} visade ett värde från <span className="num">{rows.find((r) => r.f.flag)!.f.valueDate}</span> men minPension angav ”uppgift saknas” för insättningar. Kontrollera beloppet.
                  </span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button onClick={() => (setStep(1), setEdits({}), setExcluded({}))}>Kasta</Button>
                <Button variant="primary" className="h-8" disabled={!nInc} onClick={save}>
                  Spara {nInc} pensioner
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
