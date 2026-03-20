// 共享的地图光效 pattern 渲染工具，WorldMap 和 ProvinceMap 共用

type PatternData = { width: number; height: number; data: Uint8Array }

// ── 点阵 pattern（低分辨率，正常缩放级别）──────────────────────
const DOT_DEFS = [
  { x: 6,  y: 8,  r: 2.2, a: 0.9,  phase: 0.0 },
  { x: 18, y: 4,  r: 1.4, a: 0.5,  phase: 0.8 },
  { x: 30, y: 10, r: 1.8, a: 0.75, phase: 1.6 },
  { x: 42, y: 5,  r: 1.0, a: 0.35, phase: 2.4 },
  { x: 12, y: 22, r: 1.2, a: 0.45, phase: 3.2 },
  { x: 24, y: 20, r: 2.5, a: 1.0,  phase: 0.4 },
  { x: 38, y: 24, r: 1.6, a: 0.6,  phase: 1.2 },
  { x: 4,  y: 36, r: 1.8, a: 0.7,  phase: 2.0 },
  { x: 16, y: 40, r: 1.1, a: 0.4,  phase: 2.8 },
  { x: 28, y: 34, r: 2.0, a: 0.85, phase: 0.6 },
  { x: 44, y: 38, r: 1.4, a: 0.55, phase: 1.4 },
  { x: 8,  y: 46, r: 1.0, a: 0.3,  phase: 3.6 },
  { x: 36, y: 44, r: 1.7, a: 0.65, phase: 2.2 },
]

const SIZE = 48
const patternCanvas = document.createElement('canvas')
patternCanvas.width = SIZE
patternCanvas.height = SIZE

export function renderDotPattern(t: number): PatternData {
  const ctx = patternCanvas.getContext('2d')!
  ctx.clearRect(0, 0, SIZE, SIZE)
  for (const d of DOT_DEFS) {
    const wave = (Math.sin(t * 1.2 + d.phase) + 1) / 2
    const px = d.x + Math.sin(t * 0.7 + d.phase * 1.3) * 1.5
    const py = d.y + Math.sin(t * 0.9 + d.phase * 0.8) * 1.2
    const alpha = d.a * (0.3 + wave * 0.7)
    const hue = 185 + Math.sin(t * 0.5 + d.phase) * 20
    const sat = 100
    const light = 55 + wave * 20
    const glow = ctx.createRadialGradient(px, py, 0, px, py, d.r * 2.2)
    glow.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha * 0.35})`)
    glow.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`)
    ctx.beginPath(); ctx.arc(px, py, d.r * 2.2, 0, Math.PI * 2)
    ctx.fillStyle = glow; ctx.fill()
    const core = ctx.createRadialGradient(px, py, 0, px, py, d.r * (0.8 + wave * 0.5))
    core.addColorStop(0, `hsla(${hue + 20},100%,90%,${alpha})`)
    core.addColorStop(0.5, `hsla(${hue},${sat}%,${light}%,${alpha * 0.8})`)
    core.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`)
    ctx.beginPath(); ctx.arc(px, py, d.r * (0.8 + wave * 0.5), 0, Math.PI * 2)
    ctx.fillStyle = core; ctx.fill()
  }
  return { width: SIZE, height: SIZE, data: new Uint8Array(ctx.getImageData(0, 0, SIZE, SIZE).data) }
}

// ── 高分辨率点阵 pattern（放大时使用）────────────────────────────
const SIZE_HI = 256
const hiPatternCanvas = document.createElement('canvas')
hiPatternCanvas.width = SIZE_HI
hiPatternCanvas.height = SIZE_HI

function seededRng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}
const _rng = seededRng(137)
const HI_DOT_DEFS = Array.from({ length: 60 }, () => ({
  x: _rng() * SIZE_HI,
  y: _rng() * SIZE_HI,
  r: 0.7 + _rng() * 2.0,
  a: 0.2 + _rng() * 0.8,
  phase: _rng() * Math.PI * 6,
}))

export function renderHiDotPattern(t: number): PatternData {
  const ctx = hiPatternCanvas.getContext('2d')!
  ctx.clearRect(0, 0, SIZE_HI, SIZE_HI)
  for (const d of HI_DOT_DEFS) {
    const wave = (Math.sin(t * 1.2 + d.phase) + 1) / 2
    const px = d.x + Math.sin(t * 0.7 + d.phase * 1.3) * 2.5
    const py = d.y + Math.sin(t * 0.9 + d.phase * 0.8) * 2.0
    const alpha = d.a * (0.3 + wave * 0.7)
    const hue = 185 + Math.sin(t * 0.5 + d.phase) * 20
    const sat = 100
    const light = 55 + wave * 20
    const glow = ctx.createRadialGradient(px, py, 0, px, py, d.r * 4)
    glow.addColorStop(0, `hsla(${hue},${sat}%,${light}%,${alpha * 0.4})`)
    glow.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`)
    ctx.beginPath(); ctx.arc(px, py, d.r * 4, 0, Math.PI * 2)
    ctx.fillStyle = glow; ctx.fill()
    const core = ctx.createRadialGradient(px, py, 0, px, py, d.r * (0.8 + wave * 0.5))
    core.addColorStop(0, `hsla(${hue + 20},100%,90%,${alpha})`)
    core.addColorStop(0.5, `hsla(${hue},${sat}%,${light}%,${alpha * 0.8})`)
    core.addColorStop(1, `hsla(${hue},${sat}%,${light}%,0)`)
    ctx.beginPath(); ctx.arc(px, py, d.r * (0.8 + wave * 0.5), 0, Math.PI * 2)
    ctx.fillStyle = core; ctx.fill()
  }
  return { width: SIZE_HI, height: SIZE_HI, data: new Uint8Array(ctx.getImageData(0, 0, SIZE_HI, SIZE_HI).data) }
}

