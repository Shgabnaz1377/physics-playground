<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import SimLayout from '@/components/SimLayout.vue'
import RangeControl from '@/components/RangeControl.vue'
import ChoiceControl from '@/components/ChoiceControl.vue'
import ToggleControl from '@/components/ToggleControl.vue'
import LinePlot, { type PlotSeries, type RefLine } from '@/components/LinePlot.vue'
import TexMath from '@/components/TexMath.vue'
import { useUrlParams } from '@/composables/useUrlParams'
import { useAnimationLoop } from '@/composables/useAnimationLoop'
import { useCanvas2D } from '@/composables/useCanvas2D'
import { useCanvasColors } from '@/composables/useTheme'
import {
  byAmplitude,
  dft,
  evaluate,
  resampleClosed,
  shape,
  truncationError,
  type Coefficient,
  type Point,
} from '@/physics/fourier'
import { fourierSpecs } from './params'
import { drawEpicycles, type View } from './draw'

const SAMPLES = 256
const CURVE_POINTS = 600

const { values: p, resetParams } = useUrlParams(fourierSpecs)
const running = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const canvas = ref<HTMLCanvasElement | null>(null)
const colors = useCanvasColors(() => invalidate())
const { ctx, size } = useCanvas2D(canvas, () => invalidate())

const samples = shallowRef<Point[]>([])
const coeffs = shallowRef<Coefficient[]>([])
const errors = shallowRef<number[]>([])
const drawn = ref(false)
const plotVersion = ref(0)
let curve: Point[] = []
let t = 0

function load(points: Point[]) {
  samples.value = resampleClosed(points, SAMPLES)
  coeffs.value = byAmplitude(dft(samples.value))
  errors.value = Array.from({ length: SAMPLES }, (_, i) => truncationError(coeffs.value, i + 1))
  rebuildCurve()
  t = 0
  plotVersion.value++
  invalidate()
}

function rebuildCurve() {
  const terms = Math.min(p.terms, coeffs.value.length)
  curve = Array.from({ length: CURVE_POINTS + 1 }, (_, i) => evaluate(coeffs.value, i / CURVE_POINTS, terms))
}

function view(): View {
  const { width: w, height: h } = size
  return { cx: w / 2, cy: h / 2, scale: Math.min(w, h) * 0.4 }
}

function step(dt: number) {
  t = (t + dt * p.speed) % 1
}

function draw() {
  const c = ctx.value
  if (!c) return
  const col = colors.value
  const { width: w, height: h } = size
  const v = view()
  c.fillStyle = col.bg
  c.fillRect(0, 0, w, h)
  if (p.target && samples.value.length) {
    c.strokeStyle = col.grid
    c.lineWidth = 6
    c.lineJoin = 'round'
    c.beginPath()
    samples.value.forEach(([x, y], i) => {
      if (i) c.lineTo(v.cx + x * v.scale, v.cy - y * v.scale)
      else c.moveTo(v.cx + x * v.scale, v.cy - y * v.scale)
    })
    c.closePath()
    c.stroke()
  }
  if (stroke.length > 1) {
    c.strokeStyle = col.accent
    c.lineWidth = 2
    c.beginPath()
    stroke.forEach(([x, y], i) => {
      if (i) c.lineTo(v.cx + x * v.scale, v.cy - y * v.scale)
      else c.moveTo(v.cx + x * v.scale, v.cy - y * v.scale)
    })
    c.stroke()
    return
  }
  const upto = Math.floor(t * CURVE_POINTS)
  drawEpicycles(c, coeffs.value, p.terms, t, curve.slice(0, upto + 1), v, col, p.circles)
}

const { fps, invalidate } = useAnimationLoop(running, { step, draw })

// Freehand drawing: collect points in model coordinates while the pointer is down.
let stroke: Point[] = []
function toModel(e: PointerEvent): Point {
  const r = canvas.value!.getBoundingClientRect()
  const v = view()
  return [(e.clientX - r.left - v.cx) / v.scale, -(e.clientY - r.top - v.cy) / v.scale]
}
function onDown(e: PointerEvent) {
  canvas.value!.setPointerCapture(e.pointerId)
  stroke = [toModel(e)]
  invalidate()
}
function onMove(e: PointerEvent) {
  if (!stroke.length) return
  const q = toModel(e)
  const last = stroke[stroke.length - 1]!
  if (Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.004) stroke.push(q)
  invalidate()
}
function onUp() {
  const pts = stroke
  stroke = []
  let length = 0
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1])
  if (pts.length >= 8 && length > 0.2) {
    drawn.value = true
    load(pts)
  }
  invalidate()
}

