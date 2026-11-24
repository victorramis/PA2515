import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildPreview, detect, parseDate, parseFile } from './importer'
import type { Transaction } from './types'

const HB = `Reskontradatum;Transaktionsdatum;Text;Belopp;Saldo
2026-11-23;2026-11-23;ICA KVANTUM VALLENTUNA;-642,30;31 842,17
2026-11-22;2026-11-22;SYSTEMBOLAGET 0171;-489,00;32 484,47
2026-11-20;2026-11-20;ÖVF SEB 5357;-10 000,00;32 973,47
2026-10-24;2026-10-24;LÖN 2610 ALLICA;48 900,00;42 973,47
`

describe('parseDate', () => {
  it.each([
    ['2026-11-24', '2026-11-24'],
    ['24/11/2026', '2026-11-24'],
    ['24.11.2026', '2026-11-24'],
    ['261124', '2026-11-24'],
    ['46350', '2026-11-24'],
    ['hej', null]
  ])('%s', (a, b) => expect(parseDate(a)).toBe(b))
})

describe('CSV från banken', () => {
  const p = parseFile('handelsbanken.csv', HB)
  it('hittar avgränsare och rubrikrad', () => {
    expect(p.delimiter).toBe(';')
    expect(p.headerRow).toBe(1)
    expect(p.rows).toHaveLength(4)
  })
  it('tolkar kolumnerna och teckenkonventionen', () => {
    const d = detect(p)
    expect(p.headers[d.mapping.description]).toBe('Text')
    expect(p.headers[d.mapping.amount]).toBe('Belopp')
    expect(d.mapping.balance).toBe(4)
    expect(d.signPlus).toBe(false)
    expect(d.columns.find((c) => c.role === 'Belopp')!.conf).toBeGreaterThanOrEqual(90)
  })
  it('hoppar över dubbletter (datum ±1 dag, samma belopp och handlare)', () => {
    const d = detect(p)
    const existing: Transaction[] = [
      { id: 'x', date: '2026-11-22', description: 'ICA Kvantum Vallentuna', raw: 'ICA KVANTUM VALLENTUNA', accountId: 'hb', amount: -642.3, categoryId: 'liv', source: 'rule' }
    ]
    const pv = buildPreview(p, d.mapping, d.signPlus, 'hb', existing)
    expect(pv.dupCount).toBe(1)
    expect(pv.newCount).toBe(3)
    expect(pv.sumPay).toBe(48900)
  })
})

describe('Amex-Excel med rader före rubriken', () => {
  const aoa = [
    ['American Express'],
    ['Aktivitet'],
    [],
    ['Kort', 'Platinum'],
    [],
    [],
    ['Datum', 'Beskrivning', 'Kortmedlem', 'Belopp', 'Land'],
    ['19/11/2026', 'ICA KVANTUM VALLENTUNA', 'VICTOR', 642.3, 'SE'],
    ['18/11/2026', 'MATHEM I SVERIGE AB', 'VICTOR', 1486.4, 'SE'],
    ['16/11/2026', 'BETALNING MOTTAGEN – TACK', '', -12940, ''],
    ['15/11/2026', 'SAS SCANDINAVIAN AIRL', 'VICTOR', 2140, 'SE']
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Transaktionsdetaljer')
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  it('hittar rubrikrad 7 och gissar köp som plus', () => {
    const p = parseFile('amex-aktivitet.xlsx', buf)
    expect(p.headerRow).toBe(7)
    const d = detect(p)
    expect(d.signPlus).toBe(true)
    expect(p.headers[d.mapping.date]).toBe('Datum')
    expect(p.headers[d.mapping.description]).toBe('Beskrivning')
    const pv = buildPreview(p, d.mapping, true, 'amex', [])
    expect(pv.rows[0].amount).toBe(-642.3)
    expect(pv.rows[2].amount).toBe(12940)
    expect(pv.from).toBe('2026-11-15')
  })
  it('avvisar PDF', () => {
    expect(() => parseFile('kontoutdrag.pdf', new ArrayBuffer(4))).toThrow(/ingen CSV- eller Excel-fil/)
  })
})
