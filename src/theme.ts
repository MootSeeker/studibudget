export type ThemeChoice = 'system' | 'light' | 'dark'

const KEY = 'studibudget:theme'

export function loadTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* Speicher nicht verfügbar */
  }
  return 'system'
}

export function applyTheme(choice: ThemeChoice): void {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  try {
    localStorage.setItem(KEY, choice)
  } catch {
    /* Speicher nicht verfügbar */
  }
}
