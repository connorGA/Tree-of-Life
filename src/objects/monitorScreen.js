import * as THREE from 'three'

const MESSAGE    = "Hi! My name's Connor. Welcome to my sandbox. Feel free to hang around and enjoy the view. Check out some of the stuff I've built scattered around my desk."
const CHAR_DELAY = 35     // ms between typed characters
const BLINK_RATE = 530    // ms per cursor toggle

const CANVAS_W = 512
const CANVAS_H = 320
const GREEN    = '#00ff41'

/**
 * Creates a canvas-based monitor screen overlay with a matrix-style
 * "CLICK ME" idle state and a typewriter message on click.
 *
 * @param {object} opts
 * @param {THREE.Vector3} opts.position  world-space centre of the screen plane
 * @param {THREE.Euler}   opts.rotation  match the desk's rotation so it sits flush
 * @param {number}       [opts.width=3.5]
 * @param {number}       [opts.height=2.2]
 * @returns {{ mesh: THREE.Mesh, update: () => void }}
 */
export function createMonitorScreen({ position, rotation, width = 3.5, height = 2.2 }) {
  // ── Canvas ─────────────────────────────────────────────────────────────
  const canvas  = document.createElement('canvas')
  canvas.width  = CANVAS_W
  canvas.height = CANVAS_H
  const ctx = canvas.getContext('2d')

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
  )
  if (position) mesh.position.copy(position)
  if (rotation) mesh.rotation.copy(rotation)

  // ── State ──────────────────────────────────────────────────────────────
  let phase     = 'idle'   // 'idle' | 'typing' | 'done'
  let typed     = ''
  let charIdx   = 0
  let lastChar  = 0
  let cursorOn  = true
  let lastBlink = performance.now()

  // ── Word-wrap helper ───────────────────────────────────────────────────
  function wrap(text, maxPx) {
    const words = text.split(' ')
    const lines = []
    let line = ''
    for (const word of words) {
      const candidate = line ? line + ' ' + word : word
      if (ctx.measureText(candidate).width > maxPx && line) {
        lines.push(line)
        line = word
      } else {
        line = candidate
      }
    }
    if (line) lines.push(line)
    return lines
  }

  // ── Draw ───────────────────────────────────────────────────────────────
  function draw() {
    const now = performance.now()

    // Cursor blink
    if (now - lastBlink > BLINK_RATE) {
      cursorOn  = !cursorOn
      lastBlink = now
    }

    // Advance typing
    if (phase === 'typing' && now - lastChar > CHAR_DELAY) {
      typed   += MESSAGE[charIdx++]
      lastChar = now
      if (charIdx >= MESSAGE.length) phase = 'done'
    }

    // Background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    if (phase === 'idle') {
      // ── Centred "CLICK ME" + blinking cursor ───────────────────────────
      ctx.font         = 'bold 52px monospace'
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle    = GREEN
      ctx.fillText('CLICK ME', CANVAS_W / 2, CANVAS_H / 2 - 24)
      ctx.fillStyle = cursorOn ? GREEN : '#000000'
      ctx.fillText('_', CANVAS_W / 2, CANVAS_H / 2 + 40)
    } else {
      // ── Typewriter message ─────────────────────────────────────────────
      ctx.font         = '20px monospace'
      ctx.textAlign    = 'left'
      ctx.textBaseline = 'top'
      ctx.fillStyle    = GREEN

      const lineH = 30
      const lines = wrap(typed, CANVAS_W - 40)
      lines.forEach((l, i) => ctx.fillText(l, 20, 20 + i * lineH))

      // Cursor at end of last line
      const last = lines[lines.length - 1] || ''
      const cx   = 20 + ctx.measureText(last).width
      const cy   = 20 + (lines.length - 1) * lineH
      ctx.fillStyle = cursorOn ? GREEN : '#000000'
      ctx.fillText('_', cx, cy)
    }

    texture.needsUpdate = true
  }

  // ── Click handler (called by raycaster in main.js) ─────────────────────
  mesh.userData.onClick = () => {
    if (phase === 'idle') {
      phase    = 'typing'
      typed    = ''
      charIdx  = 0
      lastChar = performance.now()
    }
  }

  draw()  // initial frame

  return { mesh, update: draw }
}
