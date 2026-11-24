import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { BankIdQr, Waiting } from '@/components/ui/bankid'
import { Dialog } from '@/components/ui/dialog'
import { Button, Field, SuccessMark } from '@/components/ui/primitives'
import { toastOk, toastUndo } from '@/components/ui/toast'
import { accountBalance } from '@/lib/analytics'
import { addDays, daysBetween, formatNumber, isoDate, parseAmount } from '@/lib/format'
import { useMoney } from '@/lib/hooks'
import type { Account } from '@/lib/types'
import { uid } from '@/lib/utils'
import { useData, useStore } from '@/store'

export const BANKS: [string, string, string][] = [
  ['Handelsbanken', 'HB', '#1F4E8C'],
  ['SEB', 'SEB', '#3E7A3A'],
  ['Swedbank', 'SW', '#C8601D'],
  ['Nordea', 'N', '#1B3F8F'],
  ['Danske Bank', 'DB', '#123A63'],
  ['Länsförsäkringar', 'LF', '#1C5DA8'],
  ['ICA Banken', 'ICA', '#C4151C'],
  ['Skandiabanken', 'SK', '#2F6E6A'],
  ['Sparbanken Roslagen', 'SR', '#C8601D'],
  ['Avanza', 'AV', '#0D6E3F']
]

type Step = 'search' | 'confirm' | 'bankid' | 'done' | 'csv'
type Flow = { mode: 'add' | 'renew' | 'csv'; step: Step; bank?: string; renewId?: string } | null

