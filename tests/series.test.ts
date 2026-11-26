import { describe, expect, it } from 'vitest'
import { RollingSeries } from '@/lib/series'

describe('RollingSeries', () => {
  it('keeps the most recent samples in order', () => {
    const s = new RollingSeries(3)
    for (const x of [1, 2, 3, 4, 5]) s.push(x)
    expect(s.length).toBe(3)
    expect(s.toArray()).toEqual([3, 4, 5])
    expect(s.last()).toBe(5)
  })

  it('computes trailing means', () => {
    const s = new RollingSeries(10)
    for (const x of [2, 4, 6, 8]) s.push(x)
    expect(s.meanOfLast(2)).toBe(7)
    expect(s.meanOfLast(100)).toBe(5)
  })

  it('clears', () => {
    const s = new RollingSeries(2)
    s.push(1)
    s.clear()
    expect(s.length).toBe(0)
    expect(s.last()).toBeUndefined()
    expect(s.meanOfLast(1)).toBeNaN()
  })

  it('rejects a zero capacity', () => {
    expect(() => new RollingSeries(0)).toThrow(RangeError)
  })
})
