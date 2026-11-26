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
  {
    slug: 'double-pendulum',
    title: 'Double pendulum',
    tagline: 'RK4 integration, energy-drift readout and two nearby trajectories diverging.',
    topics: ['ODE', 'RK4', 'chaos'],
    load: () => import('./pendulum/PendulumSim.vue'),
    thumb: () => import('./pendulum/thumb'),
  },
  {
    slug: 'ising',
    title: '2D Ising model',
    tagline: 'Metropolis Monte Carlo in a Web Worker, with a temperature scan against Onsager.',
    topics: ['Monte Carlo', 'phase transition', 'Web Worker'],
    load: () => import('./ising/IsingSim.vue'),
    thumb: () => import('./ising/thumb'),
  },
  {
    slug: 'heat',
    title: 'Heat diffusion',
    tagline: 'Draw walls, radiators and windows; total heat is conserved when the box is closed.',
    topics: ['PDE', 'FTCS', 'conservation'],
    load: () => import('./heat/HeatSim.vue'),
    thumb: () => import('./heat/thumb'),
  },
  {
    slug: 'lennard-jones',
    title: 'Lennard-Jones gas',
    tagline: 'Molecular dynamics with velocity Verlet; speeds relax to Maxwell–Boltzmann.',
    topics: ['molecular dynamics', 'Verlet', 'statistical mechanics'],
    load: () => import('./gas/GasSim.vue'),
    thumb: () => import('./gas/thumb'),
  },
  {
    slug: 'optimizers',
    title: 'Optimizer race',
    tagline: 'SGD, momentum, RMSProp and Adam on Rosenbrock, saddles and multimodal surfaces.',
    topics: ['optimisation', 'Adam', 'machine learning'],
    load: () => import('./optimizer/OptimizerSim.vue'),
    thumb: () => import('./optimizer/thumb'),
  },
  {
    slug: 'fourier',
    title: 'Fourier epicycles',
    tagline: 'Draw any closed curve and rebuild it from rotating circles; watch the error fall.',
    topics: ['Fourier series', 'DFT', 'Parseval'],
    load: () => import('./fourier/FourierSim.vue'),
    thumb: () => import('./fourier/thumb'),
  },
]

export function findSim(slug: string): SimEntry | undefined {
  return sims.find((s) => s.slug === slug)
}
