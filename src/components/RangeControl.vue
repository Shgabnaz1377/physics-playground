<script setup lang="ts">
import { computed, useId } from 'vue'
import { stepDecimals, type NumberParam } from '@/lib/params'

const props = defineProps<{
  label: string
  spec: NumberParam
  unit?: string
  /** Custom display formatter for the current value. */
  format?: (v: number) => string
  hint?: string
}>()

const model = defineModel<number>({ required: true })
const id = useId()

const shown = computed(() =>
  props.format ? props.format(model.value) : model.value.toFixed(stepDecimals(props.spec.step)),
)

function onInput(e: Event) {
  model.value = Number((e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="range">
    <div class="row">
      <label :for="id">{{ label }}</label>
      <output :for="id" class="mono">{{ shown }}<span v-if="unit" class="unit">&nbsp;{{ unit }}</span></output>
    </div>
    <input
      :id="id"
      type="range"
      :min="spec.min"
      :max="spec.max"
      :step="spec.step"
      :value="model"
      :aria-valuetext="`${shown}${unit ? ' ' + unit : ''}`"
      :aria-describedby="hint ? `${id}-hint` : undefined"
      @input="onInput"
    />
    <p v-if="hint" :id="`${id}-hint`" class="hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.range {
  display: grid;
  gap: 0.2rem;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.88rem;
}
label {
  color: var(--fg);
}
output {
  white-space: nowrap;
  color: var(--fg-muted);
  font-size: 0.82rem;
}
.unit {
  opacity: 0.8;
}
input[type='range'] {
  width: 100%;
  accent-color: var(--accent);
  margin: 0;
}
.hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--fg-muted);
}
</style>
