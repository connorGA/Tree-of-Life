/**
 * All tree growth mathematics.
 * Every function is pure and deterministic — given the same inputs
 * it returns identical results, ensuring the tree always rebuilds
 * exactly from a single integer N (the visit / seed count).
 */

import { fract, noise } from './deterministicNoise.js'

// ── Constants for deterministic parent selection ──────────────────────────
const PARENT_A = 127.1
const PARENT_B = 311.7

// ── Constants for deterministic direction generation ─────────────────────
const DIR_C = 419.2
const DIR_D = 371.9
const DIR_E = 213.5
const DIR_F = 659.1

// ── Branch count ─────────────────────────────────────────────────────────

/**
 * Total number of non-trunk branches for visit count N.
 * Uses N^0.8 for rapid early growth that gradually decelerates.
 * Returns 0 for N <= 0.
 */
export function getBranchCount(N) {
  if (N <= 0) return 0
  return Math.floor(Math.pow(N, 0.9))
}

// ── Parent selection ──────────────────────────────────────────────────────

// Fan-out: how many child branches each node spawns on average.
// A value of 4 keeps depths shallow (log₄ N) so branches stay long.
const TREE_FANOUT = 4

/**
 * Deterministic parent index for branch i.
 *
 * Uses a systematic 4-ary tree layout so depth grows as log₄(N),
 * keeping branches long and the tree properly hierarchical.
 * A small ±1 jitter is applied with 20 % probability on each side
 * for organic variation without breaking the overall structure.
 */
export function getParentIndex(i) {
  if (i <= 0) return -1
  const base = Math.floor((i - 1) / TREE_FANOUT)
  const n    = fract(Math.sin(i * PARENT_A) * PARENT_B)
  const jitter = n < 0.2 ? -1 : n > 0.8 ? 1 : 0
  return Math.max(0, Math.min(i - 1, base + jitter))
}

// ── Branch direction ──────────────────────────────────────────────────────

/**
 * Deterministic unit direction vector for branch i.
 * Uses spherical coordinates with an upward bias (y = abs(cos φ)).
 * @returns {{ x: number, y: number, z: number }}
 */
export function getBranchDirection(i) {
  const theta = 2 * Math.PI * fract(Math.sin(i * DIR_C) * DIR_D)
  const rawPhi = 2 * fract(Math.sin(i * DIR_E) * DIR_F) - 1
  // Clamp to avoid NaN from acos
  const phi = Math.acos(Math.max(-1, Math.min(1, rawPhi)))

  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.abs(Math.cos(phi)), // upward bias — simulates natural growth
    z: Math.sin(phi) * Math.sin(theta)
  }
}

// ── Trunk dimensions ──────────────────────────────────────────────────────

/**
 * Trunk height grows slowly and forever via log(N+1).
 */
export function getTrunkHeight(N) {
  const BASE_HEIGHT = 6
  const HEIGHT_FACTOR = 5.5
  return BASE_HEIGHT + Math.log(N + 1) * HEIGHT_FACTOR
}

/**
 * Trunk radius — substantially thicker base, sqrt growth, generous cap.
 * At N=1000 → ~2.9 units radius.  At N=8000 → capped at 4.5 units.
 */
export function getTrunkRadius(N) {
  const BASE_RADIUS = 1.0
  const RADIUS_FACTOR = 0.060
  return Math.min(4.5, BASE_RADIUS + Math.sqrt(N) * RADIUS_FACTOR)
}

// ── Branch dimensions ─────────────────────────────────────────────────────

/**
 * Branch length scales with trunk height so the whole canopy grows as N rises.
 * Decays exponentially with depth so outer twigs are shorter than primary limbs.
 *
 * @param {number} depth
 * @param {number} trunkHeight  passed from generateTree so canopy scales with N
 */
export function getBranchLength(depth, trunkHeight) {
  const BASE_FRAC = 0.20   // depth-1 branch ≈ 20 % of trunk height
  const DECAY_K   = 0.09
  return Math.max(0.3, trunkHeight * BASE_FRAC * Math.exp(-DECAY_K * depth))
}

/**
 * Branch radius decays with depth, floored at a visual minimum.
 * The steeper decay (0.40 vs old 0.20) ensures leaf-bearing branches at
 * depth 5–7 taper to thinner than a single leaf, so foliage always dominates
 * the outer canopy regardless of how large the trunk grows.
 */
export function getBranchRadius(depth, trunkRadius) {
  const MIN_RADIUS = 0.012
  const DECAY_K = 0.40
  return Math.max(MIN_RADIUS, trunkRadius * Math.exp(-DECAY_K * depth))
}

// ── Attachment point ──────────────────────────────────────────────────────

/**
 * Where along the parent branch (t ∈ [0,1]) the child branch attaches.
 *
 * Primary branches spread along the trunk (structural limbs at various heights).
 * Deeper branches cluster progressively closer to the parent's tip, so each
 * generation visibly forks out from the end of the previous one — the natural
 * recursive Y-split you see in real trees.
 *
 * @param {number} i      branch index
 * @param {number} depth  depth in tree hierarchy
 */
export function getAttachmentT(i, depth) {
  // Primary branches (depth 1) can start from ~30% up the trunk so the
  // lower trunk isn't bare.  Deeper branches still cluster near tips.
  const minT = Math.min(0.85, 0.28 + depth * 0.10)
  return minT + noise(i * 3 + 7) * (1.0 - minT)
}

// ── Leaf count ────────────────────────────────────────────────────────────

/**
 * Number of leaf sprites to spawn at branch i's tip.
 * Only called for branches above LEAF_DEPTH_THRESHOLD.
 */
export function getLeafCount(depth, i) {
  return Math.floor(Math.pow(depth, 0.9) * 32 + noise(i) * 48)
}

// ── Depth threshold for leaves ────────────────────────────────────────────
export const LEAF_DEPTH_THRESHOLD = 1
