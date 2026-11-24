import type { SaldoBridge } from '../shared/bridge'

declare global {
  interface Window {
    saldo?: SaldoBridge
  }
}
export {}
