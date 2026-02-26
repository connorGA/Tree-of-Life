/**
 * main.js — Tree of Life entry point
 *
 * Boot sequence:
 *  1. Initialise Three.js (renderer, scene, camera)
 *  2. Fetch & increment seed value from Supabase
 *  3. Generate deterministic tree data
 *  4. Build instanced branch + leaf meshes
 *  5. Start animation loop (wind, orbit controls, growth animation)
 */

import * as THREE from 'three'
import { createRenderer }  from './core/renderer.js'
import { createScene }     from './core/scene.js'
import { createCamera }    from './core/camera.js'
import { incrementAndGetSeedValue } from './db/supabaseClient.js'
import { generateTree }    from './tree/treeGenerator.js'
import { createBranchSystem } from './tree/branchSystem.js'
import { createLeafSystem }   from './tree/leafSystem.js'
import { createCosmicSystem } from './tree/cosmicSystem.js'
import { createGrassSystem }  from './tree/grassSystem.js'
import { createSpaceSystem }  from './space/spaceSystem.js'
import { loadDesk }           from './objects/deskSystem.js'
import { loadGuitar }         from './objects/guitarSystem.js'
import { loadBookshelf }      from './objects/bookshelfSystem.js'
import { loadGravestone }     from './objects/gravestoneSystem.js'
import { createVideoScreen }  from './objects/videoScreen.js'
import { createMonitorScreen } from './objects/monitorScreen.js'
import { flyCamera }          from './core/cinematic.js'
import { createSidebar }      from './ui/sidebar.js'

// ── DOM refs ──────────────────────────────────────────────────────────────
const canvas      = document.getElementById('canvas')
const loadingEl   = document.getElementById('loading')
const hudEl       = document.getElementById('hud')
const titleEl     = document.getElementById('title')
const visitEl     = document.getElementById('visit-count')
const statsEl     = document.getElementById('tree-stats')

// ── Growth animation state ────────────────────────────────────────────────
const GROW_DURATION = 2.8   // seconds for newest branch to grow in

