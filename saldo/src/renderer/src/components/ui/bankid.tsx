import { useEffect, useMemo, useState } from 'react'
import { rng } from '@/lib/utils'

/** Animerad QR-yta i BankID-stil (byter mönster varje sekund som riktiga BankID-koder). Endast illustration. */
export function BankIdQr({ size = 150 }: { size?: number }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const cells = useMemo(() => {
    const r = rng(7 + tick)
    const finder = (y: number, x: number) => {
      const f = y < 7 && x < 7 ? [0, 0] : y < 7 && x >= 18 ? [0, 18] : y >= 18 && x < 7 ? [18, 0] : null
      if (!f) return null
      const a = y - f[0]
      const b = x - f[1]
      return a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4)
    }
    const out: boolean[] = []
    for (let y = 0; y < 25; y++) for (let x = 0; x < 25; x++) out.push(finder(y, x) ?? r() > 0.52)
    return out
  }, [tick])
  return (
    <div role="img" aria-label="QR-kod för BankID" className="grid flex-none rounded-lg border border-line bg-white p-2" style={{ width: size, height: size, gridTemplateColumns: 'repeat(25, minmax(0, 1fr))' }}>
      {cells.map((on, i) => (
        <span key={i} style={{ background: on ? '#111' : 'transparent' }} />
      ))}
    </div>
  )
}

export function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-text2">
      <span className="spinner" />
      {children}
    </div>
  )
}
