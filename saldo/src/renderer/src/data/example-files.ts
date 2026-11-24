import * as XLSX from 'xlsx'
import { addDays, isoDate } from '@/lib/format'

/** Exempelfil i Amex-format (”Aktivitet” som Excel) för att prova importen utan egen fil. */
export function exampleAmexFile(now = new Date()): { name: string; data: ArrayBuffer } {
  const t = isoDate(now)
  const dmy = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  const rows: (string | number)[][] = [
    [dmy(addDays(t, -1)), 'ICA KVANTUM VALLENTUNA', 'VICTOR', 642.3, 'SE'],
    [dmy(addDays(t, -2)), 'HOTELL DIPLOMAT', 'VICTOR', 2850, 'SE'],
    [dmy(addDays(t, -2)), 'PRESSBYRAN 5512', 'VICTOR', 58, 'SE'],
    [dmy(addDays(t, -3)), 'CIRCLE K VALLENTUNA', 'VICTOR', 812.45, 'SE'],
    [dmy(addDays(t, -3)), 'ESPRESSO HOUSE 117', 'VICTOR', 92, 'SE'],
    [dmy(addDays(t, -4)), 'SPOTIFY P2F4A1C STOCKHOLM', 'VICTOR', 139, 'SE'],
    [dmy(addDays(t, -5)), 'NK STOCKHOLM', 'VICTOR', 1490, 'SE'],
    [dmy(addDays(t, -6)), 'APOTEKET AB VALLENTUNA', 'VICTOR', 326.5, 'SE'],
    [dmy(addDays(t, -7)), 'SL APP STOCKHOLM', 'VICTOR', 1060, 'SE'],
    [dmy(addDays(t, -8)), 'WOLT STOCKHOLM', 'VICTOR', 312, 'FI'],
    [dmy(addDays(t, -9)), 'APPLE.COM/BILL ITUNES', 'VICTOR', 129, 'IE'],
    [dmy(addDays(t, -10)), 'BOKUS.COM', 'VICTOR', 249, 'SE'],
    [dmy(addDays(t, -12)), 'BETALNING MOTTAGEN – TACK', '', -12940, ''],
    [dmy(addDays(t, -13)), 'MAX ARNINGE', 'VICTOR', 189, 'SE'],
    [dmy(addDays(t, -14)), 'FILMSTADEN TABY', 'VICTOR', 340, 'SE']
  ]
  const aoa = [['American Express'], ['Aktivitet', `${dmy(addDays(t, -30))} – ${dmy(t)}`], [], ['Kort', 'Platinum Card ·••• 41009'], ['Kortmedlem', 'VICTOR'], [], ['Datum', 'Beskrivning', 'Kortmedlem', 'Belopp', 'Land'], ...rows]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Sammanfattning'], ['Saldo', 14286.4]]), 'Sammanfattning')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Transaktionsdetaljer')
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return { name: `amex-aktivitet-${t.slice(0, 7)}.xlsx`, data }
}
