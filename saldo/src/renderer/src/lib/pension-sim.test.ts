import { describe, expect, it } from 'vitest'
import { defaultScenarios, simulate, warnings } from './pension-sim'

const inp = { birthYear: 1989, currentAge: 37, capital: [1012400, 412900, 621700, 137300] }

describe('pensionsmodellen', () => {
  const sc = defaultScenarios()
  it('räknar år för år från 37 till 95', () => {
    const r = simulate(sc.a50, inp)
    expect(r.rows[0].a).toBe(37)
    expect(r.rows.at(-1)!.a).toBe(95)
    expect(r.rows[0].y).toBe(2026)
  })
  it('insättningar upphör när man slutar jobba', () => {
    const r = simulate(sc.a50, inp).rows
    expect(r.find((x) => x.a === 49)!.dep).toBeGreaterThan(0)
    expect(r.find((x) => x.a === 50)!.dep).toBe(0)
  })
  it('allmän pension betalas ut från vald startålder', () => {
    const r = simulate(sc.a50, inp).rows
    expect(r.find((x) => x.a === 64)!.payG[0]).toBe(0)
    expect(r.find((x) => x.a === 65)!.payG[0]).toBeGreaterThan(0)
  })
  it('jobba till 60 ger mer kapital vid 80 än sluta vid 45', () => {
    const w80 = (k: 'a45' | 'a60') => simulate(sc[k], inp).rows.find((x) => x.a === 80)!.w
    expect(w80('a60')).toBeGreaterThan(w80('a45'))
  })
  it('varnar för uttag som bryter mot reglerna', () => {
    const bad = { ...sc.a50, p: sc.a50.p.map((p, j) => (j === 0 ? { ...p, start: 61 } : j === 3 ? { ...p, start: 52, yrs: 3 } : p)) }
    const w = warnings(bad, simulate(bad, inp), inp, (n) => String(Math.round(n)))
    const t = w.map((x) => x.t).join(' | ')
    expect(t).toMatch(/Inkomstpension från 61 år går inte/)
    expect(t).toMatch(/IPS före 55 år går inte/)
    expect(t).toMatch(/IPS måste betalas ut under minst 5 år/)
  })
})
