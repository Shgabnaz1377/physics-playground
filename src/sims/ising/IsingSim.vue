<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import SimLayout from '@/components/SimLayout.vue'
import RangeControl from '@/components/RangeControl.vue'
import ChoiceControl from '@/components/ChoiceControl.vue'
import LinePlot, { type PlotSeries, type RefLine } from '@/components/LinePlot.vue'
import TexMath from '@/components/TexMath.vue'
import { useUrlParams } from '@/composables/useUrlParams'
import { useAnimationLoop } from '@/composables/useAnimationLoop'
import { useCanvas2D } from '@/composables/useCanvas2D'
import { useCanvasColors } from '@/composables/useTheme'
import { hexToRgb, packRgba } from '@/lib/colormap'
import { RollingSeries } from '@/lib/series'
import { TC, onsagerEnergy, onsagerMagnetization } from '@/physics/ising'
import type { FromWorker, ToWorker } from './protocol'
import { isingSpecs } from './params'

interface ScanPoint {
  T: number
  absM: number
  e: number
  chi: number
  cv: number
}

const { values: p, resetParams } = useUrlParams(isingSpecs)
const running = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const canvas = ref<HTMLCanvasElement | null>(null)
const phaseCanvas = ref<HTMLCanvasElement | null>(null)
const colors = useCanvasColors(() => {
  updatePalette()
  invalidate()
  drawPhase()
})
const phase = useCanvas2D(phaseCanvas, () => drawPhase())

const L = () => Number(p.size)
const mSeries = new RollingSeries(500)
const eSeries = new RollingSeries(500)
const plotVersion = ref(0)
const stats = ref({ m: 0, e: 0, sweeps: 0 })
const scanning = ref(false)
const scanPoints = ref<ScanPoint[]>([])

let worker: Worker | null = null
let awaiting = false
let spins: Int8Array | null = null
let image: ImageData | null = null
let ctx: CanvasRenderingContext2D | null = null
let upColor = 0
let downColor = 0

function updatePalette() {
  const [r1, g1, b1] = hexToRgb(colors.value.series[0])
  upColor = packRgba(r1, g1, b1)
  downColor = colors.value.dark ? packRgba(19, 24, 36) : packRgba(226, 230, 237)
}
updatePalette()

function send(msg: ToWorker) {
  worker?.postMessage(msg)
}

function init() {
  const size = L()
  image = new ImageData(size, size)
  if (canvas.value) {
    canvas.value.width = size
    canvas.value.height = size
    ctx = canvas.value.getContext('2d')
  }
  mSeries.clear()
  eSeries.clear()
  awaiting = true
  send({ type: 'init', L: size, T: p.T, h: p.h, seed: (Math.random() * 2 ** 31) | 0, start: p.start })
}

function onMessage(ev: MessageEvent<FromWorker>) {
  const msg = ev.data
  if (msg.type === 'frame') {
    awaiting = false
    if (msg.spins.length !== L() * L()) return
    spins = msg.spins
    stats.value = { m: msg.m, e: msg.e, sweeps: msg.sweeps }
    mSeries.push(msg.m)
    eSeries.push(msg.e)
    plotVersion.value++
    invalidate()
  } else if (msg.type === 'scan-point') {
    scanPoints.value = [...scanPoints.value, msg]
    drawPhase()
  } else {
    scanning.value = false
    awaiting = false
    send({ type: 'params', T: p.T, h: p.h })
  }
}

function step() {
  if (!awaiting && !scanning.value) {
    awaiting = true
    send({ type: 'run', sweeps: p.speed })
  }
}

function draw() {
  if (!ctx || !image || !spins) return
  const px = new Uint32Array(image.data.buffer)
  for (let i = 0; i < spins.length; i++) px[i] = spins[i]! > 0 ? upColor : downColor
  ctx.putImageData(image, 0, 0)
}

const { fps, invalidate } = useAnimationLoop(running, { step, draw })

function startScan() {
  if (scanning.value) {
    send({ type: 'cancel-scan' })
    return
  }
  scanning.value = true
  scanPoints.value = []
  drawPhase()
  const temperatures: number[] = []
  for (let T = 1.0; T <= 3.501; T += 0.1) temperatures.push(Math.round(T * 100) / 100)
  // Start ordered at the coldest temperature and warm up, which equilibrates fastest.
  send({ type: 'init', L: L(), T: temperatures[0]!, h: 0, seed: 7, start: 'up' })
  const big = L() >= 256
  send({ type: 'scan', temperatures, equilibrate: big ? 100 : 200, measure: big ? 200 : 300 })
}

