/**
 * SplashScreen — 进入欢迎屏
 *
 * 动画时间线：
 *   1. 第一个字延迟 1s 后开始逐字显示（每字间隔 CHAR_INTERVAL ms）
 *   2. 遇到全角逗号额外停顿 500ms 再继续
 *   3. 细线在第一个字出现时同步从左侧向右延展（4s 匀速 CSS transition）
 *   4. 全部字显示完毕 → 停留 PHASE_HOLD ms
 *   5. 文字单独淡出（遮罩保持不透明，防止地图在此阶段透出）
 *   6. 纯黑屏停顿 PHASE_PAUSE ms
 *   7. 遮罩整体淡出 → 调用 onDone() 卸载组件，地图正式显现
 */

import { useEffect, useRef, useState } from 'react'
import StarField from './StarField'

interface Props {
  onDone: () => void
}

// ─── 欢迎文案 ────────────────────────────────────────────────────────────────
const TEXT = '真正的发现之旅，不在于寻找新风景，而在于拥有新眼光'

// ─── 动画时间常量（ms）────────────────────────────────────────────────────────
const CHAR_INTERVAL  = 150  // 每字出现间隔
const COMMA_PAUSE    = 500  // 逗号后额外停顿
const FIRST_DELAY    = 1000 // 首字延迟
const PHASE_HOLD     = 2000 // 全部显示后停留
const PHASE_TEXTOUT  = 700  // 文字淡出时长
const PHASE_PAUSE    = 900  // 黑屏停顿时长
const PHASE_FADEOUT  = 900  // 遮罩淡出时长
const LINE_DURATION  = 4000 // 细线延展时长（与打字过程大致同步）

export default function SplashScreen({ onDone }: Props) {
  const [visibleCount, setVisibleCount] = useState(0)   // 当前已显示字数
  const [lineVisible, setLineVisible] = useState(false)  // 细线是否开始延展
  const [textPhase, setTextPhase] = useState<'typing' | 'hold' | 'out'>('typing')
  const [screenOpacity, setScreenOpacity] = useState(1)
  const doneRef = useRef(false) // 防止 onDone 被重复调用

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    // ── 逐字调度 ──────────────────────────────────────────────────────────────
    // 首字延迟 FIRST_DELAY，遇到逗号额外累加 COMMA_PAUSE
    let accDelay = FIRST_DELAY
    for (let i = 0; i < TEXT.length; i++) {
      const delay = i * CHAR_INTERVAL + accDelay
      timers.push(setTimeout(() => setVisibleCount(i + 1), delay))
      if (TEXT[i] === '，') accDelay += COMMA_PAUSE
    }

    // 细线与首字同步启动
    timers.push(setTimeout(() => setLineVisible(true), FIRST_DELAY))

    // 打字结束时间（最后一字的触发时刻）
    const typingEnd = (TEXT.length - 1) * CHAR_INTERVAL + accDelay

    // ── 后续阶段调度 ──────────────────────────────────────────────────────────
    timers.push(setTimeout(() => setTextPhase('hold'), typingEnd))

    timers.push(setTimeout(
      () => setTextPhase('out'),
      typingEnd + PHASE_HOLD,
    ))

    timers.push(setTimeout(
      () => setScreenOpacity(0),
      typingEnd + PHASE_HOLD + PHASE_TEXTOUT + PHASE_PAUSE,
    ))

    timers.push(setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, typingEnd + PHASE_HOLD + PHASE_TEXTOUT + PHASE_PAUSE + PHASE_FADEOUT))

    return () => timers.forEach(clearTimeout)
  }, [onDone])

  const isOut  = textPhase === 'out'
  const isHold = textPhase === 'hold'

  return (
    // ── 全屏遮罩 ──────────────────────────────────────────────────────────────
    // opacity 从 1 → 0 时触发 CSS transition，完成后由 onDone 卸载
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

      {/* ── 文字区域 ────────────────────────────────────────────────────────── */}
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
          // 文字淡出 / 停留发光 使用独立 transition 属性避免互相覆盖
          opacity: isOut ? 0 : 1,
          textShadow: isHold
            ? '0 0 30px rgba(140,190,255,0.85), 0 0 70px rgba(90,150,255,0.45), 0 0 140px rgba(60,110,255,0.2)'
            : '0 0 10px rgba(140,190,255,0.25)',
          ...(isOut
            ? { transition: `opacity ${PHASE_TEXTOUT}ms ease` }
            : { transition: 'text-shadow 600ms ease' }
          ),
        }}
      >
        {/* 每个字独立 span，通过 opacity/transform 实现淡入上浮 */}
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

        {/* ── 细线：与首字同步，从左向右匀速延展 ───────────────────────────── */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 20,
            width: lineVisible ? '100%' : '0%',
            height: 1,
            background: 'linear-gradient(90deg, rgba(140,190,255,0.8), rgba(140,190,255,0.3))',
            transition: lineVisible ? `width ${LINE_DURATION}ms linear` : 'none',
          }}
        />
      </div>
    </div>
  )
}
