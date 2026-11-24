export type CategoryType = 'utgift' | 'inkomst' | 'överföring'
export type CatSource = 'manual' | 'rule' | 'learned' | 'ai'
export type IconKey = 'home' | 'cart' | 'car' | 'play' | 'heart' | 'plane' | 'arrows' | 'coin' | 'bag' | 'dots'

export interface Category {
  id: string
  name: string
  parentId: string | null
  color: number // index i diagrampaletten 0–9; underkategorier ärver huvudkategorins färg
  icon: IconKey
  type: CategoryType
  excluded: boolean // ”räknas inte som utgift”
}

export interface Suggestion {
  categoryId: string
  pct: number
  why: string
}

export interface Transaction {
  id: string
  date: string // ISO 2026-11-24
  description: string
  raw: string // banktext
  accountId: string
  amount: number // negativt = utflöde
  categoryId: string | null
  source: CatSource | null
  ruleId?: string
  aiConfidence?: number
  suggestions?: Suggestion[]
  context?: string
  note?: string
  importId?: string
  skipped?: boolean // ”Hoppa över” i Att granska
}

export type RuleKind = 'contains' | 'startsWith' | 'equals'

export interface Rule {
  id: string
  categoryId: string
  kind: RuleKind
  value: string
  accountId: string | null
  createdAt: string
}

export type AccountKind = 'bank' | 'card' | 'manual' | 'csv'

export interface Account {
  id: string
  name: string
  bank: string
  logo: string
  logoBg: string
  kind: AccountKind
  meta: string
  openingBalance: number
  /** Manuella konton: saldo du anger själv. */
  manualBalance?: number
  updatedAt: string // senaste synk/import/uppdatering, ISO med tid
  consentUntil?: string
  profileId?: string
}

export interface ColumnMapping {
  date: number
  description: number
  amount: number
  balance: number | null
}

export interface ImportProfile {
  id: string
  name: string
  format: 'csv' | 'xlsx'
  delimiter?: string
  signPlus: boolean // köp som plus i filen
  accountId: string
  headerMatch: string[] // rubriker som känns igen
  mapping: ColumnMapping
  lastUsed?: string
  lastRows?: number
}

export interface ImportRecord {
  id: string
  fileName: string
  accountId: string
  at: string
  txIds: string[]
  duplicates: number
}

export type PensionKind = 'Allmän' | 'Tjänste' | 'Privat'

export interface PensionItem {
  id: string
  name: string
  sub: string
  company: string
  kind: PensionKind
  color: string
}

export interface PensionSnapshot {
  fetchedAt: string // 2026-11-24 06:31
  values: Record<string, { value: number; valueDate: string }>
}

export interface PrivateAsset {
  id: string
  name: string
  value: number
  sub: string
  color: string
}

export interface Settings {
  birthYear: number
  municipality: string
  taxRate: number
  churchFee: number
  church: boolean
  stateTaxThreshold: number
  dataMode: 'bank' | 'csv'
  ai: boolean
  learn: boolean
  rules: boolean
  touchId: boolean
  hideOnStart: boolean
  lockAfter: string
  syncEvery: string
  consentReminder: number
  backup: string
  keepBackups: string
  csvReminder: string
  watchFolder: string
  key?: { fileName: string; importedAt: string; appId: string }
}

export interface AppData {
  version: 1
  seededAt: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  rules: Rule[]
  learned: Record<string, string> // normaliserad handlare → kategori
  profiles: ImportProfile[]
  imports: ImportRecord[]
  pensions: PensionItem[]
  snapshots: PensionSnapshot[]
  privateAssets: PrivateAsset[]
  scenarios: Record<string, import('./pension-sim').Scenario>
  settings: Settings
}
