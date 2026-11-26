import type { Component } from 'vue'
import type { CanvasColors } from '@/composables/useTheme'

/** A tiny, cheap version of a simulation that animates in a gallery card. */
export interface Thumb {
  step(dt: number): void
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, colors: CanvasColors): void
}

export type ThumbFactory = (width: number, height: number) => Thumb

export interface SimEntry {
  slug: string
  title: string
  tagline: string
  topics: string[]
  load: () => Promise<{ default: Component }>
  thumb: () => Promise<{ createThumb: ThumbFactory }>
}

/** Every simulation in the gallery, in display order. */
export const sims: SimEntry[] = [
  {
    slug: 'wave',
    title: 'Wave interference',
    tagline: 'The 2D wave equation through single and double slits, with a far-field comparison.',
    topics: ['PDE', 'leapfrog', 'CFL'],
    load: () => import('./wave/WaveSim.vue'),
    thumb: () => import('./wave/thumb'),
  },
]

export function findSim(slug: string): SimEntry | undefined {
  return sims.find((s) => s.slug === slug)
}
