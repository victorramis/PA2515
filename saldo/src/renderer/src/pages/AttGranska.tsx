import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Topbar } from '@/components/layout/Topbar'
import { Button, SuccessMark } from '@/components/ui/primitives'
import { toastUndo } from '@/components/ui/toast'
import { learn, setManual } from '@/lib/actions'
import { aiSuggest, needsReview, normalizeMerchant, UNCERTAIN_BELOW } from '@/lib/categorize'
import { useCats, useMoney } from '@/lib/hooks'
import type { Transaction } from '@/lib/types'
import { useData, useStore } from '@/store'

const QUICK = ['liv', 'rest', 'drv', 'sl', 'str', 'evt', 'apo', 'trn', 'resor', 'hem', 'klader', 'bil', 'ovrigt']

type View = 'alla' | 'okat' | 'osakra'

export function AttGranska() {
  const d = useData()
  const update = useStore((s) => s.update)
  const { kr } = useMoney()
  const c = useCats()
  const [view, setView] = useState<View>('alla')
  const [curId, setCurId] = useState<string | null>(null)
  const [remember, setRemember] = useState(true)
  const [done, setDone] = useState(0)
  const mainRef = useRef<HTMLElement>(null)

  const all = useMemo(() => d.transactions.filter(needsReview).sort((a, b) => (a.date < b.date ? 1 : -1)), [d.transactions])
  const queue = all.filter((t) => (view === 'okat' ? !t.categoryId : view === 'osakra' ? t.source === 'ai' || (topPct(t) < UNCERTAIN_BELOW) : true))
  const cur = queue.find((t) => t.id === curId) ?? queue[0] ?? null
  const idx = cur ? queue.indexOf(cur) : -1
  const total = done + all.length

  useEffect(() => {
    mainRef.current?.focus()
  }, [cur?.id])

  const sugg = cur ? (cur.suggestions?.length ? cur.suggestions : aiSuggest(cur)) : []
  const rest = QUICK.filter((id) => !sugg.some((s) => s.categoryId === id) && c.byId.has(id)).slice(0, 6)
  const options = [...sugg.map((s) => s.categoryId), ...rest]

  const finish = (t: Transaction, catId: string) => {
    const next = queue[idx + 1] ?? queue[idx - 1] ?? null
    update((x) => {
      setManual(x, [t.id], catId)
      if (remember && x.settings.learn) learn(x, t, catId)
    }, 'granskning')
    setDone((n) => n + 1)
    setCurId(next?.id ?? null)
    toastUndo(`”${t.description}” → ${c.name(catId)}${remember ? ' · sparad för handlaren' : ''}`)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (!cur) return
    const k = e.key
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (/^[1-9]$/.test(k)) {
      const id = options[Number(k) - 1]
      if (id) {
        e.preventDefault()
        finish(cur, id)
      }
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
      const n = queue[idx + 1]
      if (n) {
        e.preventDefault()
        setCurId(n.id)
      }
    } else if (k === 'ArrowUp') {
      const n = queue[idx - 1]
      if (n) {
        e.preventDefault()
        setCurId(n.id)
      }
    } else if (k === 'ö' || k === 'Ö') {
      e.preventDefault()
      finish(cur, 'egna')
    }
  }

  const acctName = (id: string) => d.accounts.find((a) => a.id === id)?.name ?? ''
  const similarCount = cur ? d.transactions.filter((t) => t.id !== cur.id && normalizeMerchant(t.description) === normalizeMerchant(cur.description)).length : 0

  return (
    <>
      <Topbar title="Att granska" />
      <div className="flex min-h-0 flex-1">
        <aside aria-label="Kö" className="flex w-[330px] flex-none flex-col border-r border-line bg-surface">
          <div className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
            <strong className="num flex-1 text-[13px] font-semibold">{all.length} kvar i kön</strong>
            <select className="f" aria-label="Visa" value={view} onChange={(e) => setView(e.target.value as View)}>
              <option value="alla">Alla</option>
              <option value="okat">Okategoriserade</option>
              <option value="osakra">Osäkra (under 70 %)</option>
            </select>
          </div>
          <div aria-hidden="true" className="mx-4 mb-2.5 h-1 rounded-sm bg-surface2">
            <div className="h-1 rounded-sm bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 100}%` }} />
          </div>
          <div className="flex flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2">
            {queue.map((t) => {
              const p = topPct(t)
              const on = cur?.id === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCurId(t.id)}
                  aria-current={on ? 'true' : undefined}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border-0 px-3 py-[9px] text-left text-text"
                  style={{ background: on ? 'var(--accentSoft)' : 'transparent' }}
                >
                  <span className="min-w-0 flex-1 leading-[1.3]">
                    <span className="block truncate font-medium">{t.description}</span>
                    <span className="num block text-small text-text3">
                      {t.date} · {acctName(t.accountId).replace(/^American Express.*/, 'Amex').replace(/^Handelsbanken /, '')}
                    </span>
                  </span>
                  <span className="text-right leading-[1.3]">
                    <span className="num block font-medium">{kr(t.amount, { decimals: 2, sign: true })}</span>
                    <span className="block text-[11px]" style={{ color: p < UNCERTAIN_BELOW ? 'var(--warn)' : 'var(--text3)' }}>
                      {p < UNCERTAIN_BELOW ? 'Osäker' : 'Förslag'} · {p} %
                    </span>
                  </span>
                </button>
              )
            })}
            {!queue.length && <div className="px-3 py-6 text-center text-[12.5px] text-text2">Allt är granskat.</div>}
          </div>
        </aside>
        <main ref={mainRef} tabIndex={0} onKeyDown={onKey} aria-label="Granska transaktion, använd tangenterna 1 till 9" className="min-w-0 flex-1 overflow-auto px-10 py-7 outline-none">
          {cur ? (
            <div className="mx-auto flex max-w-[760px] flex-col gap-4">
              <div className="card px-6 py-[22px]">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="num text-label text-text2">
                      {cur.date} · {acctName(cur.accountId)}
                    </div>
                    <div className="mt-1 text-[20px] font-semibold">{cur.description}</div>
                    <div className="mt-1 font-mono text-small text-text3">{cur.raw}</div>
                  </div>
                  <div className="num text-[24px] font-semibold">{kr(cur.amount, { decimals: 2, sign: true })}</div>
                </div>
                <div className="mt-3.5 border-t border-line pt-3 text-label text-text2">
                  {cur.context ?? (similarCount ? `${similarCount} tidigare transaktioner från samma handlare.` : 'Ingen tidigare transaktion från den här handlaren.')}
                  {cur.source === 'ai' && ` Nu satt som ”${c.name(cur.categoryId)}” med ${cur.aiConfidence} % säkerhet.`}
                </div>
              </div>
              <section aria-label="Förslag">
                <h2 className="mb-2 mt-0 text-label font-semibold text-text2">Förslag</h2>
                <div className="grid grid-cols-3 gap-2.5">
                  {sugg.map((g, i) => (
                    <button
                      key={g.categoryId}
                      type="button"
                      onClick={() => finish(cur, g.categoryId)}
                      className="flex cursor-pointer flex-col gap-2 rounded-xl border px-3.5 py-3 text-left text-text"
                      style={{ background: i === 0 ? 'var(--accentSoft)' : 'var(--surface)', borderColor: i === 0 ? 'var(--accent)' : 'var(--line)' }}
                    >
                      <span className="flex items-center gap-2">
                        <kbd>{i + 1}</kbd>
                        <span className="h-2 w-2 rounded-sm" style={{ background: c.hex(g.categoryId) }} />
                        <span className="flex-1 font-semibold">{c.name(g.categoryId)}</span>
                        <span className="num text-label text-text2">{g.pct} %</span>
                      </span>
                      <span aria-hidden="true" className="h-1 rounded-sm bg-surface2">
                        <span className="block h-1 rounded-sm bg-accent" style={{ width: `${g.pct}%` }} />
                      </span>
                      <span className="min-h-[15px] text-small text-text3">{g.why || ' '}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section aria-label="Alla kategorier">
                <h2 className="mb-2 mt-0 text-label font-semibold text-text2">Eller välj kategori</h2>
                <div className="grid grid-cols-3 gap-2">
                  {rest.map((id, i) => (
                    <Button key={id} onClick={() => finish(cur, id)} className="h-9 justify-start gap-2.5">
                      <kbd>{i + 4}</kbd>
                      <span className="h-2 w-2 rounded-sm" style={{ background: c.hex(id) }} />
                      {c.name(id)}
                    </Button>
                  ))}
                </div>
              </section>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-[12.5px]">
                  <input type="checkbox" checked={remember} onChange={() => setRemember(!remember)} /> Kom ihåg för ”{cur.description.replace(/\s+\d[\d\s]*$/, '')}” framöver
                </label>
                <span className="flex-1" />
                <Button onClick={() => queue[idx + 1] && setCurId(queue[idx + 1].id)}>
                  Hoppa över <kbd>S</kbd>
                </Button>
                <Button onClick={() => finish(cur, 'egna')}>
                  Överföring <kbd>Ö</kbd>
                </Button>
              </div>
              <div className="text-small text-text3">
                Tangenter: <kbd>1</kbd>–<kbd>9</kbd> väljer kategori · <kbd>↑</kbd> <kbd>↓</kbd> byter transaktion · <kbd>⌘Z</kbd> ångrar
              </div>
            </div>
          ) : (
            <div className="mx-auto mt-[120px] max-w-[420px] text-center">
              <SuccessMark size={48} />
              <h2 className="mb-1.5 mt-3.5 text-title2 font-semibold">Kön är tom</h2>
              <p className="mb-4 mt-0 text-text2">Alla transaktioner har en kategori. Nya som appen är osäker på hamnar här.</p>
              <Link className="btn" to="/">
                Till översikten
              </Link>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

function topPct(t: Transaction): number {
  if (t.source === 'ai' && t.aiConfidence != null) return t.aiConfidence
  return t.suggestions?.[0]?.pct ?? aiSuggest(t)[0].pct
}
