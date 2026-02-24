import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/**
 * Create a perspective camera with OrbitControls.
 * @param {HTMLElement} domElement  renderer's canvas
 * @returns {{ camera: THREE.PerspectiveCamera, controls: OrbitControls }}
 */
export function createCamera(domElement) {
  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    5000
  )
  // Initial position — pulled back so the whole tree is visible on first load
  camera.position.set(35, 18, 35)

  const controls = new OrbitControls(camera, domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minDistance = 3
  controls.maxDistance = 600
  controls.maxPolarAngle = Math.PI * 0.92  // prevent flipping under ground
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.4

  // Stop auto-rotate on user interaction, resume after idle
  let idleTimer = null
  const resumeDelay = 6000 // ms

  function onInteract() {
    controls.autoRotate = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      controls.autoRotate = true
    }, resumeDelay)
  }

  domElement.addEventListener('pointerdown', onInteract, { passive: true })
  domElement.addEventListener('wheel', onInteract, { passive: true })

  return { camera, controls }
}
