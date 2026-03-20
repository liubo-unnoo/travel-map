import { useState, useCallback } from 'react'
import WorldMap from './components/WorldMap'
import CountryPanel from './components/CountryPanel'
import StatsBar from './components/StatsBar'
import ShareCard from './components/ShareCard'
import Toast from './components/Toast'
import { useMapStore } from './store'
import type { VisitedPlace } from './types'
import { LangProvider, useLang } from './i18n/LangContext'

function AppInner() {
  const { state, updateCountry, removeCountry, stats } = useMapStore()
  const { t } = useLang()
  const [selectedPlace, setSelectedPlace] = useState<VisitedPlace | null>(null)
  const [showShare, setShowShare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [lightCountry, setLightCountry] = useState<string | null>(null)

  const handleCountryClick = useCallback((place: VisitedPlace) => {
    setSelectedPlace(place)
  }, [])

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

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', background: '#0f172a' }}>
      <WorldMap mapState={state} onCountryClick={handleCountryClick} lightCountry={lightCountry} onLightDone={() => setLightCountry(null)} />

      <StatsBar
        visitedCountries={state.visitedCountries}
        onShareClick={() => setShowShare(true)}
      />

      {selectedPlace && (
        <CountryPanel
          place={selectedPlace}
          isVisited={isVisited}
          onSave={handleSave}
          onRemove={handleRemove}
          onClose={() => setSelectedPlace(null)}
        />
      )}

      {showShare && (
        <ShareCard
          visitedCountries={state.visitedCountries}
          onClose={() => setShowShare(false)}
        />
      )}

      {stats.totalCountries === 0 && (
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          color: '#475569', fontSize: 13, textAlign: 'center', pointerEvents: 'none',
        }}>
          {t.hint}
        </div>
      )}

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