// ── 流光边框 pattern ────────────────────────────────────────────
const FLOW_W = 1024
const FLOW_H = 5
const flowCanvas = document.createElement('canvas')
flowCanvas.width = FLOW_W
flowCanvas.height = FLOW_H

const COMETS = [
  { speed: 72,  tailLen: 280, brightness: 1.0,  offset: 0   },
  { speed: 45,  tailLen: 200, brightness: 0.7,  offset: 310 },
  { speed: 110, tailLen: 160, brightness: 0.55, offset: 620 },
  { speed: 58,  tailLen: 240, brightness: 0.85, offset: 180 },
  { speed: 88,  tailLen: 120, brightness: 0.5,  offset: 750 },
]

export function renderFlowPattern(t: number): PatternData {
  const ctx = flowCanvas.getContext('2d')!
  ctx.clearRect(0, 0, FLOW_W, FLOW_H)
  for (const c of COMETS) {
    const pos = ((t * c.speed + c.offset) % FLOW_W + FLOW_W) % FLOW_W
    for (let i = 0; i < c.tailLen; i++) {
      const px = Math.round(((pos - i) % FLOW_W + FLOW_W) % FLOW_W)
      const progress = 1 - i / c.tailLen
      const alpha = progress * progress * c.brightness * 0.9
      const hue = 188 + (1 - progress) * 25
      const light = 55 + progress * 35
      ctx.fillStyle = `hsla(${hue},100%,${light}%,${alpha})`
      ctx.fillRect(px, 0, 1, FLOW_H)
    }
    for (let dx = -3; dx <= 3; dx++) {
      const px = Math.round(((pos + dx) % FLOW_W + FLOW_W) % FLOW_W)
      const a = c.brightness * (1 - Math.abs(dx) * 0.28)
      ctx.fillStyle = `rgba(210,248,255,${a})`
      ctx.fillRect(px, 0, 1, FLOW_H)
    }
  }
  return { width: FLOW_W, height: FLOW_H, data: new Uint8Array(ctx.getImageData(0, 0, FLOW_W, FLOW_H).data) }
}
