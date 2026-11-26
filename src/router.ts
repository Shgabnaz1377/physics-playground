import { createRouter, createWebHistory } from 'vue-router'
import GalleryView from './views/GalleryView.vue'
import SimView from './views/SimView.vue'
import NotFoundView from './views/NotFoundView.vue'
import { findSim } from './sims/registry'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'gallery', component: GalleryView },
    { path: '/sim/:slug', name: 'sim', component: SimView, props: true },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
  ],
  scrollBehavior(to, from) {
    // Query-only changes come from sliders writing state into the URL; keep scroll position.
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const sim = to.name === 'sim' ? findSim(String(to.params.slug)) : undefined
  document.title = sim ? `${sim.title} · Physics Playground` : 'Physics Playground'
})
