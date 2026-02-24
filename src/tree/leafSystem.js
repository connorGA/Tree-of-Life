/**
 * leafSystem.js
 *
 * Creates a single THREE.InstancedMesh that renders all leaf sprites.
 * Leaves cluster near the tips of deeper branches.
 *
 * Wind animation is injected into the built-in MeshLambertMaterial via
 * onBeforeCompile.  gl_InstanceID varies the phase per leaf so every
 * leaf sways independently without any extra per-instance attributes.
 */

import * as THREE from 'three'
import { noise, noise2, noise3 } from '../math/deterministicNoise.js'
import { LEAF_DEPTH_THRESHOLD, getLeafCount } from '../math/growthFunctions.js'

const LEAF_SIZE   = 1.15    // base leaf plane size (world units)
const LEAF_SPREAD = 1.8     // random offset radius around branch tip

// Shared geometry — a simple unit square; instancing handles placement
const LEAF_GEOMETRY = new THREE.PlaneGeometry(1, 1)

// Pre-allocated reusables
const _pos  = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scl  = new THREE.Vector3()
const _euler = new THREE.Euler()
const _mat  = new THREE.Matrix4()

/**
 * Build the instanced leaf mesh.
 *
 * @param {import('./treeGenerator.js').BranchData[]} branches
 * @param {number} branchCount
 * @returns {{
 *   mesh:     THREE.InstancedMesh,
 *   material: THREE.MeshLambertMaterial   (has .userData.shader after first render)
 * }}
 */
export function createLeafSystem(branches, branchCount) {

  // ── Material with procedural wind via onBeforeCompile ─────────────────
  const material = new THREE.MeshLambertMaterial({
    color: 0x50b850,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88
  })

  material.userData.shader = null

  material.onBeforeCompile = (shader) => {
    shader.uniforms.time = { value: 0.0 }

    // Inject uniform declaration at top of vertex shader
    shader.vertexShader = `uniform float time;\n` + shader.vertexShader

    // Inject wind displacement after the standard begin_vertex chunk.
    // 'transformed' is the local position before instancing / projection.
    // We use gl_InstanceID so every leaf has a unique wind phase.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */`
      #include <begin_vertex>

      // Wind sway — varies per instance via gl_InstanceID (WebGL2 built-in)
      float phase = float(gl_InstanceID) * 2.399963;  // golden-angle spacing
      float sway  = sin(time * 1.5 + phase) * 0.055;
      float sway2 = cos(time * 1.1 + phase * 0.7) * 0.035;

      // More motion near the leaf tip (position.y in [-0.5, 0.5])
      float tipFactor = 0.5 + position.y;
      transformed.x += sway  * tipFactor;
      transformed.z += sway2 * tipFactor;
      `
    )

    material.userData.shader = shader
  }

  // ── Count total leaf instances ────────────────────────────────────────
  // Accumulate which branches produce leaves and how many
  const leafJobs = []   // { branch, count }
  let totalLeaves = 0

  for (let i = 1; i <= branchCount; i++) {
    const b = branches[i]
    if (!b || b.depth < LEAF_DEPTH_THRESHOLD) continue

    const count = Math.max(1, getLeafCount(b.depth, i))
    leafJobs.push({ branch: b, count })
    totalLeaves += count
  }

  // ── Sort & budget ─────────────────────────────────────────────────────
  // Sort shallowest-first so visible depth-5..8 branches are always served
  // before sub-pixel outer twigs.  At high N (e.g. N=800000) the cap would
  // otherwise be exhausted on the first ~9 000 shallow branches while
  // ~190 000 outer branches got zero leaves — the "porcupine" look.
  leafJobs.sort((a, b) => a.branch.depth - b.branch.depth)

  // Dynamic per-branch cap: spread the budget evenly so every branch gets
  // at least a small cluster.  At low N the budget far exceeds natural
  // leaf counts, so nothing changes.  At N=800 000 (~205 k branches) this
  // gives each branch ~7 leaves minimum — enough to dot the tip green.
  const CAP = 1_500_000
  const budgetPerBranch = Math.max(12, Math.floor(CAP / Math.max(1, leafJobs.length)))

  const instanceCount = Math.min(totalLeaves, CAP)
  const mesh = new THREE.InstancedMesh(LEAF_GEOMETRY, material, instanceCount)
  mesh.castShadow = false
  mesh.name = 'leafSystem'

  // ── Fill instance matrices ────────────────────────────────────────────
  let idx = 0

  for (const { branch, count } of leafJobs) {
    if (idx >= instanceCount) break

    const actualCount = Math.min(count, budgetPerBranch)
    for (let l = 0; l < actualCount; l++) {
      if (idx >= instanceCount) break

      const seed = branch.index * 100 + l

      // Centre the cloud exactly half a spread-radius past the branch tip so
      // the tip sits at the mid-point of the cloud sphere — well buried no
      // matter how long the branch is (fixed world-unit offset, not a
      // fraction of branch.length).
      const push = LEAF_SPREAD * 0.5   // 0.75 world units past tip
      const cx = branch.end.x + branch.direction.x * push
      const cy = branch.end.y + branch.direction.y * push
      const cz = branch.end.z + branch.direction.z * push

      // Uniform spherical spread
      const ox = (noise(seed)     - 0.5) * LEAF_SPREAD * 2
      const oy = (noise(seed + 1) - 0.5) * LEAF_SPREAD * 2
      const oz = (noise(seed + 2) - 0.5) * LEAF_SPREAD * 2

      _pos.set(cx + ox, cy + oy, cz + oz)

      // Fully random orientation — leaves face in all directions
      _euler.set(
        noise(seed + 3) * Math.PI,
        noise(seed + 4) * Math.PI * 2,
        noise(seed + 5) * Math.PI
      )
      _quat.setFromEuler(_euler)

      // Size variation: ~0.7× to 1.3× of base size
      const s = LEAF_SIZE * (0.7 + noise2(seed + 6) * 0.6)
      _scl.set(s, s, s)

      _mat.compose(_pos, _quat, _scl)
      mesh.setMatrixAt(idx, _mat)
      idx++
    }
  }

  mesh.count = idx
  mesh.instanceMatrix.needsUpdate = true

  return { mesh, material }
}
