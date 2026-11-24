import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Topbar } from '@/components/layout/Topbar'
import { Dialog } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Button, Segmented, Switch } from '@/components/ui/primitives'
import { toastError, toastOk } from '@/components/ui/toast'
import { saveText, toCsv } from '@/lib/actions'
import { formatNumber, isoDate, parseAmount } from '@/lib/format'
import { useCats } from '@/lib/hooks'
import { KOMMUNER } from '@/lib/pension-sim'
import type { AppData, Settings } from '@/lib/types'
import { DEFAULT_SETTINGS } from '@/data/seed'
import { useData, useStore, type Theme } from '@/store'

function Row({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">{children}</div>
}
function Label({ title, sub, id }: { title: ReactNode; sub?: ReactNode; id?: string }) {
  return (
    <div className="flex-1">
      <div id={id}>{title}</div>
      {sub && <div className="num text-label text-text3">{sub}</div>}
    </div>
  )
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 mt-0 text-[13px] font-semibold">{title}</h2>
      <div className="card">{children}</div>
    </section>
  )
}

export function Installningar() {
  const d = useData()
  const update = useStore((s) => s.update)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const resetData = useStore((s) => s.resetData)
  const c = useCats()
  const s = d.settings
  const [confirm, setConfirm] = useState<null | 'empty' | 'example'>(null)
  const keyInput = useRef<HTMLInputElement>(null)
  const restoreInput = useRef<HTMLInputElement>(null)
  const set = (p: Partial<Settings>) => update((x) => void Object.assign(x.settings, p))

  const importKey = async () => {
    try {
      if (window.saldo) {
        const k = await window.saldo.importKeyFile()
        if (k) {
          set({ key: { ...k, appId: s.key?.appId ?? 'a3f1c0e2-••••-••••-••••-7b42' } })
          toastOk('Nyckeln är importerad och lagrad i nyckelringen')
        }
      } else keyInput.current?.click()
    } catch (e) {
      toastError((e as Error).message)
    }
  }

  const exportData = async (fmt: 'csv' | 'json') => {
    if (fmt === 'json') {
      const f = await saveText(`saldo-export-${isoDate(new Date())}.json`, JSON.stringify(d, null, 2))
      if (f) toastOk('All data exporterad som JSON')
    } else {
      const rows = [['Datum', 'Beskrivning', 'Banktext', 'Konto', 'Kategori', 'Huvudkategori', 'Belopp', 'Anteckning']]
      d.transactions.forEach((t) => rows.push([t.date, t.description, t.raw, d.accounts.find((a) => a.id === t.accountId)?.name ?? '', c.name(t.categoryId), t.categoryId ? c.main(t.categoryId)?.name ?? '' : '', formatNumber(t.amount, 2), t.note ?? '']))
      const f = await saveText(`saldo-transaktioner-${isoDate(new Date())}.csv`, toCsv(rows))
      if (f) toastOk(`${d.transactions.length} transaktioner exporterade som CSV`)
    }
  }

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppData
      if (data.version !== 1 || !Array.isArray(data.transactions)) throw new Error('Filen är ingen säkerhetskopia från Saldo.')
      update((x) => void Object.assign(x, data), 'återställning')
      toastOk(`Återställt från ${file.name}`)
    } catch (e) {
      toastError((e as Error).message)
    }
  }

  return (
    <>
      <Topbar title="Inställningar" />
      <main className="flex-1 overflow-auto px-7 pb-7 pt-5">
        <input ref={keyInput} type="file" accept=".pem,.key" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0]
          if (!f) return
          if (!(await f.text()).includes('PRIVATE KEY')) toastError('Filen innehåller ingen privat nyckel.')
          else {
            set({ key: { fileName: f.name, importedAt: isoDate(new Date()), appId: s.key?.appId ?? 'a3f1c0e2-••••-••••-••••-7b42' } })
            toastOk('Nyckeln är importerad')
          }
          e.target.value = ''
        }} />
        <input ref={restoreInput} type="file" accept=".json" className="hidden" onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) restore(f)
          e.target.value = ''
        }} />
        <div className="mx-auto flex max-w-[720px] flex-col gap-[22px]">
          <Section title="Utseende">
            <Row>
              <Label title="Tema" sub="Följer macOS som standard" />
              <Segmented<Theme> label="Tema" value={theme} onChange={setTheme} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Ljust' }, { value: 'dark', label: 'Mörkt' }]} />
            </Row>
          </Section>

          <Section title="Bankdata">
            <Row>
              <Label title="Hämta transaktioner via" sub="Gäller alla bankkonton. Kort som Amex importeras alltid från fil." />
              <Segmented label="Hämta transaktioner via" value={s.dataMode} onChange={(v) => set({ dataMode: v })} options={[{ value: 'bank', label: 'Open banking' }, { value: 'csv', label: 'Endast CSV-import' }]} />
            </Row>
            {s.dataMode === 'bank' ? (
              <>
                <Row>
                  <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon name="key" size={16} stroke={1.8} />
                  </span>
                  <Label title={<span className="font-medium">Enable Banking-nyckel</span>} sub={s.key ? `${s.key.fileName} · importerad ${s.key.importedAt} · lagrad i nyckelringen` : 'Ingen nyckel importerad. Bankkoppling kräver en nyckelfil (.pem) från Enable Banking.'} />
                  <Button variant={s.key ? 'default' : 'primary'} onClick={importKey}>
                    {s.key ? 'Importera ny fil…' : 'Importera nyckel…'}
                  </Button>
                </Row>
                {s.key && (
                  <Row>
                    <Label title="Applikations-id" />
                    <code className="num text-label text-text2">{s.key.appId}</code>
                  </Row>
                )}
                <Row>
                  <Label title="Synka automatiskt" />
                  <select className="f" value={s.syncEvery} onChange={(e) => set({ syncEvery: e.target.value })}>
                    {['Var 6:e timme', 'Varje timme', 'Endast manuellt'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Row>
                <Row>
                  <Label title="Påminn innan samtycke går ut" sub="Visas på Översikt och som notis" />
                  <select className="f" value={s.consentReminder} onChange={(e) => set({ consentReminder: Number(e.target.value) })}>
                    {[14, 7, 3].map((o) => (
                      <option key={o} value={o}>{o} dagar före</option>
                    ))}
                  </select>
                </Row>
              </>
            ) : (
              <>
                <Row>
                  <Label title="Påminn mig att ladda upp nya filer" sub="Visas på Översikt med en knapp till Import" />
                  <select className="f" value={s.csvReminder} onChange={(e) => set({ csvReminder: e.target.value })}>
                    {['Varje månad, den 1:a', 'Varannan vecka', 'Aldrig'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Row>
                <Row>
                  <Label title="Bevaka mapp" sub="Nya CSV-filer i mappen förhandsgranskas automatiskt" />
                  <code className="text-label text-text2">{s.watchFolder}</code>
                </Row>
                <Row>
                  <div className="flex-1 text-label text-text3">Ingen nyckel eller bankkoppling används. Befintliga kopplingar pausas och kan slås på igen.</div>
                </Row>
              </>
            )}
          </Section>

          <Section title="Kategorisering">
            {(
              [
                ['ai', 'AI-hjälp', 'Föreslår kategori när regler och inlärning inte räcker. Skickar bara beskrivning och belopp, aldrig kontonummer.'],
                ['learn', 'Lär av mina val', 'Samma handlare får samma kategori nästa gång'],
                ['rules', 'Använd regler på nya transaktioner', 'Regler körs vid synk och import']
              ] as const
            ).map(([k, t, sub]) => (
              <Row key={k}>
                <Label id={`sw-${k}`} title={t} sub={sub} />
                <Switch checked={s[k]} onChange={(v) => set({ [k]: v })} labelledBy={`sw-${k}`} />
              </Row>
            ))}
          </Section>

          <Section title="Säkerhet">
            <Row>
              <Label id="sw-touch" title="Lås med Touch ID" sub="Krävs när appen öppnas och efter inaktivitet" />
              <Switch checked={s.touchId} onChange={(v) => set({ touchId: v })} labelledBy="sw-touch" />
            </Row>
            <Row>
              <Label id="sw-hide" title="Dölj belopp vid start" sub="Bra när du delar skärmen" />
              <Switch checked={s.hideOnStart} onChange={(v) => set({ hideOnStart: v })} labelledBy="sw-hide" />
            </Row>
            <Row>
              <Label title="Lås efter inaktivitet" />
              <select className="f" value={s.lockAfter} onChange={(e) => set({ lockAfter: e.target.value })}>
                {['5 minuter', '15 minuter', '1 timme'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Row>
          </Section>

          <Section title="Säkerhetskopior och export">
            <Row>
              <Label title="Automatisk säkerhetskopia" sub="Krypterad, till ~/Library/Mobile Documents/Saldo" />
              <select className="f" value={s.backup} onChange={(e) => set({ backup: e.target.value })}>
                {['Varje natt', 'Varje vecka', 'Av'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Row>
            <Row>
              <Label title="Behåll" />
              <select className="f" value={s.keepBackups} onChange={(e) => set({ keepBackups: e.target.value })}>
                {['30 senaste', '90 senaste'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Row>
            <Row>
              <Label title="Exportera all data" sub="Transaktioner, kategorier, regler och pensioner" />
              <Button onClick={() => exportData('csv')}>CSV</Button>
              <Button onClick={() => exportData('json')}>JSON</Button>
            </Row>
            <Row>
              <Label title="Återställ från säkerhetskopia" sub="En JSON-export från Saldo" />
              <Button onClick={() => restoreInput.current?.click()}>Välj kopia…</Button>
            </Row>
          </Section>

          <Section title="Skattesatser">
            <Row>
              <label htmlFor="tk" className="flex-1">Kommun</label>
              <select id="tk" className="f" value={s.municipality} onChange={(e) => set({ municipality: e.target.value, taxRate: KOMMUNER[e.target.value] ?? s.taxRate })}>
                {Object.keys(KOMMUNER).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Row>
            <PctRow id="tr" label="Kommunal- och regionskatt" v={s.taxRate} onCommit={(v) => set({ taxRate: v })} unit="%" />
            <PctRow id="kyr" label="Kyrkoavgift" v={s.churchFee} onCommit={(v) => set({ churchFee: v })} unit="%" />
            <PctRow id="sg" label="Skiktgräns statlig skatt (per år)" v={s.stateTaxThreshold} onCommit={(v) => set({ stateTaxThreshold: v })} unit="kr" decimals={0} w={100} />
            <Row>
              <div className="flex-1 text-label text-text3">Värdena används i pensionsplaneringen. Kontrollera dem mot Skatteverket varje år.</div>
              <Button onClick={() => set({ municipality: DEFAULT_SETTINGS.municipality, taxRate: DEFAULT_SETTINGS.taxRate, churchFee: DEFAULT_SETTINGS.churchFee, stateTaxThreshold: DEFAULT_SETTINGS.stateTaxThreshold })}>Återställ standard</Button>
            </Row>
          </Section>

          <Section title="Data">
            <Row>
              <Label title="Exempeldata" sub="Påhittad svensk privatekonomi för två år, Vallentuna" />
              <Button onClick={() => setConfirm('example')}>Återställ exempeldata</Button>
            </Row>
            <Row>
              <Label title="Rensa all data" sub="Tar bort konton, transaktioner, regler och pensioner från den här datorn" />
              <Button className="text-neg" onClick={() => setConfirm('empty')}>
                Rensa…
              </Button>
            </Row>
          </Section>
        </div>
      </main>
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'empty' ? 'Rensa all data?' : 'Återställ exempeldata?'}>
        <p className="mb-[18px] mt-2 text-text2">
          {confirm === 'empty' ? `${formatNumber(d.transactions.length)} transaktioner, ${d.accounts.length} konton och ${d.rules.length} regler tas bort. Inställningarna finns kvar.` : `Nuvarande ${formatNumber(d.transactions.length)} transaktioner ersätts med exempeldata.`}
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirm(null)}>Avbryt</Button>
          <Button
            variant={confirm === 'empty' ? 'danger' : 'primary'}
            onClick={() => {
              resetData(confirm === 'empty' ? 'empty' : 'example')
              toastOk(confirm === 'empty' ? 'All data är rensad' : 'Exempeldata är återställd')
              setConfirm(null)
            }}
          >
            {confirm === 'empty' ? `Ta bort ${formatNumber(d.transactions.length)} transaktioner` : 'Återställ'}
          </Button>
        </div>
      </Dialog>
    </>
  )
}

function PctRow({ id, label, v, onCommit, unit, decimals = 2, w = 80 }: { id: string; label: string; v: number; onCommit: (v: number) => void; unit: string; decimals?: number; w?: number }) {
  const [text, setText] = useState(formatNumber(v, decimals))
  useEffect(() => setText(formatNumber(v, decimals)), [v, decimals])
  return (
    <Row>
      <label htmlFor={id} className="flex-1">
        {label}
      </label>
      <input
        id={id}
        className="f num text-right"
        style={{ width: w }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseAmount(text)
          if (n === null || n < 0) return setText(formatNumber(v, decimals))
          setText(formatNumber(n, decimals))
          if (n !== v) onCommit(n)
        }}
      />
      <span className="text-text2">{unit}</span>
    </Row>
  )
}
