# Saldo – privatekonomi och pension för macOS

Electron + React + TypeScript + Tailwind, med komponenter i shadcn/ui-stil (Radix, cmdk, Sonner). Byggd efter designen i canvasen ”Saldo – privatekonomi och pension (macOS)”, inklusive artboarden *Överlämning till Claude Code*. All text i gränssnittet är på svenska.

## Kom igång

```bash
cd saldo
npm install
npm run dev          # startar Electron-appen med hot reload
npm run dev:web      # bara gränssnittet i webbläsaren: http://localhost:5199/?demo
npm test             # enhetstester (formatering, import, pensionsmodell, exempeldata)
npm run typecheck
npm run dist:mac     # bygger Saldo.dmg (körs på en Mac)
```

Första start visar **Kom igång** (fyra steg). På sista steget kan du fylla appen med påhittad exempeldata för två år (Vallentuna), eller börja tomt. `?demo` i webbläsarläget hoppar direkt till exempeldatan.

## Vad som finns

| Vy | Innehåll |
| --- | --- |
| Översikt | KPI-kort (totalt saldo, utgifter mot snitt, sparkvot, att granska), kassaflöde 12 mån (staplar + nettolinje), största kategorier, senaste transaktioner, konton, varning när bankens samtycke snart löper ut eller har gått ut |
| Transaktioner | Virtualiserad tabell (TanStack Virtual), filter och sök, chip med källmarkör M/R/I/AI, detaljpanel 340 px, dialogen ”Bara denna / Alla liknande, även framtida”, massmarkering, dela upp belopp, skapa regel, CSV-export, ångra |
| Att granska | Kö med okategoriserade och osäkra (AI under 70 %), förslag med säkerhet, tangenter 1–9, S, Ö, ↑↓, ”Kom ihåg” skapar inlärning |
| Analys | Staplade staplar per kategori och månad, jämförelse med föregående period (samma dag), trend, treemap (d3-hierarchy), största handlare, Sankey (d3-sankey). Klick i diagram filtrerar fram transaktionerna |
| Kategorier | Träd, färg, ikon, typ, ”räknas inte som utgift”, skapa, byt namn, slå ihop, ta bort med val av mål, regler per kategori |
| Konton | Bankkonton med synkstatus och samtyckets slutdatum, Förnya, Lägg till bank (sök bank → BankID), Amex, manuella konton och CSV-konton |
| Import | CSV/Excel, automatisk tolkning av rubrikrad, kolumner och teckenkonvention med säkerhet per kolumn, dubbletter (konto, ±1 dag, belopp, handlare), sparade profiler, sammanfattning, ångra hela importen |
| Pension – Översikt | Pensioner per hämtning, utveckling mellan hämtningar, privat kapital och holdingbolag |
| Pension – Planera | Antaganden med reglage + sifferfält, scenarier och jämförelse, livsfaser, varningar för uttagsregler, KPI-rad, förmögenhet/pensionskapital över ålder, kassaflöde/pensionsutbetalning per källa med netto, årstabell (hushåll eller pension) |
| Hämta från minPension | Instruktion, inloggning, förlopp, ”Det här hittade vi” med rättning innan sparning |
| Inställningar | Tema, bankdata och Enable Banking-nyckel, AI-hjälp, Touch ID, säkerhetskopior och export, skattesatser, återställ exempeldata eller rensa allt |

Kortkommandon: ⌘K palett · ⌘F filtrera · ⌘Z ångra · ⌘I importera · ⌘, inställningar · ⌘⇧H dölj belopp · ⌘⇧N ny kategori. Toaster med ”Ångra” i 8 s.

## Struktur

```
src/main/        Electron main: fönster (hiddenInset, vibrancy, 1200×760 min), IPC, safeStorage, Touch ID, minPension-fönster
src/preload/     window.saldo-bryggan (typad i src/shared/bridge.ts)
src/renderer/src/
  styles/globals.css    designtokens (ljust/mörkt) + shadcn-variabler
  lib/format.ts         ”12 345 kr”, ”−1 234,50 kr” (U+2212, hårt mellanslag), datum
  lib/categorize.ts     regler, inlärning, AI-förslag, prioritet manuell > regel > inlärd > AI
  lib/importer.ts       CSV/Excel-tolkning, kolumngissning, tecken, dubbletter
  lib/pension-sim.ts    pensionsmodellen och varningarna
  lib/analytics.ts      kassaflöde, kategorisummor, saldon, handlare
  data/seed.ts          exempeldata för två år
  store/                Zustand: data, ångra-stack, tema, dölj belopp, period
  pages/                en fil per vy
```

Data sparas lokalt i `userData/saldo-data.bin`, krypterad med Electrons `safeStorage` (Keychain på macOS). I webbläsarläget används `localStorage`.

## Riktigt eller simulerat

Gränssnittet och logiken för kategorisering, import, analys och pensionsmodell är på riktigt. Följande kräver externa tjänster och är **simulerade** tills de kopplas in:

- **Enable Banking**: nyckelfilen (.pem) importeras och lagras krypterad i main-processen, men inga API-anrop görs ännu. ”Lägg till bank”, ”Förnya” och ”Synka nu” går igenom BankID-flödet med knappen *Simulera godkänt*. Nästa steg: signera JWT i main-processen och hämta konton/transaktioner.
- **minPension**: Mac-appen öppnar www.minpension.se i ett eget fönster med tillfällig session, men sidan läses inte av än. Värdena i ”Det här hittade vi” är påhittade utifrån senaste hämtningen.
- **AI-förslag**: en lokal nyckelordsmotor (`aiSuggest`) med säkerhet i procent. Kan bytas mot en språkmodell i main-processen som bara får beskrivning och belopp.
- **Säkerhetskopia varje natt** och **bevakad mapp** är inställningar utan schemaläggning bakom.
- Lagringen är en krypterad JSON-fil, inte SQLite som i överlämningen; datamodellen följer tabellerna där och kan flyttas till SQLite senare.
