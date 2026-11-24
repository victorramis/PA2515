import { describe, expect, it } from 'vitest'
import { seedData } from './seed'
import { needsReview } from '@/lib/categorize'
import { accountBalance, catIndex, monthFlows, totalBalance } from '@/lib/analytics'

describe('exempeldata', () => {
  const d = seedData(new Date('2026-11-24T08:00:00'))
  it('täcker två år', () => {
    const dates = d.transactions.map((t) => t.date).sort()
    expect(dates[0] <= '2024-12-31').toBe(true)
    expect(dates.at(-1)).toBe('2026-11-24')
    expect(d.transactions.length).toBeGreaterThan(900)
  })
  it('har 14 att granska', () => {
    expect(d.transactions.filter(needsReview)).toHaveLength(14)
  })
  it('stämmer med kontosaldon', () => {
    const a = d.accounts.find((x) => x.id === 'hb-allkonto')!
    expect(accountBalance(a, d.transactions)).toBeCloseTo(31842.17, 2)
    expect(totalBalance(d)).toBeGreaterThan(380000)
  })
  it('ger rimligt kassaflöde', () => {
    const f = monthFlows(d.transactions, catIndex(d.categories), '2026-10')
    f.forEach((m) => {
      expect(m.inc).toBeGreaterThan(45000)
      expect(m.exp).toBeGreaterThan(15000)
      expect(m.exp).toBeLessThan(60000)
    })
  })
})
