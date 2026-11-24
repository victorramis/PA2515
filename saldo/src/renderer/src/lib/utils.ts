import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let n = 0
export function uid(prefix = 'id'): string {
  n += 1
  return `${prefix}-${Date.now().toString(36)}-${n.toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/** Deterministisk slump (mulberry32) för exempeldata. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
