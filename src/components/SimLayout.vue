<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

defineProps<{
  title: string
  lede: string
  fps?: number
}>()

const running = defineModel<boolean>('running', { required: true })
const emit = defineEmits<{ reset: [] }>()

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

async function copyLink() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
  } catch {
    // Clipboard can be blocked (insecure context, permissions); the URL bar still has the link.
    copied.value = false
    window.prompt('Copy this link', window.location.href)
  }
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 1800)
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return (
    t.isContentEditable ||
    ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(t.tagName)
  )
}

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
  if (e.code === 'Space' || e.key === 'k') {
    e.preventDefault()
    running.value = !running.value
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault()
    emit('reset')
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(copiedTimer)
})
</script>

<template>
  <article class="sim">
    <header class="sim-head">
      <div>
        <h1>{{ title }}</h1>
        <p class="lede">{{ lede }}</p>
      </div>
      <div class="transport" role="toolbar" aria-label="Simulation controls">
        <button
          type="button"
          class="btn primary"
          :aria-pressed="running"
          aria-keyshortcuts="Space"
          @click="running = !running"
        >
          <svg v-if="running" aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          <svg v-else aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9.5-5.5z" fill="currentColor" /></svg>
          {{ running ? 'Pause' : 'Play' }}
        </button>
        <button type="button" class="btn" aria-keyshortcuts="R" @click="emit('reset')">Reset</button>
        <button type="button" class="btn" @click="copyLink">{{ copied ? 'Link copied' : 'Copy link' }}</button>
        <span class="fps mono" aria-hidden="true">{{ running && fps ? `${fps} fps` : 'paused' }}</span>
      </div>
    </header>

    <div class="body">
      <section class="stage" aria-label="Simulation view">
        <slot />
        <div v-if="$slots.readouts" class="readouts" aria-live="off">
          <slot name="readouts" />
        </div>
      </section>
      <aside class="panel" aria-label="Parameters">
        <h2 class="panel-title">Parameters</h2>
        <div class="controls">
          <slot name="controls" />
        </div>
        <p class="keys"><kbd>Space</kbd> play/pause · <kbd>R</kbd> reset</p>
      </aside>
    </div>

    <section v-if="$slots.explainer" class="explainer" aria-labelledby="physics-heading">
      <h2 id="physics-heading">The physics</h2>
      <slot name="explainer" />
    </section>
  </article>
</template>

<style scoped>
.sim {
  display: grid;
  gap: 1.25rem;
}
.sim-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}
h1 {
  margin: 0 0 0.25rem;
  font-size: clamp(1.5rem, 2.6vw, 2rem);
}
.lede {
  margin: 0;
  color: var(--fg-muted);
  max-width: 60ch;
}
.transport {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.fps {
  min-width: 4.5rem;
  font-size: 0.8rem;
  color: var(--fg-muted);
}
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 900px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
  }
}
.stage {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}
.stage :deep(canvas.main) {
  display: block;
  width: 100%;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--canvas-bg);
  touch-action: none;
}
.readouts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  font-size: 0.85rem;
  color: var(--fg-muted);
}
.readouts :deep(b) {
  color: var(--fg);
  font-weight: 600;
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}
.panel {
  position: sticky;
  top: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elev);
  box-shadow: var(--shadow);
}
@media (max-width: 900px) {
  .panel {
    position: static;
  }
}
.panel-title {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fg-muted);
}
.controls {
  display: grid;
  gap: 0.9rem;
}
.keys {
  margin: 1rem 0 0;
  font-size: 0.75rem;
  color: var(--fg-muted);
}
.explainer {
  max-width: 75ch;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border);
}
.explainer :deep(h3) {
  margin-top: 1.5rem;
  font-size: 1.05rem;
}
.explainer :deep(p),
.explainer :deep(li) {
  color: var(--fg);
}
</style>
