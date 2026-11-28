/**
 * Accent colours (links, active states, term underlines, note callouts): dark,
 * muted pastels. `light` is used in light mode, `dark` in dark mode. The reader
 * picks one on /settings/ (localStorage 'accent' -> html[data-accent]);
 * src/styles/accents.css holds the same values. Slate is the default.
 */
export const ACCENTS = [
  { id: 'slate', label: 'Slate', light: 'rgb(64 90 140)', dark: 'rgb(156 176 214)' },
  { id: 'indigo', label: 'Indigo', light: 'rgb(84 82 152)', dark: 'rgb(170 168 222)' },
  { id: 'teal', label: 'Teal', light: 'rgb(36 110 112)', dark: 'rgb(122 190 188)' },
  { id: 'sage', label: 'Sage', light: 'rgb(76 110 72)', dark: 'rgb(158 192 150)' },
  { id: 'plum', label: 'Plum', light: 'rgb(112 70 120)', dark: 'rgb(198 162 206)' },
  { id: 'terracotta', label: 'Terracotta', light: 'rgb(152 82 60)', dark: 'rgb(222 162 140)' },
  { id: 'ochre', label: 'Ochre', light: 'rgb(132 98 28)', dark: 'rgb(214 182 114)' },
] as const;
