import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const TARGET_HEIGHT = 5   // world units — visible but not dominating

/**
 * Loads the gravestone and places it 80 % of the way to the left edge
 * of the grass patch, sitting flush on the ground.
 *
 * "Left" from the camera (which sits at +X, +Z) is the (−X, +Z) diagonal.
 *
 * @param {THREE.Scene} scene
 * @param {number} trunkHeight  used to match the grass patch radius formula
 */
export function loadGravestone(scene, trunkHeight) {
  const loader = new GLTFLoader()

  loader.load(
    '/models/Gravestone RIP.glb',
    (gltf) => {
      const stone = gltf.scene

      // ── Scale ─────────────────────────────────────────────────────────
      const box  = new THREE.Box3().setFromObject(stone)
      const size = new THREE.Vector3()
      box.getSize(size)
      stone.scale.setScalar(TARGET_HEIGHT / size.y)

      // ── Sit on ground ─────────────────────────────────────────────────
      box.setFromObject(stone)

      // ── Position: 80 % from tree toward the back of the scene ───────────
      // Grass radius mirrors the formula in grassSystem.js
      const patchRadius = Math.max(70, trunkHeight * 3.2)
      const dist        = patchRadius * 0.80

      // "Behind the tree" from camera (+X,+Z) view = negative Z direction.
      // Slight −X lean puts it left-of-centre so it's visible from the desk.
      const x = -dist * 0.5
      const z = -dist * 0.7

      stone.position.set(x, -box.min.y, z)

      // Face toward the tree (origin) so the front of the stone is visible
      stone.lookAt(0, stone.position.y, 0)

      const SPIN = 90   // degrees — tweak to angle the stone
      stone.rotation.y += SPIN * (Math.PI / 180)

      // ── Shadows ───────────────────────────────────────────────────────
      stone.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true
          child.receiveShadow = true
        }
      })

      scene.add(stone)
    },
    undefined,
    (err) => console.error('[gravestoneSystem] Failed to load Gravestone RIP.glb', err)
  )
}
