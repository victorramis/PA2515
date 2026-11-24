import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { Dialog } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Button, Segmented, SuccessMark } from '@/components/ui/primitives'
import { toastOk } from '@/components/ui/toast'
import { exampleAmexFile } from '@/data/example-files'
import { autoCategorize, needsReview } from '@/lib/categorize'
import { formatNumber, isoDate, isoDateTime } from '@/lib/format'
import { useMoney } from '@/lib/hooks'
import { buildPreview, detect, mappingFromColumns, matchProfile, parseFile, ROLES, type ColumnGuess, type ColumnRole, type ParsedFile } from '@/lib/importer'
import type { ImportProfile, Transaction } from '@/lib/types'
import { uid } from '@/lib/utils'
import { useData, useStore } from '@/store'

type Stage = { s: 'drop' } | { s: 'error'; name: string; msg: string } | { s: 'preview' } | { s: 'done'; importId: string }

export function Import() {
  const d = useData()
  const update = useStore((s) => s.update)
  const { kr } = useMoney()
  const [sp, setSp] = useSearchParams()
  const [stage, setStage] = useState<Stage>({ s: 'drop' })
  const [file, setFile] = useState<ParsedFile | null>(null)
  const [cols, setCols] = useState<ColumnGuess[]>([])
  const [signPlus, setSignPlus] = useState(false)
  const [signReason, setSignReason] = useState('')
  const [accountId, setAccountId] = useState('')
  const [profile, setProfile] = useState<ImportProfile | null>(null)
  const [saveProfile, setSaveProfile] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [confirmUndo, setConfirmUndo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const presetAccount = useRef<string | null>(null)

  useEffect(() => {
    if (sp.get('konto')) {
      presetAccount.current = sp.get('konto')
      setSp({}, { replace: true })
    }
  }, [sp, setSp])

  const load = (name: string, data: ArrayBuffer) => {
    try {
      const p = parseFile(name, data)
      if (!p.rows.length) throw new Error(`”${name}” innehåller inga transaktionsrader.`)
      const det = detect(p)
      const prof = matchProfile(p, d.profiles)
      let c = det.columns
      if (prof) {
        // Sparad profil vinner över gissningen.
        const m = prof.mapping
        c = c.map((x) => ({ ...x, role: (x.index === m.date ? 'Datum' : x.index === m.description ? 'Beskrivning' : x.index === m.amount ? 'Belopp' : x.index === m.balance ? 'Saldo' : 'Ignorera') as ColumnRole }))
      }
      setFile(p)
      setCols(c)
      setProfile(prof)
      setSignPlus(prof ? prof.signPlus : det.signPlus)
      setSignReason(prof ? `Profilen ”${prof.name}” säger att köp är ${prof.signPlus ? 'plus' : 'minus'}. ${det.signReason}` : det.signReason)
      setAccountId(presetAccount.current ?? prof?.accountId ?? '__new')
      setStage({ s: 'preview' })
    } catch (e) {
      setStage({ s: 'error', name, msg: (e as Error).message })
    }
  }

  const pick = async () => {
    if (window.saldo) {
      const f = await window.saldo.pickFile(['csv', 'xlsx', 'xls', 'txt'])
      if (f) load(f.name, f.data)
    } else inputRef.current?.click()
  }

  const mapping = useMemo(() => mappingFromColumns(cols), [cols])
  const preview = useMemo(() => (file && accountId ? buildPreview(file, mapping, signPlus, accountId, d.transactions) : null), [file, mapping, signPlus, accountId, d.transactions])
  const mappingOk = mapping.date >= 0 && mapping.amount >= 0 && mapping.description >= 0

  const doImport = () => {
    if (!file || !preview) return
    const importId = uid('imp')
    update((x) => {
      let acct = accountId
      if (acct === '__new') {
        acct = uid('a')
        const base = file.fileName.replace(/\.[^.]+$/, '')
        x.accounts.push({ id: acct, name: base.replace(/[-_]/g, ' ').replace(/^./, (ch) => ch.toUpperCase()), bank: '', logo: base.slice(0, 2).toUpperCase(), logoBg: '#7A8691', kind: 'csv', meta: 'CSV-import', openingBalance: 0, updatedAt: '' })
      }
      const ids: string[] = []
      preview.rows.filter((r) => r.valid && !r.duplicate).forEach((r) => {
        const base = { id: uid('t'), date: r.date, description: tidy(r.description), raw: r.description, accountId: acct, amount: Math.round(r.amount * 100) / 100 }
        const a = autoCategorize(base, x)
        x.transactions.push({ ...base, categoryId: a.categoryId, source: a.source, ruleId: a.ruleId, aiConfidence: a.aiConfidence, suggestions: a.suggestions, importId } as Transaction)
        ids.push(base.id)
      })
      x.imports.push({ id: importId, fileName: file.fileName, accountId: acct, at: isoDateTime(new Date()), txIds: ids, duplicates: preview.dupCount })
      const ac = x.accounts.find((y) => y.id === acct)!
      ac.updatedAt = `${isoDate(new Date())}T${new Date().toTimeString().slice(0, 5)}`
      if (saveProfile) {
        const headerMatch = [mapping.date, mapping.description, mapping.amount].map((i) => file.headers[i])
        const existing = profile ? x.profiles.find((p) => p.id === profile.id) : null
        const next: ImportProfile = { id: existing?.id ?? uid('p'), name: existing?.name ?? (ac.name.startsWith('American Express') ? 'Amex' : ac.name), format: file.kind, delimiter: file.delimiter, signPlus, accountId: acct, headerMatch, mapping, lastUsed: isoDate(new Date()), lastRows: ids.length }
        if (existing) Object.assign(existing, next)
        else x.profiles.push(next)
        if (!ac.profileId) ac.profileId = next.id
      }
    }, `import av ${file.fileName}`)
    setStage({ s: 'done', importId })
  }

  const reset = () => {
    setFile(null)
    setStage({ s: 'drop' })
  }

  const rec = stage.s === 'done' ? d.imports.find((i) => i.id === stage.importId) : null
  const recTx = rec ? d.transactions.filter((t) => t.importId === rec.id) : []

  return (
    <>
      <Topbar title="Import" />
      <main
        className="flex-1 overflow-auto px-7 pb-7 pt-5"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files[0]
          if (f) load(f.name, await f.arrayBuffer())
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.txt"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) load(f.name, await f.arrayBuffer())
            e.target.value = ''
          }}
        />
        {stage.s === 'drop' && (
          <div className="mx-auto flex max-w-[880px] flex-col gap-5">
            <button
              type="button"
              onClick={pick}
              className="flex h-[280px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[14px] border-2 border-dashed text-center text-text"
              style={{ borderColor: dragOver ? 'var(--accent)' : 'var(--line)', background: dragOver ? 'var(--accentSoft)' : 'var(--surface)' }}
            >
              <span className="text-accent">
                <Icon name="drop" size={34} stroke={1.6} />
              </span>
              <span className="text-[16px] font-semibold">Dra in en CSV- eller Excel-fil hit</span>
              <span className="text-text2">
                eller <span className="text-accent">välj fil</span> · .csv, .xlsx, .xls
              </span>
            </button>
            <div className="card flex items-center gap-3.5 px-4 py-3.5">
              <div className="flex-1">
                <div className="font-semibold">Utan bankkoppling?</div>
                <div className="text-[12.5px] text-text2">Exportera kontoutdrag som CSV från internetbanken och ladda upp dem här. Nya konton skapas direkt från filen, dubbletter hoppas över.</div>
              </div>
              <Button
                onClick={() => {
                  const f = exampleAmexFile()
                  load(f.name, f.data)
                }}
              >
                Prova med exempelfil
              </Button>
            </div>
            <section aria-label="Sparade importprofiler">
              <h2 className="mb-2 mt-0 text-[13px] font-semibold">Sparade importprofiler</h2>
              <div className="grid grid-cols-3 gap-3">
                {d.profiles.map((p) => (
                  <div key={p.id} className="card px-4 py-3.5">
                    <div className="flex items-center">
                      <div className="flex-1 font-semibold">{p.name}</div>
                      <button
                        type="button"
                        aria-label={`Ta bort profilen ${p.name}`}
                        className="cursor-pointer border-0 bg-transparent text-text3 hover:text-neg"
                        onClick={() => {
                          update((x) => void (x.profiles = x.profiles.filter((y) => y.id !== p.id)), 'borttagen profil')
                          toastOk(`Profilen ”${p.name}” togs bort`)
                        }}
                      >
                        <Icon name="close" size={13} />
                      </button>
                    </div>
                    <div className="mt-0.5 text-label text-text2">
                      {p.format === 'xlsx' ? 'Excel' : `CSV ${p.delimiter ?? ''}`} · köp som {p.signPlus ? 'plus' : 'minus'} · {d.accounts.find((a) => a.id === p.accountId)?.name ?? 'Okänt konto'}
                    </div>
                    <div className="num mt-1.5 text-small text-text3">{p.lastUsed ? `Senast ${p.lastUsed} · ${p.lastRows ?? 0} rader` : 'Inte använd än'}</div>
                  </div>
                ))}
                <div className="flex items-center justify-center rounded-xl border border-dashed border-line px-4 py-3.5 text-text2">+ Ny profil sparas efter import</div>
              </div>
            </section>
          </div>
        )}

        {stage.s === 'error' && (
          <div className="card mx-auto mt-5 max-w-[520px] px-8 py-10 text-center">
            <h2 className="mb-1.5 mt-0 text-title2 font-semibold">Filen kunde inte läsas</h2>
            <p className="mb-4 mt-0 text-text2">{stage.msg}</p>
            <div className="flex justify-center gap-2">
              <Button variant="primary" onClick={pick}>
                Välj en annan fil
              </Button>
              <Button onClick={reset}>Tillbaka</Button>
            </div>
          </div>
        )}

        {stage.s === 'preview' && file && preview && (
          <div className="flex items-start gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-3.5">
              <div className="card flex items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: file.kind === 'xlsx' ? '#1E7145' : '#5B6BD6' }}>
                  {file.kind === 'xlsx' ? 'XLSX' : 'CSV'}
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{file.fileName}</div>
                  <div className="num text-label text-text2">
                    {file.rows.length} rader{file.sheet ? ` · blad ”${file.sheet}”` : ''}
                    {file.delimiter ? ` · avgränsare ”${file.delimiter === '\t' ? 'tab' : file.delimiter}”` : ''} · rubrikrad {file.headerRow}
                  </div>
                </div>
                {profile && <span className="chip border-transparent bg-pos-soft text-pos">Matchar profil ”{profile.name}”</span>}
                <Button onClick={reset}>Byt fil</Button>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                <label className="flex items-center gap-2 text-[12.5px] text-text2">
                  Importprofil
                  <select
                    className="f"
                    value={profile?.id ?? ''}
                    onChange={(e) => {
                      const p = d.profiles.find((x) => x.id === e.target.value) ?? null
                      setProfile(p)
                      if (p) {
                        setSignPlus(p.signPlus)
                        setAccountId(p.accountId)
                        const m = p.mapping
                        setCols((cs) => cs.map((x) => ({ ...x, role: (x.index === m.date ? 'Datum' : x.index === m.description ? 'Beskrivning' : x.index === m.amount ? 'Belopp' : x.index === m.balance ? 'Saldo' : 'Ignorera') as ColumnRole })))
                      }
                    }}
                  >
                    {d.profiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    <option value="">Ingen profil</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-text2">
                  Till konto
                  <select className="f" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                    {d.accounts.filter((a) => a.kind !== 'manual').map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                    <option value="__new">+ Nytt konto från filen…</option>
                  </select>
                </label>
                <div className="flex items-center gap-2 text-[12.5px] text-text2">
                  Köp i filen är
                  <Segmented label="Teckenkonvention" value={signPlus ? 'plus' : 'minus'} onChange={(v) => setSignPlus(v === 'plus')} options={[{ value: 'plus', label: 'plus (+)' }, { value: 'minus', label: 'minus (−)' }]} />
                </div>
              </div>
              <div className="-mt-1.5 text-label text-text2">{signReason}</div>
              {!mappingOk && <div className="rounded-lg bg-neg-soft px-3 py-2 text-[12.5px]">Välj vilka kolumner som är datum, beskrivning och belopp.</div>}
              <div className="card sticky-head max-h-[480px] overflow-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {cols.map((col) => {
                        const cc = col.conf >= 90 ? 'var(--pos)' : col.conf >= 70 ? 'var(--warn)' : 'var(--neg)'
                        return (
                          <th key={col.index} className="th h-auto py-2.5 align-top">
                            <div className="mb-1 text-[11px] font-normal text-text3">
                              Kolumn {col.letter} · ”{col.header}”
                            </div>
                            <select
                              className="f w-full font-medium text-text"
                              aria-label={`Tolka kolumn ${col.letter} som`}
                              value={col.role}
                              onChange={(e) => {
                                const role = e.target.value as ColumnRole
                                setCols((cs) => cs.map((x) => (x.index === col.index ? { ...x, role, conf: 99 } : role !== 'Ignorera' && x.role === role ? { ...x, role: 'Ignorera' } : x)))
                              }}
                            >
                              {ROLES.map((r) => (
                                <option key={r}>{r}</option>
                              ))}
                            </select>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: cc }}>
                              <span aria-hidden="true" className="h-[3px] max-w-[60px] flex-1 rounded-sm bg-surface2">
                                <span className="block h-[3px] rounded-sm" style={{ width: `${col.conf}%`, background: cc }} />
                              </span>
                              {col.conf} % säker{col.conf < 70 ? ' · kontrollera' : ''}
                            </div>
                          </th>
                        )
                      })}
                      <th className="th text-right">Tolkat belopp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 12).map((r, i) => (
                      <tr key={i} style={{ opacity: r.duplicate ? 0.5 : r.valid ? 1 : 0.6 }}>
                        {cols.map((col) => (
                          <td key={col.index} className="td num h-[34px] max-w-[220px] truncate" style={{ textDecoration: r.duplicate && col.role !== 'Ignorera' ? 'line-through' : undefined, color: col.role === 'Ignorera' ? 'var(--text3)' : col.role === 'Belopp' ? 'var(--text2)' : undefined }}>
                            {file.rows[i][col.index]}
                          </td>
                        ))}
                        <td className="td num h-[34px] whitespace-nowrap text-right font-medium" style={{ color: r.duplicate ? 'var(--text3)' : !r.valid ? 'var(--neg)' : r.amount > 0 ? 'var(--pos)' : 'var(--text)' }}>
                          {r.duplicate ? 'Dubblett' : r.valid ? kr(r.amount, { decimals: 2, sign: true }) : 'Kan inte tolkas'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-label text-text3">
                Visar {Math.min(12, preview.rows.length)} av {preview.rows.length} rader. Överstrukna rader finns redan i Saldo och hoppas över.
              </div>
            </div>
            <aside className="card sticky top-0 w-[300px] flex-none px-[18px] py-4" aria-label="Sammanfattning">
              <h2 className="mb-3 mt-0 text-[13px] font-semibold">Innan import</h2>
              <dl className="num m-0 grid grid-cols-[1fr_auto] gap-y-2 text-[13px]">
                <dt className="text-text2">Rader i filen</dt>
                <dd className="m-0">{preview.total}</dd>
                <dt className="text-text2">Nya transaktioner</dt>
                <dd className="m-0 font-semibold">{preview.newCount}</dd>
                <dt className="text-text2">Dubbletter som hoppas över</dt>
                <dd className="m-0">{preview.dupCount}</dd>
                {preview.invalid > 0 && (
                  <>
                    <dt className="text-text2">Rader som inte kan tolkas</dt>
                    <dd className="m-0 text-neg">{preview.invalid}</dd>
                  </>
                )}
                <dt className="text-text2">Period</dt>
                <dd className="m-0">{preview.from ? `${preview.from} – ${preview.to.slice(5)}` : '–'}</dd>
                <dt className="text-text2">Summa köp</dt>
                <dd className="m-0">{kr(preview.sumBuy, { decimals: 2 })}</dd>
                <dt className="text-text2">Inbetalningar</dt>
                <dd className="m-0">{kr(preview.sumPay, { decimals: 2, sign: true })}</dd>
              </dl>
              <div className="mt-3.5 rounded-md bg-surface2 px-2.5 py-2 text-label text-text2">Dubbletter känns igen på datum (±1 dag), belopp och beskrivning, även om filen överlappar en tidigare import.</div>
              <label className="mt-3.5 flex items-center gap-2 text-[12.5px]">
                <input type="checkbox" checked={saveProfile} onChange={() => setSaveProfile(!saveProfile)} /> {profile ? `Uppdatera profilen ”${profile.name}”` : 'Spara som importprofil'}
              </label>
              <Button variant="primary" disabled={!mappingOk || preview.newCount === 0} onClick={doImport} className="mt-3.5 h-[34px] w-full justify-center">
                {preview.newCount ? `Importera ${preview.newCount} transaktioner` : 'Inget nytt att importera'}
              </Button>
            </aside>
          </div>
        )}

        {stage.s === 'done' && rec && (
          <div className="mx-auto mt-10 max-w-[640px]">
            <div className="flex items-center gap-3">
              <SuccessMark size={40} />
              <div>
                <h2 className="m-0 text-[18px] font-semibold">{rec.txIds.length} transaktioner importerade</h2>
                <div className="num text-[12.5px] text-text2">
                  Till {d.accounts.find((a) => a.id === rec.accountId)?.name} · {rec.at}
                </div>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {[
                [rec.txIds.length, 'Importerade'],
                [rec.duplicates, 'Dubbletter överhoppade'],
                [recTx.filter((t) => !needsReview(t)).length, 'Kategoriserade direkt'],
                [recTx.filter(needsReview).length, 'Till Att granska']
              ].map(([n, l]) => (
                <div key={l} className="card px-3.5 py-3">
                  <div className="num text-[22px] font-semibold">{n}</div>
                  <div className="text-label text-text2">{l}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              {recTx.some(needsReview) && (
                <Link className="btn btn-primary" to="/granska">
                  Granska {recTx.filter(needsReview).length} transaktioner
                </Link>
              )}
              <Link className="btn" to={`/transaktioner?q=&manad=${recTx[0]?.date.slice(0, 7) ?? ''}`}>
                Visa importerade
              </Link>
              <Button onClick={reset}>Importera en till fil</Button>
              <span className="flex-1" />
              <Button className="text-neg" onClick={() => setConfirmUndo(true)}>
                Ångra importen
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={confirmUndo && !!rec} onClose={() => setConfirmUndo(false)} title={`Ångra importen av ${rec?.fileName}?`}>
        {rec && (
          <>
            <p className="mb-[18px] mt-2 text-text2">
              {rec.txIds.length} transaktioner och {recTx.filter(needsReview).length} poster i Att granska tas bort. Regler du skapat under tiden finns kvar.
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setConfirmUndo(false)}>Avbryt</Button>
              <Button
                variant="danger"
                onClick={() => {
                  const n = rec.txIds.length
                  update((x) => {
                    x.transactions = x.transactions.filter((t) => t.importId !== rec.id)
                    x.imports = x.imports.filter((i) => i.id !== rec.id)
                  }, 'ångrad import')
                  setConfirmUndo(false)
                  reset()
                  toastOk(`Importen ångrades · ${formatNumber(n)} transaktioner borttagna`)
                }}
              >
                Ta bort {rec.txIds.length} transaktioner
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  )
}

/** Gör bankens versaler läsbara: ”ICA KVANTUM VALLENTUNA” → ”Ica Kvantum Vallentuna”. Kända märken behåller versaler. */
function tidy(s: string): string {
  if (s !== s.toUpperCase()) return s
  const keep = new Set(['ICA', 'SL', 'SAS', 'SJ', 'NK', 'AB', 'H&M', 'MAX', 'IKEA', 'OKQ8', 'ST1'])
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (keep.has(w.toUpperCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
