import * as THREE from 'three'

const RISE_HEIGHT = 9     // world units to float upward
const DURATION    = 4.5   // seconds for the full float

// Word-wrap a single string to fit inside maxWidth pixels given the current ctx font
function wrapLine(ctx, text, maxWidth) {
  const words = text.split(' ')
  const out   = []
  let   cur   = ''
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word
    if (ctx.measureText(test).width > maxWidth) {
      if (cur) out.push(cur)
      cur = word
    } else {
      cur = test
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * A canvas-based label that rises from a world position and fades out,
 * like a spirit leaving the ground.  Call show() to trigger it.
 *
 * @param {object} opts
 * @param {string[]}      opts.lines     text lines to display
 * @param {THREE.Vector3} opts.position  world-space origin (ground level)
 * @param {number}       [opts.width=7]
 */
export function createFloatingLabel({ lines, position, width = 7 }) {
  const aspect = 2.0          // less wide → taller panel, more room for text
  const height = width / aspect

  // ── Canvas ─────────────────────────────────────────────────────────────
  const canvas  = document.createElement('canvas')
  canvas.width  = 512
  canvas.height = Math.round(512 / aspect)   // 256 px tall
  const ctx = canvas.getContext('2d')

  const texture = new THREE.CanvasTexture(canvas)

  const material = new THREE.MeshBasicMaterial({
    map:         texture,
    transparent: true,
    depthWrite:  false,
    side:        THREE.DoubleSide,
  })

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
  mesh.visible = false

  // ── Draw ───────────────────────────────────────────────────────────────
  function draw(opacity) {
    const cw = canvas.width
    const ch = canvas.height

    ctx.clearRect(0, 0, cw, ch)

    // Ghost card background — manual rounded rect for broad browser support
    const r = 14, x = 8, y = 8, w = cw - 16, h = ch - 16
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y,     x + w, y + r,     r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x,      y + h, x,        y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()

    ctx.fillStyle = `rgba(8, 8, 18, ${opacity * 0.72})`
    ctx.fill()
    ctx.strokeStyle = `rgba(180, 190, 255, ${opacity * 0.4})`
    ctx.lineWidth = 2
    ctx.stroke()

    // Text — word-wrapped so nothing overflows the card
    const FONT_SIZE  = 26
    ctx.font         = `italic ${FONT_SIZE}px serif`
    ctx.fillStyle    = `rgba(220, 225, 255, ${opacity})`
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    const maxTextW   = cw - 48   // 24 px side padding
    const allWrapped = lines.flatMap(l => wrapLine(ctx, l, maxTextW))
    const lineSpacing = FONT_SIZE + 8
    const totalH      = allWrapped.length * lineSpacing
    const startY      = (ch - totalH) / 2 + FONT_SIZE / 2

    allWrapped.forEach((line, i) => {
      ctx.fillText(line, cw / 2, startY + i * lineSpacing)
    })

    texture.needsUpdate = true
  }

  // ── State ──────────────────────────────────────────────────────────────
  let active  = false
  let elapsed = 0

  function show() {
    if (active) return
    active     = true
    elapsed    = 0
    mesh.position.copy(position)
    mesh.visible = true
  }

  /**
   * Call every frame.
   * @param {number}              dt      delta time in seconds
   * @param {THREE.Camera}        camera  for billboarding
   */
  function update(dt, camera) {
    if (!active) return

    elapsed = Math.min(elapsed + dt, DURATION)
    const t = elapsed / DURATION

    // Rise
    mesh.position.y = position.y + t * RISE_HEIGHT

    // Opacity: fade in over first 20%, hold, fade out over last 25%
    let opacity
    if      (t < 0.20) opacity = t / 0.20
    else if (t > 0.75) opacity = 1 - (t - 0.75) / 0.25
    else               opacity = 1

    draw(opacity)

    // Always face the camera (billboard around Y axis only)
    mesh.rotation.y = Math.atan2(
      camera.position.x - mesh.position.x,
      camera.position.z - mesh.position.z
    )

    if (t >= 1) {
      active       = false
      mesh.visible = false
    }
  }

  draw(1)  // prime the texture

  return { mesh, show, update }
}
