import { app, BrowserWindow, dialog, ipcMain, nativeTheme, safeStorage, session, shell, systemPreferences } from 'electron'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, basename } from 'node:path'

const isMac = process.platform === 'darwin'
const dataDir = () => app.getPath('userData')
const dataFile = () => join(dataDir(), 'saldo-data.bin')
const keyFile = () => join(dataDir(), 'enable-banking-key.bin')

function encrypt(text: string): Buffer {
  if (safeStorage.isEncryptionAvailable()) return Buffer.concat([Buffer.from('ENC1'), safeStorage.encryptString(text)])
  return Buffer.from(text, 'utf8')
}
function decrypt(buf: Buffer): string {
  if (buf.subarray(0, 4).toString() === 'ENC1') return safeStorage.decryptString(buf.subarray(4))
  return buf.toString('utf8')
}

let main: BrowserWindow | null = null

function createWindow(): void {
  main = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    title: 'Saldo',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 20 },
    vibrancy: isMac ? 'sidebar' : undefined,
    visualEffectState: 'followWindow',
    backgroundColor: isMac ? '#00000000' : nativeTheme.shouldUseDarkColors ? '#15171A' : '#F4F5F6',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false
    }
  })
  main.on('ready-to-show', () => main?.show())
  main.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env.ELECTRON_RENDERER_URL) main.loadURL(process.env.ELECTRON_RENDERER_URL)
  else main.loadFile(join(__dirname, '../renderer/index.html'))
}

ipcMain.handle('state:load', () => {
  if (!existsSync(dataFile())) return null
  try {
    return decrypt(readFileSync(dataFile()))
  } catch {
    return null
  }
})

ipcMain.handle('state:save', (_e, json: string) => {
  mkdirSync(dataDir(), { recursive: true })
  writeFileSync(dataFile(), encrypt(json))
})

ipcMain.handle('key:import', async () => {
  const r = await dialog.showOpenDialog(main!, {
    title: 'Importera Enable Banking-nyckel',
    filters: [{ name: 'Privat nyckel', extensions: ['pem', 'key'] }],
    properties: ['openFile']
  })
  if (r.canceled || !r.filePaths[0]) return null
  const pem = readFileSync(r.filePaths[0], 'utf8')
  if (!pem.includes('PRIVATE KEY')) throw new Error('Filen innehåller ingen privat nyckel.')
  // Nyckeln lagras krypterad och lämnar aldrig main-processen. JWT för Enable Banking signeras här.
  writeFileSync(keyFile(), encrypt(pem))
  return { fileName: basename(r.filePaths[0]), importedAt: new Date().toISOString().slice(0, 10) }
})

ipcMain.handle('minpension:open', () => {
  return new Promise<'closed'>((resolve) => {
    // Tillfällig partition: inga cookies eller sessioner sparas efter hämtningen.
    const part = session.fromPartition(`minpension-${Date.now()}`, { cache: false })
    const win = new BrowserWindow({
      width: 1100,
      height: 780,
      parent: main ?? undefined,
      title: 'minPension',
      webPreferences: { session: part, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    win.loadURL('https://www.minpension.se/')
    win.on('closed', () => {
      part.clearStorageData().finally(() => resolve('closed'))
    })
  })
})

ipcMain.handle('touchid:prompt', async (_e, reason: string) => {
  if (!isMac || !systemPreferences.canPromptTouchID()) return true
  try {
    await systemPreferences.promptTouchID(reason)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('file:save', async (_e, defaultName: string, content: string) => {
  const r = await dialog.showSaveDialog(main!, { defaultPath: defaultName })
  if (r.canceled || !r.filePath) return null
  writeFileSync(r.filePath, content, 'utf8')
  return r.filePath
})

ipcMain.handle('file:pick', async (_e, extensions: string[]) => {
  const r = await dialog.showOpenDialog(main!, { filters: [{ name: 'Filer', extensions }], properties: ['openFile'] })
  if (r.canceled || !r.filePaths[0]) return null
  const buf = readFileSync(r.filePaths[0])
  return { name: basename(r.filePaths[0]), data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) }
})

ipcMain.handle('theme:system', () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'))
nativeTheme.on('updated', () => {
  main?.webContents.send('theme:changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
})

app.whenReady().then(() => {
  app.setName('Saldo')
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})
