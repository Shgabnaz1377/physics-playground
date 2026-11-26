/**
 * Typed simulation parameters that round-trip through the URL query string.
 *
 * Each simulation declares a spec (defaults, ranges, allowed values). Values
 * parsed from the URL are validated and clamped against that spec, so a
 * hand-edited or stale link can never push a simulation outside its stable
 * parameter range.
 */

export interface NumberParam {
  type: 'number'
  default: number
  min: number
  max: number
  step: number
}

export interface BooleanParam {
  type: 'boolean'
  default: boolean
}

export interface EnumParam<O extends string = string> {
  type: 'enum'
  default: O
  options: readonly O[]
}

export type ParamSpec = NumberParam | BooleanParam | EnumParam
export type ParamSpecs = Record<string, ParamSpec>

export type ParamValues<S extends ParamSpecs> = {
  [K in keyof S]: S[K] extends NumberParam
    ? number
    : S[K] extends BooleanParam
      ? boolean
      : S[K] extends EnumParam<infer O>
        ? O
        : never
}

export type QueryLike = Record<string, unknown>

export function num(value: number, min: number, max: number, step = 1): NumberParam {
  if (!(min <= value && value <= max)) {
    throw new RangeError(`default ${value} outside [${min}, ${max}]`)
  }
  return { type: 'number', default: value, min, max, step }
}

export function bool(value: boolean): BooleanParam {
  return { type: 'boolean', default: value }
}

export function oneOf<const O extends string>(options: readonly O[], value: O): EnumParam<O> {
  if (!options.includes(value)) throw new RangeError(`default ${value} not in options`)
  return { type: 'enum', default: value, options }
}

/** Number of decimals implied by a step, e.g. 0.05 -> 2, 1 -> 0. */
export function stepDecimals(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 6
  const s = step.toString()
  if (s.includes('e-')) return Number(s.split('e-')[1])
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

function firstString(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0]
  return undefined
}

export function parseParam(spec: ParamSpec, raw: unknown): number | boolean | string {
  const s = firstString(raw)
  switch (spec.type) {
    case 'number': {
      if (s === undefined || s.trim() === '') return spec.default
      const x = Number(s)
      if (!Number.isFinite(x)) return spec.default
      return clamp(x, spec.min, spec.max)
    }
    case 'boolean':
      if (s === '1' || s === 'true') return true
      if (s === '0' || s === 'false') return false
      return spec.default
    case 'enum':
      return s !== undefined && spec.options.includes(s) ? s : spec.default
  }
}

export function parseParams<S extends ParamSpecs>(specs: S, query: QueryLike): ParamValues<S> {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(specs)) out[key] = parseParam(specs[key]!, query[key])
  return out as ParamValues<S>
}

export function defaults<S extends ParamSpecs>(specs: S): ParamValues<S> {
  return parseParams(specs, {})
}

function formatNumber(x: number, step: number): string {
  const fixed = x.toFixed(stepDecimals(step))
  // Trim trailing zeros so 0.50 -> 0.5 and 2.00 -> 2.
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

/** Serialise only values that differ from their defaults, keeping links short. */
export function serializeParams<S extends ParamSpecs>(
  specs: S,
  values: ParamValues<S>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of Object.keys(specs)) {
    const spec = specs[key]!
    const v = (values as Record<string, unknown>)[key]
    if (spec.type === 'number') {
      const str = formatNumber(v as number, spec.step)
      if (str !== formatNumber(spec.default, spec.step)) out[key] = str
    } else if (spec.type === 'boolean') {
      if (v !== spec.default) out[key] = v ? '1' : '0'
    } else if (v !== spec.default) {
      out[key] = String(v)
    }
  }
  return out
}
