/**
 * grassSystem.js
 *
 * Renders a field of animated grass blades around the base of the tree
 * using a single InstancedMesh.
 *
 * Each blade is a thin quad (PlaneGeometry) whose origin sits at y = 0
 * (ground level) so it stands upright from the earth.  A custom wind
 * shader bends the tip while the base stays rooted.
 *
 * Nothing uses Math.random() — positions come from the same deterministic
 * noise hash as the rest of the tree.
 */

import * as THREE from 'three'
import { noise, noise2, noise3 } from '../math/deterministicNoise.js'

const BLADE_COUNT  = 400_000
const BLADE_WIDTH  = 0.09   // world units
const BLADE_HEIGHT_MIN = 0.50
const BLADE_HEIGHT_MAX = 1.20

// ── Geometry: thin upright quad, origin at bottom centre ──────────────────
// PlaneGeometry sits centred at (0,0,0) — we translate it up by 0.5 so the
// bottom edge sits at y = 0 (world ground).  Extra height segments allow
// the wind shader to bend the blade smoothly.
const bladeGeo = new THREE.PlaneGeometry(BLADE_WIDTH, 1, 1, 4)
bladeGeo.translate(0, 0.5, 0)   // bottom edge → y = 0

// Pre-allocated scratch objects
const _pos  = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scl  = new THREE.Vector3()
const _mat  = new THREE.Matrix4()
const _axisY = new THREE.Vector3(0, 1, 0)

/**
 * Build the instanced grass blade mesh.
 *
 * @param {number} trunkHeight  used to scale the radius of the grass patch
 * @returns {{ mesh: THREE.InstancedMesh, update: (elapsed: number) => void }}
 */
export function createGrassSystem(trunkHeight) {

  // ── Material with wind via onBeforeCompile ───────────────────────────────
  const material = new THREE.MeshLambertMaterial({
    color: 0x4ab830,
    side: THREE.DoubleSide,
  })

  material.userData.shader = null

  material.onBeforeCompile = (shader) => {
    shader.uniforms.time = { value: 0.0 }

    // Prepend uniform declaration
    shader.vertexShader = `uniform float time;\n` + shader.vertexShader

    // Replace begin_vertex with wind-displacement logic.
    // 'position.y' in [0, 1] after our translate(0, 0.5, 0).
    // tipFactor² keeps the base rigidly rooted.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */`
      #include <begin_vertex>

      // per-instance wind phase from gl_InstanceID
      float phase = float(gl_InstanceID) * 2.399963;
      float tt    = position.y * position.y;   // quadratic — base stays still

      float windX = sin(time * 1.35 + phase)          * tt * 0.28;
      float windZ = cos(time * 1.00 + phase * 0.618)  * tt * 0.18;

      transformed.x += windX;
      transformed.z += windZ;
      `
    )

    // Color gradient: dark at base, vivid bright green at tip
    shader.fragmentShader =
      `varying float vGrassY;\n` + shader.fragmentShader

    shader.vertexShader =
      `varying float vGrassY;\n` + shader.vertexShader

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\nvGrassY = position.y;`
    )

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec3 baseCol = vec3(0.04, 0.14, 0.02);
      vec3 tipCol  = vec3(0.24, 0.64, 0.08);
      diffuseColor.rgb = mix(baseCol, tipCol, vGrassY * vGrassY);
      `
    )

    material.userData.shader = shader
  }

  // ── Build instance matrices ───────────────────────────────────────────────
  const mesh = new THREE.InstancedMesh(bladeGeo, material, BLADE_COUNT)
  mesh.castShadow    = false
  mesh.receiveShadow = true
  mesh.name = 'grassSystem'

  const patchRadius = Math.max(70, trunkHeight * 3.2)

  for (let i = 0; i < BLADE_COUNT; i++) {
    const s = i * 7 + 1000   // seed offset (avoids collision with leaf noise)

    // Uniform disk distribution: sqrt gives uniform area density
    const r     = Math.sqrt(noise(s))     * patchRadius
    const angle = noise(s + 1) * Math.PI * 2

    _pos.set(
      Math.cos(angle) * r,
      0,
      Math.sin(angle) * r
    )

    // Random yaw so blades don't all face the same direction
    _quat.setFromAxisAngle(_axisY, noise(s + 2) * Math.PI * 2)

    // Height and slight lean (non-uniform scale in Y)
    const h = BLADE_HEIGHT_MIN + noise2(s + 3) * (BLADE_HEIGHT_MAX - BLADE_HEIGHT_MIN)
    _scl.set(1, h, 1)

    _mat.compose(_pos, _quat, _scl)
    mesh.setMatrixAt(i, _mat)
  }

  mesh.instanceMatrix.needsUpdate = true

  // ── Update function (called each frame) ──────────────────────────────────
  function update(elapsed) {
    if (material.userData.shader) {
      material.userData.shader.uniforms.time.value = elapsed
    }
  }

  return { mesh, update }
}
