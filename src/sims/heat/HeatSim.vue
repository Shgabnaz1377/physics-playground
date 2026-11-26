<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue'
import SimLayout from '@/components/SimLayout.vue'
import RangeControl from '@/components/RangeControl.vue'
import ChoiceControl from '@/components/ChoiceControl.vue'
import LinePlot, { type PlotSeries } from '@/components/LinePlot.vue'
import TexMath from '@/components/TexMath.vue'
import { useUrlParams } from '@/composables/useUrlParams'
import { useAnimationLoop } from '@/composables/useAnimationLoop'
import { useTheme } from '@/composables/useTheme'
import { INFERNO, buildLut, lutIndex, packRgba } from '@/lib/colormap'
import { RollingSeries } from '@/lib/series'
import {
  Cell,
  STABILITY_LIMIT,
  buildPreset,
  conductorCount,
  paintDisc,
  stepHeat,
  totalHeat,
  type HeatGrid,
} from '@/physics/heat'
import { heatSpecs } from './params'

const NX = 200
const NY = 125

const { values: p, resetParams } = useUrlParams(heatSpecs)
const running = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const canvas = ref<HTMLCanvasElement | null>(null)
const grid = shallowRef<HeatGrid>(buildPreset(NX, NY, p.preset))
const { theme } = useTheme()
const lut = buildLut(INFERNO)
const heatSeries = new RollingSeries(600)
const plotVersion = ref(0)
const stats = ref({ q: 0, mean: 0, fixed: 0, dq: 0 })
let q0 = totalHeat(grid.value)
let image: ImageData | null = null
let pixels: Uint32Array | null = null
let ctx: CanvasRenderingContext2D | null = null

function fixedCount(g: HeatGrid): number {
  let n = 0
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === Cell.Hot || g.kind[i] === Cell.Cold) n++
  return n
}

function measure() {
  const g = grid.value
  const q = totalHeat(g)
  const n = conductorCount(g)
  stats.value = { q, mean: n ? q / n : 0, fixed: fixedCount(g), dq: q0 ? (q - q0) / Math.abs(q0) : 0 }
  heatSeries.push(q)
  plotVersion.value++
}

function load() {
  grid.value = buildPreset(NX, NY, p.preset)
  q0 = totalHeat(grid.value)
  heatSeries.clear()
  measure()
  invalidate()
}

function step() {
  const g = grid.value
  for (let k = 0; k < p.speed; k++) stepHeat(g, Math.min(p.r, STABILITY_LIMIT))
  measure()
}

function draw() {
  if (!ctx || !image || !pixels) return
  const g = grid.value
  const wall = theme.value === 'dark' ? packRgba(120, 130, 150) : packRgba(90, 98, 115)
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = g.kind[i] === Cell.Wall ? wall : lut[lutIndex(g.u[i]!, 0, 1)]!
  }
  ctx.putImageData(image, 0, 0)
}

const { fps, invalidate } = useAnimationLoop(running, { step, draw })

// Drawing with the pointer: interpolate between move events so fast strokes stay continuous.
let drawing = false
let last: { x: number; y: number } | null = null

function toGrid(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: ((e.clientX - r.left) / r.width) * NX - 0.5, y: ((e.clientY - r.top) / r.height) * NY - 0.5 }
}

function applyBrush(cx: number, cy: number) {
  const g = grid.value
  paintDisc(g, cx, cy, p.brush, (i) => {
    switch (p.tool) {
      case 'wall':
        g.kind[i] = Cell.Wall
        g.u[i] = 0
        break
      case 'hot':
        g.kind[i] = Cell.Hot
        g.u[i] = g.hot
        break
      case 'cold':
        g.kind[i] = Cell.Cold
        g.u[i] = g.cold
        break
      case 'heat':
        if (g.kind[i] === Cell.Conductor) g.u[i] = 1
        break
      case 'erase':
        if (g.kind[i] !== Cell.Conductor) {
          g.kind[i] = Cell.Conductor
          g.u[i] = 0
        }
        break
    }
  })
}

function strokeTo(pt: { x: number; y: number }) {
  const from = last ?? pt
  const dist = Math.hypot(pt.x - from.x, pt.y - from.y)
  const n = Math.max(1, Math.ceil(dist / Math.max(0.5, p.brush * 0.5)))
  for (let k = 1; k <= n; k++) {
    applyBrush(from.x + ((pt.x - from.x) * k) / n, from.y + ((pt.y - from.y) * k) / n)
  }
  last = pt
  // Painting changes the heat content on purpose; restart the conservation baseline.
  q0 = totalHeat(grid.value)
  measure()
  invalidate()
}

function onDown(e: PointerEvent) {
  drawing = true
  last = null
  canvas.value!.setPointerCapture(e.pointerId)
  strokeTo(toGrid(e))
}
function onMove(e: PointerEvent) {
  if (drawing) strokeTo(toGrid(e))
}
function onUp() {
  drawing = false
  last = null
}

function clearAll() {
  const g = grid.value
  g.kind.fill(Cell.Conductor)
  g.u.fill(0)
  q0 = 0
  heatSeries.clear()
  measure()
  invalidate()
}

