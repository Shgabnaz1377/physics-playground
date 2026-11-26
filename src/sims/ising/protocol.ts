import type { IsingInit } from '@/physics/ising'

/** Messages from the page to the Ising worker. */
export type ToWorker =
  | { type: 'init'; L: number; T: number; h: number; seed: number; start: IsingInit }
  | { type: 'params'; T: number; h: number }
  | { type: 'run'; sweeps: number }
  | { type: 'scan'; temperatures: number[]; equilibrate: number; measure: number }
  | { type: 'cancel-scan' }

/** Messages from the Ising worker to the page. */
export type FromWorker =
  | { type: 'frame'; spins: Int8Array; e: number; m: number; sweeps: number; T: number }
  | { type: 'scan-point'; T: number; absM: number; e: number; chi: number; cv: number }
  | { type: 'scan-done' }
