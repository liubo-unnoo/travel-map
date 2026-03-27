import { useState, useCallback, useEffect } from 'react'

import WorldMap from './components/WorldMap'
import CountryPanel from './components/CountryPanel'
import ProvinceMap from './components/ProvinceMap'
import StatsBar from './components/StatsBar'
import ShareCard from './components/ShareCard'
import Toast from './components/Toast'
import WarpEffect from './components/WarpEffect'
import SplashScreen from './components/SplashScreen'
import { prefetchProvinceData } from './utils/prefetch'
import { useMapStore } from './store'
import type { VisitedPlace } from './types'
import { LangProvider, useLang } from './i18n/LangContext'

// 两种视图模式：地球全图 / 单国省份图
type AppMode = 'globe' | 'country'

function AppInner() {
  const { state, updateCountry, removeCountry, updateProvince, removeProvince, stats } = useMapStore()
  const { t } = useLang()

  const [mode, setMode] = useState<AppMode>('globe')
  const [activeCountry, setActiveCountry] = useState<VisitedPlace | null>(null)  // 当前进入的国家
  const [selectedPlace, setSelectedPlace] = useState<VisitedPlace | null>(null)  // 单击选中的国家（显示面板）
  const [showShare, setShowShare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [lightCountry, setLightCountry] = useState<string | null>(null)  // 保存时触发闪光的国家 ISO3
  const [warping, setWarping] = useState(false)  // 穿越动效是否正在播放
  const [showSplash, setShowSplash] = useState(true)

  // ─── 启动时数据修复 ─────────────────────────────────────────────────────────
  // 兼容旧数据：如果省份记录存在但父国家记录缺失（可能由旧版本产生），
  // 自动补录一条默认 short 的国家记录，确保地球视图正确点亮
  useEffect(() => {
    const missing = new Set<string>()
    Object.keys(state.visitedProvinces).forEach(id => {
      const countryCode = id.split('_')[0]
      if (!state.visitedCountries[countryCode]) missing.add(countryCode)
    })
    missing.forEach(code => {
      updateCountry({ id: code, type: 'country', name: code, nameEn: code, visitDepth: 'short' })
    })
    // 欢迎页显示期间提前预取省份数据
    prefetchProvinceData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 地球视图交互 ────────────────────────────────────────────────────────────

  // 单击国家：弹出 CountryPanel
  const handleCountryClick = useCallback((place: VisitedPlace) => {
    setSelectedPlace(place)
  }, [])

  // 双击国家：关闭面板，播放穿越动效，切换到省份视图
  const handleCountryDblClick = useCallback((place: VisitedPlace) => {
    setSelectedPlace(null)
    setActiveCountry(place)
    setMode('country')
    setWarping(true)
  }, [])

  // 穿越动效结束回调
  const handleWarpDone = useCallback(() => {
    setWarping(false)
  }, [])

  // ─── 省份视图交互 ────────────────────────────────────────────────────────────

  // 返回地球视图
  // 注意：延迟 350ms 才 unmount ProvinceMap，确保 opacity 过渡结束后再销毁
  // 否则 map.remove() 会导致白屏闪烁
  const handleBack = useCallback(() => {
    // 若该国有省份记录但国家本身未点亮，自动补录（防止省份视图内只操作省份未保存国家的情况）
    if (activeCountry && !state.visitedCountries[activeCountry.id]) {
      const hasProvinces = Object.keys(state.visitedProvinces).some(id => id.startsWith(activeCountry.id + '_'))
      if (hasProvinces) {
        updateCountry({ ...activeCountry, visitDepth: activeCountry.visitDepth ?? 'short' })
      }
    }
    setMode('globe')
    setSelectedPlace(null)
    setWarping(false)
    setTimeout(() => setActiveCountry(null), 350)
  }, [activeCountry, state.visitedCountries, state.visitedProvinces, updateCountry])

  // 保存省份时自动点亮父国家（若尚未点亮）
  const handleAutoLightCountry = useCallback((country: VisitedPlace) => {
    if (state.visitedCountries[country.id]) return
    updateCountry({ ...country, visitDepth: country.visitDepth ?? 'short' })
  }, [state.visitedCountries, updateCountry])

  // ─── 地球视图面板操作 ────────────────────────────────────────────────────────

  // 保存国家：写入 store，触发地球闪光动效，显示 Toast
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

  // 过滤出当前国家的省份记录，传给 ProvinceMap
  const countryProvinces = activeCountry
    ? Object.fromEntries(
        Object.entries(state.visitedProvinces).filter(([id]) => id.startsWith(activeCountry.id + '_'))
      )
    : {}

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0f172a' }}>

      {/* ── 地球视图 ──────────────────────────────────────────────────────────
          始终挂载（不条件卸载），避免每次切回时重建 MapLibre 实例导致事件失效。
          通过 opacity + pointerEvents 控制可见性。 */}
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
          onEmptyClick={() => setSelectedPlace(null)}
          lightCountry={lightCountry}
          onLightDone={() => setLightCountry(null)}
        />
      </div>

      {/* ── 省份视图 ──────────────────────────────────────────────────────────
          同上，始终挂载。key={activeCountry.id} 确保切换国家时 ProvinceMap 重置。
          activeCountry 延迟 350ms 清空，避免 map.remove() 白屏。 */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: mode === 'country' && activeCountry ? 1 : 0,
          pointerEvents: mode === 'country' && activeCountry ? 'auto' : 'none',
          transition: 'opacity 0.3s',
          zIndex: mode === 'country' ? 2 : 0,
          background: '#060d1a',
        }}
      >
        {activeCountry && (
          <ProvinceMap
            key={activeCountry.id}
            countryCode={activeCountry.id}
            visitedProvinces={countryProvinces}
            onSaveProvince={updateProvince}
            onRemoveProvince={removeProvince}
            onAutoLightCountry={() => handleAutoLightCountry(activeCountry)}
          />
        )}
      </div>

      {/* 顶部统计栏：globe 模式显示全局统计，country 模式显示省份统计 + 返回键 */}
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

      {/* 国家标记面板（仅 globe 模式下单击后显示） */}
      {mode === 'globe' && selectedPlace && (
        <CountryPanel
          place={selectedPlace}
          isVisited={isVisited}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={() => setSelectedPlace(null)}
          onEnter={handleCountryDblClick}
        />
      )}

      {/* 分享卡片（全屏遮罩） */}
      {showShare && (
        <ShareCard
          visitedCountries={state.visitedCountries}
          onClose={() => setShowShare(false)}
        />
      )}

      {/* 空状态引导提示（无足迹时显示） */}
      {mode === 'globe' && stats.totalCountries === 0 && (
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          color: '#475569', fontSize: 13, textAlign: 'center', pointerEvents: 'none',
        }}>
          {t.hint}
        </div>
      )}

      {/* 穿越动效：双击国家时播放，onDone 后卸载 */}
      {warping && <WarpEffect onDone={handleWarpDone} />}

      {/* ── SplashScreen ────────────────────────────────────────────────────────
          进入欢迎屏，zIndex:100 覆盖地图。onDone 后从 DOM 卸载。
          WorldMap 在后台始终挂载并初始化，SplashScreen 消失后立即可用。 */}
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

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
