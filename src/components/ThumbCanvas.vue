<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useCanvas2D } from '@/composables/useCanvas2D'
import { useCanvasColors } from '@/composables/useTheme'
import type { SimEntry, Thumb } from '@/sims/registry'

const props = defineProps<{ entry: SimEntry }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const colors = useCanvasColors(() => paint())
const { ctx, size } = useCanvas2D(canvas, () => paint())

let thumb: Thumb | null = null
let raf = 0
let last = 0
let visible = false
let observer: IntersectionObserver | undefined
const reducedMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function paint() {
  if (thumb && ctx.value && size.width > 0) {
    thumb.draw(ctx.value, size.width, size.height, colors.value)
  }
}

function frame(now: number) {
  raf = 0
  if (!thumb || !visible) return
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60
  last = now
  thumb.step(dt)
  paint()
  raf = requestAnimationFrame(frame)
}

function start() {
  if (reducedMotion || raf || !thumb) return
  last = 0
  raf = requestAnimationFrame(frame)
}

onMounted(async () => {
  const mod = await props.entry.thumb()
  const w = Math.max(1, size.width)
  const h = Math.max(1, size.height)
  thumb = mod.createThumb(w, h)
  if (reducedMotion) {
    // Show a representative still: advance a couple of simulated seconds once.
    for (let i = 0; i < 120; i++) thumb.step(1 / 60)
  }
  paint()
  observer = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting
    if (visible) start()
  })
  if (canvas.value) observer.observe(canvas.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (raf) cancelAnimationFrame(raf)
  thumb = null
})
</script>

<template>
  <canvas ref="canvas" class="thumb" aria-hidden="true" />
</template>

<style scoped>
.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--canvas-bg);
}
</style>
