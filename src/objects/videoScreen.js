import * as THREE from 'three'

/**
 * Creates a floating video screen in 3D space.
 *
 * - Autoplays muted on loop (required by browser autoplay policy)
 * - Unmutes when the user hovers over it, mutes again on leave
 *
 * @param {object} opts
 * @param {string}        opts.src       path to video file (served from /public)
 * @param {THREE.Vector3} opts.position  world-space centre position
 * @param {number}       [opts.width=10] screen width in world units
 * @param {number}       [opts.height]   screen height — defaults to 16:9 of width
 * @returns {{ group: THREE.Group, screenMesh: THREE.Mesh, videoEl: HTMLVideoElement }}
 */
export function createVideoScreen({ src, position, width = 10, height }) {
  const h = height ?? width * (9 / 16)

  // ── HTML5 video element ────────────────────────────────────────────────
  const videoEl = document.createElement('video')
  videoEl.src         = src
  videoEl.loop        = true
  videoEl.muted       = true        // must start muted for autoplay to work
  videoEl.playsInline = true
  videoEl.preload     = 'auto'

  // Must be in the DOM — browsers refuse to play (and feed frames to a
  // VideoTexture) for detached video elements in many environments.
  videoEl.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none'
  document.body.appendChild(videoEl)

  // Attempt autoplay; if blocked retry on the first user click.
  const tryPlay = () => videoEl.play().catch(() => {})
  tryPlay()
  document.addEventListener('click', tryPlay, { once: true })

  // ── Video texture ──────────────────────────────────────────────────────
  const texture = new THREE.VideoTexture(videoEl)
  texture.colorSpace = THREE.SRGBColorSpace

  // ── Screen mesh ────────────────────────────────────────────────────────
  const screenMat  = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(width, h), screenMat)
  screenMesh.userData.videoEl = videoEl   // used by hover raycaster

  // ── Bezel / frame ──────────────────────────────────────────────────────
  const bezelW   = 0.5
  const frameMat = new THREE.MeshBasicMaterial({ color: 0x0d0d0d })
  const frameMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width + bezelW, h + bezelW),
    frameMat
  )
  frameMesh.position.z = -0.02

  // Subtle outer glow — a slightly larger emissive plane further back
  const glowMat  = new THREE.MeshBasicMaterial({ color: 0x1a3a5c, transparent: true, opacity: 0.35 })
  const glowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width + bezelW + 1.5, h + bezelW + 1.5),
    glowMat
  )
  glowMesh.position.z = -0.04

  // ── Back panel — visible when viewed from behind ───────────────────────
  // Rotated 180° so its face points in the −Z direction (away from the screen)
  const backMat  = new THREE.MeshBasicMaterial({ color: 0x1a1a1a })
  const backMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width + bezelW, h + bezelW),
    backMat
  )
  backMesh.rotation.y = Math.PI
  backMesh.position.z = -0.06   // just behind the glow plane

  // ── Group ──────────────────────────────────────────────────────────────
  const group = new THREE.Group()
  group.add(glowMesh)
  group.add(frameMesh)
  group.add(screenMesh)
  group.add(backMesh)
  group.position.copy(position)

  return { group, screenMesh, videoEl }
}
