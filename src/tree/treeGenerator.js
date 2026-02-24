/**
 * treeGenerator.js
 *
 * Computes the complete structural data for every branch in the tree,
 * deterministically from a single integer N (the visit / seed count).
 *
 * Nothing random is used — the same N always produces the exact same tree.
 * No geometry is created here; only plain data objects are returned.
 */

import * as THREE from 'three'
import { noise } from '../math/deterministicNoise.js'
import {
  getBranchCount,
  getParentIndex,
  getTrunkHeight,
  getTrunkRadius,
  getBranchLength,
  getBranchRadius,
  getAttachmentT
} from '../math/growthFunctions.js'

// Reusable scratch vectors
const _perp = new THREE.Vector3()
const _up   = new THREE.Vector3(0, 1, 0)
const _side = new THREE.Vector3(1, 0, 0)

/**
 * Compute a branch direction by rotating the parent direction.
 *
 * Two angles drive the rotation:
 *   inclination — how far the child deviates from the parent axis.
 *                 Large at shallow depths (primary branches spread wide),
 *                 smaller at tips (growth mostly continues forward).
 *   azimuth     — full 360° spin around the parent axis, so siblings
 *                 fan evenly in all directions around it.
 *
 * @param {THREE.Vector3} parentDir  normalised parent direction
 * @param {number}        i          branch index (seed)
 * @param {number}        depth      depth in tree (1 = primary branch)
 * @returns {THREE.Vector3} normalised direction
 */
function computeBranchDirection(parentDir, i, depth) {
  // Primary branches spread nearly horizontal (55–85° from vertical).
  // Each level narrows the range so tips mostly continue their parent's path.
  const maxDev = Math.max(0.35, 1.60 - depth * 0.12)   // upper bound (radians)
  const minDev = Math.max(0.15, 1.10 - depth * 0.16)   // lower bound (radians)
  const inclination = minDev + noise(i * 11.37 + 3.0) * (maxDev - minDev)

  // Golden angle (2.39996 rad ≈ 137.5°) guarantees no two siblings share
  // the same azimuth sector regardless of how many branches exist.
  // A small noise jitter keeps growth organic without introducing gaps.
  const azimuth = (i * 2.39996 + noise(i * 3.17 + 0.5) * 0.8) % (Math.PI * 2)

  // Build a vector perpendicular to parentDir for the inclination axis
  if (Math.abs(parentDir.dot(_up)) < 0.99) {
    _perp.crossVectors(parentDir, _up).normalize()
  } else {
    _perp.crossVectors(parentDir, _side).normalize()
  }

  // Rotate: tilt away from parent axis, then spin around it
  const dir = parentDir.clone()
    .applyAxisAngle(_perp, inclination)
    .applyAxisAngle(parentDir, azimuth)

  // Prevent strongly downward growth
  dir.y = Math.max(dir.y, -0.1)

  return dir.normalize()
}

/**
 * @typedef {Object} BranchData
 * @property {number}         index      branch index (0 = trunk)
 * @property {number}         parentIndex -1 for trunk
 * @property {number}         depth      0 = trunk
 * @property {THREE.Vector3}  start      world-space start point
 * @property {THREE.Vector3}  end        world-space end point
 * @property {THREE.Vector3}  direction  normalised world-space direction
 * @property {number}         length     branch length (world units)
 * @property {number}         radius     cylinder radius (world units)
 * @property {null|*}         projectId  reserved for future project links
 */

/**
 * Generate all branch data from seed N.
 *
 * @param {number} N  visit count / seed value
 * @returns {{
 *   branches:     BranchData[],
 *   branchCount:  number,
 *   trunkHeight:  number,
 *   trunkRadius:  number,
 *   maxDepth:     number
 * }}
 */
export function generateTree(N) {
  const branchCount = getBranchCount(N)
  const trunkHeight = getTrunkHeight(N)
  const trunkRadius = getTrunkRadius(N)

  // Total slots: trunk (index 0) + branchCount branches
  const total = branchCount + 1
  const branches = new Array(total)
  const depths   = new Int32Array(total) // depths[i] = depth of branch i

  // ── Trunk (index 0) ───────────────────────────────────────────────────
  branches[0] = {
    index:       0,
    parentIndex: -1,
    depth:       0,
    start:       new THREE.Vector3(0, 0, 0),
    end:         new THREE.Vector3(0, trunkHeight, 0),
    direction:   new THREE.Vector3(0, 1, 0),
    length:      trunkHeight,
    radius:      trunkRadius,
    projectId:   null
  }
  depths[0] = 0

  let maxDepth = 0

  // ── Branches 1..branchCount ───────────────────────────────────────────
  for (let i = 1; i <= branchCount; i++) {
    const parentIdx = getParentIndex(i)   // always in [0, i-1]
    const parent    = branches[parentIdx]
    const depth     = depths[parentIdx] + 1
    depths[i] = depth

    if (depth > maxDepth) maxDepth = depth

    // Where along the parent the child attaches (t ∈ [0,1])
    const t     = getAttachmentT(i, depth)
    const start = new THREE.Vector3().lerpVectors(parent.start, parent.end, t)

    // Direction: rotated from parent axis so growth expands outward coherently
    const direction = computeBranchDirection(parent.direction, i, depth)

    const length = getBranchLength(depth, trunkHeight)
    const radius = getBranchRadius(depth, trunkRadius)
    const end    = start.clone().addScaledVector(direction, length)

    branches[i] = {
      index:       i,
      parentIndex: parentIdx,
      depth,
      start,
      end,
      direction,
      length,
      radius,
      projectId: null   // reserved — attach metadata later
    }
  }

  return { branches, branchCount, trunkHeight, trunkRadius, maxDepth }
}
