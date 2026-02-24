import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Scale the guitar so its longest dimension is this many world units
const TARGET_LENGTH = 15

/**
 * Loads Guitar.glb, lays it flat in the grass on the left side of the tree.
 *
 * @param {THREE.Scene} scene
 * @param {number} trunkRadius
 */
export function loadGuitar(scene, trunkRadius) {
  const loader = new GLTFLoader()

  loader.load(
    '/models/Guitar.glb',
    (gltf) => {
      const guitar = gltf.scene

      // ── Scale by longest axis so the guitar reads well on the ground ───
      const box  = new THREE.Box3().setFromObject(guitar)
      const size = new THREE.Vector3()
      box.getSize(size)

      const longest = Math.max(size.x, size.y, size.z)
      const scale   = TARGET_LENGTH / longest
      guitar.scale.setScalar(scale)

      // ── Lay flat: tip the upright model onto its back ─────────────────
      guitar.rotation.x = -Math.PI / 2   // stand → lay face-up on ground
      guitar.rotation.z =  Math.PI / 6   // slight diagonal, looks natural

      // ── Sit on ground ─────────────────────────────────────────────────
      box.setFromObject(guitar)
      guitar.position.set(
        -trunkRadius * 2 - 10,   // left side of tree (−X from camera view)
        -box.min.y + 0.25,              // bottom edge rests at y = 0
        9                        // slightly toward camera
      )

      // ── Shadows ───────────────────────────────────────────────────────
      guitar.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true
          child.receiveShadow = true
        }
      })

      scene.add(guitar)
    },
    undefined,
    (err) => console.error('[guitarSystem] Failed to load Guitar.glb', err)
  )
}
