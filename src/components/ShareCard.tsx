import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import html2canvas from 'html2canvas'
import type { VisitedPlace } from '../types'
import { DEPTH_COLORS, TOTAL_COUNTRIES } from '../types'
import { useLang } from '../i18n/LangContext'

interface Props {
  visitedCountries: Record<string, VisitedPlace>
  onClose: () => void
}


export default function ShareCard({ visitedCountries, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const { t } = useLang()

  const list = Object.values(visitedCountries)
  const total = list.length
  const pct = Math.round((total / TOTAL_COUNTRIES) * 100)
  const long = list.filter(p => p.visitDepth === 'long')
  const short = list.filter(p => p.visitDepth === 'short')
  const passed = list.filter(p => p.visitDepth === 'passed')

  const handleDownload = async () => {
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: null,
      scale: 2,
    })
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${t.shareTitle}.png`
    a.click()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
        >
          {/* 分享卡片主体 */}
          <div
            ref={cardRef}
            style={{
              width: 360,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2744 100%)',
              borderRadius: 24,
              padding: 32,
              border: '1px solid #334155',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 背景装饰 */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 200, height: 200, borderRadius: '50%',
              background: 'radial-gradient(circle, #3b82f620 0%, transparent 70%)',
            }} />

            {/* 标题 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 6 }}>{t.shareTitle}</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.1 }}>
                {total}
                <span style={{ fontSize: 16, fontWeight: 400, color: '#64748b', marginLeft: 6 }}>{t.countriesUnit}</span>
              </div>
              <div style={{ fontSize: 13, color: '#3b82f6', marginTop: 6 }}>
                {t.shareSubtitle(pct)}
              </div>
            </div>

            {/* 进度条 */}
            <div style={{ marginBottom: 28 }}>
              <div style={{
                height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #3b82f6, #1d4ed8)', borderRadius: 3 }}
                />
              </div>
            </div>

            {/* 分类列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {long.length > 0 && (
                <CategoryRow label={t.longStayLabel} places={long} color={DEPTH_COLORS.long} />
              )}
              {short.length > 0 && (
                <CategoryRow label={t.shortStayLabel} places={short} color={DEPTH_COLORS.short} />
              )}
              {passed.length > 0 && (
                <CategoryRow label={t.passedLabel} places={passed} color={DEPTH_COLORS.passed} />
              )}
            </div>

            {/* 底部 */}
            <div style={{ textAlign: 'center', fontSize: 11, color: '#334155' }}>
              {t.shareFooter}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={onClose}
              className="ghost-btn"
              style={{
                padding: '10px 20px', borderRadius: 10,
                border: '1px solid #334155', background: 'transparent',
                color: '#94a3b8', cursor: 'pointer', fontSize: 14,
              }}
            >{t.close}</button>
            <button
              onClick={handleDownload}
              className="download-btn"
              style={{
                padding: '10px 24px', borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              }}
            >{t.download}</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

function CategoryRow({ label, places, color }: { label: string; places: VisitedPlace[]; color: string }) {
  const names = places.map(p => p.name).join('、')
  const display = names.length > 40 ? names.slice(0, 40) + '...' : names
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 3 }} />
      <div style={{ fontSize: 12, lineHeight: '14px' }}>
        <span style={{ color: '#64748b' }}>{label}：</span>
        <span style={{ color: '#cbd5e1' }}>{display}</span>
      </div>
    </div>
  )
}
