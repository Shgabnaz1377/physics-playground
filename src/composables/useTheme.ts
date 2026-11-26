import { nextTick, ref, shallowRef, watch } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'pp-theme'

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be unavailable (private mode); fall back to the OS preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const theme = ref<Theme>(typeof window === 'undefined' ? 'dark' : initialTheme())

if (typeof document !== 'undefined') {
  watch(
    theme,
    (t) => {
      document.documentElement.dataset.theme = t
      try {
        localStorage.setItem(STORAGE_KEY, t)
      } catch {
        // Not persisting is fine; the toggle still works for this visit.
      }
    },
    { immediate: true },
  )
}

export interface CanvasColors {
  bg: string
  grid: string
  fg: string
  muted: string
  accent: string
  series: [string, string, string, string]
}

/** Read the canvas palette from CSS custom properties for the active theme. */
export function readCanvasColors(): CanvasColors {
  const cs = getComputedStyle(document.documentElement)
  const v = (name: string) => cs.getPropertyValue(name).trim()
  return {
    bg: v('--canvas-bg'),
    grid: v('--canvas-grid'),
    fg: v('--canvas-fg'),
    muted: v('--fg-muted'),
    accent: v('--accent'),
    series: [v('--series-1'), v('--series-2'), v('--series-3'), v('--series-4')],
  }
}

/**
 * Canvas palette that refreshes whenever the theme changes. Reading CSS
 * variables once per theme change keeps getComputedStyle out of the frame loop.
 */
export function useCanvasColors(onChange?: () => void) {
  const colors = shallowRef<CanvasColors>(readCanvasColors())
  watch(theme, async () => {
    await nextTick()
    colors.value = readCanvasColors()
    onChange?.()
  })
  return colors
}

export function useTheme() {
  return {
    theme,
    toggle: () => {
      theme.value = theme.value === 'dark' ? 'light' : 'dark'
    },
  }
}
