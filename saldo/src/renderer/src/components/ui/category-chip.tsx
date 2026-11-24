import { SOURCE_LABEL, SOURCE_TITLE } from '@/lib/categorize'
import { useCats } from '@/lib/hooks'
import type { Transaction } from '@/lib/types'

/** Kategorichip med markör för hur kategorin satts: M, R, I, AI. Okategoriserad har streckad kant. */
export function CategoryChip({ tx }: { tx: Pick<Transaction, 'categoryId' | 'source' | 'aiConfidence'> }) {
  const c = useCats()
  const uncat = !tx.categoryId
  const src = tx.source ? SOURCE_LABEL[tx.source] : '?'
  const title = tx.source ? SOURCE_TITLE[tx.source] + (tx.source === 'ai' && tx.aiConfidence ? ` · ${tx.aiConfidence} %` : '') : 'Ej kategoriserad'
  return (
    <span className="chip" style={{ borderStyle: uncat ? 'dashed' : 'solid' }}>
      <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ background: c.hex(tx.categoryId) }} />
      {c.name(tx.categoryId)}
      <span className="src" title={title}>
        {src}
      </span>
    </span>
  )
}

export function CatSwatch({ id, size = 8 }: { id: string | null; size?: number }) {
  const c = useCats()
  return <span aria-hidden="true" className="inline-block flex-none rounded-sm" style={{ width: size, height: size, background: c.hex(id) }} />
}
