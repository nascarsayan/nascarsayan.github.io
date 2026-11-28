/**
 * Code highlighting themes (Shiki, all bundled). Every code block is rendered
 * with all of them: `light` colours inline, the others as --shiki-<key>* CSS
 * variables. The reader picks one theme for light mode and one for dark mode
 * on /settings/ (localStorage 'code-light' / 'code-dark', applied before first
 * paint as html[data-code-light|dark]); src/styles/code-themes.css switches.
 *
 * Used by astro.config.mjs (Markdown code fences) and every <Code> component.
 */
export const LIGHT_CODE = [
  { id: 'github', key: 'light', theme: 'github-light-default', label: 'GitHub Light' },
  { id: 'one', key: 'l-one', theme: 'one-light', label: 'One Light' },
  { id: 'solarized', key: 'l-solarized', theme: 'solarized-light', label: 'Solarized Light' },
  { id: 'latte', key: 'l-latte', theme: 'catppuccin-latte', label: 'Catppuccin Latte' },
];
export const DARK_CODE = [
  { id: 'github', key: 'dark', theme: 'github-dark-default', label: 'GitHub Dark' },
  { id: 'one', key: 'd-one', theme: 'one-dark-pro', label: 'One Dark Pro' },
  { id: 'dracula', key: 'd-dracula', theme: 'dracula', label: 'Dracula' },
  { id: 'nord', key: 'd-nord', theme: 'nord', label: 'Nord' },
  { id: 'tokyo', key: 'd-tokyo', theme: 'tokyo-night', label: 'Tokyo Night' },
];
/** The `themes` map for Shiki / <Code>. */
export const CODE_THEMES = Object.fromEntries([...LIGHT_CODE, ...DARK_CODE].map((t) => [t.key, t.theme]));
