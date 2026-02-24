/**
 * cosmicSystem.js
 *
 * A small number of slowly drifting firefly particles around the tree.
 * Each firefly has its own phase and speed so they wander independently.
 * Positions are updated every frame; the BufferAttribute is flagged Dynamic
 * so the GPU driver can optimise the repeated uploads.
 */

import * as THREE from 'three'
import { noise, noise2 } from '../math/deterministicNoise.js'

const FIREFLY_COUNT = 65

export function createCosmicSystem({ trunkHeight, trunkRadius, branchCount }) {
  const group = new THREE.Group()
  group.name  = 'cosmicSystem'

  const canopyRadius = Math.max(8, trunkHeight * 1.1)

  // ── Per-firefly data (computed once, read every frame) ─────────────────

  const baseX  = new Float32Array(FIREFLY_COUNT)
  const baseY  = new Float32Array(FIREFLY_COUNT)
  const baseZ  = new Float32Array(FIREFLY_COUNT)
  const phaseX = new Float32Array(FIREFLY_COUNT)
  const phaseY = new Float32Array(FIREFLY_COUNT)
  const phaseZ = new Float32Array(FIREFLY_COUNT)
  const speedX = new Float32Array(FIREFLY_COUNT)
  const speedY = new Float32Array(FIREFLY_COUNT)
  const speedZ = new Float32Array(FIREFLY_COUNT)

  const colors = new Float32Array(FIREFLY_COUNT * 3)
  const sizes  = new Float32Array(FIREFLY_COUNT)

  for (let i = 0; i < FIREFLY_COUNT; i++) {
    const s = i * 19 + 300

    // Gaussian spread centred on tree (Box-Muller)
    const u1  = Math.max(1e-4, noise(s))
    const u2  = noise(s + 1)
    const r   = Math.sqrt(-2.0 * Math.log(u1)) * canopyRadius * 0.55
    const ang = u2 * Math.PI * 2
    baseX[i]  = Math.cos(ang) * r
    baseY[i]  = noise(s + 2) * trunkHeight * 1.05   // full height range
    baseZ[i]  = Math.sin(ang) * r

    // Independent per-axis drift phases and speeds (very slow)
    phaseX[i] = noise(s + 3) * Math.PI * 2
    phaseY[i] = noise(s + 4) * Math.PI * 2
    phaseZ[i] = noise(s + 5) * Math.PI * 2
    speedX[i] = 0.18 + noise(s + 6) * 0.22
    speedY[i] = 0.10 + noise(s + 7) * 0.14
    speedZ[i] = 0.18 + noise(s + 8) * 0.22

    // Warm firefly palette: yellow-green, amber, occasional cool white
    const hue = noise(s + 9)
    if (hue > 0.75) {
      colors[i * 3] = 1.0;  colors[i * 3 + 1] = 0.98; colors[i * 3 + 2] = 0.55  // warm white
    } else if (hue > 0.45) {
      colors[i * 3] = 0.72; colors[i * 3 + 1] = 1.0;  colors[i * 3 + 2] = 0.25  // yellow-green
    } else {
      colors[i * 3] = 1.0;  colors[i * 3 + 1] = 0.80; colors[i * 3 + 2] = 0.20  // amber
    }

    sizes[i] = 0.38 + noise(s + 10) * 0.28   // 0.38–0.66, visibly larger than dust
  }

  // ── Geometry (positions updated every frame) ───────────────────────────

  const positions = new Float32Array(FIREFLY_COUNT * 3)
  const posAttr   = new THREE.BufferAttribute(positions, 3)
  posAttr.setUsage(THREE.DynamicDrawUsage)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', posAttr)
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('size',     new THREE.BufferAttribute(sizes,  1))

  // ── Material ───────────────────────────────────────────────────────────

  const mat = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent:  true,
    depthWrite:   false,
    blending:     THREE.AdditiveBlending,
    uniforms: {
      time:    { value: 0 },
      opacity: { value: 1.0 },
    },
    vertexShader: `
      attribute float size;
      varying vec3  vColor;
      varying float vPulse;
      uniform float time;
      void main() {
        vColor = color;
        // Each firefly pulses at its own rate using gl_VertexID as phase
        float phase = float(gl_VertexID) * 2.39996;
        vPulse = 0.45 + 0.55 * sin(time * 1.8 + phase);
        vec4 mvPos    = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize  = size * vPulse * (420.0 / -mvPos.z);
        gl_Position   = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3  vColor;
      varying float vPulse;
      void main() {
        // Soft circular glow
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float alpha = pow(1.0 - d, 1.6) * vPulse * opacity;
        gl_FragColor  = vec4(vColor, alpha);
      }
    `,
  })

  const points = new THREE.Points(geo, mat)
  group.add(points)

  // ── Update — drift positions and advance shader time ───────────────────

  const DRIFT = 2.2   // world-unit amplitude of the gentle wander

  function update(elapsed) {
    mat.uniforms.time.value = elapsed

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      positions[i * 3]     = baseX[i] + Math.sin(elapsed * speedX[i] + phaseX[i]) * DRIFT
      positions[i * 3 + 1] = baseY[i] + Math.sin(elapsed * speedY[i] + phaseY[i]) * DRIFT * 0.5
      positions[i * 3 + 2] = baseZ[i] + Math.sin(elapsed * speedZ[i] + phaseZ[i]) * DRIFT
    }

    posAttr.needsUpdate = true
  }

  return { group, update }
}
