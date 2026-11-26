<script setup lang="ts">
import { ref, watch } from 'vue'
import SimLayout from '@/components/SimLayout.vue'
import RangeControl from '@/components/RangeControl.vue'
import ToggleControl from '@/components/ToggleControl.vue'
import LinePlot, { type PlotSeries } from '@/components/LinePlot.vue'
import TexMath from '@/components/TexMath.vue'
import { useUrlParams } from '@/composables/useUrlParams'
import { useAnimationLoop } from '@/composables/useAnimationLoop'
import { useCanvas2D } from '@/composables/useCanvas2D'
import { useCanvasColors } from '@/composables/useTheme'
import { RollingSeries } from '@/lib/series'
import { DoublePendulum, bobPositions, stateDistance, type PendulumParams } from '@/physics/pendulum'
import { pendulumSpecs } from './params'
import { Trail, drawPendulum } from './draw'

const DEG = Math.PI / 180
const { values: p, resetParams } = useUrlParams(pendulumSpecs)
const running = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const canvas = ref<HTMLCanvasElement | null>(null)
const colors = useCanvasColors(() => invalidate())
const { ctx, size } = useCanvas2D(canvas, () => invalidate())

const physParams = (): PendulumParams => ({ m1: 1, m2: p.mass, l1: 1, l2: p.length, g: p.g })

let a = new DoublePendulum(physParams(), p.theta1 * DEG, p.theta2 * DEG)
let b = new DoublePendulum(physParams(), p.theta1 * DEG + 10 ** p.delta, p.theta2 * DEG)
let e0 = a.energy()
const trailA = new Trail(500)
const trailB = new Trail(500)
const sepSeries = new RollingSeries(600)
const driftSeries = new RollingSeries(600)
const plotVersion = ref(0)
const readout = ref({ t: 0, energy: e0, drift: 0, sep: 10 ** p.delta, lyap: Number.NaN })

/** Energy scale used to normalise the drift, so it is meaningful even when E0 is near zero. */
function energyScale(q: PendulumParams): number {
  return (q.m1 + q.m2) * q.g * q.l1 + q.m2 * q.g * q.l2
}

function restart() {
  const q = physParams()
  a = new DoublePendulum(q, p.theta1 * DEG, p.theta2 * DEG)
  b = new DoublePendulum(q, p.theta1 * DEG + 10 ** p.delta, p.theta2 * DEG)
  e0 = a.energy()
  trailA.clear()
  trailB.clear()
  sepSeries.clear()
  driftSeries.clear()
  sample()
  invalidate()
}

function sample() {
  const sep = stateDistance(a.y, b.y)
  const drift = Math.abs(a.energy() - e0) / energyScale(a.params)
  sepSeries.push(sep)
  driftSeries.push(drift)
  const d0 = 10 ** p.delta
  readout.value = {
    t: a.t,
    energy: a.energy(),
    drift,
    sep,
    lyap: a.t > 0.5 && sep < 1e-2 ? Math.log(sep / d0) / a.t : Number.NaN,
  }
  plotVersion.value++
}

let pending = 0
function step(dt: number) {
  // Accumulate wall time so playback speed is independent of the integration step.
  pending = Math.min(pending + dt * p.speed, 0.25)
  let n = 0
  while (pending >= p.dt && n < 4000) {
    a.step(p.dt)
    b.step(p.dt)
    pending -= p.dt
    n++
  }
  const [, , ax, ay] = bobPositions(a.params, a.y)
  const [, , bx, by] = bobPositions(b.params, b.y)
  trailA.push(ax, ay)
  trailB.push(bx, by)
  sample()
}

function geometry() {
  const { width: w, height: h } = size
  const reach = 1 + p.length
  const scale = (Math.min(w, h) * 0.46) / reach
  return { ox: w / 2, oy: h / 2, scale }
}

