import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// How tall the desk should appear in world units
// Grass blades are ~0.5–1.2 units, so 3.5 gives a clearly visible desk
const TARGET_HEIGHT = 10

/**
 * Loads Desk.glb and places it to the right of the tree on the ground (y = 0).
 *
 * @param {THREE.Scene} scene
 * @param {number} trunkRadius
 * @param {(group: THREE.Group) => void} [onLoaded]  called with the desk group after load
 */
export function loadDesk(scene, trunkRadius, onLoaded) {
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
      box.setFromObject(desk)
      desk.position.set(
        trunkRadius * 2 + 40,
        -box.min.y,
        -50
      )

      // ── Face toward camera ─────────────────────────────────────────────
      desk.rotation.y = -Math.PI * 0.25 + (160 * Math.PI / 180)

      // ── Shadows ────────────────────────────────────────────────────────
      desk.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true
          child.receiveShadow = true
        }
      })

      scene.add(desk)
      onLoaded?.(desk)
    },
    undefined,
    (err) => console.error('[deskSystem] Failed to load Desk.glb', err)
  )
}
