/**
 * branchSystem.js
 *
 * Creates a single THREE.InstancedMesh that renders every branch
 * (including the trunk) in one GPU draw call.
 *
 * Each instance is a unit cylinder, scaled / rotated / translated via
 * its instance matrix to match the pre-computed BranchData.
 *
 * Visual approach
 * ───────────────
 *  • Base geometry: 12-sided cylinder with 4 height segments (smoother silhouette)
 *  • Vertex shader: subtle bark-ridge displacement along the radial direction
 *  • Fragment shader: dark galaxy nebula + star sparkles on the face,
 *    cosmic purple→cyan rim glow at the silhouette edges.
 */

import * as THREE from 'three'

// Tapered: top radius 0.62, bottom radius 1.0 — naturally narrower toward the tip.
// 16 radial × 8 height segments for a smooth silhouette and rich bark displacement.
const BRANCH_GEOMETRY = new THREE.CylinderGeometry(0.62, 1.0, 1, 16, 8)

// Pre-allocated reusables
const _pos  = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _scl  = new THREE.Vector3()
const _up   = new THREE.Vector3(0, 1, 0)
const _mat  = new THREE.Matrix4()
const _col  = new THREE.Color()

/**
 * Map branch depth to a cosmic glow tint (deep purple trunk → cyan tips).
 */
function depthColor(depth, maxDepth) {
  const t = maxDepth > 0 ? Math.min(1, depth / maxDepth) : 0
  _col.setRGB(
    0.45 * (1.0 - t),
    0.05 + t * 0.25,
    0.70 + t * 0.30
  )
  return _col.clone()
}

export function createBranchSystem(branches, branchCount, maxDepth) {
  const total = branchCount + 1

  const material = new THREE.MeshStandardMaterial({
    color: 0x010103,
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
  })

  material.customProgramCacheKey = () => 'cosmicBranchV3'

  material.onBeforeCompile = (shader) => {

    // ── Vertex: organic bark-ridge displacement ─────────────────────────
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */`
      #include <begin_vertex>

      vec3 radNorm = normalize(vec3(normal.x, 0.0, normal.z));
      float azimuth = atan(position.z, position.x);

      float bark = sin(position.y * 11.0 + azimuth * 2.5) * 0.075
                 + sin(position.y *  6.0 + azimuth * 4.8) * 0.045
                 + sin(position.y * 22.0 + azimuth * 1.1) * 0.020;
      transformed += radNorm * bark;
      `
    )

    // ── Fragment: black body + cosmic rim glow only ─────────────────────
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
      /* glsl */`
      #include <output_fragment>

      float cosA = clamp(abs(dot(normalize(vNormal), normalize(vViewPosition))), 0.0, 1.0);
      float rim  = pow(1.0 - cosA, 2.0);

      // Near-black body, vivid colour only at the silhouette rim
      gl_FragColor.rgb = gl_FragColor.rgb * 0.04 + vColor.rgb * rim * 3.2;
      `
    )
  }

  const mesh = new THREE.InstancedMesh(BRANCH_GEOMETRY, material, total)
  mesh.castShadow    = true
  mesh.receiveShadow = true
  mesh.name          = 'branchSystem'

  let newestTargetMatrix = null

  for (let i = 0; i < total; i++) {
    const b = branches[i]
    if (!b) continue

    _pos.addVectors(b.start, b.end).multiplyScalar(0.5)

    if (b.direction.y > -0.9999) {
      _quat.setFromUnitVectors(_up, b.direction)
    } else {
      _quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)
    }

    _scl.set(b.radius, b.length, b.radius)
    _mat.compose(_pos, _quat, _scl)

    if (i === branchCount && branchCount > 0) {
      newestTargetMatrix = _mat.clone()
      mesh.setMatrixAt(i, new THREE.Matrix4().compose(_pos, _quat, new THREE.Vector3(0, 0, 0)))
    } else {
      mesh.setMatrixAt(i, _mat)
    }

    mesh.setColorAt(i, depthColor(b.depth, maxDepth))
  }

  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  function animateNewest(t) {
    if (!newestTargetMatrix || branchCount === 0) return
    const branch = branches[branchCount]
    if (!branch) return

    const targetPos  = new THREE.Vector3()
    const targetQuat = new THREE.Quaternion()
    const targetScl  = new THREE.Vector3()
    newestTargetMatrix.decompose(targetPos, targetQuat, targetScl)

    const easedT = t < 1 ? 1 - Math.pow(1 - t, 3) : 1
    const currentScl = targetScl.clone().multiplyScalar(easedT)

    _mat.compose(targetPos, targetQuat, currentScl)
    mesh.setMatrixAt(branchCount, _mat)
    mesh.instanceMatrix.needsUpdate = true
  }

  return { mesh, animateNewest }
}
