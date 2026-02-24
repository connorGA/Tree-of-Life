import * as THREE from 'three'

// Ease-out quint — fast rush from far out, dramatic deceleration on landing
function easeOutQuint(t) {
  return 1 - Math.pow(1 - t, 5)
}

/**
 * Plays the intro cinematic: camera starts outside the cosmos looking in,
 * then flies through the atmosphere and lands in front of the monitor.
 *
 * Call tick(dt) every frame until done is true.
 * Controls are automatically re-enabled when the animation finishes.
 *
 * @param {object} opts
 * @param {THREE.PerspectiveCamera} opts.camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} opts.controls
 * @param {THREE.Vector3} opts.endPos     final camera world position
 * @param {THREE.Vector3} opts.endTarget  final look-at target
 * @param {number}       [opts.duration=7]  seconds
 */
export function startIntroCinematic({ camera, controls, endPos, endTarget, duration = 7 }) {
  // ── Start: pulled back far enough to see the full cosmos sphere ────────
  const startPos    = new THREE.Vector3(0, 350, 750)
  const startTarget = new THREE.Vector3(0, 30, 0)

  camera.position.copy(startPos)
  controls.target.copy(startTarget)
  controls.enabled    = false
  controls.autoRotate = false
  controls.update()

  let elapsed = 0
  let done    = false

  const _pos    = new THREE.Vector3()
  const _target = new THREE.Vector3()

  function tick(dt) {
    if (done) return

    elapsed = Math.min(elapsed + dt, duration)
    const e = easeOutQuint(elapsed / duration)

    _pos.lerpVectors(startPos, endPos, e)
    _target.lerpVectors(startTarget, endTarget, e)

    camera.position.copy(_pos)
    controls.target.copy(_target)
    controls.update()

    if (elapsed >= duration) {
      done = true
      controls.enabled    = true
      controls.autoRotate = true
    }
  }

  return {
    tick,
    get done() { return done },
  }
}

/**
 * Smoothly flies the camera from its current position to a new position.
 * Controls are disabled during the flight and re-enabled on landing.
 *
 * @param {object}             opts
 * @param {THREE.Camera}       opts.camera
 * @param {OrbitControls}      opts.controls
 * @param {THREE.Vector3}      opts.endPos
 * @param {THREE.Vector3}      opts.endTarget
 * @param {number}            [opts.duration=2.5]
 * @param {() => void}        [opts.onComplete]
 */
export function flyCamera({ camera, controls, endPos, endTarget, duration = 2.5, onComplete }) {
  const startPos    = camera.position.clone()
  const startTarget = controls.target.clone()

  controls.enabled    = false
  controls.autoRotate = false

  let elapsed = 0
  let done    = false

  const _pos    = new THREE.Vector3()
  const _target = new THREE.Vector3()

  function tick(dt) {
    if (done) return

    elapsed = Math.min(elapsed + dt, duration)
    const e = easeOutQuint(elapsed / duration)

    _pos.lerpVectors(startPos, endPos, e)
    _target.lerpVectors(startTarget, endTarget, e)

    camera.position.copy(_pos)
    controls.target.copy(_target)
    controls.update()

    if (elapsed >= duration) {
      done                = true
      controls.enabled    = true
      controls.autoRotate = false
      onComplete?.()
    }
  }

  return {
    tick,
    get done() { return done },
  }
}
