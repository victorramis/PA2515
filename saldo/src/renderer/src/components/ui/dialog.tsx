import * as D from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Modal dialog (shadcn Dialog på Radix). Esc stänger. */
export function Dialog({ open, onClose, title, children, width = 420, className, padded = true, describedBy }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number; className?: string; padded?: boolean; describedBy?: string }) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,.28)' }} />
        <D.Content
          aria-describedby={describedBy}
          className={cn('fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface shadow-dialog outline-none', padded && 'p-5', className)}
          style={{ width }}
        >
          <D.Title className="m-0 text-page font-semibold">{title}</D.Title>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export const DialogClose = D.Close
