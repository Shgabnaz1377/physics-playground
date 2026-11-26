<script setup lang="ts">
import ThumbCanvas from '@/components/ThumbCanvas.vue'
import { sims } from '@/sims/registry'
</script>

<template>
  <div class="gallery">
    <section class="hero">
      <h1>Physics Playground</h1>
      <p>
        Interactive simulations of waves, chaos, phase transitions, diffusion, molecular dynamics
        and optimisation, computed live in your browser. Every parameter is a slider, every
        configuration is a shareable link, and every numerical core is unit-tested against the
        physics it claims to model.
      </p>
    </section>

    <ul class="grid" aria-label="Simulations">
      <li v-for="s in sims" :key="s.slug">
        <RouterLink :to="`/sim/${s.slug}`" class="card">
          <ThumbCanvas :entry="s" />
          <div class="meta">
            <h2>{{ s.title }}</h2>
            <p>{{ s.tagline }}</p>
            <ul class="topics" aria-label="Topics">
              <li v-for="t in s.topics" :key="t">{{ t }}</li>
            </ul>
          </div>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.hero {
  padding: 1.5rem 0 1.75rem;
  max-width: 70ch;
}
.hero h1 {
  margin: 0 0 0.5rem;
  font-size: clamp(2rem, 4.5vw, 2.9rem);
}
.hero p {
  margin: 0;
  color: var(--fg-muted);
  font-size: 1.05rem;
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.1rem;
}
.card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elev);
  box-shadow: var(--shadow);
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}
.card:hover,
.card:focus-visible {
  transform: translateY(-2px);
  border-color: var(--accent);
}
.meta {
  padding: 0.85rem 1rem 1rem;
  display: grid;
  gap: 0.35rem;
}
.meta h2 {
  margin: 0;
  font-size: 1.05rem;
}
.meta p {
  margin: 0;
  color: var(--fg-muted);
  font-size: 0.9rem;
}
.topics {
  list-style: none;
  padding: 0;
  margin: 0.25rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.topics li {
  font-size: 0.72rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--fg);
}
</style>
