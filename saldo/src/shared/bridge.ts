/** Kontraktet mellan main-processen och gränssnittet (window.saldo). */
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
  /** Öppnar minPension i ett eget fönster med tillfällig partition. */
  openMinPension(): Promise<'closed'>
  promptTouchId(reason: string): Promise<boolean>
  saveFile(defaultName: string, content: string): Promise<string | null>
  pickFile(extensions: string[]): Promise<PickedFile | null>
  systemTheme(): Promise<'light' | 'dark'>
  onSystemTheme(cb: (t: 'light' | 'dark') => void): () => void
}
