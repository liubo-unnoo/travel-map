import { useEffect, useRef, useState } from 'react'
import StarField from './StarField'

interface Props {
  onDone: () => void
}

const TEXT = '真正的发现之旅，不在于寻找新风景，而在于拥有新眼光'

// 每个字的显示间隔（ms）
const CHAR_INTERVAL = 150
// 所有字显示完后的停留时间
const PHASE_HOLD    = 2000
// 文字单独淡出
const PHASE_TEXTOUT = 700
// 纯黑屏停顿
const PHASE_PAUSE   = 900
// 遮罩整体淡出
const PHASE_FADEOUT = 900


export default function SplashScreen({ onDone }: Props) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [lineWidth, setLineWidth] = useState(0)
  const [textPhase, setTextPhase] = useState<'typing' | 'hold' | 'out'>('typing')
  const [screenOpacity, setScreenOpacity] = useState(1)
  const doneRef = useRef(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    // 第一个字延迟 1 秒，逐字显示，遇到逗号后累加 500ms 延迟
    const FIRST_CHAR_DELAY = 1000
    let accumulatedDelay = FIRST_CHAR_DELAY

    for (let i = 0; i < TEXT.length; i++) {
      const baseDelay = i * CHAR_INTERVAL + accumulatedDelay
      timers.push(setTimeout(() => setVisibleCount(i + 1), baseDelay))

      // 如果当前字是逗号，后续字符延迟 500ms
      if (TEXT[i] === '，') {
        accumulatedDelay += 500
      }
    }

    // 细线在第一个字出现时开始延展，匀速延展到最后一个字
    const totalTypingTime = (TEXT.length - 1) * CHAR_INTERVAL + accumulatedDelay
    timers.push(setTimeout(() => setLineWidth(100), FIRST_CHAR_DELAY))

    // 全部显示完 → 停留
    timers.push(setTimeout(() => setTextPhase('hold'), totalTypingTime))

    // 停留结束 → 文字淡出
    timers.push(setTimeout(() => setTextPhase('out'), totalTypingTime + PHASE_HOLD))

    // 文字淡出 + 黑屏停顿结束 → 遮罩淡出
    timers.push(setTimeout(() => setScreenOpacity(0),
      totalTypingTime + PHASE_HOLD + PHASE_TEXTOUT + PHASE_PAUSE))

    // 遮罩淡出结束 → 卸载
    timers.push(setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone() }
    }, totalTypingTime + PHASE_HOLD + PHASE_TEXTOUT + PHASE_PAUSE + PHASE_FADEOUT))

    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const isOut = textPhase === 'out'
  const isHold = textPhase === 'hold'

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

      {/* 文字容器 */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'inline-block',
          fontFamily: '"Cormorant Garamond", "Playfair Display", "Noto Serif SC", Georgia, serif',
          fontSize: 'clamp(20px, 3.2vw, 42px)',
          fontWeight: 700,
          fontStyle: 'italic',
          letterSpacing: '0.12em',
          color: '#e8f0ff',
          userSelect: 'none',
          opacity: isOut ? 0 : 1,
          transition: isOut ? `opacity ${PHASE_TEXTOUT}ms ease` : 'none',
          textShadow: isHold
            ? '0 0 30px rgba(140,190,255,0.85), 0 0 70px rgba(90,150,255,0.45), 0 0 140px rgba(60,110,255,0.2)'
            : '0 0 10px rgba(140,190,255,0.25)',
          transitionProperty: isOut ? 'opacity' : 'text-shadow',
          transitionDuration: isOut ? `${PHASE_TEXTOUT}ms` : '600ms',
          transitionTimingFunction: 'ease',
        }}
      >
        {TEXT.split('').map((char, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: i < visibleCount ? 1 : 0,
              transform: i < visibleCount ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 200ms ease, transform 200ms ease',
            }}
          >
            {char}
          </span>
        ))}

        {/* 下方细线装饰：从文字左侧开始延展 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 20,
            width: `${lineWidth}%`,
            height: 1,
            background: 'linear-gradient(90deg, rgba(140,190,255,0.8), rgba(140,190,255,0.3))',
            transition: 'width 4000ms linear',
          }}
        />
      </div>
    </div>
  )
}

