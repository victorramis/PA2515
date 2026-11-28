import { describe, expect, it } from 'vitest'
import { buildResult, findTotal, parseBlock, parseJson, parseKr, parseSwedishDate } from './minpension'

describe('grundtolkning', () => {
  it('belopp', () => {
    expect(parseKr('1 012 400 kr')).toEqual([1012400])
    expect(parseKr('Värde 621 700 kr')).toEqual([621700])
    expect(parseKr('137 300,50 kr')).toEqual([137300.5])
    expect(parseKr('412.900 SEK')).toEqual([412900])
  })
  it('datum', () => {
    expect(parseSwedishDate('Värdet avser 2026-11-20')).toBe('2026-11-20')
    expect(parseSwedishDate('per 31 december 2025')).toBe('2025-12-31')
    expect(parseSwedishDate('20.11.2026')).toBe('2026-11-20')
  })
})

describe('kort på sidan', () => {
  it('tolkar ett kort med namn, bolag, värde och datum', () => {
    const p = parseBlock(['Tjänstepension', 'ITP 1', 'SEB Pension och Försäkring', 'Värde', '621 700 kr', 'Värdedatum 2026-11-21'])
    expect(p).toMatchObject({ value: 621700, company: 'SEB Pension och Försäkring', valueDate: '2026-11-21', kind: 'Tjänste' })
    expect(p!.name).toMatch(/ITP 1|Tjänstepension/)
  })
  it('bortser från månadsprognos och tar kapitalet', () => {
    const p = parseBlock(['Inkomstpension', 'Pensionsmyndigheten', 'Prognos från 65 år', '9 840 kr/mån', 'Behållning', '1 012 400 kr', 'Värdet avser 31 december 2025'])
    expect(p).toMatchObject({ name: 'Inkomstpension', value: 1012400, kind: 'Allmän', valueDate: '2025-12-31' })
  })
  it('privat sparande', () => {
    expect(parseBlock(['Privat pensionssparande (IPS)', 'Avanza Pension', '137 300 kr'])).toMatchObject({ kind: 'Privat', company: 'Avanza Pension', value: 137300, name: 'Privat pensionssparande (IPS)' })
  })
  it('klarar belopp som sitter ihop med nästa text', () => {
    expect(parseBlock(['Inkomstpension', 'Pensionsmyndigheten', 'Behållning1 012 400 krVärdet avser 31 december 2025', 'Prognos från 65 år9 840 kr/mån'])).toMatchObject({ value: 1012400, valueDate: '2025-12-31' })
  })
  it('ignorerar summeringsrader', () => {
    expect(parseBlock(['Totalt pensionskapital', '2 184 300 kr'])).toBeNull()
  })
  it('hittar total', () => {
    expect(findTotal('Översikt\nTotalt pensionskapital\n2 184 300 kr\nLogga ut')).toBe(2184300)
  })
})

describe('JSON från webbappen', () => {
  it('hittar pensioner i nästlade svar', () => {
    const body = {
      data: {
        companies: [
          { companyName: 'Pensionsmyndigheten', products: [{ productName: 'Inkomstpension', value: 1012400, valueDate: '2025-12-31' }, { productName: 'Premiepension', value: { amount: 412900 }, valueDate: '2026-11-20' }] },
          { companyName: 'Alecta', products: [{ productName: 'ITP 2', marketValue: '84 200 kr' }] }
        ],
        totalValue: 1509500
      }
    }
    const r = parseJson([{ url: 'https://www.minpension.se/api/x', body }])
    expect(r).toHaveLength(3)
    expect(r[1]).toMatchObject({ name: 'Premiepension', company: 'Pensionsmyndigheten', value: 412900, kind: 'Allmän' })
    expect(r[2]).toMatchObject({ company: 'Alecta', value: 84200, kind: 'Tjänste' })
  })
})

describe('buildResult', () => {
  it('slår ihop JSON och sida utan dubbletter', () => {
    const json = [{ url: 'https://www.minpension.se/api', body: [{ name: 'Premiepension', company: 'Pensionsmyndigheten', value: 412900 }] }]
    const page = {
      url: 'https://www.minpension.se/mina-pensioner',
      title: 'Mina pensioner',
      text: 'Logga ut\nTotalt 1 034 600 kr',
      blocks: [
        ['Premiepension', 'Pensionsmyndigheten', '412 900 kr'],
        ['Tjänstepension ITP 1', 'SEB Pension och Försäkring', '621 700 kr'],
        ['Allmän pension', '412 900 kr']
      ]
    }
    const r = buildResult(page, json)
    expect(r.loggedIn).toBe(true)
    expect(r.total).toBe(1034600)
    expect(r.pensions.map((p) => p.value).sort()).toEqual([412900, 621700])
    expect(r.pensions.find((p) => p.value === 412900)!.via).toBe('json')
  })
  it('inloggningssidan ger inget', () => {
    const r = buildResult({ url: 'https://www.minpension.se/', title: 'Logga in | minPension', text: 'Logga in med BankID', blocks: [] }, [])
    expect(r.loggedIn).toBe(false)
    expect(r.pensions).toHaveLength(0)
  })
})