export function Konton() {
  const d = useData()
  const update = useStore((s) => s.update)
  const sync = useStore((s) => s.sync)
  const syncing = useStore((s) => s.syncing)
  const { kr } = useMoney()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [flow, setFlow] = useState<Flow>(null)
  const [manual, setManual] = useState<Account | 'new' | null>(null)
  const today = isoDate(new Date())

  useEffect(() => {
    if (sp.get('fornya')) {
      const a = d.accounts.find((x) => x.id === sp.get('fornya'))
      if (a) setFlow({ mode: 'renew', step: 'confirm', bank: a.bank, renewId: a.id })
      setSp({}, { replace: true })
    } else if (sp.get('lagg-till')) {
      setFlow({ mode: 'add', step: 'search' })
      setSp({}, { replace: true })
    }
  }, [sp, setSp, d.accounts])

  const total = d.accounts.reduce((s, a) => s + accountBalance(a, d.transactions), 0)
  const groups: { title: string; sub: string; items: Account[] }[] = [
    { title: 'Bankkonton', sub: 'Via Enable Banking', items: d.accounts.filter((a) => a.kind === 'bank') },
    { title: 'Kort', sub: 'CSV- eller Excel-import', items: d.accounts.filter((a) => a.kind === 'card') },
    { title: 'Konton utan bankkoppling', sub: 'CSV-import eller saldo du anger själv', items: d.accounts.filter((a) => a.kind === 'manual' || a.kind === 'csv') }
  ].filter((g) => g.items.length)

  const status = (a: Account): { text: string; color: string; sub: string } => {
    if (a.kind === 'bank') {
      const left = a.consentUntil ? daysBetween(today, a.consentUntil) : 999
      if (left < 0) return { text: 'Kopplingen har gått ut', color: 'var(--neg)', sub: `Samtycke gick ut ${a.consentUntil}` }
      if (left <= d.settings.consentReminder) return { text: `Samtycket löper ut om ${left} ${left === 1 ? 'dag' : 'dagar'}`, color: 'var(--warn)', sub: `Samtycke t.o.m. ${a.consentUntil}` }
      const day = a.updatedAt.slice(0, 10)
      return { text: day === today ? `Synkad i dag ${a.updatedAt.slice(11, 16)}` : `Synkad ${day}`, color: 'var(--pos)', sub: `Samtycke t.o.m. ${a.consentUntil}` }
    }
    if (a.kind === 'card' || a.kind === 'csv') {
      const imp = [...d.imports].reverse().find((i) => i.accountId === a.id)
      const prof = d.profiles.find((p) => p.accountId === a.id)
      return { text: `Importerad ${a.updatedAt.slice(0, 10)}`, color: 'var(--text2)', sub: imp ? `${imp.txIds.length} transaktioner i senaste filen` : prof?.lastRows ? `${prof.lastRows} transaktioner i senaste filen` : '' }
    }
    return { text: `Uppdaterat ${a.updatedAt.slice(0, 10)}`, color: 'var(--text2)', sub: 'Påminnelse varje månad' }
  }

  return (
    <>
      <Topbar title="Konton" />
      <main className="flex-1 overflow-auto px-7 pb-7 pt-5">
        <div className="flex max-w-[1040px] flex-col gap-5">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <div className="text-label text-text2">Nettoförmögenhet i konton</div>
              <div className="num text-[28px] font-semibold">{kr(total, { decimals: 2 })}</div>
            </div>
            <Button onClick={() => setManual('new')}>Lägg till manuellt konto</Button>
            <Button onClick={() => setFlow({ mode: 'csv', step: 'csv' })}>Lägg till konto via CSV</Button>
            <Button variant="primary" onClick={() => setFlow({ mode: 'add', step: 'search' })}>
              + Lägg till bank
            </Button>
          </div>
          {groups.length === 0 && (
            <div className="card px-8 py-12 text-center text-text2">Inga konton än. Koppla en bank med BankID eller lägg till ett konto via CSV.</div>
          )}
          {groups.map((g) => (
            <section key={g.title} aria-label={g.title}>
              <div className="mb-2 flex items-baseline gap-2.5">
                <h2 className="m-0 text-[13px] font-semibold">{g.title}</h2>
                <span className="text-label text-text3">{g.sub}</span>
              </div>
              <div className="card overflow-hidden">
                {g.items.map((a) => {
                  const st = status(a)
                  const bal = accountBalance(a, d.transactions)
                  const renew = a.kind === 'bank' && a.consentUntil && daysBetween(today, a.consentUntil) <= d.settings.consentReminder
                  return (
                    <div key={a.id} className="flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0">
                      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white" style={{ background: a.logoBg }}>
                        {a.logo}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{a.name}</div>
                        <div className="num text-label text-text3">{a.meta}</div>
                      </div>
                      <div className="w-[230px] text-label leading-[1.35]">
                        <div className="flex items-center gap-1.5" style={{ color: st.color }}>
                          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: st.color }} />
                          {st.text}
                        </div>
                        <div className="num text-text3">{st.sub}</div>
                      </div>
                      <div className="num w-[150px] text-right text-[14px] font-semibold" style={{ color: bal < 0 ? 'var(--neg)' : 'var(--text)' }}>
                        {kr(bal, { decimals: 2 })}
                      </div>
                      <div className="w-[130px] text-right">
                        {renew ? (
                          <Button variant="primary" onClick={() => setFlow({ mode: 'renew', step: 'confirm', bank: a.bank, renewId: a.id })}>
                            Förnya
                          </Button>
                        ) : a.kind === 'bank' ? (
                          <Button disabled={!!syncing} onClick={() => sync().then(() => toastOk(`${a.bank} är synkad`))}>
                            {syncing ? 'Synkar…' : 'Synka nu'}
                          </Button>
                        ) : a.kind === 'manual' ? (
                          <Button onClick={() => setManual(a)}>Uppdatera saldo</Button>
                        ) : (
                          <Button onClick={() => nav(`/import?konto=${a.id}`)}>Importera</Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
          <p className="m-0 text-small text-text3">
            Bankdata hämtas via Enable Banking (PSD2) med ditt samtycke, som gäller i högst 180 dagar. Konton utan koppling, som Amex, uppdateras med CSV- eller Excel-filer.{' '}
            {!d.settings.key && (
              <>
                Bankkoppling kräver en Enable Banking-nyckel: <Link to="/installningar">importera nyckel</Link>.
              </>
            )}
          </p>
        </div>
      </main>

      {flow && <BankFlowDialog flow={flow} setFlow={setFlow} onAdd={addBank} onRenew={renewBank} />}
      {manual && <ManualDialog account={manual === 'new' ? null : manual} onClose={() => setManual(null)} />}
    </>
  )

  function addBank(bank: string) {
    const b = BANKS.find((x) => x[0] === bank)!
    update((x) => {
      x.accounts.push({
        id: uid('a'),
        name: `${bank} Privatkonto`,
        bank,
        logo: b[1],
        logoBg: b[2],
        kind: 'bank',
        meta: 'Hämtar historik…',
        openingBalance: 0,
        updatedAt: `${today}T${new Date().toTimeString().slice(0, 5)}`,
        consentUntil: addDays(today, 180)
      })
    }, 'ny bankkoppling')
  }

  function renewBank(id: string) {
    update((x) => {
      const a = x.accounts.find((y) => y.id === id)
      // Samma samtycke gäller alla konton hos banken.
      x.accounts.filter((y) => y.bank === a?.bank && y.kind === 'bank').forEach((y) => {
        y.consentUntil = addDays(today, 180)
        y.updatedAt = `${today}T${new Date().toTimeString().slice(0, 5)}`
      })
    }, 'förnyad bankkoppling')
  }
}

function BankFlowDialog({ flow, setFlow, onAdd, onRenew }: { flow: NonNullable<Flow>; setFlow: (f: Flow) => void; onAdd: (bank: string) => void; onRenew: (id: string) => void }) {
  const d = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [csvName, setCsvName] = useState('Swedbank e-sparkonto')
  const [csvBank, setCsvBank] = useState('Swedbank')
  const today = isoDate(new Date())
  const renew = flow.mode === 'renew'
  const close = () => setFlow(null)
  const connected = new Set(d.accounts.filter((a) => a.kind === 'bank').map((a) => a.bank))
  const title = renew ? 'Förnya bankkoppling' : flow.mode === 'csv' ? 'Lägg till konto via CSV' : 'Lägg till bank'
  return (
    <Dialog open onClose={close} title={<span className="block border-b border-line px-5 py-4">{title}</span>} width={460} padded={false}>
      {flow.step === 'search' && (
        <div className="px-5 pb-5 pt-4">
          <label className="flex">
            <span className="sr-only">Sök bank</span>
            <input className="f h-[34px] w-full text-[14px]" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök bank" />
          </label>
          <div className="mt-2.5 max-h-[300px] overflow-auto">
            {BANKS.filter((b) => b[0].toLowerCase().includes(q.toLowerCase())).map(([n, ab, bg]) => (
              <button key={n} type="button" onClick={() => setFlow({ ...flow, step: 'confirm', bank: n })} className="flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 text-left text-text hover:bg-surface2">
                <span aria-hidden="true" className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: bg }}>
                  {ab}
                </span>
                <span className="flex-1">{n}</span>
                <span className="text-small text-text3">{connected.has(n) ? 'Ansluten' : ''}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3 text-[12.5px]">
            <span className="flex-1 text-text2">Kan eller vill du inte koppla banken?</span>
            <Button onClick={() => setFlow({ mode: 'csv', step: 'csv' })}>Ladda upp CSV i stället</Button>
          </div>
        </div>
      )}
      {flow.step === 'csv' && (
        <div className="flex flex-col gap-3 px-5 pb-5 pt-4">
          <p className="m-0 text-[12.5px] text-text2">Kontot uppdateras när du laddar upp en ny CSV-fil från internetbanken. Ingen bankkoppling eller nyckel behövs.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Bank">
              <select className="f h-[30px]" value={csvBank} onChange={(e) => setCsvBank(e.target.value)}>
                {BANKS.map((b) => (
                  <option key={b[0]}>{b[0]}</option>
                ))}
                <option>Annan bank</option>
              </select>
            </Field>
            <Field label="Typ">
              <select className="f h-[30px]">
                <option>Lönekonto</option>
                <option>Sparkonto</option>
                <option>Kort</option>
                <option>ISK (endast saldo)</option>
              </select>
            </Field>
          </div>
          <Field label="Kontonamn">
            <input className="f h-[30px]" value={csvName} onChange={(e) => setCsvName(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" defaultChecked /> Påminn mig att ladda upp ny fil varje månad
          </label>
          <div className="flex justify-end gap-2">
            <Button onClick={close}>Avbryt</Button>
            <Button
              variant="primary"
              disabled={!csvName.trim()}
              onClick={() => {
                const id = uid('a')
                const b = BANKS.find((x) => x[0] === csvBank)
                useStore.getState().update((x) => {
                  x.accounts.push({ id, name: csvName.trim(), bank: csvBank, logo: b?.[1] ?? csvBank.slice(0, 2).toUpperCase(), logoBg: b?.[2] ?? '#7A8691', kind: 'csv', meta: 'CSV-import', openingBalance: 0, updatedAt: `${today}T00:00` })
                }, 'nytt CSV-konto')
                close()
                nav(`/import?konto=${id}`)
              }}
            >
              Fortsätt till import
            </Button>
          </div>
        </div>
      )}
      {flow.step === 'confirm' && (
        <div className="p-5">
          <p className="mb-3 mt-0">
            Du skickas till <strong>{flow.bank}</strong> för att {renew ? 'förnya samtycket så att' : 'godkänna att'} Saldo får läsa saldo och transaktioner.
          </p>
          <ul className="mb-4 mt-0 pl-[18px] text-[12.5px] leading-[1.7] text-text2">
            <li>Endast läsrätt. Saldo kan inte flytta pengar.</li>
            <li>Samtycket gäller i 180 dagar, sedan förnyar du med BankID.</li>
            {!renew && <li>Upp till 24 månaders historik hämtas första gången.</li>}
          </ul>
          <div className="flex justify-end gap-2">
            <Button onClick={() => (renew ? close() : setFlow({ ...flow, step: 'search' }))}>{renew ? 'Avbryt' : 'Tillbaka'}</Button>
            <Button variant="primary" autoFocus onClick={() => setFlow({ ...flow, step: 'bankid' })}>
              Starta inloggning med BankID
            </Button>
          </div>
        </div>
      )}
      {flow.step === 'bankid' && (
        <div className="flex items-center gap-5 p-5">
          <BankIdQr />
          <div className="flex-1">
            <div className="font-semibold">Öppna BankID-appen och skanna koden</div>
            <p className="mb-3 mt-1.5 text-[12.5px] text-text2">Har du BankID på den här datorn? Öppna BankID-appen där i stället.</p>
            <Waiting>Väntar på BankID…</Waiting>
            <div className="mt-3.5 flex gap-2">
              <Button
                onClick={() => {
                  if (renew && flow.renewId) onRenew(flow.renewId)
                  else if (flow.bank) onAdd(flow.bank)
                  setFlow({ ...flow, step: 'done' })
                }}
              >
                Simulera godkänt
              </Button>
              <Button variant="ghost" onClick={close}>
                Avbryt
              </Button>
            </div>
          </div>
        </div>
      )}
      {flow.step === 'done' && (
        <div className="px-5 py-6 text-center">
          <SuccessMark />
          <div className="mt-2.5 font-semibold">{renew ? `${flow.bank} är förnyad` : `${flow.bank} är ansluten`}</div>
          <p className="num mb-4 mt-1 text-[12.5px] text-text2">{renew ? `Samtycket gäller nu till ${addDays(today, 180)}.` : 'Kontot är tillagt. Historik hämtas i bakgrunden, ca 1 minut.'}</p>
          <Button
            variant="primary"
            autoFocus
            onClick={() => {
              close()
              toastUndo(renew ? `Bankkopplingen till ${flow.bank} är förnyad` : `${flow.bank} är ansluten`)
            }}
          >
            Klar
          </Button>
        </div>
      )}
    </Dialog>
  )
}

function ManualDialog({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const update = useStore((s) => s.update)
  const [name, setName] = useState(account?.name ?? '')
  const [bal, setBal] = useState(account ? formatNumber(account.manualBalance ?? 0, 2) : '')
  const v = parseAmount(bal)
  const today = isoDate(new Date())
  return (
    <Dialog open onClose={onClose} title={account ? `Uppdatera saldo · ${account.name}` : 'Nytt manuellt konto'} width={400}>
      <form
        className="mt-3 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (v === null || !name.trim()) return
          update((x) => {
            if (account) {
              const a = x.accounts.find((y) => y.id === account.id)!
              a.manualBalance = v
              a.updatedAt = `${today}T${new Date().toTimeString().slice(0, 5)}`
            } else {
              x.accounts.push({ id: uid('a'), name: name.trim(), bank: '', logo: name.trim().slice(0, 2).toUpperCase(), logoBg: '#7A8691', kind: 'manual', meta: 'Manuellt konto', openingBalance: 0, manualBalance: v, updatedAt: `${today}T${new Date().toTimeString().slice(0, 5)}` })
            }
          }, account ? 'saldouppdatering' : 'nytt konto')
          toastUndo(account ? 'Saldot är uppdaterat' : `Kontot ”${name.trim()}” är tillagt`)
          onClose()
        }}
      >
        {!account && (
          <Field label="Kontonamn">
            <input className="f h-[30px]" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Ikano Sparkonto" />
          </Field>
        )}
        <Field label="Saldo i dag">
          <input className="f num h-[30px] text-right" autoFocus={!!account} value={bal} onChange={(e) => setBal(e.target.value)} placeholder="0,00" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="primary" type="submit" disabled={v === null || !name.trim()}>
            Spara
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
