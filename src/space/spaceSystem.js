/**
 * spaceSystem.js
 *
 * Three overlapping visual layers build the sky:
 *
 *   1. Stars — 3 500 sparse background + 25 000 in the galactic band,
 *      twinkling via vertex shader.
 *
 *   2. Nebula wash — three tiers of additive sprites along the galactic
 *      band:
 *        • 6 large haze blobs (400–700 units) — background colour mist
 *        • 20 main emission blobs (150–380 units) — vivid reds, purples, blues
 *        • 14 bright hot-spots (50–130 units) — luminous accent points
 *      Additive blending means overlapping shapes automatically mix into
 *      richer intermediate hues (red + blue → purple, etc.).
 *
 *   3. Shooting stars — 5 streaks on independent random timers.
 */

import * as THREE from 'three'
import { noise } from '../math/deterministicNoise.js'

// ── Constants ─────────────────────────────────────────────────────────────

const SPHERE_R   = 950
const BG_COUNT   = 3_500
const BAND_COUNT = 25_000
const BAND_SIGMA = 0.26     // ≈ 15° std dev → ~35° FWHM width
const SHOOT_SLOTS = 5

// ── Galactic plane (computed once) ────────────────────────────────────────
//
// Galactic north pole N tilted so the band sweeps from the horizon on one
// side, high overhead, and back down — a dramatic diagonal arc.

const _ngx = -0.55, _ngy = 0.18, _ngz = 0.82
const _ngL = Math.sqrt(_ngx*_ngx + _ngy*_ngy + _ngz*_ngz)
const NX = _ngx/_ngL, NY = _ngy/_ngL, NZ = _ngz/_ngL

// B1 = cross(N, worldUp)  →  horizontal, y = 0
const _b1L = Math.sqrt(NZ*NZ + NX*NX)
const B1X = -NZ/_b1L, B1Z = NX/_b1L   // B1Y = 0

// B2 = cross(N, B1)  →  passes through near-zenith
const _b2x = NY*B1Z
const _b2y = NZ*B1X - NX*B1Z
const _b2z = -NY*B1X
const _b2L = Math.sqrt(_b2x*_b2x + _b2y*_b2y + _b2z*_b2z)
const B2X = _b2x/_b2L, B2Y = _b2y/_b2L, B2Z = _b2z/_b2L

// Galactic centre at θ = 5π/4 → elevation ≈ 44°
const GC_THETA = Math.PI * 1.25
const GCX = Math.cos(GC_THETA)*B1X + Math.sin(GC_THETA)*B2X
const GCY =                           Math.sin(GC_THETA)*B2Y  // B1Y = 0
const GCZ = Math.cos(GC_THETA)*B1Z + Math.sin(GC_THETA)*B2Z

// ── Helpers ───────────────────────────────────────────────────────────────

// Point on the galactic band at (θ, δ), radius r.
// B1⊥N and B2⊥N so |result| = 1 already — no re-normalisation needed.
function bandPoint(theta, delta, r) {
  const cosT = Math.cos(theta), sinT = Math.sin(theta)
  const cosD = Math.cos(delta), sinD = Math.sin(delta)
  const px = B1X*cosT + B2X*sinT
  const py =            B2Y*sinT
  const pz = B1Z*cosT + B2Z*sinT
  return {
    x: (cosD*px + sinD*NX) * r,
    y: (cosD*py + sinD*NY) * r,
    z: (cosD*pz + sinD*NZ) * r,
  }
}

