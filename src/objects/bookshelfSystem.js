import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const TARGET_HEIGHT = 14

// Must match deskSystem values so the shelf sits flush against the desk
const DESK_X_BASE = 30   // trunkRadius * 2 + DESK_X_BASE is the desk center X
const DESK_Z      = -50  // desk Z position

// Same rotation as the desk
const ROTATION_Y = -Math.PI * 0.25 + (160 * Math.PI / 180)

/**
 * Loads Bookshelf.glb and places it just to the right of the desk,
 * facing the same direction.
 *
 * @param {THREE.Scene} scene
 * @param {number} trunkRadius
 */
export function loadBookshelf(scene, trunkRadius) {
  const loader = new GLTFLoader()

  loader.load(
    '/models/Bookshelf.glb',
    (gltf) => {
      const shelf = gltf.scene

      // ── Scale ─────────────────────────────────────────────────────────
      const box  = new THREE.Box3().setFromObject(shelf)
      const size = new THREE.Vector3()
      box.getSize(size)

      const scale = TARGET_HEIGHT / size.y
      shelf.scale.setScalar(scale)

      // ── Same facing as the desk ────────────────────────────────────────
      shelf.rotation.y = ROTATION_Y + 21

      // ── Position: to the camera-right of the desk (+X, −Z direction) ──
      // Re-measure after scale+rotation so the bounding box is accurate,
      // then use its X width to snug the shelf up against the desk side.
      box.setFromObject(shelf)
      const shelfHalfWidth = (box.max.x - box.min.x) / 2

      shelf.position.set(
        trunkRadius * 2 + DESK_X_BASE + -26 + shelfHalfWidth,
        -box.min.y,   // sit on ground
        DESK_Z + 25   // slightly further back to align with desk depth
      )

      // ── Shadows ───────────────────────────────────────────────────────
      shelf.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true
          child.receiveShadow = true
        }
      })

      scene.add(shelf)
    },
    undefined,
    (err) => console.error('[bookshelfSystem] Failed to load Bookshelf.glb', err)
  )
}
