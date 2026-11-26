<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import SimLayout from '@/components/SimLayout.vue'
import RangeControl from '@/components/RangeControl.vue'
import ChoiceControl from '@/components/ChoiceControl.vue'
import ToggleControl from '@/components/ToggleControl.vue'
import LinePlot, { type PlotSeries } from '@/components/LinePlot.vue'
import TexMath from '@/components/TexMath.vue'
import { useUrlParams } from '@/composables/useUrlParams'
import { useAnimationLoop } from '@/composables/useAnimationLoop'
import { useCanvas2D } from '@/composables/useCanvas2D'
import { useCanvasColors } from '@/composables/useTheme'
import { SURFACES, configFor, type OptimizerId, type Vec2 } from '@/physics/optim'
import { optimizerSpecs } from './params'
import { renderSurface, projector } from './field'
import { LABELS, ORDER, makeRunners, stepRunners, type Runner } from './race'

const MAX_STEPS = 4000
const FIELD = 360

const { values: p, resetParams } = useUrlParams(optimizerSpecs)
const running = ref(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
const canvas = ref<HTMLCanvasElement | null>(null)
const colors = useCanvasColors(() => {
  rebuildField()
  invalidate()
})
const { ctx, size } = useCanvas2D(canvas, () => invalidate())

const surface = computed(() => SURFACES[p.surface])
const runners = shallowRef<Runner[]>([])
const steps = ref(0)
const plotVersion = ref(0)
let fieldCanvas: HTMLCanvasElement | null = null

const active = (id: OptimizerId) => p[id]

function startPoint(): Vec2 {
  const s = surface.value
  if (p.sx < 0 || p.sy < 0) return [...s.start]
  const [x0, x1, y0, y1] = s.domain
  return [x0 + p.sx * (x1 - x0), y0 + p.sy * (y1 - y0)]
}

function restart() {
  clearTrails()
  runners.value = makeRunners(surface.value, startPoint(), 1)
  steps.value = 0
  plotVersion.value++
  invalidate()
}

function rebuildField() {
  const img = renderSurface(surface.value, FIELD, colors.value.dark)
  fieldCanvas ??= document.createElement('canvas')
  fieldCanvas.width = FIELD
  fieldCanvas.height = FIELD
  fieldCanvas.getContext('2d')!.putImageData(img, 0, 0)
}

function step() {
  if (steps.value >= MAX_STEPS) {
    running.value = false
    return
  }
  const n = Math.min(p.speed, MAX_STEPS - steps.value)
  for (let k = 0; k < n; k++) {
    stepRunners(runners.value, surface.value, 10 ** p.lr, p.beta, p.noise, active)
  }
  steps.value += n
  plotVersion.value++
}

// Trajectories are drawn incrementally into two offscreen layers (halos below, colours
// above), so each frame only strokes the newest segments and no halo ever hides another
// path. The layers are rebuilt when the view, theme or visible set changes.
const layers: { halo: HTMLCanvasElement | null; line: HTMLCanvasElement | null } = { halo: null, line: null }
let drawnTo = [0, 0, 0, 0]
let trailKey = ''

function updateTrails(P: ReturnType<typeof projector>, ox: number, oy: number, s: number) {
  const el = canvas.value!
  layers.halo ??= document.createElement('canvas')
  layers.line ??= document.createElement('canvas')
  const key = `${el.width}x${el.height}|${colors.value.dark}|${p.sgd}${p.momentum}${p.rmsprop}${p.adam}|${p.surface}`
  if (key !== trailKey) {
    for (const layer of [layers.halo, layers.line]) {
      layer.width = el.width
      layer.height = el.height
    }
    trailKey = key
    drawnTo = [0, 0, 0, 0]
  }
  const hc = layers.halo.getContext('2d')!
  const lc = layers.line.getContext('2d')!
  for (const [tc, width] of [
    [hc, 5],
    [lc, 2],
  ] as const) {
    tc.setTransform(size.dpr, 0, 0, size.dpr, 0, 0)
    tc.save()
    tc.beginPath()
    tc.rect(ox, oy, s, s)
    tc.clip()
    tc.lineJoin = 'round'
    tc.lineCap = 'round'
    tc.lineWidth = width
    ORDER.forEach((id, k) => {
      const r = runners.value[k]
      if (!r || !active(id)) return
      const last = r.path.length - 2
      const from = drawnTo[k]!
      if (last <= from) return
      tc.beginPath()
      tc.moveTo(P.X(r.path[from]!), P.Y(r.path[from + 1]!))
      for (let i = from + 2; i <= last; i += 2) tc.lineTo(P.X(r.path[i]!), P.Y(r.path[i + 1]!))
      tc.strokeStyle = tc === hc ? colors.value.bg : colors.value.series[k]!
      tc.stroke()
    })
    tc.restore()
  }
  ORDER.forEach((_, k) => {
    const r = runners.value[k]
    if (r) drawnTo[k] = Math.max(drawnTo[k]!, r.path.length - 2)
  })
}

function clearTrails() {
  trailKey = ''
}

function geometry() {
  const { width: w, height: h } = size
  const s = Math.min(w, h)
  return { ox: (w - s) / 2, oy: (h - s) / 2, s }
}

function draw() {
  const c = ctx.value
  if (!c) return
  const col = colors.value
  const { width: w, height: h } = size
  const { ox, oy, s } = geometry()
  c.fillStyle = col.bg
  c.fillRect(0, 0, w, h)
  if (!fieldCanvas) rebuildField()
  c.imageSmoothingEnabled = true
  c.drawImage(fieldCanvas!, ox, oy, s, s)
  const P = projector(surface.value, ox, oy, s)

  c.strokeStyle = col.fg
  c.lineWidth = 2
  for (const [mx, my] of surface.value.minima) {
    const x = P.X(mx)
    const y = P.Y(my)
    c.beginPath()
    c.moveTo(x - 5, y - 5)
    c.lineTo(x + 5, y + 5)
    c.moveTo(x + 5, y - 5)
    c.lineTo(x - 5, y + 5)
    c.stroke()
  }

  updateTrails(P, ox, oy, s)
  c.drawImage(layers.halo!, 0, 0, w, h)
  c.drawImage(layers.line!, 0, 0, w, h)

  ORDER.forEach((id, k) => {
    const r = runners.value[k]
    if (!r || !active(id)) return
    const n = r.path.length
    c.fillStyle = col.series[k]!
    c.strokeStyle = col.bg
    c.lineWidth = 2
    c.beginPath()
    c.arc(P.X(r.path[n - 2]!), P.Y(r.path[n - 1]!), 6, 0, Math.PI * 2)
    c.fill()
    c.stroke()
  })

  const [sx, sy] = startPoint()
  c.strokeStyle = col.fg
  c.lineWidth = 2
  c.beginPath()
  c.arc(P.X(sx), P.Y(sy), 8, 0, Math.PI * 2)
  c.stroke()
}

const { fps, invalidate } = useAnimationLoop(running, { step, draw })

function onClick(e: MouseEvent) {
  const el = canvas.value!
  const rect = el.getBoundingClientRect()
  const { ox, oy, s } = geometry()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  if (px < ox || px > ox + s || py < oy || py > oy + s) return
  p.sx = Math.round(((px - ox) / s) * 1000) / 1000
  p.sy = Math.round((1 - (py - oy) / s) * 1000) / 1000
}

watch(
  () => p.surface,
  () => {
    // A new surface gets its own default start point.
    p.sx = -1
    p.sy = -1
    rebuildField()
    restart()
  },
)
watch(() => [p.sx, p.sy, p.lr, p.beta, p.noise], restart)
watch(() => [p.sgd, p.momentum, p.rmsprop, p.adam], () => invalidate())

function reset() {
  resetParams()
  restart()
  running.value = true
}

restart()

const lossSeries = computed<PlotSeries[]>(() =>
  ORDER.map((id, k) => ({ id, k }))
    .filter(({ id }) => p[id])
    .map(({ id, k }) => ({
      label: LABELS[id],
      color: k,
      get length() {
        return runners.value[k]?.loss.length ?? 0
      },
      at: (i: number) => runners.value[k]!.loss[i]!,
    })),
)

const status = computed(() => {
  void plotVersion.value
  return ORDER.map((id, k) => {
    const r = runners.value[k]
    const loss = r?.loss[r.loss.length - 1] ?? Number.NaN
    const lr = configFor(id, surface.value, 10 ** p.lr, p.beta).lr
    return { id, k, loss, diverged: !!r?.diverged, lr, on: p[id] }
  })
})
</script>

<template>
  <SimLayout
    v-model:running="running"
    title="Optimizer race"
    lede="SGD, momentum, RMSProp and Adam descend the same loss surface from the same start. Click the surface to choose a new starting point."
    :fps="fps"
    @reset="reset"
  >
    <canvas
      ref="canvas"
      class="main surface"
      role="img"
      :aria-label="`${surface.name} with optimizer trajectories`"
      @click="onClick"
    />
    <LinePlot :series="lossSeries" :version="plotVersion" title="f(x) − f*" log-y :y-min="-12" :height="150" />

    <template #readouts>
      <span>step <b>{{ steps }}</b> / {{ MAX_STEPS }}</span>
      <template v-for="s in status" :key="s.id">
        <span v-if="s.on">
          {{ LABELS[s.id] }}: <b>{{ s.diverged ? 'diverged' : s.loss.toExponential(2) }}</b>
          <small class="lr">(lr {{ s.lr.toPrecision(2) }})</small>
        </span>
      </template>
    </template>

    <template #controls>
      <ChoiceControl
        v-model="p.surface"
        label="Loss surface"
        :options="optimizerSpecs.surface.options"
        :labels="{ rosenbrock: 'Rosenbrock valley', bowl: 'Ill-conditioned bowl (κ = 20)', himmelblau: 'Himmelblau (four minima)', saddle: 'Saddle with two wells', rastrigin: 'Rastrigin (many local minima)' }"
      />
      <RangeControl
        v-model="p.lr"
        label="Learning-rate multiplier"
        :spec="optimizerSpecs.lr"
        :format="(v) => `×${(10 ** v).toPrecision(2)}`"
        hint="Scales every optimizer's tuned rate. Push it up to make momentum overshoot or diverge."
      />
      <RangeControl v-model="p.beta" label="β (momentum, Adam β₁)" :spec="optimizerSpecs.beta" />
      <RangeControl v-model="p.noise" label="Gradient noise σ" :spec="optimizerSpecs.noise" hint="Gaussian noise on each gradient, imitating minibatches." />
      <RangeControl v-model="p.speed" label="Steps per frame" :spec="optimizerSpecs.speed" />
      <fieldset class="opts">
        <legend>Optimizers</legend>
        <ToggleControl v-model="p.sgd" label="SGD" />
        <ToggleControl v-model="p.momentum" label="Momentum" />
        <ToggleControl v-model="p.rmsprop" label="RMSProp" />
        <ToggleControl v-model="p.adam" label="Adam" />
      </fieldset>
    </template>

    <template #explainer>
      <p>
        Each method minimises <TexMath expr="f(\mathbf x)" /> using only gradients. The update rules,
        with learning rate <TexMath expr="\eta" /> and <TexMath expr="\mathbf g_t = \nabla f(\mathbf x_t)" />:
      </p>
      <ul>
        <li><b>SGD</b>: <TexMath expr="\mathbf x_{t+1} = \mathbf x_t - \eta\,\mathbf g_t" /></li>
        <li>
          <b>Momentum</b> (heavy ball): <TexMath expr="\mathbf v_{t+1} = \beta\mathbf v_t + \mathbf g_t,\ \ \mathbf x_{t+1} = \mathbf x_t - \eta\,\mathbf v_{t+1}" />.
          It accumulates velocity along consistent directions and damps oscillation across a valley.
        </li>
        <li>
          <b>RMSProp</b>: <TexMath expr="\mathbf s_{t+1} = \rho\,\mathbf s_t + (1-\rho)\,\mathbf g_t^2,\ \ \mathbf x_{t+1} = \mathbf x_t - \eta\,\mathbf g_t / (\sqrt{\mathbf s_{t+1}} + \epsilon)" />.
          The step is normalised per coordinate.
        </li>
        <li>
          <b>Adam</b>: momentum on both moments, with bias correction
          <TexMath expr="\hat{\mathbf m}_t = \mathbf m_t/(1-\beta_1^t),\ \hat{\mathbf v}_t = \mathbf v_t/(1-\beta_2^t)" />, then
          <TexMath expr="\mathbf x_{t+1} = \mathbf x_t - \eta\,\hat{\mathbf m}_t/(\sqrt{\hat{\mathbf v}_t} + \epsilon)" />. Its first step has length
          <TexMath expr="\eta" /> in every coordinate, whatever the gradient's size.
        </li>
      </ul>
      <h3>What to look for</h3>
      <p>
        On a quadratic <TexMath expr="f = \tfrac12\mathbf x^\top H\mathbf x" />, SGD contracts each
        eigen-direction by <TexMath expr="1 - \eta\lambda_i" />. It is stable only for
        <TexMath expr="\eta < 2/\lambda_{\max}" />, and progress along the flattest direction is then
        limited by the condition number <TexMath expr="\kappa = \lambda_{\max}/\lambda_{\min}" />. On
        Rosenbrock's curved valley, momentum and Adam travel along the floor while SGD crawls. On the saddle,
        noise or momentum pushes the iterate off the unstable ridge. On Rastrigin every method stops in the
        nearest local minimum unless gradient noise shakes it loose.
      </p>
      <p>
        The learning rates are tuned per surface. The adaptive methods take steps of roughly
        <TexMath expr="\eta" /> regardless of gradient size, so their rate scales with the size of the
        view rather than with the curvature.
      </p>
    </template>
  </SimLayout>
</template>

<style scoped>
.surface {
  aspect-ratio: 1;
  max-height: 620px;
  cursor: crosshair;
}
.opts {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.75rem 0.6rem;
  margin: 0;
  display: grid;
  gap: 0.35rem;
}
.opts legend {
  font-size: 0.8rem;
  color: var(--fg-muted);
  padding: 0 0.25rem;
}
.lr {
  color: var(--fg-muted);
}
</style>
