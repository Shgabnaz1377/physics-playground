<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import SimLayout from '@/components/SimLayout.vue'
import RangeControl from '@/components/RangeControl.vue'
import ChoiceControl from '@/components/ChoiceControl.vue'
import LinePlot, { type PlotSeries } from '@/components/LinePlot.vue'
import TexMath from '@/components/TexMath.vue'
import { useUrlParams } from '@/composables/useUrlParams'
import { useAnimationLoop } from '@/composables/useAnimationLoop'
import { useTheme } from '@/composables/useTheme'
import { DIVERGING_DARK, DIVERGING_LIGHT, INFERNO, buildLut, lutIndex, packRgba } from '@/lib/colormap'
import { addPulse, advance, buildScene, fraunhofer, type Scene } from '@/physics/wave'
import { CFL_LIMIT_2D } from '@/physics/wave'
import { waveSpecs } from './params'

const NX = 360
const NY = 240
const SPONGE = 24

const { values: p, resetParams } = useUrlParams(waveSpecs)
const running = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const canvas = ref<HTMLCanvasElement | null>(null)
const scene = shallowRef<Scene>(makeScene())
const plotVersion = ref(0)
const { theme } = useTheme()

const luts = {
  light: buildLut(DIVERGING_LIGHT),
  dark: buildLut(DIVERGING_DARK),
  intensity: buildLut(INFERNO),
}
let image: ImageData | null = null
let pixels: Uint32Array | null = null
let ctx: CanvasRenderingContext2D | null = null
const screenSim = new Float64Array(NY)
const screenTheory = new Float64Array(NY)

function makeScene(): Scene {
  return buildScene({
    nx: NX,
    ny: NY,
    scene: p.scene,
    separation: p.separation,
    slitWidth: p.slit,
    spongeWidth: SPONGE,
  })
}

const physics = computed(() => ({
  courant: p.courant,
  wavelength: p.wavelength,
  amplitude: 1,
  sources: scene.value.sources,
}))

function rebuild() {
  scene.value = makeScene()
  screenSim.fill(0)
  invalidate()
}

function sourceX(s: Scene): number {
  return s.barrierX >= 0 ? s.barrierX : s.sources[0]!.x
}

function updateScreen() {
  const s = scene.value
  const g = s.grid
  const L = s.screenX - sourceX(s)
  const slits = p.scene === 'single-slit' ? 1 : 2
  const a = p.scene === 'two-sources' ? 0 : p.slit
  let max = 0
  for (let y = 0; y < NY; y++) {
    const v = g.intensity[y * NX + s.screenX]!
    screenSim[y] = v
    if (y > SPONGE && y < NY - SPONGE && v > max) max = v
  }
  for (let y = 0; y < NY; y++) {
    screenSim[y] = max > 0 ? screenSim[y]! / max : 0
    const theta = Math.atan2(y - NY / 2, L)
    screenTheory[y] = fraunhofer(theta, p.wavelength, slits, a, p.separation)
  }
  plotVersion.value++
}

function draw() {
  if (!ctx || !image || !pixels) return
  const g = scene.value.grid
  const wallColor = theme.value === 'dark' ? packRgba(230, 233, 239) : packRgba(20, 24, 33)
  if (p.view === 'field') {
    const lut = theme.value === 'dark' ? luts.dark : luts.light
    const A = p.scene === 'two-sources' ? 0.35 : 0.6
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = g.wall[i] ? wallColor : lut[lutIndex(g.u[i]!, -A, A)]!
    }
  } else {
    let max = 1e-12
    const x0 = Math.max(scene.value.barrierX, scene.value.sources[0]!.x) + 6
    for (let y = SPONGE; y < NY - SPONGE; y++) {
      for (let x = x0; x < NX - SPONGE; x++) max = Math.max(max, g.intensity[y * NX + x]!)
    }
    const lut = luts.intensity
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = g.wall[i] ? wallColor : lut[lutIndex(Math.sqrt(g.intensity[i]! / max), 0, 1)]!
    }
  }
  ctx.putImageData(image, 0, 0)
}

function step() {
  advance(scene.value.grid, physics.value, p.speed)
  updateScreen()
}

const { fps, invalidate } = useAnimationLoop(running, { step, draw })

function reset() {
  resetParams()
  rebuild()
}

function onPointer(e: PointerEvent) {
  const el = canvas.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const x = Math.round(((e.clientX - r.left) / r.width) * NX)
  const y = Math.round(((e.clientY - r.top) / r.height) * NY)
  addPulse(scene.value.grid, x, y, 2.5, 1.5)
  invalidate()
}

watch(() => [p.scene, p.separation, p.slit], rebuild)
watch(() => [p.view, p.wavelength, theme.value], () => {
  updateScreen()
  invalidate()
})

onMounted(() => {
  ctx = canvas.value!.getContext('2d')
  image = new ImageData(NX, NY)
  pixels = new Uint32Array(image.data.buffer)
  updateScreen()
})

const screenSeries = computed<PlotSeries[]>(() => [
  { label: 'simulated intensity', color: 0, length: NY, at: (i) => screenSim[i]! },
  { label: 'Fraunhofer prediction', color: 1, length: NY, at: (i) => screenTheory[i]! },
])

