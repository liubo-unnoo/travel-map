import { useEffect, useRef } from 'react'

interface Props {
  onDone: () => void
}

// 穿越动效：地球放大 + 矩阵光点向外扩散 + 白光闪烁，持续约 1.2s
export default function WarpEffect({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const cx = canvas.width / 2
    const cy = canvas.height / 2
    const DURATION = 1200
    const start = performance.now()

    // 生成随机光点（矩阵风格）
    const dots = Array.from({ length: 120 }, () => ({
      angle: Math.random() * Math.PI * 2,
      speed: 180 + Math.random() * 320,
      r: 2 + Math.random() * 3,
      dist: 40 + Math.random() * 200,
      hue: 185 + Math.random() * 30,
    }))

    const animate = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / DURATION, 1)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 背景 vignette 渐深
      const vignette = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cx, cy))
      vignette.addColorStop(0, `rgba(6,13,26,0)`)
      vignette.addColorStop(1, `rgba(6,13,26,${t * 0.85})`)
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 中心放射光圈（模拟地球放大穿越）
      const ringCount = 4
      for (let i = 0; i < ringCount; i++) {
        const phase = (t * 2 + i / ringCount) % 1
        const radius = phase * Math.max(cx, cy) * 1.4
        const alpha = (1 - phase) * 0.25
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // 矩阵光点向外扩散
      for (const d of dots) {
        const traveled = d.speed * t
        const dist = d.dist + traveled
        const px = cx + Math.cos(d.angle) * dist
        const py = cy + Math.sin(d.angle) * dist
        const alpha = Math.max(0, 1 - t * 1.2) * 0.9

        // 拖尾
        const tailLen = 20 + traveled * 0.3
        const tx = px - Math.cos(d.angle) * tailLen
        const ty = py - Math.sin(d.angle) * tailLen
        const grad = ctx.createLinearGradient(tx, ty, px, py)
        grad.addColorStop(0, `hsla(${d.hue},100%,65%,0)`)
        grad.addColorStop(1, `hsla(${d.hue},100%,75%,${alpha})`)
        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(px, py)
        ctx.strokeStyle = grad
        ctx.lineWidth = d.r * 0.6
        ctx.stroke()

        // 亮核
        ctx.beginPath()
        ctx.arc(px, py, d.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${d.hue + 20},100%,90%,${alpha})`
        ctx.fill()
      }

      // 末尾白光闪烁
      if (t > 0.75) {
        const flash = (t - 0.75) / 0.25
        const flashAlpha = flash * flash * 0.95
        ctx.fillStyle = `rgba(220,248,255,${flashAlpha})`
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        onDoneRef.current()
      }
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // 只在挂载时运行一次，onDone 通过 ref 访问保持最新

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        pointerEvents: 'none',
      }}
    />
  )
}
