import { Icon } from '@/components/ui/icon'
import { cap, monthLabel, shiftMonth, isoDate, monthKey } from '@/lib/format'
import { isDark, useStore } from '@/store'

export function Topbar({ title, showPeriod = false }: { title: string; showPeriod?: boolean }) {
  const { period, setPeriod, hide, toggleHide, setPalette, syncing, lastSync, sync, setTheme } = useStore()
  const dark = useStore(isDark)
  const max = monthKey(isoDate(new Date()))
  const hasBank = useStore((s) => s.data?.accounts.some((a) => a.kind === 'bank'))
  const expired = useStore((s) => s.data?.accounts.some((a) => a.kind === 'bank' && a.consentUntil && a.consentUntil < isoDate(new Date())))
  return (
    <header className="drag relative flex h-[52px] flex-none items-center gap-2.5 border-b border-line bg-surface pl-6 pr-5">
      <h1 className="m-0 whitespace-nowrap text-page font-[650]">{title}</h1>
      {showPeriod && (
        <div role="group" aria-label="Period" className="ml-3.5 flex h-7 items-center overflow-hidden rounded-md border border-line">
          <button type="button" aria-label="Föregående period" onClick={() => setPeriod(shiftMonth(period, -1))} className="h-7 w-7 cursor-pointer border-0 bg-transparent text-text2 hover:bg-surface2">
            ‹
          </button>
          <span className="num min-w-[112px] whitespace-nowrap px-2.5 text-center font-medium">{cap(monthLabel(period))}</span>
          <button type="button" aria-label="Nästa period" disabled={period >= max} onClick={() => setPeriod(shiftMonth(period, 1))} className="h-7 w-7 cursor-pointer border-0 bg-transparent text-text2 hover:bg-surface2 disabled:opacity-40">
            ›
          </button>
        </div>
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setPalette(true)}
        aria-haspopup="dialog"
        className="flex h-7 w-[280px] cursor-pointer items-center gap-2 rounded-md border border-line bg-surface2 px-2 text-[13px] text-text3"
      >
        <Icon name="search" size={14} stroke={2} />
        <span className="flex-1 text-left">Sök eller kör kommando</span>
        <kbd>⌘K</kbd>
      </button>
      {hasBank && (
        <button type="button" onClick={() => sync()} title="Synka nu" className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-0 bg-transparent px-1.5 text-label text-text2">
          {syncing ? <span className="spinner" style={{ width: 10, height: 10 }} /> : <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: expired ? 'var(--warn)' : 'var(--pos)' }} />}
          <span className="num">{syncing ? 'Synkar…' : `Synkat ${lastSync}`}</span>
        </button>
      )}
      <button type="button" onClick={toggleHide} aria-pressed={hide} className="btn px-2.5">
        <Icon name={hide ? 'eyeOff' : 'eye'} size={15} stroke={1.8} />
        {hide ? 'Visa belopp' : 'Dölj belopp'}
      </button>
      <button type="button" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Byt till ljust läge' : 'Byt till mörkt läge'} title={dark ? 'Byt till ljust läge' : 'Byt till mörkt läge'} className="btn w-7 justify-center p-0">
        <Icon name={dark ? 'sun' : 'moon'} size={15} stroke={1.8} />
      </button>
    </header>
  )
}
