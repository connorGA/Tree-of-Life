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
  const groundRadius = Math.max(80, trunkHeight * 3.5)
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
  loadDesk(scene, trunkRadius)
  loadBookshelf(scene, trunkRadius)
  loadGuitar(scene, trunkRadius)

  // ── Aim camera at tree ───────────────────────────────────────────────
  const cameraRadius = Math.max(30, trunkHeight * 2.5)
  camera.position.set(cameraRadius * 0.8, trunkHeight * 0.7, cameraRadius * 0.8)
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

  function animate() {
    requestAnimationFrame(animate)

    const elapsed = clock.getElapsedTime()

    // Leaf wind — update time uniform once shader has compiled
    if (leafMaterial.userData.shader) {
      leafMaterial.userData.shader.uniforms.time.value = elapsed
    }

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
