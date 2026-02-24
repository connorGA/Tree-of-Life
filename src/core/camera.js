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
  controls.enableZoom = false   // replaced with custom unrestricted zoom below
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.4

  // Stop auto-rotate on user interaction, resume after idle
  let idleTimer = null
  const resumeDelay = 120_000 // 2 minutes idle before auto-rotate resumes

  function onInteract() {
    controls.autoRotate = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      controls.autoRotate = true
    }, resumeDelay)
  }

  domElement.addEventListener('pointerdown', onInteract, { passive: true })

  // Custom zoom — casts a ray through the mouse cursor and moves both
  // camera and orbit target along that exact direction.  No distance limit,
  // no target wall — the camera flies straight toward wherever the mouse points.
  const _raycaster = new THREE.Raycaster()
  const _mouse     = new THREE.Vector2()
  const _dir       = new THREE.Vector3()

  domElement.addEventListener('wheel', (e) => {
    e.preventDefault()
    onInteract()

    // Cursor position in normalised device coordinates (−1..+1)
    const rect = domElement.getBoundingClientRect()
    _mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    _mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1

    // Direction from camera through the cursor in world space
    _raycaster.setFromCamera(_mouse, camera)
    _dir.copy(_raycaster.ray.direction)

    const step = -e.deltaY * 0.35
    camera.position.addScaledVector(_dir, step)
    controls.target.addScaledVector(_dir, step)
  }, { passive: false })

  return { camera, controls }
}
