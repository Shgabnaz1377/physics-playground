import { describe, expect, it } from 'vitest'

describe('toolchain', () => {
  it('runs TypeScript tests', () => {
    expect([1, 2, 3].reduce((a, b) => a + b, 0)).toBe(6)
  })
})
