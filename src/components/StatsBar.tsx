import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VisitedPlace, VisitedProvince } from '../types'
import { TOTAL_COUNTRIES } from '../types'
import { useLang } from '../i18n/LangContext'
import { LANG_LABELS } from '../i18n/countries'
import type { LangCode } from '../i18n/countries'
import GlowButton from './GlowButton'

interface GlobalProps {
  mode: 'global'
  visitedCountries: Record<string, VisitedPlace>
  onShareClick: () => void
}

interface CountryProps {
  mode: 'country'
  countryName: string
  visitedProvinces: Record<string, VisitedProvince>
  onBack: () => void
}

type Props = GlobalProps | CountryProps

const LANGS = Object.keys(LANG_LABELS) as LangCode[]

export function LangSelector() {
  const { lang, setLang } = useLang()
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        pointerEvents: 'auto',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderRadius: 16,
        padding: '12px 16px',
        border: '1px solid #1e3a5f',
        cursor: 'pointer',
      }}
    >
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <select
          value={lang}
          onChange={e => setLang(e.target.value as LangCode)}
          style={{
            position: 'absolute', inset: 0, opacity: 0,
            cursor: 'pointer', width: '100%', height: '100%',
          }}
        >
          {LANGS.map(l => (
            <option key={l} value={l}>{LANG_LABELS[l]}</option>
          ))}
        </select>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#00e5ff', lineHeight: 1 }}>
          {LANG_LABELS[lang]}
        </div>
        <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center' }}>
          <svg width="8" height="5" viewBox="0 0 10 6"><path d="M0 0l5 6 5-6z" fill="#475569"/></svg>
        </div>
      </div>
    </motion.div>
  )
}

export default function StatsBar(props: Props) {
  const { t } = useLang()
  const [expanded, setExpanded] = useState(false)

  if (props.mode === 'country') {
    const { countryName, visitedProvinces, onBack } = props
    const list = Object.values(visitedProvinces)
    const total = list.length
    const passed = list.filter(p => p.visitDepth === 'passed').length
    const short = list.filter(p => p.visitDepth === 'short').length
    const long = list.filter(p => p.visitDepth === 'long').length

    return (
      <div style={{
        position: 'absolute', top: 20, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        zIndex: 50, pointerEvents: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
          <LangSelector />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(12px)',
              borderRadius: 16,
              padding: '12px 20px',
              display: 'flex', alignItems: 'center', gap: 20,
              border: '1px solid #1e3a5f',
              whiteSpace: 'nowrap',
            }}
          >
            <button
              onClick={onBack}
              className="close-btn"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#475569', fontSize: 18, lineHeight: 1, padding: '0 4px',
              }}
            >←</button>

            <div style={{ fontWeight: 800, fontSize: 14, color: '#80f0ff' }}>
              {countryName}
            </div>

            <div style={{ width: 1, height: 24, background: '#1e3a5f' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer' }}>
                <StatItem value={total} label={t.provinces} color="#00e5ff" />
              </div>

              <AnimatePresence>
                {expanded && (
                  <motion.div
                    key="breakdown"
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: 'flex', gap: 18, overflow: 'hidden' }}
                  >
                    <StatItem value={passed} label={t.passed} color="#3B82F6" />
                    <StatItem value={short} label={t.short} color="#3B82F6" />
                    <StatItem value={long} label={t.long} color="#3B82F6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // global mode
  const { visitedCountries, onShareClick } = props
  const list = Object.values(visitedCountries)
  const total = list.length
  const passed = list.filter(p => p.visitDepth === 'passed').length
  const short = list.filter(p => p.visitDepth === 'short').length
  const long = list.filter(p => p.visitDepth === 'long').length
  const pct = Math.round((total / TOTAL_COUNTRIES) * 100)

  return (
    <div style={{
      position: 'absolute', top: 20, left: 0, right: 0,
      display: 'flex', justifyContent: 'center',
      zIndex: 50, pointerEvents: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto' }}>
        <LangSelector />
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 16,
            padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 20,
            border: '1px solid #1e3a5f',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14, color: '#80f0ff' }}>
            {t.appName}
          </div>

          <div style={{ width: 1, height: 24, background: '#1e3a5f' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <StatItem value={pct + '%'} label={t.explored} color="#00e5ff" />
            <div onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer' }}>
              <StatItem value={total} label={t.countries} color="#00e5ff" />
            </div>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  key="breakdown"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'flex', gap: 18, overflow: 'hidden' }}
                >
                  <StatItem value={passed} label={t.passed} color="#3B82F6" />
                  <StatItem value={short} label={t.short} color="#3B82F6" />
                  <StatItem value={long} label={t.long} color="#3B82F6" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ width: 1, height: 24, background: '#1e3a5f' }} />

          <GlowButton onClick={onShareClick}>
            {t.share}
          </GlowButton>
        </motion.div>
      </div>
    </div>
  )
}

function StatItem({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>{label}</div>
    </div>
  )
}