function drawPhase() {
  const c = phase.ctx.value
  if (!c) return
  const { width: w, height: h } = phase.size
  const col = colors.value
  c.fillStyle = col.bg
  c.fillRect(0, 0, w, h)
  const padL = 36
  const padR = 10
  const padT = 24
  const padB = 24
  const T0 = 0.8
  const T1 = 3.7
  const X = (T: number) => padL + ((T - T0) / (T1 - T0)) * (w - padL - padR)
  // Left axis: |m| in [0, 1]; energy is plotted as -e/2 so it shares the same [0, 1] range.
  const Y = (v: number) => padT + (1 - v) * (h - padT - padB)

  c.font = '11px ui-sans-serif, system-ui, sans-serif'
  c.strokeStyle = col.grid
  c.fillStyle = col.muted
  c.lineWidth = 1
  c.textAlign = 'right'
  c.textBaseline = 'middle'
  for (const v of [0, 0.5, 1]) {
    c.beginPath()
    c.moveTo(padL, Y(v))
    c.lineTo(w - padR, Y(v))
    c.stroke()
    c.fillText(v.toFixed(1), padL - 6, Y(v))
  }
  c.textAlign = 'center'
  c.textBaseline = 'top'
  for (let T = 1; T <= 3.5; T += 0.5) c.fillText(T.toFixed(1), X(T), h - padB + 6)

  c.setLineDash([4, 4])
  c.strokeStyle = col.muted
  c.beginPath()
  c.moveTo(X(TC), padT)
  c.lineTo(X(TC), h - padB)
  c.stroke()
  c.setLineDash([])
  c.textAlign = 'left'
  c.textBaseline = 'bottom'
  c.fillText('Tc', X(TC) + 4, h - padB - 4)

  const curve = (f: (T: number) => number, color: string) => {
    c.strokeStyle = color
    c.lineWidth = 1.5
    c.globalAlpha = 0.6
    c.beginPath()
    for (let i = 0; i <= 300; i++) {
      const T = T0 + ((T1 - T0) * i) / 300
      const y = Y(f(T))
      if (i) c.lineTo(X(T), y)
      else c.moveTo(X(T), y)
    }
    c.stroke()
    c.globalAlpha = 1
  }
  curve(onsagerMagnetization, col.series[0])
  curve((T) => -onsagerEnergy(T) / 2, col.series[1])

  const pts = scanPoints.value
  const chiMax = Math.max(1e-9, ...pts.map((q) => q.chi))
  const dot = (x: number, y: number, color: string) => {
    c.fillStyle = color
    c.beginPath()
    c.arc(x, y, 3.2, 0, Math.PI * 2)
    c.fill()
  }
  for (const q of pts) {
    dot(X(q.T), Y(q.absM), col.series[0])
    dot(X(q.T), Y(-q.e / 2), col.series[1])
    dot(X(q.T), Y((0.9 * q.chi) / chiMax), col.series[2])
  }

  c.textAlign = 'left'
  c.textBaseline = 'middle'
  const legend: Array<[string, string]> = [
    ['⟨|m|⟩', col.series[0]],
    ['−⟨e⟩/2', col.series[1]],
    ['χ (scaled)', col.series[2]],
  ]
  let lx = padL
  c.fillStyle = col.fg
  c.fillText('Temperature scan vs Onsager (lines)', lx, 10)
  lx += c.measureText('Temperature scan vs Onsager (lines)').width + 14
  for (const [label, color] of legend) {
    c.fillStyle = color
    c.fillRect(lx, 7, 10, 4)
    lx += 14
    c.fillStyle = col.muted
    c.fillText(label, lx, 10)
    lx += c.measureText(label).width + 12
  }
}

watch(() => [p.size, p.start], init)
watch(
  () => [p.T, p.h],
  () => {
    if (!scanning.value) send({ type: 'params', T: p.T, h: p.h })
  },
)
watch(scanPoints, drawPhase)

function reset() {
  if (scanning.value) send({ type: 'cancel-scan' })
  resetParams()
  init()
}

