<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCanvas2D } from '@/composables/useCanvas2D'
import { useCanvasColors } from '@/composables/useTheme'

export interface PlotSeries {
  label: string
  /** Index into the theme's series palette (0-3). */
  color: number
  length: number
  at: (i: number) => number
}

export interface RefLine {
  y: number
  label: string
}

const props = withDefaults(
  defineProps<{
    series: PlotSeries[]
    /** Bump to request a redraw; series data is mutated in place for speed. */
    version: number
    title: string
    yMin?: number
    yMax?: number
    /** Plot log10 of the values. */
    logY?: boolean
    refLines?: RefLine[]
    height?: number
  }>(),
  { yMin: undefined, yMax: undefined, logY: false, refLines: () => [], height: 140 },
)

const canvas = ref<HTMLCanvasElement | null>(null)
const colors = useCanvasColors(() => draw())
const { ctx, size } = useCanvas2D(canvas, () => draw())

function fmt(v: number): string {
  if (props.logY) return `1e${Math.round(v)}`
  const a = Math.abs(v)
  if (a !== 0 && (a < 1e-2 || a >= 1e4)) return v.toExponential(1)
  return v.toFixed(a < 1 ? 2 : a < 10 ? 1 : 0)
}

function draw() {
  const c = ctx.value
  if (!c) return
  const { width: w, height: h } = size
  const col = colors.value
  const tf = (y: number) => (props.logY ? Math.log10(Math.max(Math.abs(y), 1e-300)) : y)
  c.clearRect(0, 0, w, h)
  c.fillStyle = col.bg
  c.fillRect(0, 0, w, h)

  let lo = Infinity
  let hi = -Infinity
  for (const s of props.series) {
    for (let i = 0; i < s.length; i++) {
      const y = tf(s.at(i))
      if (Number.isFinite(y)) {
        if (y < lo) lo = y
        if (y > hi) hi = y
      }
    }
  }
  for (const r of props.refLines) {
    lo = Math.min(lo, tf(r.y))
    hi = Math.max(hi, tf(r.y))
  }
  if (props.yMin !== undefined) lo = props.yMin
  if (props.yMax !== undefined) hi = props.yMax
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    lo = 0
    hi = 1
  }
  if (hi - lo < 1e-12) {
    hi += 0.5
    lo -= 0.5
  }

  const padL = 46
  const padR = 8
  const padT = 22
  const padB = 8
  const pw = w - padL - padR
  const ph = h - padT - padB
  const Y = (y: number) => padT + ph * (1 - (y - lo) / (hi - lo))

  c.font = '11px ui-sans-serif, system-ui, sans-serif'
  c.textBaseline = 'middle'
  c.strokeStyle = col.grid
  c.lineWidth = 1
  c.fillStyle = col.muted
  for (let k = 0; k <= 2; k++) {
    const v = lo + ((hi - lo) * k) / 2
    const y = Math.round(Y(v)) + 0.5
    c.beginPath()
    c.moveTo(padL, y)
    c.lineTo(w - padR, y)
    c.stroke()
    c.textAlign = 'right'
    c.fillText(fmt(v), padL - 6, y)
  }

  c.setLineDash([4, 4])
  for (const r of props.refLines) {
    const y = Y(tf(r.y))
    c.strokeStyle = col.muted
    c.beginPath()
    c.moveTo(padL, y)
    c.lineTo(w - padR, y)
    c.stroke()
    c.textAlign = 'right'
    c.fillText(r.label, w - padR - 2, y - 8)
  }
  c.setLineDash([])

  c.lineWidth = 1.6
  for (const s of props.series) {
    if (s.length < 2) continue
    const n = s.length
    c.strokeStyle = col.series[s.color % 4]!
    c.beginPath()
    let started = false
    // Draw at most about two samples per horizontal pixel.
    const stride = Math.max(1, Math.floor(n / (2 * pw)))
    for (let i = 0; i < n; i += stride) {
      const y = tf(s.at(i))
      if (!Number.isFinite(y)) {
        started = false
        continue
      }
      const x = padL + (pw * i) / (n - 1)
      const yy = Math.min(Math.max(Y(y), padT - 2), h - padB + 2)
      if (started) c.lineTo(x, yy)
      else c.moveTo(x, yy)
      started = true
    }
    c.stroke()
  }

  c.textAlign = 'left'
  c.fillStyle = col.fg
  c.fillText(props.title, padL, 10)
  let x = padL + c.measureText(props.title).width + 14
  for (const s of props.series) {
    c.fillStyle = col.series[s.color % 4]!
    c.fillRect(x, 7, 10, 3)
    x += 14
    c.fillStyle = col.muted
    c.fillText(s.label, x, 10)
    x += c.measureText(s.label).width + 12
  }
}

watch(
  () => props.version,
  () => draw(),
)
</script>

<template>
  <canvas
    ref="canvas"
    class="plot"
    :style="{ height: `${height}px` }"
    role="img"
    :aria-label="`${title} plot`"
  />
</template>

<style scoped>
.plot {
  display: block;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--border);
}
</style>