const fringe = computed(() => {
  const L = scene.value.screenX - sourceX(scene.value)
  return (p.wavelength * L) / p.separation
})
</script>

<template>
  <SimLayout
    v-model:running="running"
    title="Wave interference"
    lede="The 2D wave equation on a 360 × 240 grid. Send a plane wave through one or two slits, or drive two point sources, and watch the interference pattern form."
    :fps="fps"
    @reset="reset"
  >
    <canvas
      ref="canvas"
      class="main pixel"
      :width="NX"
      :height="NY"
      :style="{ aspectRatio: `${NX} / ${NY}` }"
      role="img"
      :aria-label="`Wave field, ${p.scene} scene, wavelength ${p.wavelength} cells`"
      @pointerdown="onPointer"
    />
    <LinePlot
      :series="screenSeries"
      :version="plotVersion"
      title="Screen (right edge)"
      :y-min="0"
      :y-max="1"
      :height="130"
    />

    <template #readouts>
      <span>t = <b>{{ scene.grid.t.toFixed(0) }}</b></span>
      <span>Courant C = <b>{{ p.courant.toFixed(2) }}</b> (limit {{ CFL_LIMIT_2D.toFixed(3) }})</span>
      <span v-if="p.scene !== 'single-slit'">fringe spacing λL/d ≈ <b>{{ fringe.toFixed(1) }}</b> cells</span>
      <span>click the field to drop a pulse</span>
    </template>

    <template #controls>
      <ChoiceControl
        v-model="p.scene"
        label="Experiment"
        :options="waveSpecs.scene.options"
        :labels="{ 'double-slit': 'Double slit', 'single-slit': 'Single slit', 'two-sources': 'Two point sources' }"
      />
      <ChoiceControl
        v-model="p.view"
        label="Show"
        :options="waveSpecs.view.options"
        :labels="{ field: 'Field u(x, y, t)', intensity: 'Time-averaged intensity ⟨u²⟩' }"
      />
      <RangeControl v-model="p.wavelength" label="Wavelength λ" :spec="waveSpecs.wavelength" unit="cells" />
      <RangeControl
        v-model="p.separation"
        :label="p.scene === 'two-sources' ? 'Source separation d' : 'Slit separation d'"
        :spec="waveSpecs.separation"
        unit="cells"
      />
      <RangeControl v-if="p.scene !== 'two-sources'" v-model="p.slit" label="Slit width a" :spec="waveSpecs.slit" unit="cells" />
      <RangeControl
        v-model="p.courant"
        label="Courant number C = cΔt/Δx"
        :spec="waveSpecs.courant"
        hint="Leapfrog is stable for C ≤ 1/√2 in 2D; the slider stops just below."
      />
      <RangeControl v-model="p.speed" label="Steps per frame" :spec="waveSpecs.speed" />
    </template>

    <template #explainer>
      <p>The field obeys the scalar wave equation with wave speed <TexMath expr="c" />:</p>
      <TexMath display expr="\frac{\partial^2 u}{\partial t^2} + \gamma(\mathbf{x})\,\frac{\partial u}{\partial t} = c^2 \nabla^2 u" />
      <p>
        Space and time are discretised with central differences (the leapfrog scheme). With grid
        spacing <TexMath expr="\Delta x" /> and Courant number <TexMath expr="C = c\,\Delta t/\Delta x" />:
      </p>
      <TexMath display expr="u^{n+1}_{ij} = 2u^n_{ij} - u^{n-1}_{ij} + C^2\left(u^n_{i+1,j} + u^n_{i-1,j} + u^n_{i,j+1} + u^n_{i,j-1} - 4u^n_{ij}\right)" />
      <p>
        A von Neumann analysis gives the dispersion relation
        <TexMath expr="\sin^2(\omega\Delta t/2) = C^2\left[\sin^2(k_x\Delta x/2) + \sin^2(k_y\Delta x/2)\right]" />,
        which has real solutions for every wavevector only if <TexMath expr="C \le 1/\sqrt{2}" />. That
        is the CFL condition; above it the checkerboard mode grows exponentially. The damping
        <TexMath expr="\gamma" /> is zero in the interior and ramps up in a border "sponge" so that
        outgoing waves are absorbed instead of reflected.
      </p>
      <h3>Interference</h3>
      <p>
        Far from two slits separated by <TexMath expr="d" />, each of width <TexMath expr="a" />, the
        time-averaged intensity follows the Fraunhofer result
      </p>
      <TexMath display expr="I(\theta) \propto \cos^2\!\left(\frac{\pi d \sin\theta}{\lambda}\right)\,\operatorname{sinc}^2\!\left(\frac{\pi a \sin\theta}{\lambda}\right)" />
      <p>
        with bright fringes at <TexMath expr="d\sin\theta = m\lambda" />. The plot under the field compares
        the simulated intensity on the right-hand screen with this prediction. They agree on the fringe
        positions; amplitudes differ somewhat because the screen is not truly in the far field.
      </p>
    </template>
  </SimLayout>
</template>

<style scoped>
.pixel {
  image-rendering: auto;
  cursor: crosshair;
}
</style>
