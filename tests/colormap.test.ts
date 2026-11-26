import { describe, expect, it } from 'vitest'
import { VIRIDIS, buildLut, hexToRgb, lutIndex, packRgba, unpackRgba } from '@/lib/colormap'

describe('colormap', () => {
  it('parses hex colours', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
    expect(hexToRgb('#fff')).toEqual([255, 255, 255])
  })

  it('packs RGBA in ImageData byte order on little-endian hosts', () => {
    const w = packRgba(1, 2, 3, 4)
    const bytes = new Uint8Array(new Uint32Array([w]).buffer)
    const littleEndian = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1
    expect([...bytes]).toEqual(littleEndian ? [1, 2, 3, 4] : [4, 3, 2, 1])
    expect(unpackRgba(w)).toEqual([1, 2, 3, 4])
  })

  it('hits both end stops exactly', () => {
    const lut = buildLut(VIRIDIS)
    expect(unpackRgba(lut[0]!).slice(0, 3)).toEqual(hexToRgb(VIRIDIS[0]!))
    expect(unpackRgba(lut[255]!).slice(0, 3)).toEqual(hexToRgb(VIRIDIS[VIRIDIS.length - 1]!))
  })

  it('clamps indices and survives NaN', () => {
    expect(lutIndex(-1, 0, 1)).toBe(0)
    expect(lutIndex(2, 0, 1)).toBe(255)
    expect(lutIndex(Number.NaN, 0, 1)).toBe(0)
    expect(lutIndex(0.5, 0, 1)).toBe(127)
  })
})