onMounted(() => {
  worker = new Worker(new URL('./ising.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = onMessage
  init()
})

onBeforeUnmount(() => {
  worker?.terminate()
  worker = null
})

const series: PlotSeries[] = [
  { label: 'm', color: 0, get length() { return mSeries.length }, at: (i) => mSeries.at(i) },
  { label: 'e', color: 1, get length() { return eSeries.length }, at: (i) => eSeries.at(i) },
]

function refLines(): RefLine[] {
  if (p.h !== 0) return []
  const m = onsagerMagnetization(p.T)
  const lines: RefLine[] = [{ y: onsagerEnergy(p.T), label: 'exact e' }]
  if (m > 0) lines.push({ y: m, label: 'exact +m' }, { y: -m, label: 'exact −m' })
  return lines
}
</script>

<template>
  <SimLayout
    v-model:running="running"
    title="2D Ising model"
    lede="Metropolis Monte Carlo on a periodic square lattice, running in a Web Worker. Cool it through Tc ≈ 2.269 and watch domains form and magnetisation appear."
    :fps="fps"
    @reset="reset"
  >
    <div class="stage">
      <canvas
        ref="canvas"
        class="main lattice"
        role="img"
        :aria-label="`Ising lattice ${p.size} by ${p.size} at temperature ${p.T}`"
      />
      <div class="side">
        <LinePlot :series="series" :version="plotVersion" title="Per-spin observables" :y-min="-2" :y-max="1" :ref-lines="refLines()" :height="170" />
        <canvas ref="phaseCanvas" class="phase" role="img" aria-label="Temperature scan compared with the Onsager solution" />
        <button type="button" class="btn" @click="startScan">
          {{ scanning ? `Scanning… ${scanPoints.length}/26 (stop)` : 'Run temperature scan 1.0 → 3.5' }}
        </button>
      </div>
    </div>

    <template #readouts>
      <span>T/Tc = <b>{{ (p.T / TC).toFixed(3) }}</b></span>
      <span>m = <b>{{ stats.m.toFixed(3) }}</b></span>
      <span>e = <b>{{ stats.e.toFixed(3) }}</b></span>
      <span>sweeps = <b>{{ stats.sweeps }}</b></span>
      <span v-if="p.h === 0">exact |m| = <b>{{ onsagerMagnetization(p.T).toFixed(3) }}</b>, e = <b>{{ onsagerEnergy(p.T).toFixed(3) }}</b></span>
    </template>

    <template #controls>
      <RangeControl v-model="p.T" label="Temperature T" :spec="isingSpecs.T" hint="Tc = 2 / ln(1 + √2) ≈ 2.269 (J = k_B = 1)" />
      <RangeControl v-model="p.h" label="External field h" :spec="isingSpecs.h" />
      <RangeControl v-model="p.speed" label="Sweeps per frame" :spec="isingSpecs.speed" />
      <ChoiceControl v-model="p.size" label="Lattice size" :options="isingSpecs.size.options" :labels="{ '64': '64 × 64', '128': '128 × 128', '256': '256 × 256' }" />
      <ChoiceControl v-model="p.start" label="Initial state" :options="isingSpecs.start.options" :labels="{ random: 'Random (infinite T)', up: 'All up (T = 0)' }" />
    </template>

    <template #explainer>
      <p>Each site carries a spin <TexMath expr="s_i = \pm 1" /> with energy</p>
      <TexMath display expr="H = -J\sum_{\langle ij\rangle} s_i s_j - h\sum_i s_i" />
      <p>
        where the first sum runs over nearest-neighbour pairs on a periodic lattice. In equilibrium a
        configuration has Boltzmann weight <TexMath expr="e^{-H/k_BT}" />.
      </p>
      <h3>Metropolis algorithm</h3>
      <p>
        Pick a random spin and compute the cost of flipping it,
        <TexMath expr="\Delta E = 2 s_i\,(J\sum_{j\in\partial i} s_j + h)" />. Accept the flip with
        probability <TexMath expr="\min(1, e^{-\Delta E/k_BT})" />. This satisfies detailed balance, so
        the chain converges to the Boltzmann distribution. The neighbour sum takes only five values,
        so the ten possible acceptance probabilities are precomputed whenever T or h changes. A sweep is
        <TexMath expr="N = L^2" /> attempts. Energy and magnetisation are updated incrementally, and the
        tests check them against a full recomputation.
      </p>
      <h3>The phase transition</h3>
      <p>
        Onsager solved the model exactly in 1944. Below
        <TexMath expr="T_c = 2J/\ln(1+\sqrt2) \approx 2.269" /> the spins order spontaneously, with
      </p>
      <TexMath display expr="|m| = \left[1 - \sinh^{-4}(2J/k_BT)\right]^{1/8}" />
      <p>
        and the energy per spin involves a complete elliptic integral
        <TexMath expr="K" />, computed here with the arithmetic–geometric mean:
      </p>
      <TexMath display expr="u = -J\coth(2\beta J)\left[1 + \frac{2}{\pi}\left(2\tanh^2(2\beta J) - 1\right)K(k)\right],\quad k = \frac{2\sinh(2\beta J)}{\cosh^2(2\beta J)}" />
      <p>
        The temperature scan measures <TexMath expr="\langle|m|\rangle" />, <TexMath expr="\langle e\rangle" />
        and the susceptibility <TexMath expr="\chi = N(\langle m^2\rangle - \langle|m|\rangle^2)/k_BT" />.
        On a finite lattice the transition is rounded and <TexMath expr="\chi" /> peaks slightly above
        <TexMath expr="T_c" />. Near <TexMath expr="T_c" />, domains of all sizes appear and single-flip
        dynamics slows down (critical slowing down).
      </p>
    </template>
  </SimLayout>
</template>

<style scoped>
.stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0.75rem;
  align-items: start;
}
@media (max-width: 700px) {
  .stage {
    grid-template-columns: minmax(0, 1fr);
  }
}
.lattice {
  aspect-ratio: 1;
  image-rendering: pixelated;
}
.side {
  display: grid;
  gap: 0.75rem;
}
.phase {
  display: block;
  width: 100%;
  height: 220px;
  border-radius: 10px;
  border: 1px solid var(--border);
}
</style>
