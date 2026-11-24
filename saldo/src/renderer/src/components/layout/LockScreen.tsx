import { useEffect } from 'react'
import { Button } from '@/components/ui/primitives'
import { Icon } from '@/components/ui/icon'
import { useStore } from '@/store'
import { Logo } from './Sidebar'

export function LockScreen() {
  const unlock = useStore((s) => s.unlock)
  const ask = async () => {
    const ok = window.saldo ? await window.saldo.promptTouchId('låsa upp Saldo') : true
    if (ok) unlock()
  }
  useEffect(() => {
    ask()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="drag flex h-full flex-col items-center justify-center gap-4 bg-bg">
      <Logo size={48} />
      <h1 className="m-0 text-title1 font-semibold">Saldo är låst</h1>
      <p className="m-0 text-text2">Lås upp med Touch ID för att visa din ekonomi.</p>
      <Button variant="primary" onClick={ask} className="h-8">
        <Icon name="fingerprint" /> Lås upp med Touch ID
      </Button>
    </div>
  )
}
