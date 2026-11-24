import { useState } from 'react'
import { Logo } from '@/components/layout/Sidebar'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/primitives'
import { formatNumber } from '@/lib/format'
import { KOMMUNER } from '@/lib/pension-sim'
import { isDark, useStore } from '@/store'
import { BANKS } from './Konton'

const STEPS = ['Om dig', 'Bankdata', 'Importera Amex', 'Hämta pension']

export function KomIgang() {
  const finish = useStore((s) => s.finishOnboarding)
  const setTheme = useStore((s) => s.setTheme)
  const dark = useStore(isDark)
  const [step, setStep] = useState(1)
  const [birth, setBirth] = useState(1989)
  const [kom, setKom] = useState('Vallentuna')
  const [church, setChurch] = useState(false)
  const [mode, setMode] = useState<'bank' | 'csv'>('bank')
  const [bank, setBank] = useState<string | null>(null)
  const [csvN, setCsvN] = useState(0)
  const [file, setFile] = useState(false)
  const [example, setExample] = useState(true)

  const done = (to?: string) => {
    finish(example, { birthYear: birth, municipality: kom, taxRate: KOMMUNER[kom] ?? 30.98, church, dataMode: mode })
    if (to) location.hash = to
  }
  const next = () => (step < 4 ? setStep(step + 1) : done())
  const CSV = [
    ['handelsbanken-allkonto.csv', '1 284 rader · 24 månader'],
    ['handelsbanken-sparkonto.csv', '96 rader · 24 månader'],
    ['seb-enkla-sparkontot.csv', '41 rader · 24 månader']
  ]

  return (
    <div className="flex h-full min-w-[1200px] flex-col bg-bg">
      <div className="drag flex h-[52px] flex-none items-center gap-2 px-[18px]">
        <span className="w-[70px]" />
        <span className="flex-1 text-center text-[13px] font-semibold text-text2">Välkommen till Saldo</span>
        <Button onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Byt till ljust läge' : 'Byt till mörkt läge'} className="w-7 justify-center p-0">
          <Icon name={dark ? 'sun' : 'moon'} size={15} />
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center p-5">
        <div className="card flex min-h-[520px] w-[820px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,.08)]">
          <nav aria-label="Steg" className="flex w-[240px] flex-none flex-col border-r border-line bg-surface2 px-[18px] py-6">
            <div className="mb-6 flex items-center gap-2.5">
              <Logo size={28} />
              <strong className="text-[15px]">Saldo</strong>
            </div>
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {STEPS.map((n, i) => {
                const k = i + 1
                const on = k === step
                const ok = k < step
                return (
                  <li key={n} aria-current={on ? 'step' : undefined} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2" style={{ background: on ? 'var(--surface)' : 'transparent', fontWeight: on ? 600 : 400, color: on || ok ? 'var(--text)' : 'var(--text3)' }}>
                    <span className="num inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: on ? 'var(--accent)' : ok ? 'var(--posSoft)' : 'var(--line)', color: on ? 'var(--accentText)' : ok ? 'var(--pos)' : 'var(--text2)' }}>
                      {ok ? '✓' : k}
                    </span>
                    {n}
                  </li>
                )
              })}
            </ol>
            <span className="flex-1" />
            <div className="text-small leading-[1.5] text-text3">All data sparas lokalt på den här datorn, krypterad. Inget konto hos oss behövs.</div>
          </nav>
          <div className="flex flex-1 flex-col px-9 py-8">
            <div className="num text-label text-text3">Steg {step} av 4</div>
            <div className="flex-1">
              {step === 1 && (
                <>
                  <h1 className="mb-1.5 mt-1 text-title1 font-semibold">Om dig</h1>
                  <p className="mb-[22px] mt-0 text-text2">Används för pensionsberäkningar och skatt. Kan ändras senare under Inställningar.</p>
                  <div className="grid max-w-[420px] grid-cols-[140px_1fr] items-center gap-x-4 gap-y-3.5">
                    <label htmlFor="by" className="text-text2">Födelseår</label>
                    <input id="by" className="f num h-8 w-[110px]" type="number" min={1930} max={2010} value={birth} onChange={(e) => setBirth(Number(e.target.value))} />
                    <label htmlFor="kom" className="text-text2">Kommun</label>
                    <select id="kom" className="f h-8" value={kom} onChange={(e) => setKom(e.target.value)}>
                      {Object.keys(KOMMUNER).map((k) => (
                        <option key={k}>{k}</option>
                      ))}
                    </select>
                    <span className="text-text2">Kommunalskatt</span>
                    <span className="num">
                      {formatNumber(KOMMUNER[kom], 2)} % <span className="text-label text-text3">· hämtas för vald kommun</span>
                    </span>
                    <span className="text-text2">Kyrkoavgift</span>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={church} onChange={() => setChurch(!church)} /> Jag är medlem i Svenska kyrkan
                    </label>
                  </div>
                </>
              )}
              {step === 2 && (
                <>
                  <h1 className="mb-1.5 mt-1 text-title1 font-semibold">Hämta dina banktransaktioner</h1>
                  <p className="mb-3.5 mt-0 text-text2">Koppla banken med BankID, eller ladda upp CSV-filer från internetbanken om du inte kan eller vill använda open banking.</p>
                  <div role="radiogroup" aria-label="Sätt att hämta bankdata" className="mb-3.5 grid grid-cols-2 gap-2">
                    {(
                      [
                        ['bank', 'Koppla med BankID', 'Open banking via Enable Banking, synkas automatiskt'],
                        ['csv', 'Ladda upp CSV-filer', 'Utan bankkoppling, du laddar upp nya filer själv']
                      ] as const
                    ).map(([k, n, dsc]) => (
                      <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className="flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3.5 py-3 text-left text-text" style={{ borderColor: mode === k ? 'var(--accent)' : 'var(--line)', background: mode === k ? 'var(--accentSoft)' : 'var(--surface)' }}>
                        <span className="font-semibold">{n}</span>
                        <span className="text-label text-text2">{dsc}</span>
                      </button>
                    ))}
                  </div>
                  {mode === 'bank' ? (
                    <>
                      <div className="flex flex-col gap-2">
                        {BANKS.slice(0, 4).map(([n, ab, bg]) => (
                          <button key={n} type="button" onClick={() => setBank(n)} className="flex cursor-pointer items-center gap-3 rounded-xl border bg-surface px-3.5 py-2 text-left text-text" style={{ borderColor: bank === n ? 'var(--accent)' : 'var(--line)' }}>
                            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: bg }}>
                              {ab}
                            </span>
                            <span className="flex-1 font-medium">{n}</span>
                            <span className="text-label" style={{ color: bank === n ? 'var(--pos)' : 'var(--text3)' }}>
                              {bank === n ? 'Ansluten · 2 konton' : 'Koppla med BankID'}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="mt-2.5 text-label text-text3">Kräver en Enable Banking-nyckel, som du importerar under Inställningar.</div>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => setCsvN(Math.min(3, csvN + 1))} className="flex h-[88px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line bg-surface text-text">
                        <span className="font-semibold">Dra in en eller flera CSV-filer</span>
                        <span className="text-[12.5px] text-text2">en fil per konto · eller klicka för att välja</span>
                      </button>
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        {CSV.slice(0, csvN).map(([n, m]) => (
                          <div key={n} className="flex items-center gap-2.5 rounded-lg border border-line px-3 py-2 text-[12.5px]">
                            <span className="flex-1 font-medium">{n}</span>
                            <span className="num text-text2">{m}</span>
                            <span className="text-pos">Klar att importera</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-label text-text3">Saldo påminner dig en gång i månaden om att ladda upp nya filer. Du kan koppla banken senare.</div>
                    </>
                  )}
                </>
              )}
              {step === 3 && (
                <>
                  <h1 className="mb-1.5 mt-1 text-title1 font-semibold">Importera Amex eller annan fil</h1>
                  <p className="mb-[18px] mt-0 text-text2">American Express går inte att koppla via open banking. Exportera ”Aktivitet” som Excel från amex.se och dra in filen här.</p>
                  <button type="button" onClick={() => setFile(true)} className="flex h-[170px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-surface text-text" style={{ borderColor: file ? 'var(--pos)' : 'var(--line)' }}>
                    <span className="font-semibold">{file ? 'amex-aktivitet.xlsx' : 'Dra in en .xlsx- eller .csv-fil'}</span>
                    <span className="text-[12.5px] text-text2">{file ? 'Profil ”Amex” skapad · köp som plus' : 'eller klicka för att välja fil'}</span>
                  </button>
                </>
              )}
              {step === 4 && (
                <>
                  <h1 className="mb-1.5 mt-1 text-title1 font-semibold">Hämta din pension</h1>
                  <p className="mb-[18px] mt-0 text-text2">Logga in hos minPension med BankID så läser Saldo av dina pensioner. Du granskar värdena innan de sparas.</p>
                  <Button variant="primary" className="h-[34px]" onClick={() => done('#/pension/hamta')}>
                    Hämta från minPension
                  </Button>
                  <div className="mt-7 rounded-xl bg-surface2 px-4 py-3.5">
                    <div className="mb-1.5 font-semibold">Klart att börja</div>
                    <ul className="m-0 pl-[18px] text-[12.5px] leading-[1.7] text-text2">
                      <li>{mode === 'bank' ? (bank ? `${bank} kopplad · 2 konton` : 'Ingen bank kopplad än') : `${csvN} CSV-filer redo`}</li>
                      <li>{file ? 'amex-aktivitet.xlsx · redo att importera' : 'Ingen Amex-fil än'}</li>
                      <li>Pension · ej hämtad än</li>
                    </ul>
                    <label className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12.5px]">
                      <input type="checkbox" checked={example} onChange={() => setExample(!example)} /> Fyll appen med exempeldata (två år, påhittad) så att du kan prova allt direkt
                    </label>
                  </div>
                </>
              )}
            </div>
            <div className="mt-6 flex items-center gap-2">
              {step > 1 && <Button onClick={() => setStep(step - 1)}>Tillbaka</Button>}
              <span className="flex-1" />
              {step < 4 && (
                <Button variant="ghost" onClick={next}>
                  Hoppa över
                </Button>
              )}
              <Button variant="primary" className="h-8" onClick={next}>
                {step < 4 ? 'Fortsätt' : 'Öppna Saldo'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
