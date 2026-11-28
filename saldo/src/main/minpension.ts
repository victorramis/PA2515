import { BrowserWindow, dialog, ipcMain, session, shell, type WebContents } from 'electron'
import { writeFileSync } from 'node:fs'
import { buildResult, extractPage, type CapturedJson, type PageSnapshot, type ReadResult } from '../shared/minpension'

/**
 * minPension-fönstret. Användaren loggar in själv med BankID; Saldo ser aldrig inloggningen.
 * - Tillfällig, icke-persistent session som rensas när fönstret stängs.
 * - JSON-svar från *.minpension.se fångas (bara i minnet) så att värdena kan läsas exakt.
 * - Inget sparas förrän användaren har granskat och tryckt Spara i appen.
 */

// SALDO_MINPENSION_URL används bara för test mot en lokal kopia av sidan.
const START_URL = process.env.SALDO_MINPENSION_URL || 'https://www.minpension.se/'
const MAX_BODIES = 300
const MAX_BODY = 3_000_000

let win: BrowserWindow | null = null
let captured: CapturedJson[] = []
let lastPage: PageSnapshot | null = null

const isMinPension = (url: string) => {
  try {
    return /(^|\.)minpension\.se$/i.test(new URL(url).hostname)
  } catch {
    return false
  }
}

function send(owner: WebContents | null, event: string, payload?: unknown) {
  if (owner && !owner.isDestroyed()) owner.send('minpension:event', event, payload)
}

function captureJson(wc: WebContents) {
  const dbg = wc.debugger
  try {
    dbg.attach('1.3')
  } catch {
    return // redan kopplad eller DevTools öppet: avläsningen faller tillbaka på sidans text
  }
  dbg.sendCommand('Network.enable', { maxResourceBufferSize: MAX_BODY, maxTotalBufferSize: MAX_BODY * 20 }).catch(() => undefined)
  const pending = new Map<string, string>()
  dbg.on('message', async (_e, method, params) => {
    if (method === 'Network.responseReceived') {
      const r = params.response
      if (isMinPension(r.url) && /json/i.test(r.mimeType ?? '') && r.status < 400) pending.set(params.requestId, r.url)
    } else if (method === 'Network.loadingFinished' && pending.has(params.requestId)) {
      const url = pending.get(params.requestId)!
      pending.delete(params.requestId)
      try {
        const res = await dbg.sendCommand('Network.getResponseBody', { requestId: params.requestId })
        const text = res.base64Encoded ? Buffer.from(res.body, 'base64').toString('utf8') : res.body
        if (text.length > MAX_BODY) return
        const body = JSON.parse(text)
        captured.push({ url, body })
        if (captured.length > MAX_BODIES) captured.shift()
      } catch {
        /* inte JSON eller redan borta */
      }
    }
  })
}

async function readPage(): Promise<PageSnapshot | null> {
  if (!win || win.isDestroyed()) return null
  // Läs alla ramar, inte bara huvudsidan (inloggade vyer kan ligga i iframes).
  const frames = win.webContents.mainFrame.framesInSubtree.filter((f) => isMinPension(f.url))
  const code = `(${extractPage.toString()})()`
  const snaps: PageSnapshot[] = []
  for (const f of frames.length ? frames : [win.webContents.mainFrame]) {
    try {
      snaps.push((await f.executeJavaScript(code)) as PageSnapshot)
    } catch {
      /* ram utan åtkomst */
    }
  }
  if (!snaps.length) return null
  return {
    url: snaps[0].url,
    title: snaps[0].title,
    blocks: snaps.flatMap((s) => s.blocks),
    text: snaps.map((s) => s.text).join('\n')
  }
}

function close() {
  if (win && !win.isDestroyed()) win.close()
}

export function registerMinPension(getMain: () => BrowserWindow | null) {
  ipcMain.handle('minpension:open', async (e) => {
    const owner = e.sender
    if (win && !win.isDestroyed()) {
      win.focus()
      return
    }
    captured = []
    lastPage = null
    const part = session.fromPartition(`minpension-${Date.now()}`, { cache: false })
    win = new BrowserWindow({
      width: 1180,
      height: 860,
      minWidth: 900,
      minHeight: 640,
      parent: getMain() ?? undefined,
      title: 'minPension – logga in',
      webPreferences: { session: part, contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    const wc = win.webContents
    // BankID på samma dator: bankid:// öppnas i BankID-appen.
    const external = (url: string) => {
      if (/^bankid:/i.test(url)) {
        shell.openExternal(url)
        return true
      }
      return false
    }
    wc.setWindowOpenHandler(({ url }) => {
      if (external(url)) return { action: 'deny' }
      if (isMinPension(url)) {
        wc.loadURL(url)
        return { action: 'deny' }
      }
      shell.openExternal(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (ev, url) => {
      if (external(url)) ev.preventDefault()
    })
    wc.on('did-navigate', (_ev, url) => send(owner, 'navigated', url))
    wc.on('did-navigate-in-page', (_ev, url) => send(owner, 'navigated', url))
    win.on('closed', () => {
      win = null
      captured = []
      part.clearStorageData().catch(() => undefined)
      part.clearCache().catch(() => undefined)
      send(owner, 'closed')
    })
    // Inloggningssidan laddas i bakgrunden; fel visas i själva fönstret.
    win.loadURL(START_URL).catch(() => undefined)
    wc.once('did-start-loading', () => captureJson(wc))
  })

  ipcMain.handle('minpension:read', async (): Promise<ReadResult | { error: string }> => {
    if (!win || win.isDestroyed()) return { error: 'minPension-fönstret är stängt. Öppna det igen och logga in.' }
    // Låt sidan bli klar (SPA:er laddar värden efter navigering).
    await new Promise((r) => setTimeout(r, 600))
    lastPage = await readPage()
    return buildResult(lastPage, captured)
  })

  ipcMain.handle('minpension:close', () => close())

  /** Sparar det som lästes, så att tolkningen kan anpassas om minPension ändrar sin sida. Innehåller personuppgifter. */
  ipcMain.handle('minpension:debug', async () => {
    const page = lastPage ?? (await readPage())
    const r = await dialog.showSaveDialog(getMain()!, {
      title: 'Spara felsökningsfil (innehåller dina pensionsuppgifter)',
      defaultPath: `minpension-avlasning-${new Date().toISOString().slice(0, 10)}.json`
    })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, JSON.stringify({ savedAt: new Date().toISOString(), page, json: captured, result: buildResult(page, captured) }, null, 2), 'utf8')
    return r.filePath
  })
}
