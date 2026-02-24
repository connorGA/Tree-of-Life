import * as THREE from 'three'

/**
 * Build the shared Three.js scene.
 *
 * Background is pure black — the spaceSystem fills the void with stars,
 * galaxies, nebulas, and shooting stars.  Only lights live here.
 *
 * @returns {THREE.Scene}
 */
export function createScene() {
  const scene = new THREE.Scene()
  // No fog, no sky sphere — deep space black handled by renderer clear colour

  // ── Lights ────────────────────────────────────────────────────────────

  // Soft ambient
  const ambient = new THREE.AmbientLight(0x2a5535, 2.8)
  scene.add(ambient)

  // Primary sun — warm directional from upper-right
  const sun = new THREE.DirectionalLight(0xfff5e0, 3.8)
  sun.position.set(60, 120, 40)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far  = 500
  sun.shadow.camera.left   = -80
  sun.shadow.camera.right  =  80
  sun.shadow.camera.top    =  80
  sun.shadow.camera.bottom = -80
  sun.shadow.bias = -0.0004
  scene.add(sun)

  // Subtle fill light from opposite direction
  const fill = new THREE.DirectionalLight(0x304858, 1.2)
  fill.position.set(-40, 30, -60)
  scene.add(fill)

  // Gentle hemisphere light for sky/ground bounce
  const hemi = new THREE.HemisphereLight(0x2a4a30, 0x152015, 1.4)
  scene.add(hemi)

  return scene
}