// ── Main async boot ───────────────────────────────────────────────────────
async function init() {

  const sidebar = createSidebar()

  // Three.js foundation
  const renderer             = createRenderer(canvas)
  const scene                = createScene()
  const { camera, controls } = createCamera(renderer.domElement)

  // ── Fetch seed from Supabase ─────────────────────────────────────────
  const N = await incrementAndGetSeedValue()

  // ── Generate tree data ───────────────────────────────────────────────
  const { branches, branchCount, trunkHeight, trunkRadius, maxDepth } =
    generateTree(N)

  // ── Build instanced meshes ───────────────────────────────────────────
  const { mesh: branchMesh, animateNewest } =
    createBranchSystem(branches, branchCount, maxDepth)

  const { mesh: leafMesh, material: leafMaterial } =
    createLeafSystem(branches, branchCount)

  scene.add(branchMesh)
  scene.add(leafMesh)

  const { group: cosmicGroup, update: updateCosmic } =
    createCosmicSystem({ trunkHeight, trunkRadius, branchCount })
  scene.add(cosmicGroup)

  const { mesh: grassMesh, update: updateGrass } = createGrassSystem(trunkHeight)
  scene.add(grassMesh)

  const { group: spaceGroup, update: updateSpace } = createSpaceSystem()
  scene.add(spaceGroup)

  // ── Ground disc (shadow receiver under the grass blades) ─────────────
  const groundRadius = Math.max(70, trunkHeight * 3.2)
  const groundGeo    = new THREE.CircleGeometry(groundRadius, 64)
  const groundMat    = new THREE.MeshStandardMaterial({
    color: 0x0a1e04,
    roughness: 1.0,
    metalness: 0.0,
  })
  const groundDisc = new THREE.Mesh(groundGeo, groundMat)
  groundDisc.rotation.x   = -Math.PI / 2
  groundDisc.position.y   = -0.06   // below grass blade bases to avoid z-fighting
  groundDisc.receiveShadow = true
  scene.add(groundDisc)

  // ── Props ─────────────────────────────────────────────────────────────
  loadBookshelf(scene, trunkRadius)
  loadGuitar(scene, trunkRadius)
  let gravestoneLabel = null
  let graveFly        = null
  loadGravestone(scene, trunkHeight, (stoneGroup, combined, camPos, camTarget) => {
    gravestoneLabel = combined

    // Gravestone body — click toggles the fly-in + cards
    stoneGroup.traverse((child) => {
      if (child.isMesh) {
        clickTargets.push(child)
        child.userData.onClick = () => {
          if (combined.isOpen()) {
            combined.close()
          } else {
            if (graveFly && !graveFly.done) return
            graveFly = flyCamera({
              camera, controls,
              endPos:    camPos,
              endTarget: camTarget,
              duration:  2.5,
              onComplete: () => combined.trigger(),
            })
          }
        }
      }
    })

    // Project cards — clicking one opens the sidebar with that project's info
    combined.cardMeshes.forEach((mesh) => {
      clickTargets.push(mesh)
      mesh.userData.onClick = () => sidebar.open(mesh.userData.project)
    })
  })

  // Click detection — shared across all clickable meshes
  const clickCaster  = new THREE.Raycaster()
  const clickMouse   = new THREE.Vector2()
  const clickTargets = []

  canvas.addEventListener('click', (e) => {
    clickMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
    clickMouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    clickCaster.setFromCamera(clickMouse, camera)
    const hits = clickCaster.intersectObjects(clickTargets)
    if (hits.length > 0) {
      e.stopPropagation()   // prevent backdrop-close listeners from firing
      hits[0].object.userData.onClick?.()
    }
  })

  // ── Monitor screen (created once the desk GLB has loaded) ─────────────
  // monitorUpdate starts as a no-op and is replaced when the desk loads.
  let monitorUpdate = () => {}
  let deskFly       = null

  loadDesk(scene, trunkRadius, (deskGroup) => {
    // Log every mesh name so we can identify the screen mesh exactly
    console.log('[desk meshes]')
    deskGroup.traverse((child) => {
      if (child.isMesh) console.log(' •', child.name)
    })

    // Find the screen mesh — checks common naming conventions
    const SCREEN_KEYWORDS = ['screen', 'monitor', 'display', 'glass', 'lcd']
    let screenMesh = null
    deskGroup.traverse((child) => {
      if (screenMesh || !child.isMesh) return
      const n = child.name.toLowerCase()
      if (SCREEN_KEYWORDS.some(k => n.includes(k))) screenMesh = child
    })

    // World position & normal of the screen face
    const pos  = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const norm = new THREE.Vector3()

    if (screenMesh) {
      screenMesh.getWorldPosition(pos)
      screenMesh.getWorldQuaternion(quat)
      // Nudge slightly along the mesh's world +Z so the overlay sits in front
      norm.set(0, 0, 1).applyQuaternion(quat)
      pos.addScaledVector(norm, 0.05)
      console.log('[desk] screen mesh found:', screenMesh.name, pos)
    } else {
      // Fallback: centre of the desk bounding box, near the top
      const b = new THREE.Box3().setFromObject(deskGroup)
      b.getCenter(pos)
      pos.y = b.min.y + (b.max.y - b.min.y) * 0.85
      quat.setFromEuler(new THREE.Euler(0, -Math.PI * 0.25 + (160 * Math.PI / 180), 0))
      console.log('[desk] no screen mesh found — using fallback position', pos)
    }

    const MONITOR_Y_OFFSET = 2.6    // move up (+) or down (−)
    const MONITOR_TILT     = 90   // tip forward (+) or backward (−), degrees
    const MONITOR_SPIN     = 10    // rotate around the tilted screen's own normal, degrees
    const MONITOR_PAN      = 89    // rotate around the axis perpendicular to SPIN, degrees

    // Each quaternion is applied in the local frame of the previous,
    // so all three axes stay fully independent of each other.
    const tiltQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), MONITOR_TILT * (Math.PI / 180))
    const spinQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), MONITOR_SPIN * (Math.PI / 180))
    const panQ  = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), MONITOR_PAN  * (Math.PI / 180))
    const finalQuat = quat.clone().multiply(tiltQ).multiply(spinQ).multiply(panQ)

    const MONITOR_FORWARD  = 0.48    // push toward camera (+) or away (−)

    pos.y += MONITOR_Y_OFFSET
    const screenNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(finalQuat)
    pos.addScaledVector(screenNormal, MONITOR_FORWARD)
    const euler = new THREE.Euler().setFromQuaternion(finalQuat)

    const { mesh: monitorMesh, update } = createMonitorScreen({
      position: pos,
      rotation: euler,
      width:  4.2,
      height: 2.4,
    })

    scene.add(monitorMesh)
    monitorUpdate = update

    // ── Camera fly-to: position in front of the monitor screen ───────────
    const deskCamPos    = pos.clone().addScaledVector(screenNormal, 5)
    const deskCamTarget = pos.clone()

    function flyToDesk(onArrival) {
      if (deskFly && !deskFly.done) return
      // Already close enough — skip the fly and fire the callback directly
      if (camera.position.distanceTo(deskCamPos) < 4) {
        onArrival?.()
        return
      }
      deskFly = flyCamera({
        camera, controls,
        endPos:    deskCamPos,
        endTarget: deskCamTarget,
        duration:  2.0,
        onComplete: onArrival,
      })
    }

    // All desk GLB meshes — clicking any part flies you to the monitor
    deskGroup.traverse((child) => {
      if (!child.isMesh) return
      clickTargets.push(child)
      child.userData.onClick = () => flyToDesk()
    })

    // Monitor canvas overlay — fly in first, then trigger the typewriter
    const savedMonitorClick = monitorMesh.userData.onClick
    clickTargets.push(monitorMesh)
    monitorMesh.userData.onClick = () => flyToDesk(savedMonitorClick)

    // Re-align the two extra screens now that we know the desk's real position.
    // Centre sits directly above the monitor; left mirrors the right through that centre.
    const lookTarget = new THREE.Vector3(camera.position.x, 18, camera.position.z)

    const S2_OFFSET_X =  -2    // nudge centre screen left(−) / right(+)
    const S2_OFFSET_Y =  0    // nudge centre screen down(−) / up(+)
    const S2_OFFSET_Z =  -4    // nudge centre screen toward(−) / away(+)
    const S2_ROTATE_Y =  4    // tilt centre screen: left side forward(+) / backward(−), degrees

    const S3_OFFSET_X =  -1.5    // nudge left screen left(−) / right(+)
    const S3_OFFSET_Y =  0    // nudge left screen down(−) / up(+)
    const S3_OFFSET_Z =  -2   // nudge left screen toward(−) / away(+)
    const S3_ROTATE_Y =  20    // tilt left screen: left side forward(+) / backward(−), degrees

    screen2Group.position.set(pos.x + S2_OFFSET_X, 18 + S2_OFFSET_Y, pos.z + S2_OFFSET_Z)
    screen2Group.lookAt(lookTarget)
    screen2Group.rotateY(S2_ROTATE_Y * Math.PI / 180)

    screen3Group.position.set(
      2 * pos.x - (trunkRadius * 2 + 25) + S3_OFFSET_X,
      18 + S3_OFFSET_Y,
      2 * pos.z - (-40) + S3_OFFSET_Z,
    )
    screen3Group.lookAt(lookTarget)
    screen3Group.rotateY(S3_ROTATE_Y * Math.PI / 180)
  })

  // ── Video screens ─────────────────────────────────────────────────────
  const videoScreens = []   // grows as more screens are added

  const { group: screen1Group, screenMesh: screen1Mesh } = createVideoScreen({
    src:      '/assets/SyntheticSoul.mp4',
    position: new THREE.Vector3(trunkRadius * 2 + 25, 18, -40),
    width:    10,
  })
  // Face the screen toward the camera's starting position (stay vertical)
  screen1Group.lookAt(new THREE.Vector3(camera.position.x, 18, camera.position.z))
  scene.add(screen1Group)
  videoScreens.push(screen1Mesh)

  // ── Centre screen — directly above the desk ───────────────────────────
  const { group: screen2Group, screenMesh: screen2Mesh } = createVideoScreen({
    src:      '/assets/Course Engine_30_EM (1).mp4',
    position: new THREE.Vector3(trunkRadius * 2 + 40, 18, -40),
    width:    10,
  })
  screen2Group.lookAt(new THREE.Vector3(camera.position.x, 18, camera.position.z))
  scene.add(screen2Group)
  videoScreens.push(screen2Mesh)

  // ── Left screen — exact mirror of the right ────────────────────────────
  const { group: screen3Group, screenMesh: screen3Mesh } = createVideoScreen({
    src:      '/assets/project3.mp4',   // swap with your video
    position: new THREE.Vector3(trunkRadius * 2 + 55, 18, -40),
    width:    10,
  })
  screen3Group.lookAt(new THREE.Vector3(camera.position.x, 18, camera.position.z))
  scene.add(screen3Group)
  videoScreens.push(screen3Mesh)

  // ── Sidebar project data for each screen ─────────────────────────────
  const videoProject = {
    title:     'Synthetic Soul',
    desc:      'Add a short description of this project here.',
    accentRGB: '255, 100, 180',
    siteUrl:   '',
    githubUrl: '',
    notes:     'Add your notes about this project here.',
  }
  const videoProject2 = {
    title:     'Project Two',
    desc:      'Add a short description of this project here.',
    accentRGB: '100, 200, 255',
    siteUrl:   '',
    githubUrl: '',
    notes:     'Add your notes about this project here.',
  }
  const videoProject3 = {
    title:     'Project Three',
    desc:      'Add a short description of this project here.',
    accentRGB: '140, 255, 160',
    siteUrl:   '',
    githubUrl: '',
    notes:     'Add your notes about this project here.',
  }

  screen1Mesh.userData.onClick = () => sidebar.open(videoProject)
  screen2Mesh.userData.onClick = () => sidebar.open(videoProject2)
  screen3Mesh.userData.onClick = () => sidebar.open(videoProject3)
  clickTargets.push(screen1Mesh, screen2Mesh, screen3Mesh)

  // ── Video hover — unmute on enter, mute on leave ───────────────────
  const hoverCaster = new THREE.Raycaster()
  const hoverMouse  = new THREE.Vector2()
  let   activeVideo = null

  window.addEventListener('mousemove', (e) => {
    hoverMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
    hoverMouse.y = -(e.clientY / window.innerHeight) * 2 + 1

    hoverCaster.setFromCamera(hoverMouse, camera)

    // Pointer cursor for anything clickable (gravestone, monitor, video screen)
    const clickHits = hoverCaster.intersectObjects(clickTargets)
    const videoHits = hoverCaster.intersectObjects(videoScreens)
    canvas.style.cursor = (clickHits.length > 0 || videoHits.length > 0) ? 'pointer' : ''

    // Video audio toggle
    if (videoHits.length > 0) {
      const vid = videoHits[0].object.userData.videoEl
      if (activeVideo !== vid) {
        if (activeVideo) activeVideo.muted = true
        vid.muted   = false
        activeVideo = vid
      }
    } else if (activeVideo) {
      activeVideo.muted = true
      activeVideo       = null
    }
  })

  // ── Aim camera at tree ───────────────────────────────────────────────
  const cameraRadius = Math.max(30, trunkHeight * 2.5)
  camera.position.set(cameraRadius * 0.4, trunkHeight * 0.5, cameraRadius * 0.4)
  controls.target.set(0, trunkHeight * 0.45, 0)
  controls.update()

  // ── Update HUD ───────────────────────────────────────────────────────
  const leafCount  = leafMesh.count
  visitEl.textContent  = `VISIT #${N.toLocaleString()}`
  statsEl.textContent  = `${(branchCount + 1).toLocaleString()} BRANCHES · ${leafCount.toLocaleString()} LEAVES`

  // ── Hide loading overlay ─────────────────────────────────────────────
  loadingEl.classList.add('fade-out')
  setTimeout(() => {
    loadingEl.style.display = 'none'
    hudEl.style.display     = 'block'
    titleEl.style.display   = 'block'
  }, 900)

  // ── Animation loop ───────────────────────────────────────────────────
  const clock = new THREE.Clock()
  let prevElapsed = 0

  function animate() {
    requestAnimationFrame(animate)

    const elapsed = clock.getElapsedTime()
    const dt      = elapsed - prevElapsed
    prevElapsed   = elapsed

    // Camera flies
    graveFly?.tick(dt)
    deskFly?.tick(dt)

    // Leaf wind — update time uniform once shader has compiled
    if (leafMaterial.userData.shader) {
      leafMaterial.userData.shader.uniforms.time.value = elapsed
    }

    // Monitor screen canvas
    monitorUpdate()

    // Gravestone floating label
    gravestoneLabel?.update(dt, camera)

    // Nebula pulse
    updateCosmic(elapsed)

    // Grass wind
    updateGrass(elapsed)

    // Space background (star twinkle + shooting stars)
    updateSpace(elapsed)

    // Newest branch growth animation
    if (elapsed < GROW_DURATION) {
      animateNewest(elapsed / GROW_DURATION)
    } else {
      // Ensure it finishes at exactly t=1 (idempotent)
      animateNewest(1)
    }

    controls.update()
    renderer.render(scene, camera)
  }

  animate()

  // ── Resize handler ───────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  })
}

init().catch((err) => {
  console.error('[Tree of Life] Fatal init error:', err)
  // Still show something — remove loading screen
  loadingEl.style.display = 'none'
})