watch(
  () => p.shape,
  () => {
    drawn.value = false
    load(shape(p.shape))
  },
)
watch(
  () => p.terms,
  () => {
    rebuildCurve()
    plotVersion.value++
    invalidate()
  },
)
watch(() => [p.circles, p.target], () => invalidate())

function reset() {
  resetParams()
  drawn.value = false
  load(shape(p.shape))
}

load(shape(p.shape))

const series: PlotSeries[] = [
  { label: 'relative RMS error', color: 1, get length() { return errors.value.length }, at: (i) => errors.value[i]! },
]

const currentError = computed(() => {
  void plotVersion.value
  return errors.value[Math.min(p.terms, SAMPLES) - 1] ?? 0
})

const refLines = computed<RefLine[]>(() => [{ y: Math.max(currentError.value, 1e-15), label: `${p.terms} terms` }])
</script>

<template>
  <SimLayout
    v-model:running="running"
    title="Fourier epicycles"
    lede="Any closed curve is a sum of rotating circles. Pick a shape or draw your own, then change how many terms of its Fourier series are kept."
    :fps="fps"
    @reset="reset"
  >
    <canvas
      ref="canvas"
      class="main epi"
      role="img"
      :aria-label="`Fourier epicycles drawing a ${drawn ? 'hand-drawn' : p.shape} curve with ${p.terms} terms`"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    />
    <LinePlot :series="series" :version="plotVersion" title="Error vs number of terms (largest first)" log-y :y-min="-6" :y-max="0" :ref-lines="refLines" :height="130" />

    <template #readouts>
      <span>terms = <b>{{ p.terms }}</b> / {{ SAMPLES }}</span>
      <span>relative RMS error = <b>{{ currentError.toExponential(2) }}</b></span>
      <span>largest term: k = <b>{{ coeffs[0]?.k ?? 0 }}</b>, |c| = <b>{{ (coeffs[0]?.amp ?? 0).toFixed(3) }}</b></span>
      <span>{{ drawn ? 'your drawing (not stored in the link)' : 'draw on the canvas to use your own curve' }}</span>
    </template>

    <template #controls>
      <ChoiceControl v-model="p.shape" label="Shape" :options="fourierSpecs.shape.options" :labels="{ heart: 'Heart', star: 'Star', square: 'Square', trefoil: 'Trefoil' }" />
      <RangeControl v-model="p.terms" label="Terms kept" :spec="fourierSpecs.terms" />
      <RangeControl v-model="p.speed" label="Speed" :spec="fourierSpecs.speed" unit="rev/s" />
      <ToggleControl v-model="p.circles" label="Show circles" />
      <ToggleControl v-model="p.target" label="Show target curve" />
    </template>

    <template #explainer>
      <p>
        Treat the plane as the complex plane and walk once around a closed curve in time
        <TexMath expr="t\in[0,1)" />. Any such periodic path <TexMath expr="z(t) = x(t) + i\,y(t)" /> can be
        written as a Fourier series:
      </p>
      <TexMath display expr="z(t) = \sum_{k=-\infty}^{\infty} c_k\, e^{2\pi i k t}, \qquad c_k = \int_0^1 z(t)\, e^{-2\pi i k t}\,dt" />
      <p>
        Each term is a vector of length <TexMath expr="|c_k|" /> rotating <TexMath expr="k" /> times per
        period, counter-clockwise for <TexMath expr="k > 0" /> and clockwise for <TexMath expr="k < 0" />.
        Placing the vectors tip to tail gives the chain of epicycles; its tip traces the curve.
      </p>
      <h3>Computing it</h3>
      <p>
        The curve is resampled at <TexMath expr="N = 256" /> points equally spaced in arc length, and the
        coefficients come from the discrete Fourier transform
        <TexMath expr="c_k = \frac1N\sum_{n=0}^{N-1} z_n e^{-2\pi i k n/N}" />. With all
        <TexMath expr="N" /> terms the samples are reproduced exactly. Keeping the <TexMath expr="M" />
        largest terms gives the best <TexMath expr="M" />-term approximation in the mean-square sense, and
        by Parseval's theorem its error is
      </p>
      <TexMath display expr="\frac{\lVert z - z_M\rVert}{\lVert z\rVert} = \sqrt{\frac{\sum_{k\notin M}|c_k|^2}{\sum_k |c_k|^2}}" />
      <p>
        Smooth curves (heart, trefoil) have coefficients that decay quickly, so a handful of circles is
        enough. Corners (star, square) make them decay like <TexMath expr="1/k^2" />, so many more terms are
        needed and the truncated curve rounds the corners off.
      </p>
    </template>
  </SimLayout>
</template>

<style scoped>
.epi {
  aspect-ratio: 16 / 10;
  max-height: 560px;
  cursor: crosshair;
}
</style>
