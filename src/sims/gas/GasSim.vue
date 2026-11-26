<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue'
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
import { LJSystem, accumulateSpeeds, maxwellBoltzmann2D } from '@/physics/lj'
import { gasSpecs } from './params'
import { drawParticles } from './draw'

const BINS = 36

const { values: p, resetParams } = useUrlParams(gasSpecs)
const running = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const canvas = ref<HTMLCanvasElement | null>(null)
const histCanvas = ref<HTMLCanvasElement | null>(null)
const colors = useCanvasColors(() => {
  invalidate()
  drawHistogram()
})
const box = useCanvas2D(canvas, () => invalidate())
const hist = useCanvas2D(histCanvas, () => drawHistogram())

const sys = shallowRef(makeSystem())
let vmax = vmaxFor(p.T)
const histogram = new Float64Array(BINS)
const frameBins = new Float64Array(BINS)
let tAvg = sys.value.temperature()
let e0 = sys.value.totalEnergy() / sys.value.N
const eSeries = new RollingSeries(600)
const tSeries = new RollingSeries(600)
const plotVersion = ref(0)
const stats = ref({ T: tAvg, e: e0, P: 0, drift: 0, t: 0 })

function makeSystem() {
  return new LJSystem({ N: p.N, density: p.density, temperature: p.T, seed: (Math.random() * 2 ** 31) | 0 })
}

function vmaxFor(T: number) {
  return 4.5 * Math.sqrt(Math.max(T, 0.05))
}

function restart() {
  sys.value = makeSystem()
  vmax = vmaxFor(p.T)
  histogram.fill(0)
  tAvg = sys.value.temperature()
  e0 = sys.value.totalEnergy() / sys.value.N
  eSeries.clear()
  tSeries.clear()
  sample()
  invalidate()
}

function sample() {
  const s = sys.value
  const T = s.temperature()
  const e = s.totalEnergy() / s.N
  tAvg += 0.03 * (T - tAvg)
  frameBins.fill(0)
  accumulateSpeeds(s.vx, s.vy, frameBins, vmax)
  for (let k = 0; k < BINS; k++) histogram[k] = histogram[k]! + 0.04 * (frameBins[k]! / s.N - histogram[k]!)
  eSeries.push(e)
  tSeries.push(T)
  stats.value = { T, e, P: s.pressure(), drift: e - e0, t: s.time }
  plotVersion.value++
  drawHistogram()
}

function step() {
  const s = sys.value
  for (let k = 0; k < p.speed; k++) {
    s.step(p.dt)
    if (p.thermostat) s.berendsen(p.T, p.dt, 0.2)
  }
  if (p.thermostat) e0 = s.totalEnergy() / s.N
  sample()
}

function draw() {
  const c = box.ctx.value
  if (!c) return
  const { width: w, height: h } = box.size
  const col = colors.value
  c.fillStyle = col.bg
  c.fillRect(0, 0, w, h)
  const size = Math.min(w, h) - 16
  const ox = (w - size) / 2
  const oy = (h - size) / 2
  c.strokeStyle = col.grid
  c.lineWidth = 1
  c.setLineDash([5, 5])
  c.strokeRect(ox, oy, size, size)
  c.setLineDash([])
  c.save()
  c.beginPath()
  c.rect(ox, oy, size, size)
  c.clip()
  drawParticles(c, sys.value, ox, oy, size, vmax)
  c.restore()
}

