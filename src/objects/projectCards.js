import * as THREE from 'three'

// ── Timing ─────────────────────────────────────────────────────────────────
const FADE_TIME  = 0.5   // seconds to fade in / out

// ── Layout: evenly spaced above the gravestone, same height ─────────────────
const SPACING = 5.5   // centre-to-centre distance between cards
const CARD_Y  = 7     // height above ground

const CARD_OFFSETS = [
  new THREE.Vector3(-SPACING, CARD_Y, 0),   // left
  new THREE.Vector3(       0, CARD_Y, 0),   // centre
  new THREE.Vector3( SPACING, CARD_Y, 0),   // right
]

const CARD_W = 5    // world units wide
const CARD_H = 3.2  // world units tall (matches 512×320 canvas aspect)

// ── Canvas word-wrap helper ─────────────────────────────────────────────────
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let   cur   = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxWidth) {
      if (cur) lines.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) lines.push(cur)
  return lines
}

// ── Build one card mesh ─────────────────────────────────────────────────────
function makeCard(project, worldPos) {
  const canvas  = document.createElement('canvas')
  canvas.width  = 512
  canvas.height = 320
  const ctx     = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)

  const material = new THREE.MeshBasicMaterial({
    map:         texture,
    transparent: true,
    depthWrite:  false,
    side:        THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), material)
  mesh.position.copy(worldPos)
  mesh.visible = false

  function draw(opacity) {
    const cw = canvas.width
    const ch = canvas.height
    ctx.clearRect(0, 0, cw, ch)

    // Card background
    const r = 12, px = 8, py = 8, w = cw - 16, h = ch - 16
    ctx.beginPath()
    ctx.moveTo(px + r, py)
    ctx.lineTo(px + w - r, py)
    ctx.arcTo(px + w, py,     px + w, py + r,     r)
    ctx.lineTo(px + w, py + h - r)
    ctx.arcTo(px + w, py + h, px + w - r, py + h, r)
    ctx.lineTo(px + r, py + h)
    ctx.arcTo(px,      py + h, px,        py + h - r, r)
    ctx.lineTo(px, py + r)
    ctx.arcTo(px, py, px + r, py, r)
    ctx.closePath()

    ctx.fillStyle   = `rgba(6, 6, 20, ${opacity * 0.88})`
    ctx.fill()
    ctx.strokeStyle = `rgba(${project.accentRGB}, ${opacity * 0.65})`
    ctx.lineWidth   = 2
    ctx.stroke()

    // Accent bar along the top edge
    ctx.fillStyle = `rgba(${project.accentRGB}, ${opacity * 0.85})`
    ctx.fillRect(px + 2, py + 2, w - 4, 5)

    // Title
    ctx.fillStyle    = `rgba(230, 235, 255, ${opacity})`
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'top'
    ctx.font         = 'bold 38px sans-serif'
    ctx.fillText(project.title, px + 14, py + 18)

    // Description — word-wrapped
    ctx.fillStyle = `rgba(170, 178, 215, ${opacity * 0.9})`
    ctx.font      = '22px sans-serif'
    const wrapped = wrapText(ctx, project.desc, w - 28)
    wrapped.forEach((line, i) => {
      ctx.fillText(line, px + 14, py + 72 + i * 30)
    })

    texture.needsUpdate = true
  }

  draw(1)   // prime texture

  return { mesh, draw }
}

// ── Public API ──────────────────────────────────────────────────────────────
/**
 * Creates three billboard project-preview cards that fade in after a delay,
 * hold for HOLD_TIME seconds, then fade out.
 *
 * @param {object}        opts
 * @param {object[]}      opts.projects        array of { title, desc, accentRGB }
 * @param {THREE.Vector3} opts.origin          gravestone world position
 * @param {number}       [opts.startDelay=1.2] seconds after show() before cards appear
 */
export function createProjectCards({ projects, origin, startDelay = 3.0 }) {
  const cards     = projects.map((p, i) =>
    makeCard(p, origin.clone().add(CARD_OFFSETS[i]))
  )
  const allMeshes = cards.map(c => c.mesh)

  let active  = false
  let elapsed = 0
  let phase   = 'idle'   // 'delay' | 'fadein' | 'hold' | 'fadeout'

  function show() {
    if (active) return
    active  = true
    elapsed = 0
    phase   = 'delay'
  }

  function hide() {
    if (!active) return
    elapsed = 0
    phase   = 'fadeout'
  }

  function isActive() {
    return active
  }

  function update(dt, camera) {
    if (!active) return
    elapsed += dt

    let opacity = 0

    if (phase === 'delay') {
      if (elapsed >= startDelay) { elapsed = 0; phase = 'fadein' }
      return   // cards still hidden during delay
    }

    if (phase === 'fadein') {
      opacity = Math.min(elapsed / FADE_TIME, 1)
      allMeshes.forEach(m => { m.visible = true })
      if (elapsed >= FADE_TIME) { elapsed = 0; phase = 'hold' }

    } else if (phase === 'hold') {
      opacity = 1   // stays visible until hide() is called

    } else if (phase === 'fadeout') {
      opacity = Math.max(1 - elapsed / FADE_TIME, 0)
      if (elapsed >= FADE_TIME) {
        active = false
        phase  = 'idle'
        allMeshes.forEach(m => { m.visible = false })
        return
      }
    }

    cards.forEach(({ mesh, draw }) => {
      draw(opacity)
      // Billboard: always face camera around Y axis
      mesh.rotation.y = Math.atan2(
        camera.position.x - mesh.position.x,
        camera.position.z - mesh.position.z,
      )
    })
  }

  return { meshes: allMeshes, show, hide, isActive, update }
}
