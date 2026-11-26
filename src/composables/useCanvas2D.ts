import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue'

export interface CanvasSize {
  width: number
  height: number
  dpr: number
}

/**
 * Keeps a canvas' backing store matched to its CSS size and devicePixelRatio,
 * so vector drawing stays crisp. Drawing code works in CSS pixels.
 */
export function useCanvas2D(canvas: Ref<HTMLCanvasElement | null>, onResize?: () => void) {
  const ctx = shallowRef<CanvasRenderingContext2D | null>(null)
  const size: CanvasSize = { width: 0, height: 0, dpr: 1 }
  let observer: ResizeObserver | undefined

  function fit() {
    const el = canvas.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))
    if (el.width !== w || el.height !== h) {
      el.width = w
      el.height = h
    }
    size.width = rect.width
    size.height = rect.height
    size.dpr = dpr
    ctx.value?.setTransform(dpr, 0, 0, dpr, 0, 0)
    onResize?.()
  }

  onMounted(() => {
    const el = canvas.value
    if (!el) return
    ctx.value = el.getContext('2d')
    fit()
    observer = new ResizeObserver(fit)
    observer.observe(el)
  })

  onBeforeUnmount(() => observer?.disconnect())

  return { ctx, size }
}