function drawHistogram() {
  const c = hist.ctx.value
  if (!c) return
  const { width: w, height: h } = hist.size
  const col = colors.value
  const padL = 36
  const padR = 10
  const padT = 24
  const padB = 22
  const pw = w - padL - padR
  const ph = h - padT - padB
  const dv = vmax / BINS
  const T = Math.max(tAvg, 1e-3)
  const peak = maxwellBoltzmann2D(Math.sqrt(T), T)
  let ymax = peak * 1.25
  for (let k = 0; k < BINS; k++) ymax = Math.max(ymax, histogram[k]! / dv)
  const X = (v: number) => padL + (v / vmax) * pw
  const Y = (f: number) => padT + ph * (1 - f / ymax)

  c.fillStyle = col.bg
  c.fillRect(0, 0, w, h)
  c.font = '11px ui-sans-serif, system-ui, sans-serif'
  c.fillStyle = col.series[0]
  c.globalAlpha = 0.55
  for (let k = 0; k < BINS; k++) {
    const f = histogram[k]! / dv
    c.fillRect(X(k * dv) + 0.5, Y(f), Math.max(1, pw / BINS - 1), padT + ph - Y(f))
  }
  c.globalAlpha = 1
  c.strokeStyle = col.series[1]
  c.lineWidth = 2
  c.beginPath()
  for (let i = 0; i <= 200; i++) {
    const v = (vmax * i) / 200
    const y = Y(maxwellBoltzmann2D(v, T))
    if (i) c.lineTo(X(v), y)
    else c.moveTo(X(v), y)
  }
  c.stroke()

  c.fillStyle = col.muted
  c.textAlign = 'center'
  c.textBaseline = 'top'
  const ticks = Math.floor(vmax)
  for (let v = 0; v <= ticks; v++) c.fillText(String(v), X(v), h - padB + 6)
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillStyle = col.fg
  c.fillText('Speed distribution |v|', padL, 10)
  let lx = padL + c.measureText('Speed distribution |v|').width + 14
  c.fillStyle = col.series[0]
  c.fillRect(lx, 6, 10, 8)
  lx += 14
  c.fillStyle = col.muted
  c.fillText('simulation', lx, 10)
  lx += c.measureText('simulation').width + 12
  c.fillStyle = col.series[1]
  c.fillRect(lx, 8, 10, 3)
  lx += 14
  c.fillStyle = col.muted
  c.fillText(`Maxwell–Boltzmann at T = ${T.toFixed(2)}`, lx, 10)
}

const { fps, invalidate } = useAnimationLoop(running, { step, draw })

watch(() => [p.N, p.density], restart)
watch(
  () => p.T,
  () => {
    if (!p.thermostat) {
      sys.value.scaleToTemperature(p.T)
      e0 = sys.value.totalEnergy() / sys.value.N
    }
    vmax = vmaxFor(p.T)
    histogram.fill(0)
    invalidate()
  },
)

function reset() {
  resetParams()
  restart()
}

const series: PlotSeries[] = [
  { label: 'T', color: 1, get length() { return tSeries.length }, at: (i) => tSeries.at(i) },
  { label: 'E/N', color: 0, get length() { return eSeries.length }, at: (i) => eSeries.at(i) },
]
</script>

