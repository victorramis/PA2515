import type { SVGProps } from 'react'

const P: Record<string, string> = {
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z',
  chart: 'M5 20V11M12 20V4M19 20v-6',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  bank: 'M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  pie: 'M12 3a9 9 0 1 0 9 9h-9zM15 3.5A9 9 0 0 1 20.5 9H15z',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  gear: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7S18 19 12 19 2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A9.9 9.9 0 0 1 12 5c5 0 9 5 9 7a9.8 9.8 0 0 1-2.4 3.3M6.3 6.3C4 7.8 3 10.6 3 12c0 2 4 7 9 7a9.6 9.6 0 0 0 4.4-1M12 9a3 3 0 0 1 3 3',
  sun: 'M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v6M12 16.5h.01',
  check: 'M5 12.5l4.5 4.5L19 7',
  upload: 'M12 15V3M7 8l5-5 5 5M4 21h16',
  drop: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  key: 'M8 11a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM11 12l9-9M17 6l3 3M15 8l2 2',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  close: 'M6 6l12 12M18 6L6 18',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  fingerprint: 'M12 11v3M8.5 8.5a5 5 0 0 1 8.5 3.5c0 3-.5 5.5-1.5 7.5M7 12c0 2.5-.5 4.5-1.5 6M12 7a5 5 0 0 0-5 5M12 15c0 2-.4 4-1.2 5.5'
}

export type IconName = keyof typeof P

export function Icon({ name, d, size = 16, stroke = 1.7, ...rest }: { name?: IconName; d?: string; size?: number; stroke?: number } & Omit<SVGProps<SVGSVGElement>, 'stroke' | 'name' | 'size'>) {
  const path = d ?? (name ? P[name] : '')
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {name === 'gear' && <circle cx="12" cy="12" r="3" />}
      <path d={path} />
    </svg>
  )
}