function draw() {
  const c = ctx.value
  if (!c) return
  const col = colors.value
  const { width: w, height: h } = size
  const { ox, oy, scale } = geometry()
  c.fillStyle = col.bg
  c.fillRect(0, 0, w, h)
  c.strokeStyle = col.grid
  c.lineWidth = 1
  c.beginPath()
  c.arc(ox, oy, (1 + p.length) * scale, 0, Math.PI * 2)
  c.stroke()
  if (p.trail) {
    trailB.draw(c, col.series[1], (x) => ox + x * scale, (y) => oy + y * scale)
    trailA.draw(c, col.series[0], (x) => ox + x * scale, (y) => oy + y * scale)
  }
  drawPendulum(c, b.params, b.y, ox, oy, scale, col.muted, col.series[1], 0.85)
  drawPendulum(c, a.params, a.y, ox, oy, scale, col.fg, col.series[0])
  c.fillStyle = col.fg
  c.beginPath()
  c.arc(ox, oy, 4, 0, Math.PI * 2)
  c.fill()
}

const { fps, invalidate } = useAnimationLoop(running, { step, draw })

watch(() => [p.theta1, p.theta2, p.mass, p.length, p.g, p.delta], restart)
watch(() => [p.trail], () => invalidate())

function reset() {
  resetParams()
  restart()
}

// Drag a bob to set the initial angles.
let dragging: 0 | 1 | 2 = 0
let wasRunning = false
function pointerPos(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function onDown(e: PointerEvent) {
  const { ox, oy, scale } = geometry()
  const [x1, y1, x2, y2] = bobPositions(a.params, a.y)
  const m = pointerPos(e)
  const d1 = Math.hypot(m.x - (ox + x1 * scale), m.y - (oy + y1 * scale))
  const d2 = Math.hypot(m.x - (ox + x2 * scale), m.y - (oy + y2 * scale))
  if (Math.min(d1, d2) > 28) return
  dragging = d2 <= d1 ? 2 : 1
  wasRunning = running.value
  running.value = false
  canvas.value!.setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging) return
  const { ox, oy, scale } = geometry()
  const m = pointerPos(e)
  if (dragging === 1) {
    p.theta1 = Math.round(Math.atan2(m.x - ox, m.y - oy) / DEG)
  } else {
    const [x1, y1] = bobPositions(a.params, a.y)
    p.theta2 = Math.round(Math.atan2(m.x - (ox + x1 * scale), m.y - (oy + y1 * scale)) / DEG)
  }
}
function onUp() {
  if (!dragging) return
  dragging = 0
  running.value = wasRunning
}

// Series objects read the rolling buffers lazily; LinePlot redraws when plotVersion changes.
const sepPlot: PlotSeries[] = [
  { label: '|Δstate|', color: 1, get length() { return sepSeries.length }, at: (i) => sepSeries.at(i) },
]
const driftPlot: PlotSeries[] = [
  { label: '|E − E₀| / E_scale', color: 0, get length() { return driftSeries.length }, at: (i) => driftSeries.at(i) },
]

function sci(x: number): string {
  return x === 0 ? '0' : x.toExponential(2)
}
</script>

