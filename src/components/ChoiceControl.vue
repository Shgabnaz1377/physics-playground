<script setup lang="ts" generic="T extends string">
import { useId } from 'vue'

defineProps<{
  label: string
  options: readonly T[]
  /** Human-readable label per option; defaults to the option value. */
  labels?: Partial<Record<T, string>>
}>()

const model = defineModel<T>({ required: true })
const id = useId()
</script>

<template>
  <div class="choice">
    <label :for="id">{{ label }}</label>
    <select :id="id" v-model="model">
      <option v-for="o in options" :key="o" :value="o">{{ labels?.[o] ?? o }}</option>
    </select>
  </div>
</template>

<style scoped>
.choice {
  display: grid;
  gap: 0.25rem;
  font-size: 0.88rem;
}
select {
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elev);
}
</style>