// Soft radial-gradient texture for nebula sprites.
function makeNebulaTex(r, g, b, peakAlpha = 1.0) {
  const sz  = 128
  const cvs = document.createElement('canvas')
  cvs.width = cvs.height = sz
  const ctx = cvs.getContext('2d')
  const cx  = sz / 2
  const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx)
  grd.addColorStop(0,    `rgba(${r},${g},${b},${peakAlpha})`)
  grd.addColorStop(0.22, `rgba(${r},${g},${b},${(peakAlpha*0.72).toFixed(2)})`)
  grd.addColorStop(0.50, `rgba(${r},${g},${b},${(peakAlpha*0.28).toFixed(2)})`)
  grd.addColorStop(0.78, `rgba(${r},${g},${b},${(peakAlpha*0.07).toFixed(2)})`)
  grd.addColorStop(1,    `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = grd
  ctx.fillRect(0, 0, sz, sz)
  return new THREE.CanvasTexture(cvs)
}

// Pre-allocated scratch vectors
const _head    = new THREE.Vector3()
const _tail    = new THREE.Vector3()
const _tangent = new THREE.Vector3()
const _down    = new THREE.Vector3(0, -1, 0)

// ─────────────────────────────────────────────────────────────────────────

export function createSpaceSystem() {
  const group = new THREE.Group()
  group.name  = 'spaceSystem'

  // ── Stars ───────────────────────────────────────────────────────────────

  const TOTAL = BG_COUNT + BAND_COUNT
  const starPos   = new Float32Array(TOTAL * 3)
  const starColor = new Float32Array(TOTAL * 3)
  const starSize  = new Float32Array(TOTAL)

  // Background — sparse, mostly dim blue-white
  for (let i = 0; i < BG_COUNT; i++) {
    const s     = i * 19 + 100
    const theta = noise(s)     * Math.PI * 2
    const phi   = Math.acos(2.0 * noise(s + 1) - 1.0)
    starPos[i*3]   = SPHERE_R * Math.sin(phi) * Math.cos(theta)
    starPos[i*3+1] = SPHERE_R * Math.cos(phi)
    starPos[i*3+2] = SPHERE_R * Math.sin(phi) * Math.sin(theta)
    const c = noise(s + 2)
    if (c > 0.88) {
      starColor[i*3]=0.78; starColor[i*3+1]=0.90; starColor[i*3+2]=1.00
    } else if (c > 0.65) {
      starColor[i*3]=1.00; starColor[i*3+1]=1.00; starColor[i*3+2]=1.00
    } else {
      starColor[i*3]=0.55; starColor[i*3+1]=0.55; starColor[i*3+2]=0.60
    }
    const sz = noise(s + 3)
    starSize[i] = sz > 0.97 ? 8.0 : sz > 0.90 ? 4.5 : sz > 0.68 ? 2.2 : 1.1
  }

  // Band stars — Gaussian around galactic plane, coloured by proximity to core
  for (let i = 0; i < BAND_COUNT; i++) {
    const si = BG_COUNT + i
    const s  = i * 23 + 10_000
    const theta = noise(s) * Math.PI * 2
    const u1    = Math.max(1e-6, noise(s + 1))
    const u2    = noise(s + 2)
    const delta = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) * BAND_SIGMA
    const bp    = bandPoint(theta, delta, SPHERE_R)
    starPos[si*3]=bp.x; starPos[si*3+1]=bp.y; starPos[si*3+2]=bp.z

    const dotGC  = (bp.x*GCX + bp.y*GCY + bp.z*GCZ) / SPHERE_R
    const tGC    = Math.min(1.0, Math.acos(Math.max(-1, Math.min(1, dotGC))) / (Math.PI * 0.55))
    const tBand  = Math.min(1.0, Math.abs(delta) / BAND_SIGMA)
    const jitter = noise(s + 3)

    let r, g, b
    if (tGC < 0.22 && tBand < 0.55) {
      r = 1.00;  g = 0.70 + jitter*0.22;  b = 0.14 + jitter*0.22   // orange-gold core
    } else if (tGC < 0.50) {
      const bl = tGC / 0.50
      r = 1.00;  g = 0.70 + bl*0.30 + jitter*0.08;  b = 0.14 + bl*0.68 + jitter*0.18
    } else if (tBand < 0.45) {
      r = 0.76 + jitter*0.24;  g = 0.88 + jitter*0.12;  b = 1.00   // blue-white arms
    } else {
      r = 0.60 + jitter*0.40;  g = 0.68 + jitter*0.32;  b = 0.86 + jitter*0.14
    }
    starColor[si*3]=r; starColor[si*3+1]=g; starColor[si*3+2]=b

    const coreBias = tGC < 0.25 ? 0.05 : 0
    const sz = noise(s + 4) + coreBias
    starSize[si] = sz > 0.97 ? 7.5 : sz > 0.90 ? 4.0 : sz > 0.68 ? 2.0 : 1.0
  }

  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos,   3))
  starGeo.setAttribute('color',    new THREE.BufferAttribute(starColor, 3))
  starGeo.setAttribute('size',     new THREE.BufferAttribute(starSize,  1))

  const starMat = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent:  true,
    depthWrite:   false,
    blending:     THREE.AdditiveBlending,
    uniforms: { time: { value: 0 } },
    vertexShader: `
      attribute float size;
      varying vec3  vColor;
      varying float vTwinkle;
      uniform float time;
      void main() {
        vColor = color;
        float phase = float(gl_VertexID) * 2.39996;
        vTwinkle = 0.72 + 0.28 * sin(time * 0.55 + phase);
        vec4 mvPos   = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * vTwinkle * (600.0 / -mvPos.z);
        gl_Position  = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3  vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float alpha = pow(1.0 - d, 1.6) * vTwinkle;
        gl_FragColor = vec4(vColor, alpha);
      }
    `
  })

  group.add(new THREE.Points(starGeo, starMat))

  // ── Nebula wash — three tiers of additive sprites ──────────────────────
  //
  // Overlapping additive blobs of different pure hues automatically mix
  // into richer intermediate colours at their intersections.
  // Tier layout:
  //   Haze  : very large, low opacity  → background colour atmosphere
  //   Main  : medium, vivid            → the dominant nebula colours
  //   Sparks: small, bright            → hot-spot accents

  function addSprite(x, y, z, r, g, b, scaleW, scaleH, opacity, rotation) {
    const mat = new THREE.SpriteMaterial({
      map:         makeNebulaTex(r, g, b),
      transparent: true,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      opacity,
      rotation,
    })
    const sprite = new THREE.Sprite(mat)
    sprite.position.set(x, y, z)
    sprite.scale.set(scaleW, scaleH, 1)
    group.add(sprite)
  }

  // ── Tier 1: Background haze — large low-opacity mist ─────────────────

  const hazeColors = [
    [ 80,  10, 170],  // deep violet
    [ 20,  50, 200],  // indigo-blue
    [170,  15,  60],  // dark crimson
    [  0, 120, 190],  // deep cyan
    [130,  10, 180],  // purple
    [ 20,  80, 160],  // steel blue
  ]
  for (let i = 0; i < hazeColors.length; i++) {
    const s     = i * 53 + 3000
    const theta = (i / hazeColors.length) * Math.PI * 2 + noise(s) * 0.8
    const delta = (noise(s + 1) - 0.5) * BAND_SIGMA * 1.5
    const bp    = bandPoint(theta, delta, SPHERE_R * 0.78)
    const scl   = 440 + noise(s + 2) * 280
    addSprite(bp.x, bp.y, bp.z,
      ...hazeColors[i],
      scl, scl * (0.55 + noise(s + 3) * 0.60),
      0.06 + noise(s + 4) * 0.06,
      noise(s + 5) * Math.PI)
  }

  // ── Tier 2: Main emission blobs — the vivid nebula colors ─────────────

  const mainColors = [
    [215,  20,  45],  // deep crimson  (H-II red)
    [230,  65,  15],  // orange-red
    [ 15,  65, 230],  // electric blue
    [120,  10, 200],  // deep violet
    [200,  15, 130],  // hot magenta
    [  0, 180, 220],  // vivid cyan
    [180,  20, 210],  // purple
    [230,  60, 100],  // rose-red
    [ 10, 140, 200],  // ocean blue
    [ 90,  10, 190],  // indigo
  ]
  for (let i = 0; i < 22; i++) {
    const s     = i * 37 + 5000
    const theta = (i / 22) * Math.PI * 2 + noise(s) * 0.7
    const delta = (noise(s + 1) - 0.5) * BAND_SIGMA * 2.2
    const bp    = bandPoint(theta, delta, SPHERE_R * 0.80)
    const col   = mainColors[Math.floor(noise(s + 2) * mainColors.length)]
    const scl   = 165 + noise(s + 3) * 220
    addSprite(bp.x, bp.y, bp.z,
      ...col,
      scl, scl * (0.45 + noise(s + 4) * 0.90),
      0.13 + noise(s + 5) * 0.14,
      noise(s + 6) * Math.PI)
  }

  // ── Tier 3: Bright hot-spots — luminous accent points ─────────────────

  const sparkColors = [
    [255,  90, 110],  // bright rose
    [100, 160, 255],  // bright blue
    [255, 120,  40],  // bright orange
    [190,  90, 255],  // bright lavender
    [  0, 230, 230],  // bright teal
    [255, 200, 100],  // bright amber
  ]
  for (let i = 0; i < 14; i++) {
    const s     = i * 29 + 7000
    const theta = noise(s) * Math.PI * 2
    const delta = (noise(s + 1) - 0.5) * BAND_SIGMA * 1.6
    const bp    = bandPoint(theta, delta, SPHERE_R * 0.82)
    const col   = sparkColors[Math.floor(noise(s + 2) * sparkColors.length)]
    const scl   = 55 + noise(s + 3) * 80
    addSprite(bp.x, bp.y, bp.z,
      ...col,
      scl, scl * (0.6 + noise(s + 4) * 0.8),
      0.22 + noise(s + 5) * 0.22,
      noise(s + 6) * Math.PI)
  }

  // ── Shooting Stars ────────────────────────────────────────────────────

  function spawnShootingStar(slot) {
    const theta = Math.random() * Math.PI * 2
    const phi   = Math.acos(0.08 + Math.random() * 0.88)
    const r     = SPHERE_R * 0.93
    slot.origin.set(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    )
    _tangent.set(-Math.sin(theta), 0, Math.cos(theta))
    slot.dir.copy(_tangent)
      .addScaledVector(_down, 0.10 + Math.random() * 0.30)
      .normalize()
    slot.duration    = 0.7 + Math.random() * 1.6
    slot.trailLength = 55  + Math.random() * 130
  }

  const slots = []
  for (let i = 0; i < SHOOT_SLOTS; i++) {
    const positions = new Float32Array(6)
    const posAttr   = new THREE.BufferAttribute(positions, 3)
    posAttr.setUsage(THREE.DynamicDrawUsage)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', posAttr)
    const mat = new THREE.LineBasicMaterial({
      color: 0xdde8ff, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    })
    group.add(new THREE.Line(geo, mat))
    slots.push({
      posAttr, positions, mat,
      active: false,
      nextFireTime: 1.5 + Math.random() * 10,
      fireTime: 0, duration: 0, trailLength: 0,
      origin: new THREE.Vector3(), dir: new THREE.Vector3(),
    })
  }

  // ── Update ─────────────────────────────────────────────────────────────

  function update(elapsed) {
    starMat.uniforms.time.value = elapsed

    for (const slot of slots) {
      if (!slot.active) {
        if (elapsed >= slot.nextFireTime) {
          slot.active   = true
          slot.fireTime = elapsed
          spawnShootingStar(slot)
        }
        continue
      }
      const t = (elapsed - slot.fireTime) / slot.duration
      if (t >= 1.0) {
        slot.active       = false
        slot.mat.opacity  = 0
        slot.nextFireTime = elapsed + 3 + Math.random() * 12
        continue
      }
      const fadeIn  = Math.min(1.0, t * 8.5)
      const fadeOut = t > 0.55 ? 1.0 - (t - 0.55) / 0.45 : 1.0
      slot.mat.opacity = fadeIn * fadeOut * 0.95

      const headDist = t * slot.trailLength
      const tailDist = Math.max(0, headDist - slot.trailLength * 0.42)
      _head.copy(slot.origin).addScaledVector(slot.dir, headDist)
      _tail.copy(slot.origin).addScaledVector(slot.dir, tailDist)
      slot.positions[0]=_tail.x; slot.positions[1]=_tail.y; slot.positions[2]=_tail.z
      slot.positions[3]=_head.x; slot.positions[4]=_head.y; slot.positions[5]=_head.z
      slot.posAttr.needsUpdate = true
    }
  }

  return { group, update }
}
