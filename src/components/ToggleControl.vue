<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label: string }>()
const model = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <div class="toggle">
    <input :id="id" v-model="model" type="checkbox" />
    <label :for="id">{{ label }}</label>
  </div>
</template>

<style scoped>
.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.88rem;
}
input {
  accent-color: var(--accent);
  width: 1rem;
  height: 1rem;
  margin: 0;
}
</style>
