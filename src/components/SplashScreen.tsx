import { useEffect, useRef, useState } from 'react'
import StarField from './StarField'

interface Props {
  onDone: () => void
}

// 动画时间线（ms）
const PHASE_FADEIN  = 500   // 纯淡入
const PHASE_GLOW    = 800   // 发光脉冲
const PHASE_HOLD    = 2000  // 停留
const PHASE_TEXTOUT = 700   // 文字单独淡出（遮罩保持不透明）
const PHASE_PAUSE   = 900   // 文字消失后纯黑屏停顿
const PHASE_FADEOUT = 900   // 遮罩整体淡出，地图显现

export default function SplashScreen({ onDone }: Props) {
  const [textPhase, setTextPhase] = useState<'in' | 'glow' | 'hold' | 'out'>('in')
  const [screenOpacity, setScreenOpacity] = useState(1)
  const doneRef = useRef(false)

  useEffect(() => {
    // t1: 淡入结束 → 发光
    const t1 = setTimeout(() => setTextPhase('glow'), PHASE_FADEIN)
    // t2: 发光结束 → 停留
    const t2 = setTimeout(() => setTextPhase('hold'), PHASE_FADEIN + PHASE_GLOW)
    // t3: 停留结束 → 文字淡出（遮罩仍不透明）
    const t3 = setTimeout(() => setTextPhase('out'), PHASE_FADEIN + PHASE_GLOW + PHASE_HOLD)
    // t4: 文字消失 + 黑屏停顿结束 → 遮罩开始淡出
    const t4 = setTimeout(() => setScreenOpacity(0),
      PHASE_FADEIN + PHASE_GLOW + PHASE_HOLD + PHASE_TEXTOUT + PHASE_PAUSE)
    // t5: 遮罩淡出结束 → 卸载组件
    const t5 = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone() }
    }, PHASE_FADEIN + PHASE_GLOW + PHASE_HOLD + PHASE_TEXTOUT + PHASE_PAUSE + PHASE_FADEOUT)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5) }
  }, [onDone])

  const textStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 2,
    // 艺术感衬线字体：优先 Google Fonts Cormorant / Garamond 系
    fontFamily: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
    fontSize: 'clamp(32px, 5.5vw, 64px)',
    fontWeight: 700,
    fontStyle: 'italic',
    letterSpacing: '0.08em',
    color: '#e8f0ff',
    userSelect: 'none',
    // 纯淡入，ease 和缓，不做位移
    transition: textPhase === 'in'
      ? `opacity ${PHASE_FADEIN}ms ease`
      : textPhase === 'out'
      ? `opacity ${PHASE_TEXTOUT}ms ease`
      : 'opacity 600ms ease',
    opacity: textPhase === 'in' ? 0 : textPhase === 'out' ? 0 : 1,
    textShadow: textPhase === 'glow' || textPhase === 'hold'
      ? '0 0 30px rgba(140,190,255,0.85), 0 0 70px rgba(90,150,255,0.45), 0 0 140px rgba(60,110,255,0.2)'
      : '0 0 10px rgba(140,190,255,0.25)',
  }

  const lineStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 2,
    marginTop: 20,
    width: textPhase === 'in' ? '0%' : '100%',
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(140,190,255,0.55), transparent)',
    transition: textPhase === 'in'
      ? `width ${PHASE_FADEIN * 0.7}ms ${PHASE_FADEIN * 0.3}ms ease`
      : textPhase === 'out'
      ? `opacity ${PHASE_TEXTOUT}ms ease`
      : 'none',
    opacity: textPhase === 'out' ? 0 : 1,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#060d1a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: screenOpacity,
        transition: screenOpacity === 0 ? `opacity ${PHASE_FADEOUT}ms ease` : 'none',
        pointerEvents: screenOpacity === 0 ? 'none' : 'auto',
      }}
    >
      <StarField />
      <div style={textStyle}>Welcome，My Friend</div>
      <div style={lineStyle} />
    </div>
  )
}
