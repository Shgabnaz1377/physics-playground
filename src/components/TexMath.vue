<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'

const props = withDefaults(defineProps<{ expr: string; display?: boolean }>(), {
  display: false,
})

// Expressions are static strings authored in this repo, never user input.
const html = computed(() =>
  katex.renderToString(props.expr, {
    displayMode: props.display,
    throwOnError: false,
    output: 'htmlAndMathml',
  }),
)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div v-if="display" class="tex display" v-html="html" />
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span v-else class="tex" v-html="html" />
</template>

<style scoped>
.tex.display {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.25rem 0;
}
</style>
