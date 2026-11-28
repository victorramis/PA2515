/** Kontraktet mellan main-processen och gränssnittet (window.saldo). */
import type { ReadResult } from './minpension'

export interface PickedFile {
  name: string
  data: ArrayBuffer
}

export interface KeyFileInfo {
  fileName: string
  importedAt: string
}

export interface SaldoBridge {
  platform: string
  /** Läser sparad appdata (krypterad med safeStorage när det finns). */
  loadState(): Promise<string | null>
  saveState(json: string): Promise<void>
  /** Väljer och lagrar Enable Banking-nyckeln (.pem) i nyckelringen. */
  importKeyFile(): Promise<KeyFileInfo | null>
  /** Öppnar minPension i ett eget fönster med tillfällig session. Användaren loggar in själv med BankID. */
  openMinPension(): Promise<void>
  /** Läser av sidan som visas i minPension-fönstret. */
  readMinPension(): Promise<ReadResult | { error: string }>
  closeMinPension(): Promise<void>
  /** Sparar avläsningen till fil för felsökning (innehåller personuppgifter). */
  saveMinPensionDebug(): Promise<string | null>
  onMinPension(cb: (event: 'navigated' | 'closed', payload?: string) => void): () => void
  promptTouchId(reason: string): Promise<boolean>
  saveFile(defaultName: string, content: string): Promise<string | null>
  pickFile(extensions: string[]): Promise<PickedFile | null>
  systemTheme(): Promise<'light' | 'dark'>
  onSystemTheme(cb: (t: 'light' | 'dark') => void): () => void
}
