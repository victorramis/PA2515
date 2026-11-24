/** @type {import('tailwindcss').Config} */
const v = (n) => `var(--${n})`
module.exports = {
  darkMode: 'class',
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'), surface: v('surface'), surface2: v('surface2'), side: v('side'), line: v('line'),
        text: v('text'), text2: v('text2'), text3: v('text3'),
        accent: { DEFAULT: v('accent'), soft: v('accentSoft'), text: v('accentText') },
        pos: { DEFAULT: v('pos'), soft: v('posSoft') },
        neg: { DEFAULT: v('neg'), soft: v('negSoft') },
        warn: { DEFAULT: v('warn'), soft: v('warnSoft') },
        // shadcn/ui-mappning (se Överlämning)
        background: v('background'), foreground: v('foreground'), card: { DEFAULT: v('card'), foreground: v('foreground') },
        muted: { DEFAULT: v('muted'), foreground: v('muted-foreground') }, border: v('border'), input: v('input'), ring: v('ring'),
        primary: { DEFAULT: v('primary'), foreground: v('primary-foreground') }, destructive: { DEFAULT: v('destructive'), foreground: '#fff' },
        chart: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, v(`chart-${i + 1}`)]))
      },
      borderRadius: { sm: '4px', md: '6px', lg: '8px', xl: '10px', '2xl': '12px' },
      fontFamily: { sans: ['system-ui', '-apple-system', '"SF Pro Text"', 'sans-serif'], mono: ['ui-monospace', 'SFMono-Regular', 'monospace'] },
      fontSize: {
        micro: ['11px', '14px'], small: ['11.5px', '16px'], label: ['12px', '16px'], body: ['13px', '18px'],
        page: ['15px', '20px'], title2: ['17px', '24px'], title1: ['22px', '28px'], kpi: ['26px', '32px'], display: ['30px', '36px']
      },
      boxShadow: { pop: '0 6px 24px rgba(0,0,0,.14)', palette: '0 12px 40px rgba(0,0,0,.18)', dialog: '0 20px 60px rgba(0,0,0,.30)', toast: '0 10px 30px rgba(0,0,0,.25)' }
    }
  },
  plugins: []
}
