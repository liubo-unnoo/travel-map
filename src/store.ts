import { useState, useCallback } from 'react'
import type { MapState, VisitedPlace } from './types'

const STORAGE_KEY = 'travel-map-data'

function loadState(): MapState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.visitedCountries === 'object') return parsed
    }
  } catch {}
  return { visitedCountries: {}, visitedCities: {} }
}

function saveState(state: MapState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function useMapStore() {
  const [state, setState] = useState<MapState>(loadState)

  const updateCountry = useCallback((place: VisitedPlace) => {
    setState(prev => {
      const next = {
        ...prev,
        visitedCountries: { ...prev.visitedCountries, [place.id]: place },
      }
      saveState(next)
      return next
    })
  }, [])

  const removeCountry = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, visitedCountries: { ...prev.visitedCountries } }
      delete next.visitedCountries[id]
      saveState(next)
      return next
    })
  }, [])

  const stats = {
    totalCountries: Object.keys(state.visitedCountries).length,
    passed: Object.values(state.visitedCountries).filter(p => p.visitDepth === 'passed').length,
    short: Object.values(state.visitedCountries).filter(p => p.visitDepth === 'short').length,
    long: Object.values(state.visitedCountries).filter(p => p.visitDepth === 'long').length,
  }

  return { state, updateCountry, removeCountry, stats }
}
