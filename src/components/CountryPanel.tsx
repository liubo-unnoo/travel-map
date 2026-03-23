import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VisitedPlace } from '../types'
import { DEPTH_COLORS } from '../types'
import { useLang } from '../i18n/LangContext'
import GlowButton from './GlowButton'

interface Props {
  place: VisitedPlace | null
  isVisited: boolean
  onSave: (place: VisitedPlace) => void
  onRemove: (id: string) => void
  onClose: () => void
  onEnter: (place: VisitedPlace) => void
}

export default function CountryPanel({ place, isVisited, onSave, onRemove, onClose, onEnter }: Props) {
  const { t } = useLang()
  const [selectedDepth, setSelectedDepth] = useState(place?.visitDepth ?? 'short')
  const [note, setNote] = useState(place?.note ?? '')

  if (!place) return null

  const depthLabels = { passed: t.passed, short: t.shortStay, long: t.longStay }

  return (
    <AnimatePresence>
      <motion.div
        key={place.id}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          position: 'fixed', right: 128, top: 0, bottom: 0,
          margin: 'auto 0',
          height: 'fit-content',
          zIndex: 100,
        }}
      >
        <div style={{
          width: 280,
          background: '#0d1f35',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          border: '1px solid #1e3a5f',
          position: 'relative',
        }}>
          <button
            onClick={onClose}
            className="close-btn"
            style={{
              position: 'absolute', top: 12, right: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#475569', fontSize: 20, lineHeight: 1,
            }}
          >×</button>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 4 }}>
              {isVisited ? t.visited : t.unvisited}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#e0f7ff' }}>{place.name}</div>
              <button
                onClick={() => onEnter(place)}
                className="enter-btn"
                style={{
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: '1px solid #1e3a5f', borderRadius: 6,
                  padding: '4px 10px', cursor: 'pointer', color: '#00e5ff',
                  fontSize: 12, lineHeight: '20px', whiteSpace: 'nowrap',
                }}
              >
                进入
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{place.nameEn}</div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>{t.depthLabel}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['passed', 'short', 'long'] as const).map(depth => (
                <button
                  key={depth}
                  onClick={() => setSelectedDepth(depth)}
                  className="depth-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: selectedDepth === depth ? `1px solid ${DEPTH_COLORS[depth]}` : '1px solid #1e3a5f',
                    background: selectedDepth === depth ? `${DEPTH_COLORS[depth]}18` : '#060d1a',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: DEPTH_COLORS[depth], flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>{depthLabels[depth]}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{t.note}</div>
            <textarea
              placeholder={t.notePlaceholder}
              defaultValue={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#060d1a', border: '1px solid #1e3a5f', borderRadius: 8,
                padding: '8px 10px', color: '#e0f7ff', fontSize: 13, resize: 'none',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {isVisited && (
              <button
                onClick={() => onRemove(place.id)}
                className="danger-btn"
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  border: '1px solid #ef4444', background: 'transparent',
                  color: '#ef4444', cursor: 'pointer', fontSize: 13,
                }}
              >{t.remove}</button>
            )}
            <GlowButton
              onClick={() => onSave({ ...place, visitDepth: selectedDepth, note })}
              fullWidth
              style={{ flex: 2, padding: '10px 0' }}
            >
              {isVisited ? t.update : t.save}
            </GlowButton>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
