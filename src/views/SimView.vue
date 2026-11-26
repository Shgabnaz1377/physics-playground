<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { findSim } from '@/sims/registry'
import NotFoundView from './NotFoundView.vue'

const props = defineProps<{ slug: string }>()

const entry = computed(() => findSim(props.slug))
const component = computed(() => (entry.value ? defineAsyncComponent(entry.value.load) : null))
</script>

<template>
  <div>
    <nav class="crumbs" aria-label="Breadcrumb">
      <RouterLink to="/">← All simulations</RouterLink>
    </nav>
    <component :is="component" v-if="component" :key="slug" />
    <NotFoundView v-else />
  </div>
</template>

<style scoped>
.crumbs {
  margin: 0.25rem 0 1rem;
  font-size: 0.9rem;
}
.crumbs a {
  text-decoration: none;
}
</style>
