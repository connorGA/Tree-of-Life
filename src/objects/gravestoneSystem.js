import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createFloatingLabel } from './floatingLabel.js'
import { createProjectCards  } from './projectCards.js'

const TARGET_HEIGHT = 5

// ── Edit your failed (or any) projects here ─────────────────────────────────
const PROJECTS = [
  {
    title:     'App Concept',
    desc:      'Had a great idea. Built half of it. Decided it was a terrible idea.',
    accentRGB: '100, 140, 255',
  },
  {
    title:     'Game Prototype',
    desc:      'Three weeks of tutorials. One weekend of actual work. Zero shipped.',
    accentRGB: '180, 100, 255',
  },
  {
    title:     'CLI Tool',
    desc:      'Automated a task I do once a year. Spent two months building it.',
    accentRGB: '100, 210, 190',
  },
]

/**
 * @param {THREE.Scene} scene
 * @param {number} trunkHeight
 * @param {(group: THREE.Group, combined: object) => void} [onLoaded]
 */
export function loadGravestone(scene, trunkHeight, onLoaded) {
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

      // ── Position ──────────────────────────────────────────────────────
      const patchRadius = Math.max(70, trunkHeight * 3.2)
      const dist        = patchRadius * 0.80
      const x = -dist * 0.5
      const z = -dist * 0.7

      stone.position.set(x, -box.min.y, z)
      stone.lookAt(0, stone.position.y, 0)

      const SPIN = 90
      stone.rotation.y += SPIN * (Math.PI / 180)

      // ── Shared direction: stone → tree (used for label offset + cam fly)
      const origin    = new THREE.Vector3(x, 0, z)
      const dirToTree = new THREE.Vector3(-x, 0, -z).normalize()

      // ── Floating label ────────────────────────────────────────────────
      const label = createFloatingLabel({
        lines:    ['Here lies my failed projects.', 'Every failure a lesson learned.'],
        position: origin.clone().addScaledVector(dirToTree, 3),
      })
      scene.add(label.mesh)

      // ── Project cards — appear after the label rises ──────────────────
      const cards = createProjectCards({ projects: PROJECTS, origin })
      cards.meshes.forEach(m => scene.add(m))

      // ── Camera fly-to position: low in the grass, in front of the stone
      const camPos    = origin.clone().addScaledVector(dirToTree, 14)
      camPos.y        = 1.5
      const camTarget = origin.clone()
      camTarget.y     = 2.5

      // ── Shadows ───────────────────────────────────────────────────────
      stone.traverse((child) => {
        if (child.isMesh) {
          child.castShadow    = true
          child.receiveShadow = true
        }
      })

      scene.add(stone)

      // Bundle updates + a trigger() that main.js calls after the fly lands
      const combined = {
        update(dt, camera) {
          label.update(dt, camera)
          cards.update(dt, camera)
        },
        trigger() {
          label.show()
          cards.show()
        },
        isOpen()  { return cards.isActive() },
        close()   { cards.hide() },
      }

      onLoaded?.(stone, combined, camPos, camTarget)
    },
    undefined,
    (err) => console.error('[gravestoneSystem] Failed to load Gravestone RIP.glb', err)
  )
}
