import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { CategoryChip } from '@/components/ui/category-chip'
import { Dialog } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Button, EmptyState, Field } from '@/components/ui/primitives'
import { toastOk, toastUndo } from '@/components/ui/toast'
import { applySimilar, countSimilar, runRule, saveText, setManual, similarRule, toCsv } from '@/lib/actions'
import { ruleLabel, SOURCE_TITLE, UNCERTAIN_BELOW } from '@/lib/categorize'
import { cap, formatNumber, isoDate, monthKey, monthLabel, parseAmount } from '@/lib/format'
import { useCats, useMoney } from '@/lib/hooks'
import type { CatSource, Rule, Transaction } from '@/lib/types'
import { uid } from '@/lib/utils'
import { useData, useStore } from '@/store'
import { shortAcct } from './Oversikt'

const ROW = 36
const GRID = '34px 100px minmax(150px,1.5fr) minmax(80px,.6fr) minmax(150px,1fr) 124px'

export function Transaktioner() {
  const d = useData()
  const update = useStore((s) => s.update)
  const period = useStore((s) => s.period)
  const setPeriod = useStore((s) => s.setPeriod)
  const { kr } = useMoney()
  const c = useCats()
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [acct, setAcct] = useState('')
  const [cat, setCat] = useState(sp.get('kategori') === '__okat' ? '' : sp.get('kategori') ?? '')
  const [src, setSrc] = useState<CatSource | ''>('')
  const [onlyUncat, setOnlyUncat] = useState(sp.get('kategori') === '__okat')
  const [allPeriods, setAllPeriods] = useState(!!sp.get('q'))
  const [sel, setSel] = useState<string | null>(sp.get('tx'))
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [cursor, setCursor] = useState(0)
  const [dlg, setDlg] = useState<{ tx: Transaction; cat: string; similar: number } | null>(null)
  const [ruleDlg, setRuleDlg] = useState<Transaction | null>(null)
  const [splitDlg, setSplitDlg] = useState<Transaction | null>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Länkar från Översikt/Analys: ?manad=2026-10&kategori=mat
  useEffect(() => {
    const m = sp.get('manad')
    if (m) setPeriod(m)
    if (sp.get('kategori') === '__okat') setOnlyUncat(true)
    else if (sp.get('kategori')) setCat(sp.get('kategori')!)
    if (sp.get('tx')) setSel(sp.get('tx'))
    if (sp.get('q')) {
      setQ(sp.get('q')!)
      setAllPeriods(true)
    }
    if (m || sp.get('kategori') || sp.get('tx') || sp.get('q')) setSp({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp])

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    const amt = parseAmount(s)
    const catSet = cat ? new Set([cat, ...c.cats.filter((x) => x.parentId === cat).map((x) => x.id)]) : null
    return d.transactions
      .filter((t) => {
        if (!allPeriods && monthKey(t.date) !== period) return false
        if (acct && t.accountId !== acct) return false
        if (catSet && !catSet.has(t.categoryId ?? '')) return false
        if (src && t.source !== src) return false
        if (onlyUncat && t.categoryId) return false
        if (s) {
          const inText = t.description.toLowerCase().includes(s) || t.raw.toLowerCase().includes(s)
          const inAmt = amt !== null && Math.abs(Math.abs(t.amount) - Math.abs(amt)) < 0.005
          if (!inText && !inAmt) return false
        }
        return true
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [d.transactions, q, acct, cat, src, onlyUncat, allPeriods, period, c.cats])

  const v = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => ROW, overscan: 12 })
  const selTx = sel ? d.transactions.find((t) => t.id === sel) ?? null : null
  const sum = rows.reduce((s, t) => s + t.amount, 0)

  useEffect(() => {
    if (sel) {
      const i = rows.findIndex((t) => t.id === sel)
      if (i >= 0) {
        setCursor(i)
        v.scrollToIndex(i, { align: 'auto' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel])

  // Tabell: ↑↓ flytta, Enter öppna, Mellanslag markera, ⌘A markera alla, ⌘F filtrera, Esc stäng.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        filterRef.current?.focus()
        return
      }
      if (dlg || ruleDlg || splitDlg || useStore.getState().paletteOpen) return
      if (e.key === 'Escape') {
        if (typing) (el as HTMLInputElement).blur()
        else if (sel) setSel(null)
        else if (checked.size) setChecked(new Set())
        return
      }
      if (typing) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setChecked(new Set(rows.map((t) => t.id)))
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const n = Math.max(0, Math.min(rows.length - 1, cursor + (e.key === 'ArrowDown' ? 1 : -1)))
        setCursor(n)
        v.scrollToIndex(n)
        if (sel) setSel(rows[n]?.id ?? null)
      } else if (e.key === 'Enter' && rows[cursor]) {
        setSel(rows[cursor].id)
      } else if (e.key === ' ' && rows[cursor]) {
        e.preventDefault()
        toggle(rows[cursor].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toggle = (id: string) =>
    setChecked((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const bulk = (catId: string) => {
    if (!catId) return
    const ids = [...checked]
    update((x) => setManual(x, ids, catId), 'massändring av kategori')
    setChecked(new Set())
    toastUndo(`Kategori ”${c.name(catId)}” satt på ${ids.length} transaktioner`)
  }

  const exportCsv = async () => {
    const head = ['Datum', 'Beskrivning', 'Konto', 'Kategori', 'Källa', 'Belopp']
    const body = rows.map((t) => [t.date, t.description, d.accounts.find((a) => a.id === t.accountId)?.name ?? '', c.name(t.categoryId), t.source ? SOURCE_TITLE[t.source] : '', formatNumber(t.amount, 2)])
    const f = await saveText(`saldo-transaktioner-${allPeriods ? 'alla' : period}.csv`, toCsv([head, ...body]))
    if (f) toastOk(`${rows.length} transaktioner exporterade`)
  }

  const filtersActive = !!(q || acct || cat || src || onlyUncat)

  return (
    <>
      <Topbar title="Transaktioner" showPeriod />
      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col px-6 pt-4">
          {checked.size === 0 ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <label className="relative flex items-center">
                <span className="sr-only">Filtrera transaktioner</span>
                <input ref={filterRef} className="f w-[230px]" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrera på beskrivning eller belopp" />
              </label>
              <label className="flex items-center gap-1.5 text-label text-text2">
                Konto
                <select className="f w-[140px]" value={acct} onChange={(e) => setAcct(e.target.value)}>
                  <option value="">Alla konton</option>
                  {d.accounts.filter((a) => a.kind !== 'manual').map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-label text-text2">
                Kategori
                <select className="f w-[140px]" value={cat} onChange={(e) => setCat(e.target.value)}>
                  <option value="">Alla kategorier</option>
                  {c.cats.filter((x) => !x.parentId).map((m) => [
                    <option key={m.id} value={m.id}>{m.name}</option>,
                    ...c.cats.filter((k) => k.parentId === m.id).map((k) => (
                      <option key={k.id} value={k.id}>{'   '}{k.name}</option>
                    ))
                  ])}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-label text-text2">
                Källa
                <select className="f" value={src} onChange={(e) => setSrc(e.target.value as CatSource | '')}>
                  <option value="">Alla</option>
                  <option value="manual">Manuell</option>
                  <option value="rule">Regel</option>
                  <option value="learned">Inlärd</option>
                  <option value="ai">AI</option>
                </select>
              </label>
              <label className="ml-1 flex items-center gap-1.5 text-[12.5px]">
                <input type="checkbox" checked={onlyUncat} onChange={() => setOnlyUncat(!onlyUncat)} /> Endast okategoriserade
              </label>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input type="checkbox" checked={allPeriods} onChange={() => setAllPeriods(!allPeriods)} /> Alla perioder
              </label>
              <span className="flex-1" />
              <span className="num text-label text-text2">{rows.length} transaktioner</span>
              <Button onClick={exportCsv}>
                <Icon name="upload" size={14} stroke={1.8} />
                Exportera
              </Button>
            </div>
          ) : (
            <div role="toolbar" aria-label="Massåtgärder" className="mb-3 flex h-7 items-center gap-2.5 rounded-lg bg-accent-soft py-1 pl-3 pr-2" style={{ boxSizing: 'content-box' }}>
              <strong className="num font-semibold text-accent">{checked.size} markerade</strong>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                Kategorisera som
                <CategorySelect value="" onChange={bulk} placeholder="Välj kategori…" />
              </label>
              <span className="flex-1" />
              <Button onClick={() => setChecked(new Set())}>Avmarkera</Button>
            </div>
          )}

          <div className="card flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-none" role="table" aria-label="Transaktioner" aria-rowcount={rows.length}>
            <div role="row" className="grid border-b border-line" style={{ gridTemplateColumns: GRID }}>
              <div role="columnheader" className="th flex items-center border-0 pl-3.5">
                <input type="checkbox" aria-label="Markera alla" checked={checked.size > 0 && checked.size === rows.length} onChange={() => setChecked(checked.size === rows.length ? new Set() : new Set(rows.map((t) => t.id)))} />
              </div>
              {['Datum', 'Beskrivning', 'Konto', 'Kategori'].map((h) => (
                <div key={h} role="columnheader" className="th flex items-center border-0">{h}</div>
              ))}
              <div role="columnheader" className="th flex items-center justify-end border-0 pr-[18px]">Belopp</div>
            </div>
            {rows.length === 0 ? (
              <div className="p-6">
                {d.transactions.length === 0 ? (
                  <EmptyState icon="list" title="Inga transaktioner än" actions={<><Link className="btn btn-primary h-8" to="/konton?lagg-till=1">Koppla bank</Link><Link className="btn h-8" to="/import">Importera fil</Link></>}>
                    Koppla din bank för att hämta upp till 24 månaders historik, eller importera en fil från Amex.
                  </EmptyState>
                ) : (
                  <div className="flex items-center gap-4 rounded-xl border border-line px-6 py-5">
                    <div className="flex-1">
                      <div className="font-semibold">Tomt filterresultat</div>
                      <div className="text-[12.5px] text-text2">Inga transaktioner matchar {q ? `”${q}”` : 'filtret'}{allPeriods ? '' : ` i ${monthLabel(period)}`}.</div>
                    </div>
                    {filtersActive && <Button onClick={() => (setQ(''), setAcct(''), setCat(''), setSrc(''), setOnlyUncat(false))}>Rensa filter</Button>}
                    {!allPeriods && <Button onClick={() => setAllPeriods(true)}>Sök i alla perioder</Button>}
                  </div>
                )}
              </div>
            ) : (
              <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
                <div style={{ height: v.getTotalSize(), position: 'relative' }}>
                  {v.getVirtualItems().map((vi) => {
                    const t = rows[vi.index]
                    const on = sel === t.id
                    const ck = checked.has(t.id)
                    return (
                      <div
                        key={t.id}
                        role="row"
                        aria-selected={on}
                        className="absolute left-0 right-0 grid cursor-default items-center border-b border-line"
                        style={{ gridTemplateColumns: GRID, height: ROW, transform: `translateY(${vi.start}px)`, background: on ? 'var(--accentSoft)' : ck ? 'var(--surface2)' : vi.index === cursor ? 'color-mix(in srgb, var(--surface2) 60%, transparent)' : undefined }}
                        onClick={() => (setSel(t.id), setCursor(vi.index))}
                      >
                        <div role="cell" className="pl-3.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Markera ${t.description}`} checked={ck} onChange={() => toggle(t.id)} />
                        </div>
                        <div role="cell" className="num whitespace-nowrap px-3 text-text2">{t.date}</div>
                        <div role="cell" className="truncate px-3 font-medium">
                          <button type="button" className="cursor-pointer border-0 bg-transparent p-0 text-left font-medium text-text" onClick={() => setSel(t.id)}>{t.description}</button>
                        </div>
                        <div role="cell" className="truncate px-3 text-text2">{shortAcct(d.accounts.find((a) => a.id === t.accountId)?.name)}</div>
                        <div role="cell" className="min-w-0 overflow-hidden px-3"><CategoryChip tx={t} /></div>
                        <div role="cell" className="num pr-[18px] text-right font-medium" style={{ color: t.amount > 0 ? 'var(--pos)' : 'var(--text)' }}>{kr(t.amount, { decimals: 2, sign: true })}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          <div className="flex h-[34px] items-center gap-3.5 text-small text-text2">
            <span>Kategorin sattes:</span>
            <span><span className="src">M</span> manuellt</span>
            <span><span className="src">R</span> av regel</span>
            <span><span className="src">I</span> inlärd</span>
            <span><span className="src">AI</span> AI-förslag</span>
            <span className="flex-1" />
            <span className="num">Summa visade: {kr(sum, { decimals: 2, sign: true })}</span>
          </div>
        </main>

        {selTx && (
          <DetailPanel
            key={selTx.id}
            tx={selTx}
            onClose={() => setSel(null)}
            onPick={(catId) => setDlg({ tx: selTx, cat: catId, similar: countSimilar(d, selTx) })}
            onRule={() => setRuleDlg(selTx)}
            onSplit={() => setSplitDlg(selTx)}
          />
        )}
      </div>

      <Dialog open={!!dlg} onClose={() => setDlg(null)} title={dlg ? `Byt kategori till ${c.name(dlg.cat)}?` : ''}>
        {dlg && (
          <>
            <p className="mb-4 mt-2 text-text2">
              Det finns <strong className="num text-text">{dlg.similar}</strong> liknande transaktioner från <strong className="text-text">{similarRule(dlg.tx, '').value}</strong>. Vill du ändra bara den här, eller alla liknande och framtida?
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                className="h-[34px] justify-center"
                autoFocus
                onClick={() => {
                  let n = 0
                  update((x) => {
                    const t = x.transactions.find((y) => y.id === dlg.tx.id)!
                    n = applySimilar(x, t, dlg.cat).changed
                  }, 'kategoribyte med regel')
                  toastUndo(`Kategori ändrad för ${n} transaktioner · ny regel skapad`)
                  setDlg(null)
                }}
              >
                Alla liknande, även framtida
              </Button>
              <Button
                className="h-[34px] justify-center"
                onClick={() => {
                  update((x) => setManual(x, [dlg.tx.id], dlg.cat), 'kategoribyte')
                  toastUndo('Kategori ändrad för 1 transaktion')
                  setDlg(null)
                }}
              >
                Bara denna
              </Button>
              <Button variant="ghost" className="h-[30px] justify-center" onClick={() => setDlg(null)}>
                Avbryt
              </Button>
            </div>
            <p className="mb-0 mt-3 text-small text-text3">”Alla liknande” skapar en regel: Beskrivning börjar med ”{similarRule(dlg.tx, '').value}”.</p>
          </>
        )}
      </Dialog>

      {ruleDlg && <RuleDialog tx={ruleDlg} onClose={() => setRuleDlg(null)} />}
      {splitDlg && <SplitDialog tx={splitDlg} onClose={() => setSplitDlg(null)} />}
    </>
  )
}

export function CategorySelect({ value, onChange, placeholder, className, style }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; style?: React.CSSProperties }) {
  const c = useCats()
  return (
    <select className={`f ${className ?? ''}`} style={style} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {c.cats.filter((x) => !x.parentId).map((m) => {
        const kids = c.cats.filter((k) => k.parentId === m.id)
        return kids.length ? (
          <optgroup key={m.id} label={m.name}>
            {kids.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </optgroup>
        ) : (
          <option key={m.id} value={m.id}>{m.name}</option>
        )
      })}
    </select>
  )
}

function DetailPanel({ tx, onClose, onPick, onRule, onSplit }: { tx: Transaction; onClose: () => void; onPick: (c: string) => void; onRule: () => void; onSplit: () => void }) {
  const d = useData()
  const update = useStore((s) => s.update)
  const { kr } = useMoney()
  const c = useCats()
  const acct = d.accounts.find((a) => a.id === tx.accountId)
  const rule = tx.ruleId ? d.rules.find((r) => r.id === tx.ruleId) : null
  const why = !tx.categoryId
    ? 'Ingen kategori ännu. Välj en nedan.'
    : tx.source === 'manual'
      ? 'Satt manuellt av dig.'
      : tx.source === 'rule'
        ? `Regel: ${rule ? ruleLabel(rule) : 'en regel'} sätter kategorin automatiskt.`
        : tx.source === 'learned'
          ? `Inlärd: du har satt ”${c.name(tx.categoryId)}” på liknande köp hos samma handlare.`
          : `AI-förslag med ${tx.aiConfidence ?? 0} % säkerhet.${(tx.aiConfidence ?? 0) < UNCERTAIN_BELOW ? ' Osäkert, finns i Att granska.' : ''} Bekräfta eller välj en annan kategori.`
  const via = acct?.kind === 'bank' ? 'Enable Banking' : acct?.kind === 'manual' ? 'Manuellt konto' : tx.importId ? 'Filimport' : `Filimport (profil ${d.profiles.find((p) => p.id === acct?.profileId)?.name ?? '–'})`
  return (
    <aside aria-label="Transaktionsdetaljer" className="flex w-[340px] flex-none flex-col overflow-auto border-l border-line bg-surface">
      <div className="flex items-center px-4 pt-3.5">
        <span className="flex-1 text-label text-text2">Transaktion</span>
        <Button aria-label="Stäng" onClick={onClose} className="w-7 justify-center p-0">
          <Icon name="close" size={14} />
        </Button>
      </div>
      <div className="border-b border-line px-4 pb-4 pt-1.5">
        <div className="text-[16px] font-semibold">{tx.description}</div>
        <div className="num mt-1.5 text-[24px] font-semibold" style={{ color: tx.amount > 0 ? 'var(--pos)' : 'var(--text)' }}>{kr(tx.amount, { decimals: 2, sign: true })}</div>
      </div>
      <dl className="m-0 grid grid-cols-[110px_1fr] gap-y-2 border-b border-line px-4 py-3 text-[12.5px]">
        <dt className="text-text2">Datum</dt>
        <dd className="num m-0">{tx.date}</dd>
        <dt className="text-text2">Konto</dt>
        <dd className="m-0">{acct?.name}</dd>
        <dt className="text-text2">Banktext</dt>
        <dd className="m-0 break-all font-mono text-small">{tx.raw}</dd>
        <dt className="text-text2">Källa</dt>
        <dd className="m-0">{via}</dd>
      </dl>
      <div className="flex flex-col gap-2.5 px-4 py-3.5">
        <Field label="Kategori">
          <CategorySelect value={tx.categoryId ?? ''} placeholder={tx.categoryId ? undefined : 'Välj kategori…'} onChange={(v) => v && v !== tx.categoryId && onPick(v)} style={{ height: 32 }} />
        </Field>
        <div className="rounded-md bg-surface2 px-2.5 py-2 text-label text-text2">{why}</div>
        <Field label="Anteckning">
          <textarea
            className="f h-16 resize-none px-2 py-1.5"
            rows={3}
            defaultValue={tx.note ?? ''}
            placeholder="Lägg till en anteckning"
            onBlur={(e) => e.target.value !== (tx.note ?? '') && update((x) => void (x.transactions.find((t) => t.id === tx.id)!.note = e.target.value))}
          />
        </Field>
        <div className="flex gap-2">
          <Button onClick={onSplit}>Dela upp belopp</Button>
          <Button onClick={onRule}>Skapa regel…</Button>
        </div>
      </div>
    </aside>
  )
}

function RuleDialog({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const d = useData()
  const update = useStore((s) => s.update)
  const [kind, setKind] = useState<Rule['kind']>('startsWith')
  const [value, setValue] = useState(similarRule(tx, '').value)
  const [cat, setCat] = useState(tx.categoryId ?? '')
  const [acct, setAcct] = useState('')
  return (
    <Dialog open onClose={onClose} title="Ny regel" width={460}>
      <div className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-[150px_1fr] gap-2">
          <Field label="Villkor">
            <select className="f h-[30px]" value={kind} onChange={(e) => setKind(e.target.value as Rule['kind'])}>
              <option value="startsWith">Börjar med</option>
              <option value="contains">Innehåller</option>
              <option value="equals">Är exakt</option>
            </select>
          </Field>
          <Field label="Text i beskrivningen">
            <input className="f h-[30px]" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sätt kategori">
            <CategorySelect value={cat} onChange={setCat} placeholder="Välj kategori…" style={{ height: 30 }} />
          </Field>
          <Field label="Konto">
            <select className="f h-[30px]" value={acct} onChange={(e) => setAcct(e.target.value)}>
              <option value="">Alla</option>
              {d.accounts.filter((a) => a.kind !== 'manual').map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <p className="m-0 text-small text-text3">Regeln körs direkt på befintliga transaktioner (utom manuellt satta) och på allt som synkas eller importeras framöver.</p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Avbryt</Button>
          <Button
            variant="primary"
            disabled={!cat || !value.trim()}
            onClick={() => {
              let n = 0
              update((x) => {
                const r: Rule = { id: uid('r'), categoryId: cat, kind, value: value.trim(), accountId: acct || null, createdAt: isoDate(new Date()) }
                x.rules.unshift(r)
                n = runRule(x, r)
              }, 'ny regel')
              toastUndo(`Regel skapad · ${n} transaktioner kategoriserade`)
              onClose()
            }}
          >
            Skapa regel
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function SplitDialog({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const update = useStore((s) => s.update)
  const { kr } = useMoney()
  const [part, setPart] = useState(formatNumber(Math.abs(tx.amount) / 2, 2))
  const [cat, setCat] = useState('')
  const v = parseAmount(part) ?? 0
  const ok = v > 0 && v < Math.abs(tx.amount) && !!cat
  return (
    <Dialog open onClose={onClose} title="Dela upp belopp" width={440}>
      <p className="mb-3 mt-2 text-text2">Dela {tx.description} ({kr(tx.amount, { decimals: 2 })}) i två delar med olika kategorier.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Belopp för den nya delen">
          <input className="f num h-[30px] text-right" value={part} onChange={(e) => setPart(e.target.value)} />
        </Field>
        <Field label="Kategori för den nya delen">
          <CategorySelect value={cat} onChange={setCat} placeholder="Välj kategori…" style={{ height: 30 }} />
        </Field>
      </div>
      <p className="num mb-0 mt-2 text-small text-text3">Kvar på ursprunglig rad: {kr(tx.amount - (Math.sign(tx.amount) || -1) * v, { decimals: 2 })}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant="primary"
          disabled={!ok}
          onClick={() => {
            update((x) => {
              const t = x.transactions.find((y) => y.id === tx.id)!
              const sign = Math.sign(t.amount) || -1
              t.amount = Math.round((t.amount - sign * v) * 100) / 100
              x.transactions.push({ ...t, id: uid('t'), amount: sign * v, categoryId: cat, source: 'manual', ruleId: undefined, aiConfidence: undefined, description: `${t.description} (del)` })
            }, 'uppdelning')
            toastUndo('Beloppet delades upp i två transaktioner')
            onClose()
          }}
        >
          Dela upp
        </Button>
      </div>
    </Dialog>
  )
}

export const periodLabel = (p: string) => cap(monthLabel(p))
