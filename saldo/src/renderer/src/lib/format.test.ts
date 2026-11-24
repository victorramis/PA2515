import { describe, expect, it } from 'vitest'
import { formatKr, formatNumber, parseAmount, shiftMonth, MINUS, NBSP } from './format'

describe('formatKr', () => {
  it('formaterar svenska belopp med hårt mellanslag och riktigt minus', () => {
    expect(formatKr(12345)).toBe(`12${NBSP}345${NBSP}kr`)
    expect(formatKr(-1234.5, { decimals: 2 })).toBe(`${MINUS}1${NBSP}234,50${NBSP}kr`)
    expect(formatKr(48900, { decimals: 2, sign: true })).toBe(`+48${NBSP}900,00${NBSP}kr`)
    expect(formatKr(-0.001, { decimals: 2 })).toBe(`0,00${NBSP}kr`)
  })
  it('döljer belopp', () => {
    expect(formatKr(5, { hide: true })).toBe(`••••${NBSP}kr`)
  })
  it('formatNumber', () => {
    expect(formatNumber(2184300)).toBe(`2${NBSP}184${NBSP}300`)
  })
})

describe('parseAmount', () => {
  it.each([
    ['1 234,50', 1234.5],
    ['−1 234,50', -1234.5],
    ['-12 940,00 kr', -12940],
    ['1234.5', 1234.5],
    ['1,234.50', 1234.5],
    ['1.234,50', 1234.5],
    ['642,30', 642.3],
    ['(350)', -350],
    ['abc', null],
    ['', null]
  ])('%s → %s', (s, v) => expect(parseAmount(s)).toBe(v))
})

describe('shiftMonth', () => {
  it('flyttar över årsskiften', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftMonth('2026-11', -11)).toBe('2025-12')
  })
})