<template>
  <SimLayout
    v-model:running="running"
    title="Double pendulum"
    lede="Two copies of a double pendulum, started a hair apart. RK4 keeps the energy almost exactly constant, yet the trajectories separate exponentially: deterministic chaos."
    :fps="fps"
    @reset="reset"
  >
    <canvas
      ref="canvas"
      class="main pend"
      role="img"
      :aria-label="`Double pendulum, initial angles ${p.theta1} and ${p.theta2} degrees`"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    />
    <div class="plots">
      <LinePlot :series="sepPlot" :version="plotVersion" title="Divergence" log-y :y-min="p.delta - 1" :y-max="1" />
      <LinePlot :series="driftPlot" :version="plotVersion" title="Energy error" log-y :y-min="-16" />
    </div>

    <template #readouts>
      <span>t = <b>{{ readout.t.toFixed(2) }} s</b></span>
      <span>E = <b>{{ readout.energy.toFixed(4) }} J</b></span>
      <span>|ΔE|/E<sub>scale</sub> = <b>{{ sci(readout.drift) }}</b></span>
      <span>|Δstate| = <b>{{ sci(readout.sep) }}</b></span>
      <span>λ ≈ <b>{{ Number.isNaN(readout.lyap) ? '–' : readout.lyap.toFixed(2) + ' s⁻¹' }}</b></span>
      <span>drag a bob to set the angles</span>
    </template>

    <template #controls>
      <RangeControl v-model="p.theta1" label="Initial θ₁" :spec="pendulumSpecs.theta1" unit="°" />
      <RangeControl v-model="p.theta2" label="Initial θ₂" :spec="pendulumSpecs.theta2" unit="°" />
      <RangeControl v-model="p.mass" label="Mass ratio m₂/m₁" :spec="pendulumSpecs.mass" />
      <RangeControl v-model="p.length" label="Length ratio ℓ₂/ℓ₁" :spec="pendulumSpecs.length" />
      <RangeControl v-model="p.g" label="Gravity g" :spec="pendulumSpecs.g" unit="m/s²" />
      <RangeControl
        v-model="p.delta"
        label="Shadow offset δ₀ in θ₁"
        :spec="pendulumSpecs.delta"
        :format="(v) => `1e${v}`"
        unit="rad"
      />
      <RangeControl
        v-model="p.dt"
        label="RK4 time step Δt"
        :spec="pendulumSpecs.dt"
        unit="s"
        hint="Raise it to watch the energy error grow roughly as Δt⁴."
      />
      <RangeControl v-model="p.speed" label="Playback speed" :spec="pendulumSpecs.speed" unit="×" />
      <ToggleControl v-model="p.trail" label="Show trails" />
    </template>

    <template #explainer>
      <p>
        With angles <TexMath expr="\theta_1, \theta_2" /> measured from the vertical, the Lagrangian of
        two point masses on rigid, massless rods is <TexMath expr="L = T - V" /> with
      </p>
      <TexMath display expr="T = \tfrac12 (m_1+m_2)\ell_1^2\dot\theta_1^2 + \tfrac12 m_2\ell_2^2\dot\theta_2^2 + m_2\ell_1\ell_2\dot\theta_1\dot\theta_2\cos(\theta_1-\theta_2)" />
      <TexMath display expr="V = -(m_1+m_2)\,g\ell_1\cos\theta_1 - m_2\, g\ell_2\cos\theta_2" />
      <p>
        The Euler–Lagrange equations are linear in the accelerations, so they can be solved
        explicitly. With <TexMath expr="\Delta = \theta_1 - \theta_2" /> and
        <TexMath expr="D = 2m_1 + m_2 - m_2\cos 2\Delta" />:
      </p>
      <TexMath display expr="\ddot\theta_1 = \frac{-g(2m_1+m_2)\sin\theta_1 - m_2 g\sin(\theta_1-2\theta_2) - 2\sin\Delta\, m_2(\dot\theta_2^2\ell_2 + \dot\theta_1^2\ell_1\cos\Delta)}{\ell_1 D}" />
      <TexMath display expr="\ddot\theta_2 = \frac{2\sin\Delta\left(\dot\theta_1^2\ell_1(m_1+m_2) + g(m_1+m_2)\cos\theta_1 + \dot\theta_2^2\ell_2 m_2\cos\Delta\right)}{\ell_2 D}" />
      <p>
        The state <TexMath expr="(\theta_1,\theta_2,\dot\theta_1,\dot\theta_2)" /> is advanced with the
        classical fourth-order Runge–Kutta method. RK4 is not symplectic, so energy is not conserved
        exactly, but the error per unit time scales as <TexMath expr="\Delta t^4" />. At the default
        step it stays below about <TexMath expr="10^{-8}" /> of the energy scale
        <TexMath expr="(m_1+m_2)g\ell_1 + m_2 g\ell_2" />.
      </p>
      <h3>Chaos</h3>
      <p>
        The faint copy starts with <TexMath expr="\theta_1" /> shifted by a tiny amount
        <TexMath expr="\delta_0" />. At high energy the separation grows as
        <TexMath expr="\delta(t) \approx \delta_0 e^{\lambda t}" />, a straight line on the log plot,
        until it saturates at the size of the system. The slope <TexMath expr="\lambda" /> estimates the
        largest Lyapunov exponent. At small angles the motion is a superposition of two normal modes
        with frequencies from <TexMath expr="\det(K - \omega^2 M) = 0" />, and nearby trajectories stay
        close.
      </p>
    </template>
  </SimLayout>
</template>

<style scoped>
.pend {
  aspect-ratio: 4 / 3;
  max-height: 560px;
  cursor: grab;
}
.plots {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.75rem;
}
</style>
