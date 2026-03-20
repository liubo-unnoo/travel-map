import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import WorldMap from './components/WorldMap'
import CountryPanel from './components/CountryPanel'
import ProvinceMap from './components/ProvinceMap'
import StatsBar from './components/StatsBar'
import ShareCard from './components/ShareCard'
import Toast from './components/Toast'
import WarpEffect from './components/WarpEffect'
import { useMapStore } from './store'
import type { VisitedPlace } from './types'
import { LangProvider, useLang } from './i18n/LangContext'

type AppMode = 'globe' | 'country'

function AppInner() {
  const { state, updateCountry, removeCountry, updateProvince, removeProvince, stats } = useMapStore()
  const { t } = useLang()

  const [mode, setMode] = useState<AppMode>('globe')
  const [activeCountry, setActiveCountry] = useState<VisitedPlace | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<VisitedPlace | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [lightCountry, setLightCountry] = useState<string | null>(null)
  const [warping, setWarping] = useState(false)

  const handleCountryClick = useCallback((place: VisitedPlace) => {
    setSelectedPlace(place)
  }, [])

  const handleCountryDblClick = useCallback((place: VisitedPlace) => {
    setSelectedPlace(null)
    setActiveCountry(place)
    setWarping(true)
    // 隐藏地球，但等穿越动效结束后再展示省份地图（以便看到放大动画）
  }, [])

  const handleWarpDone = useCallback(() => {
    setWarping(false)
    setMode('country')
  }, [])

  const handleBack = useCallback(() => {
    setMode('globe')
    setActiveCountry(null)
    setSelectedPlace(null)  // 防止 CountryPanel 遮挡地图，导致下次双击失效
  }, [])

  const handleAutoLightCountry = useCallback((country: VisitedPlace) => {
    if (state.visitedCountries[country.id]) return
    updateCountry({ ...country, visitDepth: country.visitDepth ?? 'short' })
  }, [state.visitedCountries, updateCountry])

  const handleSave = useCallback((place: VisitedPlace) => {
    updateCountry(place)
    setSelectedPlace(null)
    setToast(`${place.name} ${t.lit}`)
    setLightCountry(place.id)
  }, [updateCountry, t.lit])

  const handleRemove = useCallback((id: string) => {
    removeCountry(id)
    setSelectedPlace(null)
  }, [removeCountry])

  const isVisited = selectedPlace ? !!state.visitedCountries[selectedPlace.id] : false

  const countryProvinces = activeCountry
    ? Object.fromEntries(
        Object.entries(state.visitedProvinces).filter(([id]) => id.startsWith(activeCountry.id + '_'))
      )
    : {}

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0f172a' }}>

      {/* 地球视图 - 始终保持挂载，避免每次切回时重建地图实例 */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: mode === 'globe' ? 1 : 0,
          pointerEvents: mode === 'globe' ? 'auto' : 'none',
          transition: 'opacity 0.3s',
          zIndex: mode === 'globe' ? 1 : 0,
        }}
      >
        <WorldMap
          mapState={state}
          onCountryClick={handleCountryClick}
          onCountryDblClick={handleCountryDblClick}
          lightCountry={lightCountry}
          onLightDone={() => setLightCountry(null)}
        />
      </div>

      {/* 国家省份视图 */}
      <AnimatePresence>
        {mode === 'country' && activeCountry && (
          <motion.div
            key="country"
            initial={{ opacity: 0, scale: 0.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.04 }}
            transition={{ duration: 0.35, ease: [0.15, 0, 0.1, 1] }}
            style={{ position: 'absolute', inset: 0, background: '#060d1a', transformOrigin: 'center center' }}
          >
            <ProvinceMap
              countryCode={activeCountry.id}
              countryName={activeCountry.name}
              visitedProvinces={countryProvinces}
              onSaveProvince={updateProvince}
              onRemoveProvince={removeProvince}
              onAutoLightCountry={() => handleAutoLightCountry(activeCountry)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 统计栏 */}
      {mode === 'globe' ? (
        <StatsBar
          mode="global"
          visitedCountries={state.visitedCountries}
          onShareClick={() => setShowShare(true)}
        />
      ) : activeCountry ? (
        <StatsBar
          mode="country"
          countryName={activeCountry.name}
          visitedProvinces={countryProvinces}
          onBack={handleBack}
        />
      ) : null}

      {/* 国家详情面板（地球视图） */}
      {mode === 'globe' && selectedPlace && (
        <CountryPanel
          place={selectedPlace}
          isVisited={isVisited}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={() => setSelectedPlace(null)}
        />
      )}

      {/* 分享卡片 */}
      {showShare && (
        <ShareCard
          visitedCountries={state.visitedCountries}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* 空状态提示 */}
      {mode === 'globe' && stats.totalCountries === 0 && (
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          color: '#475569', fontSize: 13, textAlign: 'center', pointerEvents: 'none',
        }}>
          {t.hint}
        </div>
      )}

      {/* 穿越动效 */}
      {warping && <WarpEffect onDone={handleWarpDone} />}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  )
}