function reset() {
  resetParams()
  load()
}

watch(() => p.preset, load)
watch(theme, () => invalidate())

onMounted(() => {
  ctx = canvas.value!.getContext('2d')
  image = new ImageData(NX, NY)
  pixels = new Uint32Array(image.data.buffer)
  measure()
})

const series: PlotSeries[] = [
  { label: 'Σu over conducting cells', color: 1, get length() { return heatSeries.length }, at: (i) => heatSeries.at(i) },
]

const toolLabels = {
  wall: 'Insulating wall',
  hot: 'Hot reservoir (u = 1)',
  cold: 'Cold reservoir (u = 0)',
  heat: 'Add heat (one-off)',
  erase: 'Erase to conductor',
}
</script>

<template>
  <SimLayout
    v-model:running="running"
    title="Heat diffusion"
    lede="The 2D heat equation with drawable walls, hot and cold reservoirs. With only insulating boundaries the total heat stays fixed to machine precision."
    :fps="fps"
    @reset="reset"
  >
    <canvas
      ref="canvas"
      class="main field"
      :width="NX"
      :height="NY"
      :style="{ aspectRatio: `${NX} / ${NY}` }"
      role="img"
      :aria-label="`Temperature field, preset ${p.preset}`"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    />
    <LinePlot :series="series" :version="plotVersion" title="Total heat" :height="120" />

    <template #readouts>
      <span>Σu = <b>{{ stats.q.toFixed(3) }}</b></span>
      <span v-if="!stats.fixed">relative change of Σu since last edit = <b>{{ stats.dq.toExponential(2) }}</b></span>
      <span>mean u = <b>{{ stats.mean.toFixed(4) }}</b></span>
      <span>fixed cells = <b>{{ stats.fixed }}</b></span>
      <span>{{ stats.fixed ? 'reservoirs exchange heat' : 'closed system: Σu is conserved' }}</span>
    </template>

    <template #controls>
      <ChoiceControl
        v-model="p.preset"
        label="Scene"
        :options="heatSpecs.preset.options"
        :labels="{ radiator: 'Room with radiator and window', blob: 'Two hot blobs, insulated box', maze: 'Heat through a maze', bar: 'Bar between reservoirs' }"
      />
      <ChoiceControl v-model="p.tool" label="Brush" :options="heatSpecs.tool.options" :labels="toolLabels" />
      <RangeControl v-model="p.brush" label="Brush radius" :spec="heatSpecs.brush" unit="cells" />
      <RangeControl
        v-model="p.r"
        label="r = αΔt/Δx²"
        :spec="heatSpecs.r"
        hint="Explicit Euler is stable for r ≤ 1/4 in 2D, so the slider stops there."
      />
      <RangeControl v-model="p.speed" label="Steps per frame" :spec="heatSpecs.speed" />
      <button type="button" class="btn" @click="clearAll">Clear canvas</button>
    </template>

    <template #explainer>
      <p>Temperature <TexMath expr="u(\mathbf{x}, t)" /> obeys the diffusion equation</p>
      <TexMath display expr="\frac{\partial u}{\partial t} = \alpha\,\nabla^2 u" />
      <p>
        It is discretised with forward Euler in time and central differences in space (FTCS), written
        as a sum of fluxes between neighbouring cells:
      </p>
      <TexMath display expr="u_i^{n+1} = u_i^n + r\sum_{j\in\partial i}\left(u_j^n - u_i^n\right), \qquad r = \frac{\alpha\,\Delta t}{\Delta x^2}" />
      <p>
        Only pairs of non-wall neighbours exchange heat. The edge of the domain and every wall you draw
        are therefore perfectly insulating: a zero-flux Neumann condition
        <TexMath expr="\partial u/\partial n = 0" />. Each exchange adds to one cell exactly what it
        removes from the other, so with no reservoirs <TexMath expr="\sum_i u_i" /> is constant up to
        rounding. The readout shows the relative change since your last edit, typically around
        <TexMath expr="10^{-14}" />. Hot and cold cells are Dirichlet conditions
        (<TexMath expr="u = 1" /> or <TexMath expr="u = 0" />) and act as sources and sinks.
      </p>
      <h3>Stability</h3>
      <p>
        A von Neumann analysis of the 2D scheme gives an amplification factor
        <TexMath expr="g = 1 - 4r\left[\sin^2(k_x\Delta x/2) + \sin^2(k_y\Delta x/2)\right]" />, and
        <TexMath expr="|g| \le 1" /> for every mode requires <TexMath expr="r \le 1/4" />. In that range
        the update is a convex average of neighbours, so it also obeys a discrete maximum principle: no
        new hot or cold spots can appear. Starting from a point, the variance of the distribution grows
        by exactly <TexMath expr="2r" /> grid units² per step along each axis, the discrete form of
        <TexMath expr="\langle x^2\rangle = 2\alpha t" />.
      </p>
    </template>
  </SimLayout>
</template>

<style scoped>
.field {
  cursor: crosshair;
  image-rendering: pixelated;
}
</style>
