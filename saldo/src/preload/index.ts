import { contextBridge, ipcRenderer } from 'electron'
import type { SaldoBridge } from '../shared/bridge'

const api: SaldoBridge = {
  platform: process.platform,
  loadState: () => ipcRenderer.invoke('state:load'),
  saveState: (json) => ipcRenderer.invoke('state:save', json),
  importKeyFile: () => ipcRenderer.invoke('key:import'),
  openMinPension: () => ipcRenderer.invoke('minpension:open'),
  promptTouchId: (reason) => ipcRenderer.invoke('touchid:prompt', reason),
  saveFile: (name, content) => ipcRenderer.invoke('file:save', name, content),
  pickFile: (ext) => ipcRenderer.invoke('file:pick', ext),
  systemTheme: () => ipcRenderer.invoke('theme:system'),
  onSystemTheme: (cb) => {
    const h = (_e: unknown, t: 'light' | 'dark') => cb(t)
    ipcRenderer.on('theme:changed', h)
    return () => ipcRenderer.removeListener('theme:changed', h)
  }
}

contextBridge.exposeInMainWorld('saldo', api)
