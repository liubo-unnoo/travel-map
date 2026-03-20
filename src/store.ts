import { useState, useCallback } from 'react'
import type { MapState, VisitedPlace, VisitedProvince } from './types'

const STORAGE_KEY = 'travel-map-data'

function loadState(): MapState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.visitedCountries === 'object') {
        return {
          visitedCountries: parsed.visitedCountries ?? {},
          visitedCities: parsed.visitedCities ?? {},
          visitedProvinces: parsed.visitedProvinces ?? {},
        }
      }
    }
  } catch {}
  return { visitedCountries: {}, visitedCities: {}, visitedProvinces: {} }
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

  const updateProvince = useCallback((province: VisitedProvince) => {
    setState(prev => {
      const next = {
        ...prev,
        visitedProvinces: { ...prev.visitedProvinces, [province.id]: province },
      }
      saveState(next)
      return next
    })
  }, [])

  const removeProvince = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, visitedProvinces: { ...prev.visitedProvinces } }
      delete next.visitedProvinces[id]
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

  return { state, updateCountry, removeCountry, updateProvince, removeProvince, stats }
}
