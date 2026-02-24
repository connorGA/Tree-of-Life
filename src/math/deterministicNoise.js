/**
 * Deterministic pseudo-random utilities.
 * NO Math.random() — the same input always produces the same output.
 */

/** Fractional part of x */
export function fract(x) {
  return x - Math.floor(x)
}

/**
 * Canonical deterministic noise in [0, 1).
 * Based on the classic GLSL hash used in ShaderToy.
 */
export function noise(i) {
  return fract(Math.sin(i * 12.9898) * 43758.5453)
}

/** Second noise variant — different seed constants. */
export function noise2(i) {
  return fract(Math.sin(i * 78.233 + 1.0) * 43758.5453)
}

/** Third noise variant. */
export function noise3(i) {
  return fract(Math.sin(i * 39.346 + 2.0) * 43758.5453)
}

/**
 * Remap a noise value from [0,1) to [min, max].
 */
export function noiseRange(i, min, max) {
  return min + noise(i) * (max - min)
}
