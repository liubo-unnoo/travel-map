import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  vx: number          // 水平漂移速度
  vy: number          // 垂直漂移速度
  radius: number
  phase: number
  speed: number
  baseAlpha: number
}

const STAR_COUNT = 280

export default function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      starsRef.current = Array.from({ length: STAR_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        // 缓慢漂移，速度极小
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        radius: Math.random() * 1.4 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.6 + 0.2,
        baseAlpha: Math.random() * 0.7 + 0.5,
      }))
    }

    resize()
    window.addEventListener('resize', resize)

    let t = 0
    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)
      t += 0.016

      for (const star of starsRef.current) {
        // 缓慢移动，超出屏幕边界时从对侧回绕
        star.x += star.vx
        star.y += star.vy
        if (star.x < 0) star.x = w
        if (star.x > w) star.x = 0
        if (star.y < 0) star.y = h
        if (star.y > h) star.y = 0

        const wave = (Math.sin(t * star.speed + star.phase) + 1) / 2
        // 最亮降低 20%：原来峰值 0.05 + baseAlpha，现在乘 0.8
        const alpha = (0.05 + wave * star.baseAlpha) * 0.8
        const sr = star.radius * (0.6 + wave * 0.8)

        // 光晕弱化：半径缩小（sr*2 代替 sr*4），透明度减半
        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, sr * 2)
        glow.addColorStop(0, `rgba(180, 210, 255, ${alpha * 0.5})`)
        glow.addColorStop(1, 'rgba(180, 210, 255, 0)')
        ctx.beginPath()
        ctx.arc(star.x, star.y, sr * 2, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()

        // 星点核心
        ctx.beginPath()
        ctx.arc(star.x, star.y, sr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(220, 235, 255, ${Math.min(1, alpha * 1.5)})`
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  )
}