<template>
  <SimLayout
    v-model:running="running"
    title="Lennard-Jones gas"
    lede="Molecular dynamics of a 2D Lennard-Jones fluid with velocity Verlet and a cell list. Starting from a lattice, the speeds relax to the Maxwell–Boltzmann distribution."
    :fps="fps"
    @reset="reset"
  >
    <div class="stage">
      <canvas ref="canvas" class="main box" role="img" :aria-label="`${p.N} particles at density ${p.density}`" />
      <div class="side">
        <canvas ref="histCanvas" class="hist" role="img" aria-label="Speed histogram with the Maxwell–Boltzmann prediction" />
        <LinePlot :series="series" :version="plotVersion" title="Temperature and energy per particle" :height="160" />
      </div>
    </div>

    <template #readouts>
      <span>T<sub>kin</sub> = <b>{{ stats.T.toFixed(3) }}</b></span>
      <span>E/N = <b>{{ stats.e.toFixed(4) }}</b></span>
      <span v-if="!p.thermostat">Δ(E/N) = <b>{{ stats.drift.toExponential(1) }}</b></span>
      <span>P = <b>{{ stats.P.toFixed(3) }}</b></span>
      <span>t = <b>{{ stats.t.toFixed(1) }}</b> τ</span>
      <span>{{ p.thermostat ? 'NVT (Berendsen)' : 'NVE (isolated)' }}</span>
    </template>

    <template #controls>
      <RangeControl v-model="p.N" label="Particles N" :spec="gasSpecs.N" />
      <RangeControl v-model="p.density" label="Density ρ = N/A" :spec="gasSpecs.density" unit="σ⁻²" />
      <RangeControl
        v-model="p.T"
        label="Temperature T"
        :spec="gasSpecs.T"
        unit="ε/k_B"
        :hint="p.thermostat ? 'Thermostat target.' : 'Changing it rescales the velocities once, then the system evolves at constant energy.'"
      />
      <ToggleControl v-model="p.thermostat" label="Berendsen thermostat (NVT)" />
      <RangeControl v-model="p.dt" label="Time step Δt" :spec="gasSpecs.dt" unit="τ" />
      <RangeControl v-model="p.speed" label="Steps per frame" :spec="gasSpecs.speed" />
    </template>

    <template #explainer>
      <p>Particles interact through the Lennard-Jones pair potential, truncated and shifted at <TexMath expr="r_c = 2.5\sigma" />:</p>
      <TexMath display expr="U(r) = 4\varepsilon\left[\left(\frac{\sigma}{r}\right)^{12} - \left(\frac{\sigma}{r}\right)^{6}\right] - U_{\mathrm{LJ}}(r_c), \qquad r < r_c" />
      <p>
        It is steeply repulsive at short range (Pauli exclusion) and weakly attractive at long range
        (van der Waals), with its minimum at <TexMath expr="r = 2^{1/6}\sigma" />. Reduced units set
        <TexMath expr="\sigma = \varepsilon = m = k_B = 1" />, so time is measured in
        <TexMath expr="\tau = \sigma\sqrt{m/\varepsilon}" />.
      </p>
      <h3>Integration</h3>
      <p>
        Velocity Verlet is time-reversible and symplectic. It does not conserve energy exactly, but the
        error stays bounded instead of drifting. Forces come from a cell list: the box is divided into
        cells at least <TexMath expr="r_c" /> wide, and each particle only checks its own and neighbouring
        cells. That is <TexMath expr="O(N)" /> instead of <TexMath expr="O(N^2)" />, and the tests check
        it against the brute-force sum. Periodic boundaries use the minimum-image convention.
      </p>
      <TexMath display expr="\mathbf v_{n+\frac12} = \mathbf v_n + \tfrac{\Delta t}{2}\mathbf F_n,\quad \mathbf r_{n+1} = \mathbf r_n + \Delta t\,\mathbf v_{n+\frac12},\quad \mathbf v_{n+1} = \mathbf v_{n+\frac12} + \tfrac{\Delta t}{2}\mathbf F_{n+1}" />
      <h3>Maxwell–Boltzmann</h3>
      <p>
        In equilibrium each velocity component is Gaussian with variance <TexMath expr="k_BT/m" />, so in
        two dimensions the speed follows
      </p>
      <TexMath display expr="f(v) = \frac{m v}{k_BT}\,\exp\!\left(-\frac{m v^2}{2k_BT}\right), \qquad \langle v\rangle = \sqrt{\frac{\pi k_BT}{2m}}" />
      <p>
        The particles start on a square lattice with Gaussian velocities. Collisions redistribute energy
        between kinetic and potential terms, and the histogram (a running average) settles onto the curve
        at the measured kinetic temperature <TexMath expr="k_BT = 2K/(2N-2)" />. The pressure comes from
        the virial theorem,
        <TexMath expr="P = \big(Nk_BT + \tfrac12\sum_{i<j}\mathbf r_{ij}\cdot\mathbf F_{ij}\big)/A" />.
        The optional Berendsen thermostat rescales velocities by
        <TexMath expr="\lambda = \sqrt{1 + \tfrac{\Delta t}{\tau_T}(T_0/T - 1)}" />.
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
.box {
  aspect-ratio: 1;
}
.side {
  display: grid;
  gap: 0.75rem;
}
.hist {
  display: block;
  width: 100%;
  height: 240px;
  border-radius: 10px;
  border: 1px solid var(--border);
}
</style>
