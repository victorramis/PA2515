import { useEffect } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { LockScreen } from '@/components/layout/LockScreen'
import { Sidebar } from '@/components/layout/Sidebar'
import { toastOk } from '@/components/ui/toast'
import { isDark, useStore } from '@/store'
import { Oversikt } from '@/pages/Oversikt'
import { Transaktioner } from '@/pages/Transaktioner'
import { AttGranska } from '@/pages/AttGranska'
import { Analys } from '@/pages/Analys'
import { Kategorier } from '@/pages/Kategorier'
import { Konton } from '@/pages/Konton'
import { Import } from '@/pages/Import'
import { PensionOversikt } from '@/pages/PensionOversikt'
import { PensionPlanera } from '@/pages/PensionPlanera'
import { MinPension } from '@/pages/MinPension'
import { KomIgang } from '@/pages/KomIgang'
import { Installningar } from '@/pages/Installningar'

const IDLE: Record<string, number> = { '5 minuter': 5, '15 minuter': 15, '1 timme': 60 }

function Shell() {
  const nav = useNavigate()
  const { setPalette, toggleHide, undo } = useStore()
  const touchId = useStore((s) => s.data?.settings.touchId)
  const lockAfter = useStore((s) => s.data?.settings.lockAfter ?? '5 minuter')
  const lock = useStore((s) => s.lock)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
      if (!e.metaKey && !e.ctrlKey) return
      const k = e.key.toLowerCase()
      if (k === 'k') {
        e.preventDefault()
        setPalette(true)
      } else if (k === 'i') {
        e.preventDefault()
        nav('/import')
      } else if (k === ',') {
        e.preventDefault()
        nav('/installningar')
      } else if (k === 'h' && e.shiftKey) {
        e.preventDefault()
        toggleHide()
      } else if (k === 'z' && !e.shiftKey && !typing) {
        e.preventDefault()
        const l = undo()
        if (l) toastOk(`Ångrade: ${l}`)
      } else if (k === 'n' && e.shiftKey) {
        e.preventDefault()
        nav('/kategorier?ny=1')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nav, setPalette, toggleHide, undo])

  // Lås efter inaktivitet (bara i Electron med Touch ID påslaget).
  useEffect(() => {
    if (!touchId || !window.saldo) return
    let t: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(lock, (IDLE[lockAfter] ?? 5) * 60000)
    }
    const ev = ['mousemove', 'keydown', 'mousedown', 'wheel']
    ev.forEach((x) => window.addEventListener(x, reset))
    reset()
    return () => {
      clearTimeout(t)
      ev.forEach((x) => window.removeEventListener(x, reset))
    }
  }, [touchId, lockAfter, lock])

  return (
    <div className="flex h-full min-w-[1200px] overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
      <CommandPalette />
    </div>
  )
}

export function App() {
  const { ready, data, onboarded, locked, init, setSystemDark } = useStore()
  const dark = useStore(isDark)

  useEffect(() => {
    init()
    if (window.saldo) return window.saldo.onSystemTheme((t) => setSystemDark(t === 'dark'))
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const h = () => setSystemDark(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [init, setSystemDark])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  if (!ready) return null
  return (
    <HashRouter>
      <Toaster position="bottom-center" theme={dark ? 'dark' : 'light'} toastOptions={{ style: { background: 'var(--toast)', color: 'var(--toastText)', border: 0, fontSize: 13 } }} />
      {locked ? (
        <LockScreen />
      ) : !data || !onboarded ? (
        <KomIgang />
      ) : (
        <Routes>
          <Route element={<Shell />}>
            <Route path="/" element={<Oversikt />} />
            <Route path="/transaktioner" element={<Transaktioner />} />
            <Route path="/granska" element={<AttGranska />} />
            <Route path="/analys" element={<Analys />} />
            <Route path="/kategorier" element={<Kategorier />} />
            <Route path="/konton" element={<Konton />} />
            <Route path="/import" element={<Import />} />
            <Route path="/pension" element={<PensionOversikt />} />
            <Route path="/pension/planera" element={<PensionPlanera />} />
            <Route path="/pension/hamta" element={<MinPension />} />
            <Route path="/installningar" element={<Installningar />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </HashRouter>
  )
}
