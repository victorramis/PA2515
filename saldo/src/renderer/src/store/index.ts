import { create } from 'zustand'
import { emptyData, seedData } from '@/data/seed'
import { isoDate, monthKey } from '@/lib/format'
import type { AppData } from '@/lib/types'

export type Theme = 'system' | 'light' | 'dark'

interface UndoEntry {
  label: string
  data: AppData
}

interface State {
  ready: boolean
  data: AppData | null // null = första start (Kom igång)
  onboarded: boolean
  theme: Theme
  systemDark: boolean
  hide: boolean
  period: string // ”2026-11”
  locked: boolean
  undoStack: UndoEntry[]
  paletteOpen: boolean
  syncing: string | null // ”Synkar Handelsbanken… 2 av 3 konton”
  lastSync: string
  // actions
  init: () => Promise<void>
  /** Ändrar data. Med label sparas ett ångra-steg. */
  update: (fn: (d: AppData) => void, label?: string) => void
  undo: () => string | null
  setTheme: (t: Theme) => void
  setSystemDark: (v: boolean) => void
  toggleHide: () => void
  setPeriod: (p: string) => void
  setPalette: (v: boolean) => void
  finishOnboarding: (withExample: boolean, patch?: Partial<AppData['settings']>) => void
  resetData: (mode: 'example' | 'empty') => void
  unlock: () => void
  lock: () => void
  sync: () => Promise<void>
}

const LS_KEY = 'saldo-state-v1'
const UI_KEY = 'saldo-ui-v1'

async function loadRaw(): Promise<string | null> {
  try {
    if (window.saldo) return await window.saldo.loadState()
    return localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
function persist(data: AppData | null, onboarded: boolean) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const json = JSON.stringify({ data, onboarded })
    try {
      if (window.saldo) window.saldo.saveState(json)
      else localStorage.setItem(LS_KEY, json)
    } catch {
      /* lagring kan saknas i förhandsvisning */
    }
  }, 250)
}

function persistUi(s: Pick<State, 'theme' | 'period'>) {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ theme: s.theme }))
  } catch {
    /* ignoreras */
  }
}

const clone = <T,>(x: T): T => structuredClone(x)
const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const useStore = create<State>((set, get) => ({
  ready: false,
  data: null,
  onboarded: false,
  theme: 'system',
  systemDark: false,
  hide: false,
  period: monthKey(isoDate(new Date())),
  locked: false,
  undoStack: [],
  paletteOpen: false,
  syncing: null,
  lastSync: '06:42',

  init: async () => {
    let theme: Theme = 'system'
    try {
      const ui = JSON.parse(localStorage.getItem(UI_KEY) || '{}')
      if (ui.theme) theme = ui.theme
    } catch {
      /* ignoreras */
    }
    const raw = await loadRaw()
    let data: AppData | null = null
    let onboarded = false
    if (raw) {
      try {
        const p = JSON.parse(raw)
        data = p.data
        onboarded = !!p.onboarded
      } catch {
        /* trasig fil: börja om */
      }
    }
    const params = new URLSearchParams(location.search)
    if (params.has('demo') && !data) {
      data = seedData()
      onboarded = true
    }
    const systemDark = window.saldo ? (await window.saldo.systemTheme()) === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    const lastTx = data?.transactions.reduce((m, t) => (t.date > m ? t.date : m), '')
    set({
      ready: true,
      data,
      onboarded,
      theme,
      systemDark,
      hide: !!data?.settings.hideOnStart,
      locked: !!data?.settings.touchId && !!window.saldo && onboarded,
      period: monthKey(lastTx && lastTx > isoDate(new Date()) ? lastTx : isoDate(new Date())),
      lastSync: data?.accounts.find((a) => a.kind === 'bank')?.updatedAt.slice(11, 16) ?? nowTime()
    })
  },

  update: (fn, label) => {
    const cur = get().data
    if (!cur) return
    const next = clone(cur)
    fn(next)
    const undoStack = label ? [...get().undoStack.slice(-29), { label, data: cur }] : get().undoStack
    set({ data: next, undoStack })
    persist(next, get().onboarded)
  },

  undo: () => {
    const st = get().undoStack
    const last = st[st.length - 1]
    if (!last) return null
    set({ data: last.data, undoStack: st.slice(0, -1) })
    persist(last.data, get().onboarded)
    return last.label
  },

  setTheme: (theme) => {
    set({ theme })
    persistUi({ theme, period: get().period })
  },
  setSystemDark: (systemDark) => set({ systemDark }),
  toggleHide: () => set({ hide: !get().hide }),
  setPeriod: (period) => set({ period }),
  setPalette: (paletteOpen) => set({ paletteOpen }),

  finishOnboarding: (withExample, patch) => {
    const base = withExample ? seedData() : emptyData(isoDate(new Date()))
    if (patch) base.settings = { ...base.settings, ...patch }
    set({ data: base, onboarded: true, undoStack: [] })
    persist(base, true)
  },

  resetData: (mode) => {
    const cur = get().data
    const base = mode === 'example' ? seedData() : emptyData(isoDate(new Date()))
    if (cur) base.settings = { ...cur.settings, key: mode === 'example' ? base.settings.key : cur.settings.key }
    set({ data: base, undoStack: [] })
    persist(base, true)
  },

  unlock: () => set({ locked: false }),
  lock: () => set({ locked: true }),

  sync: async () => {
    const d = get().data
    if (!d || get().syncing) return
    const banks = d.accounts.filter((a) => a.kind === 'bank' && (!a.consentUntil || a.consentUntil >= isoDate(new Date())))
    for (let i = 0; i < banks.length; i++) {
      set({ syncing: `Synkar ${banks[i].bank}… ${i + 1} av ${banks.length} konton` })
      await new Promise((r) => setTimeout(r, 450))
    }
    const t = nowTime()
    get().update((x) => {
      x.accounts.forEach((a) => {
        if (banks.some((b) => b.id === a.id)) a.updatedAt = `${isoDate(new Date())}T${t}`
      })
    })
    set({ syncing: null, lastSync: t })
  }
}))

export const useData = () => useStore((s) => s.data!)
export const isDark = (s: Pick<State, 'theme' | 'systemDark'>) => s.theme === 'dark' || (s.theme === 'system' && s.systemDark)
