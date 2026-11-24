import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { Dialog } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Button, Field, Segmented } from '@/components/ui/primitives'
import { toastUndo } from '@/components/ui/toast'
import { runRule } from '@/lib/actions'
import { spendBySub } from '@/lib/analytics'
import { ruleLabel } from '@/lib/categorize'
import { isoDate, monthLabel } from '@/lib/format'
import { useCats, useMoney } from '@/lib/hooks'
import { ICONS, PALETTE, PALETTE_NAMES } from '@/lib/palette'
import type { Category, CategoryType, IconKey, Rule } from '@/lib/types'
import { uid } from '@/lib/utils'
import { useData, useStore } from '@/store'
import { CategorySelect } from './Transaktioner'

export function Kategorier() {
  const d = useData()
  const update = useStore((s) => s.update)
  const period = useStore((s) => s.period)
  const { kr } = useMoney()
  const c = useCats()
  const [sp, setSp] = useSearchParams()
  const [selId, setSelId] = useState('liv')
  const [open, setOpen] = useState<Record<string, boolean>>({ mat: true, boende: true })
  const [q, setQ] = useState('')
  const [dlg, setDlg] = useState<null | 'del' | 'merge' | 'new' | 'rename'>(null)
  const [ruleEdit, setRuleEdit] = useState<Rule | 'new' | null>(null)

  useEffect(() => {
    if (sp.get('ny')) {
      setDlg('new')
      setSp({}, { replace: true })
    }
  }, [sp, setSp])

  const sums = useMemo(() => spendBySub(d.transactions, c, [period]), [d.transactions, c, period])
  const sumFor = (cat: Category) => {
    const own = sums.get(cat.id) ?? 0
    const kids = c.cats.filter((k) => k.parentId === cat.id).reduce((s, k) => s + (sums.get(k.id) ?? 0), 0)
    const v = own + kids
    return cat.type === 'inkomst' ? -v : v
  }
  const sel = c.byId.get(selId) ?? c.cats[0]
  const main = sel ? c.main(sel.id)! : null
  const isMain = sel && !sel.parentId
  const txCount = sel ? d.transactions.filter((t) => t.categoryId === sel.id || (isMain && c.byId.get(t.categoryId ?? '')?.parentId === sel.id)).length : 0
  const rules = sel ? d.rules.filter((r) => r.categoryId === sel.id || (isMain && c.byId.get(r.categoryId)?.parentId === sel.id)) : []

  const patch = (p: Partial<Category>) =>
    update((x) => {
      const cat = x.categories.find((k) => k.id === sel.id)!
      Object.assign(cat, p)
      // Underkategorier ärver huvudkategorins färg, ikon och typ.
      if (!cat.parentId && (p.color !== undefined || p.icon !== undefined || p.type !== undefined || p.excluded !== undefined))
        x.categories.filter((k) => k.parentId === cat.id).forEach((k) => {
          if (p.color !== undefined) k.color = p.color
          if (p.icon !== undefined) k.icon = p.icon
          if (p.type !== undefined) k.type = p.type
          if (p.excluded !== undefined) k.excluded = p.excluded
        })
    })

  const s = q.trim().toLowerCase()
  const mains = c.cats.filter((k) => !k.parentId)
  const visible = (k: Category) => !s || k.name.toLowerCase().includes(s) || c.cats.some((x) => x.parentId === k.id && x.name.toLowerCase().includes(s))

  if (!sel) return null
  return (
    <>
      <Topbar title="Kategorier" />
      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6 pt-4">
        <section className="card flex w-[380px] flex-none flex-col overflow-hidden" aria-label="Kategoriträd">
          <div className="flex gap-2 p-3">
            <label className="flex flex-1">
              <span className="sr-only">Sök kategori</span>
              <input className="f w-full" type="search" placeholder="Sök kategori" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <Button variant="primary" onClick={() => setDlg('new')}>
              + Ny kategori
            </Button>
          </div>
          <div className="flex px-[22px] pb-1.5 text-[11px] text-text3">
            <span className="flex-1">Namn</span>
            <span>{monthLabel(period, 'short')} {period.slice(0, 4)}</span>
          </div>
          <div role="tree" aria-label="Kategorier" className="flex-1 overflow-auto px-2 pb-2">
            {mains.filter(visible).map((m) => {
              const kids = c.cats.filter((k) => k.parentId === m.id && (!s || k.name.toLowerCase().includes(s) || m.name.toLowerCase().includes(s)))
              const isOpen = !!open[m.id] || !!s
              return (
                <div key={m.id}>
                  <TreeItem cat={m} level={0} sel={selId === m.id} caret={kids.length ? (isOpen ? '▾' : '▸') : ''} amt={kr(sumFor(m))} onPick={() => (setSelId(m.id), kids.length && setOpen({ ...open, [m.id]: !open[m.id] }))} />
                  {isOpen && kids.map((k) => <TreeItem key={k.id} cat={k} level={1} sel={selId === k.id} caret="" amt={kr(sumFor(k))} onPick={() => setSelId(k.id)} />)}
                </div>
              )
            })}
          </div>
        </section>

        <section className="card min-w-0 flex-1 overflow-auto px-6 py-5" aria-label="Kategoridetaljer">
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] text-white" style={{ background: PALETTE[c.color(sel.id)] }}>
              <Icon d={ICONS[sel.icon]} size={20} stroke={2} />
            </span>
            <div className="flex-1">
              <div className="text-label text-text2">{sel.parentId ? `${main!.name} ›` : 'Huvudkategori'}</div>
              <h2 className="m-0 text-[19px] font-semibold">{sel.name}</h2>
            </div>
            <Button onClick={() => setDlg('rename')}>Byt namn</Button>
            <Button onClick={() => setDlg('merge')}>Slå ihop…</Button>
            <Button onClick={() => setDlg('del')} className="text-neg">
              Ta bort…
            </Button>
          </div>
          <div className="mt-[22px] grid grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-5">
            <div>
              <div className="mb-2 text-label text-text2">Färg{sel.parentId ? ' · ärvs från ' + main!.name : ''}</div>
              <div role="radiogroup" aria-label="Färg" className="flex gap-2">
                {PALETTE.map((col, i) => (
                  <button
                    key={col}
                    type="button"
                    role="radio"
                    aria-checked={main!.color === i}
                    aria-label={PALETTE_NAMES[i]}
                    disabled={!!sel.parentId}
                    onClick={() => patch({ color: i })}
                    className="h-[22px] w-[22px] cursor-pointer rounded-full border-0 disabled:cursor-default disabled:opacity-50"
                    style={{ background: col, boxShadow: `0 0 0 2px var(--surface), 0 0 0 ${main!.color === i ? 4 : 0}px var(--text)` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-label text-text2">Ikon</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ICONS) as IconKey[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={`Ikon ${k}`}
                    aria-pressed={sel.icon === k}
                    onClick={() => patch({ icon: k })}
                    className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-text"
                    style={{ borderColor: sel.icon === k ? 'var(--accent)' : 'var(--line)', background: sel.icon === k ? 'var(--accentSoft)' : 'var(--surface)' }}
                  >
                    <Icon d={ICONS[k]} size={15} stroke={1.9} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-label text-text2">Typ</div>
              <Segmented<CategoryType>
                label="Typ"
                value={sel.type}
                onChange={(t) => patch({ type: t, excluded: t === 'överföring' ? true : sel.excluded })}
                options={[
                  { value: 'utgift', label: 'Utgift' },
                  { value: 'inkomst', label: 'Inkomst' },
                  { value: 'överföring', label: 'Överföring' }
                ]}
              />
            </div>
            <div>
              <div className="mb-2 text-label text-text2">Budget och rapporter</div>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={sel.excluded} onChange={() => patch({ excluded: !sel.excluded })} /> Räknas inte som utgift
              </label>
              <div className="mt-1 text-small text-text3">Tas bort ur utgifter, sparkvot och diagram, men syns i transaktionslistan.</div>
            </div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-2.5 flex items-center">
              <h3 className="m-0 flex-1 text-[13px] font-semibold">Regler som sätter {sel.name}</h3>
              <Button onClick={() => setRuleEdit('new')}>+ Ny regel</Button>
            </div>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th pl-0">Villkor</th>
                  {isMain && <th className="th">Kategori</th>}
                  <th className="th">Konto</th>
                  <th className="th text-right">Träffar</th>
                  <th className="th text-right">Senast</th>
                  <th className="th w-[60px]"><span className="sr-only">Åtgärder</span></th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && (
                  <tr>
                    <td className="td pl-0 text-text2" colSpan={6}>Inga regler än. Kategorin sätts manuellt eller via inlärning.</td>
                  </tr>
                )}
                {rules.map((r) => {
                  const hits = d.transactions.filter((t) => t.ruleId === r.id)
                  const last = hits.reduce((m, t) => (t.date > m ? t.date : m), '')
                  return (
                    <tr key={r.id}>
                      <td className="td pl-0">{ruleLabel(r)}</td>
                      {isMain && <td className="td text-text2">{c.name(r.categoryId)}</td>}
                      <td className="td text-text2">{r.accountId ? d.accounts.find((a) => a.id === r.accountId)?.name : 'Alla'}</td>
                      <td className="td num text-right">{hits.length}</td>
                      <td className="td num text-right text-text2">{last || '–'}</td>
                      <td className="td text-right">
                        <Button className="h-6 px-2" onClick={() => setRuleEdit(r)}>Ändra</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mb-0 mt-2.5 text-small text-text3">
              Ordning: manuellt val går före regel, regel före inlärning, inlärning före AI-förslag. {txCount} transaktioner har kategorin.
            </p>
          </div>
        </section>
      </div>

      {(dlg === 'del' || dlg === 'merge') && <MoveDialog mode={dlg} cat={sel} count={txCount} rules={rules.length} onClose={() => setDlg(null)} onDone={(to) => setSelId(to && to !== '__none' ? to : 'ovrigt')} />}
      {dlg === 'new' && <NewDialog onClose={() => setDlg(null)} onCreated={(id) => setSelId(id)} parentHint={sel.parentId ?? sel.id} />}
      {dlg === 'rename' && <RenameDialog cat={sel} onClose={() => setDlg(null)} />}
      {ruleEdit && <RuleEditor rule={ruleEdit === 'new' ? null : ruleEdit} defaultCat={sel.id} onClose={() => setRuleEdit(null)} />}
    </>
  )
}

function TreeItem({ cat, level, sel, caret, amt, onPick }: { cat: Category; level: number; sel: boolean; caret: string; amt: string; onPick: () => void }) {
  const c = useCats()
  return (
    <button
      type="button"
      role="treeitem"
      aria-selected={sel}
      onClick={onPick}
      className="flex h-[30px] w-full cursor-pointer items-center gap-2 rounded-md border-0 pr-2.5 text-left text-[13px] text-text"
      style={{ paddingLeft: 10 + level * 22, background: sel ? 'var(--accentSoft)' : 'transparent', fontWeight: level === 0 ? 600 : 400 }}
    >
      <span aria-hidden="true" className="w-2.5 text-[10px] text-text3">{caret}</span>
      <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] text-white" style={{ background: PALETTE[c.color(cat.id)] }}>
        <Icon d={ICONS[cat.icon]} size={12} stroke={2.2} />
      </span>
      <span className="flex-1">{cat.name}</span>
      {cat.excluded && level === 0 && <span className="rounded border border-line px-1 text-[10.5px] text-text3">ej utgift</span>}
      <span className="num text-label font-normal text-text2">{amt}</span>
    </button>
  )
}

function MoveDialog({ mode, cat, count, rules, onClose, onDone }: { mode: 'del' | 'merge'; cat: Category; count: number; rules: number; onClose: () => void; onDone: (to: string) => void }) {
  const update = useStore((s) => s.update)
  const c = useCats()
  const [to, setTo] = useState(mode === 'del' ? cat.parentId ?? 'ovrigt' : '')
  const merge = mode === 'merge'
  return (
    <Dialog open onClose={onClose} title={merge ? `Slå ihop ”${cat.name}” med…` : `Ta bort ”${cat.name}”?`} width={440}>
      <p className="mb-3.5 mt-2 text-text2">
        {merge
          ? `Alla ${count} transaktioner och ${rules} regler flyttas till kategorin du väljer. ”${cat.name}” tas sedan bort.`
          : `${count} transaktioner och ${rules} regler använder kategorin${!cat.parentId && c.cats.some((k) => k.parentId === cat.id) ? ' och dess underkategorier' : ''}. Välj vart transaktionerna ska flyttas.`}
      </p>
      <Field label={merge ? 'Slå ihop med' : 'Flytta transaktioner till'}>
        <select className="f h-8" value={to} onChange={(e) => setTo(e.target.value)}>
          {merge && <option value="">Välj kategori…</option>}
          {c.cats
            .filter((k) => k.id !== cat.id && k.parentId !== cat.id)
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.parentId ? '   ' : ''}
                {k.name}
              </option>
            ))}
          {!merge && <option value="__none">Okategoriserad (till Att granska)</option>}
        </select>
      </Field>
      <div className="mt-[18px] flex justify-end gap-2">
        <Button onClick={onClose}>Avbryt</Button>
        <Button
          variant={merge ? 'primary' : 'danger'}
          disabled={!to}
          onClick={() => {
            const target = to === '__none' ? null : to
            update((x) => {
              const ids = new Set([cat.id, ...x.categories.filter((k) => k.parentId === cat.id).map((k) => k.id)])
              x.transactions.forEach((t) => {
                if (t.categoryId && ids.has(t.categoryId)) {
                  t.categoryId = target
                  t.source = target ? t.source ?? 'manual' : null
                  if (!target) t.ruleId = undefined
                }
              })
              x.rules = target ? x.rules.map((r) => (ids.has(r.categoryId) ? { ...r, categoryId: target } : r)) : x.rules.filter((r) => !ids.has(r.categoryId))
              Object.keys(x.learned).forEach((k) => {
                if (ids.has(x.learned[k])) {
                  if (target) x.learned[k] = target
                  else delete x.learned[k]
                }
              })
              x.categories = x.categories.filter((k) => !ids.has(k.id))
            }, merge ? 'sammanslagning' : 'borttagning av kategori')
            toastUndo(merge ? `”${cat.name}” slogs ihop med ”${c.name(target)}”` : `”${cat.name}” togs bort · ${count} transaktioner flyttade`)
            onDone(to)
            onClose()
          }}
        >
          {merge ? 'Slå ihop' : 'Flytta och ta bort'}
        </Button>
      </div>
    </Dialog>
  )
}

function NewDialog({ onClose, onCreated, parentHint }: { onClose: () => void; onCreated: (id: string) => void; parentHint: string }) {
  const update = useStore((s) => s.update)
  const c = useCats()
  const [name, setName] = useState('')
  const [parent, setParent] = useState(c.byId.get(parentHint)?.parentId ?? parentHint)
  return (
    <Dialog open onClose={onClose} title="Ny kategori" width={420}>
      <div className="mt-3 flex flex-col gap-3">
        <Field label="Namn">
          <input className="f h-[30px]" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Barn" />
        </Field>
        <Field label="Placering">
          <select className="f h-[30px]" value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Ny huvudkategori</option>
            {c.cats.filter((k) => !k.parentId).map((k) => (
              <option key={k.id} value={k.id}>Under {k.name}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Avbryt</Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => {
              const p = parent ? c.byId.get(parent) : null
              const id = uid('c')
              const used = new Set(c.cats.filter((k) => !k.parentId).map((k) => k.color))
              update((x) => {
                x.categories.push({ id, name: name.trim(), parentId: p?.id ?? null, color: p?.color ?? (PALETTE.findIndex((_, i) => !used.has(i)) + 10) % 10, icon: p?.icon ?? 'dots', type: p?.type ?? 'utgift', excluded: p?.excluded ?? false })
              }, 'ny kategori')
              toastUndo(`Kategorin ”${name.trim()}” skapades`)
              onCreated(id)
              onClose()
            }}
          >
            Skapa
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function RenameDialog({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const update = useStore((s) => s.update)
  const [name, setName] = useState(cat.name)
  const save = () => {
    if (!name.trim() || name === cat.name) return onClose()
    update((x) => void (x.categories.find((k) => k.id === cat.id)!.name = name.trim()), 'namnbyte')
    toastUndo(`Bytte namn till ”${name.trim()}”`)
    onClose()
  }
  return (
    <Dialog open onClose={onClose} title="Byt namn" width={380}>
      <form className="mt-3 flex flex-col gap-3" onSubmit={(e) => (e.preventDefault(), save())}>
        <input className="f h-[30px]" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Nytt namn" />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Avbryt</Button>
          <Button variant="primary" type="submit">Spara</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function RuleEditor({ rule, defaultCat, onClose }: { rule: Rule | null; defaultCat: string; onClose: () => void }) {
  const d = useData()
  const update = useStore((s) => s.update)
  const [kind, setKind] = useState<Rule['kind']>(rule?.kind ?? 'contains')
  const [value, setValue] = useState(rule?.value ?? '')
  const [cat, setCat] = useState(rule?.categoryId ?? defaultCat)
  const [acct, setAcct] = useState(rule?.accountId ?? '')
  return (
    <Dialog open onClose={onClose} title={rule ? 'Ändra regel' : 'Ny regel'} width={460}>
      <div className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-[150px_1fr] gap-2">
          <Field label="Villkor">
            <select className="f h-[30px]" value={kind} onChange={(e) => setKind(e.target.value as Rule['kind'])}>
              <option value="contains">Innehåller</option>
              <option value="startsWith">Börjar med</option>
              <option value="equals">Är exakt</option>
            </select>
          </Field>
          <Field label="Text i beskrivningen">
            <input className="f h-[30px]" autoFocus value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Sätt kategori">
            <CategorySelect value={cat} onChange={setCat} style={{ height: 30 }} />
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
        <div className="flex gap-2">
          {rule && (
            <Button
              className="text-neg"
              onClick={() => {
                update((x) => {
                  x.rules = x.rules.filter((r) => r.id !== rule.id)
                  x.transactions.forEach((t) => {
                    if (t.ruleId === rule.id) t.ruleId = undefined
                  })
                }, 'borttagning av regel')
                toastUndo('Regeln togs bort. Transaktionerna behåller sin kategori.')
                onClose()
              }}
            >
              Ta bort regel
            </Button>
          )}
          <span className="flex-1" />
          <Button onClick={onClose}>Avbryt</Button>
          <Button
            variant="primary"
            disabled={!value.trim() || !cat}
            onClick={() => {
              let n = 0
              update((x) => {
                const r: Rule = { id: rule?.id ?? uid('r'), categoryId: cat, kind, value: value.trim(), accountId: acct || null, createdAt: rule?.createdAt ?? isoDate(new Date()) }
                if (rule) x.rules = x.rules.map((y) => (y.id === rule.id ? r : y))
                else x.rules.unshift(r)
                n = runRule(x, r)
              }, rule ? 'ändrad regel' : 'ny regel')
              toastUndo(`Regel sparad · ${n} transaktioner matchar`)
              onClose()
            }}
          >
            Spara
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
