<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'

const { theme, toggle } = useTheme()
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="top">
    <div class="wrap bar">
      <RouterLink to="/" class="brand" aria-label="Physics Playground home">
        <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="currentColor" opacity="0.12" />
          <path d="M6 32c6-14 10-14 13 0s7 14 13 0 7-14 13 0 7 14 13 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" />
        </svg>
        <span>Physics Playground</span>
      </RouterLink>
      <nav class="nav" aria-label="Main">
        <a href="https://github.com/Shgabnaz1377/physics-playground" rel="noopener">Source</a>
        <button
          type="button"
          class="btn theme"
          :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
          @click="toggle"
        >
          <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor" /><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></g></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" fill="currentColor" /></svg>
        </button>
      </nav>
    </div>
  </header>
  <main id="main" class="wrap" tabindex="-1">
    <RouterView />
  </main>
  <footer class="wrap foot">
    <p>MIT licensed · numerical cores are plain TypeScript, tested with Vitest.</p>
  </footer>
</template>

<style scoped>
.wrap {
  width: min(1240px, 100% - 2rem);
  margin-inline: auto;
}
.top {
  border-bottom: 1px solid var(--border);
  background: var(--bg-elev);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 650;
  color: var(--fg);
  text-decoration: none;
}
.brand svg {
  color: var(--accent);
}
.nav {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.92rem;
}
.nav a {
  color: var(--fg-muted);
  text-decoration: none;
}
.nav a:hover {
  color: var(--fg);
}
.theme {
  padding: 0.4rem 0.55rem;
}
main {
  padding: 1rem 0 3rem;
  outline: none;
}
.foot {
  padding: 1.5rem 0 2rem;
  border-top: 1px solid var(--border);
  color: var(--fg-muted);
  font-size: 0.85rem;
}
.foot p {
  margin: 0;
}
</style>
