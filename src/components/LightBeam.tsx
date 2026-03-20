import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

interface Props {
  map: maplibregl.Map | null
  countryCode: string | null
  onDone: () => void
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  hue: number
}

const DURATION = 3000 // ms

export default function LightBeam({ map, countryCode, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(0)
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    if (!map || !countryCode || !canvasRef.current) return

    const canvas = canvasRef.current
    const container = map.getContainer()
    canvas.width = container.offsetWidth
    canvas.height = container.offsetHeight

    // Query the country's screen polygon
    const features = map.querySourceFeatures('countries', {
      sourceLayer: '',
      filter: ['==', ['get', 'ADM0_A3'], countryCode],
    })

    if (!features.length) { onDone(); return }

    // Collect all screen points from the country geometry
    const screenPoints: [number, number][] = []
    for (const f of features) {
      const geom = f.geometry
      const rings = geom.type === 'Polygon'
        ? geom.coordinates
        : geom.type === 'MultiPolygon'
          ? geom.coordinates.flat()
          : []
      for (const ring of rings) {
        for (const coord of ring as [number, number][]) {
          const pt = map.project(coord as maplibregl.LngLatLike)
          screenPoints.push([pt.x, pt.y])
        }
      }
    }

    if (!screenPoints.length) { onDone(); return }

    // Bounding box of the country on screen
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const [x, y] of screenPoints) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }

    const cx = (minX + maxX) / 2
    const width = maxX - minX
    const beamTop = minY - canvas.height * 0.6

    // Spawn particles
    particlesRef.current = []
    const spawnParticles = () => {
      for (let i = 0; i < 40; i++) {
        const px = minX + Math.random() * width
        const py = minY + Math.random() * (maxY - minY) * 0.3
        particlesRef.current.push({
          x: px, y: py,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -(0.5 + Math.random() * 2.5),
          life: 0,
          maxLife: 60 + Math.random() * 80,
          size: 1 + Math.random() * 2.5,
          hue: 185 + Math.random() * 30,
        })
      }
    }
    spawnParticles()

    const ctx = canvas.getContext('2d')!
    startRef.current = performance.now()

    const draw = (now: number) => {
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / DURATION, 1)

      // Fade in first 0.3s, hold, fade out last 0.5s
      let alpha = 1
      if (progress < 0.1) alpha = progress / 0.1
      else if (progress > 0.7) alpha = 1 - (progress - 0.7) / 0.3

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // === Light beam (vertical column from country upward) ===
      const beamW = width * 0.6
      const grad = ctx.createLinearGradient(cx, maxY, cx, beamTop)
      grad.addColorStop(0, `rgba(0, 200, 255, ${0.55 * alpha})`)
      grad.addColorStop(0.3, `rgba(100, 220, 255, ${0.35 * alpha})`)
      grad.addColorStop(0.7, `rgba(150, 235, 255, ${0.12 * alpha})`)
      grad.addColorStop(1, `rgba(200, 245, 255, 0)`)

      // Beam shape: trapezoid narrowing upward
      ctx.beginPath()
      ctx.moveTo(cx - beamW / 2, maxY)
      ctx.lineTo(cx + beamW / 2, maxY)
      ctx.lineTo(cx + beamW * 0.08, beamTop)
      ctx.lineTo(cx - beamW * 0.08, beamTop)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // === Inner bright core ===
      const coreGrad = ctx.createLinearGradient(cx, maxY, cx, minY)
      coreGrad.addColorStop(0, `rgba(180, 245, 255, ${0.7 * alpha})`)
      coreGrad.addColorStop(0.5, `rgba(100, 220, 255, ${0.3 * alpha})`)
      coreGrad.addColorStop(1, `rgba(100, 220, 255, 0)`)
      ctx.beginPath()
      ctx.moveTo(cx - beamW * 0.12, maxY)
      ctx.lineTo(cx + beamW * 0.12, maxY)
      ctx.lineTo(cx + beamW * 0.03, minY)
      ctx.lineTo(cx - beamW * 0.03, minY)
      ctx.closePath()
      ctx.fillStyle = coreGrad
      ctx.fill()

      // === Halo at base ===
      const haloR = beamW * 0.7
      const halo = ctx.createRadialGradient(cx, maxY, 0, cx, maxY, haloR)
      halo.addColorStop(0, `rgba(0, 220, 255, ${0.4 * alpha})`)
      halo.addColorStop(0.5, `rgba(0, 180, 255, ${0.15 * alpha})`)
      halo.addColorStop(1, `rgba(0, 150, 255, 0)`)
      ctx.beginPath()
      ctx.ellipse(cx, maxY, haloR, haloR * 0.35, 0, 0, Math.PI * 2)
      ctx.fillStyle = halo
      ctx.fill()

      // === Particles ===
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy; p.life++
        const pAlpha = (1 - p.life / p.maxLife) * alpha
        const pg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2)
        pg.addColorStop(0, `hsla(${p.hue}, 100%, 85%, ${pAlpha})`)
        pg.addColorStop(1, `hsla(${p.hue}, 100%, 70%, 0)`)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
        ctx.fillStyle = pg
        ctx.fill()
      }
      // Remove dead particles and respawn while beam is active
      particlesRef.current = particlesRef.current.filter(p => p.life < p.maxLife)
      if (progress < 0.7 && particlesRef.current.length < 30) spawnParticles()

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(draw)
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        onDone()
      }
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [map, countryCode]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!countryCode) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  )
}
