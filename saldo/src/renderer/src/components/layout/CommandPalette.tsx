import { Command } from 'cmdk'
import * as D from '@radix-ui/react-dialog'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui/icon'
import { CategoryChip } from '@/components/ui/category-chip'
import { useMoney } from '@/lib/hooks'
import { useStore } from '@/store'

export function CommandPalette() {
  const open = useStore((s) => s.paletteOpen)
  const setOpen = useStore((s) => s.setPalette)
  const data = useStore((s) => s.data)
  const toggleHide = useStore((s) => s.toggleHide)
  const sync = useStore((s) => s.sync)
  const nav = useNavigate()
  const { kr } = useMoney()
  const [q, setQ] = useState('')
  const go = (to: string) => {
    setOpen(false)
    setQ('')
    nav(to)
  }
  const cmds: { label: string; key: string; run: () => void }[] = [
    { label: 'Gå till Översikt', key: 'G Ö', run: () => go('/') },
    { label: 'Gå till Transaktioner', key: 'G T', run: () => go('/transaktioner') },
    { label: 'Granska okategoriserade', key: 'G G', run: () => go('/granska') },
    { label: 'Importera fil…', key: '⌘I', run: () => go('/import') },
    { label: 'Hämta från minPension', key: '', run: () => go('/pension/hamta') },
    { label: 'Planera pension', key: 'G P', run: () => go('/pension/planera') },
    { label: 'Ny kategori', key: '⌘⇧N', run: () => go('/kategorier?ny=1') },
    { label: 'Förnya bankkoppling', key: '', run: () => go('/konton') },
    { label: 'Synka banker nu', key: '', run: () => (setOpen(false), sync()) },
    { label: 'Dölj eller visa belopp', key: '⌘⇧H', run: () => (setOpen(false), toggleHide()) },
    { label: 'Inställningar', key: '⌘,', run: () => go('/installningar') }
  ]
  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2 || !data) return []
    const num = s.replace(/[\s ]/g, '').replace(',', '.')
    return data.transactions
      .filter((t) => t.description.toLowerCase().includes(s) || (/^\d/.test(num) && Math.abs(t.amount).toFixed(2).startsWith(num)))
      .slice(0, 6)
  }, [q, data])
  return (
    <D.Root open={open} onOpenChange={(o) => (setOpen(o), o || setQ(''))}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,.12)' }} />
        <D.Content aria-describedby={undefined} className="fixed left-1/2 top-[84px] z-50 w-[520px] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface shadow-palette outline-none">
          <D.Title className="sr-only">Kommandopalett</D.Title>
          <Command label="Kommandopalett" shouldFilter={true} loop>
            <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <Icon name="search" size={15} stroke={2} />
              <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Skriv ett kommando, en handlare eller ett belopp" className="flex-1 border-0 bg-transparent text-[14px] text-text outline-none" />
              <kbd>esc</kbd>
            </div>
            <Command.List className="max-h-[380px] overflow-auto p-1.5">
              <Command.Empty className="px-2 py-3 text-text2">Inget hittades.</Command.Empty>
              {hits.length > 0 && (
                <Command.Group heading="Transaktioner" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-text3">
                  {hits.map((t) => (
                    <Command.Item key={t.id} value={`tx ${t.id} ${t.description} ${q}`} onSelect={() => go(`/transaktioner?q=${encodeURIComponent(t.description)}&tx=${t.id}`)} className="flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 data-[selected=true]:bg-accent-soft">
                      <span className="num w-[84px] text-text2">{t.date}</span>
                      <span className="flex-1 truncate">{t.description}</span>
                      <CategoryChip tx={t} />
                      <span className="num w-[110px] text-right font-medium">{kr(t.amount, { decimals: 2, sign: true })}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              <Command.Group heading="Kommandon" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-text3">
                {cmds.map((c) => (
                  <Command.Item key={c.label} value={c.label} onSelect={c.run} className="flex h-8 cursor-pointer items-center justify-between rounded-md px-2 data-[selected=true]:bg-accent-soft">
                    <span>{c.label}</span>
                    <span className="text-small text-text3">{c.key}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}
