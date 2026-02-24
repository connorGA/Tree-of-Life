import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// How tall the desk should appear in world units
// Grass blades are ~0.5–1.2 units, so 3.5 gives a clearly visible desk
const TARGET_HEIGHT = 10

/**
 * Loads Desk.glb and places it to the right of the tree on the ground (y = 0).
 *
 * @param {THREE.Scene} scene
 * @param {number} trunkRadius  used to clear the trunk when computing x offset
 */
export function loadDesk(scene, trunkRadius) {
  const loader = new GLTFLoader()

  loader.load(
    '/models/Desk.glb',
    (gltf) => {
      const desk = gltf.scene

      // ── Normalise scale ────────────────────────────────────────────────
      const box  = new THREE.Box3().setFromObject(desk)
      const size = new THREE.Vector3()
      box.getSize(size)

      const scale = TARGET_HEIGHT / size.y
      desk.scale.setScalar(scale)

      // ── Sit on ground ──────────────────────────────────────────────────
      // Re-measure after applying scale so we know the exact bottom edge
      box.setFromObject(desk)
      desk.position.set(
        trunkRadius * 2 + 40,   // clear of trunk, to the right (+X)
        -box.min.y,             // lift so lowest point rests at y = 0
        -50                     // negative Z pushes it back, away from camera
      )

      // ── Face toward camera ─────────────────────────────────────────────
      // Camera is always at (cx, cy, cx) — equal X and Z — so it sits at 45°
      // in the XZ plane.  Rotating -135° around Y swings the model's default
      // -Z forward to point in the +X, +Z direction.
      // Adjust this value if your GLB has a different default facing.
      desk.rotation.y = -Math.PI * 0.25 + (160 * Math.PI / 180)

      // ── Shadows ────────────────────────────────────────────────────────
      desk.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true
          child.receiveShadow = true
        }
      })

      scene.add(desk)
    },
    undefined,
    (err) => console.error('[deskSystem] Failed to load Desk.glb', err)
  )
}
