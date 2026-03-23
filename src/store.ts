import { useState, useCallback } from 'react'
import type { MapState, VisitedPlace, VisitedProvince } from './types'

const STORAGE_KEY = 'travel-map-data'

// ─── 持久化读写 ───────────────────────────────────────────────────────────────

function loadState(): MapState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // 校验顶层结构，兼容旧版本（visitedProvinces 字段可能不存在）
      if (parsed && typeof parsed.visitedCountries === 'object') {
        return {
          visitedCountries: parsed.visitedCountries ?? {},
          visitedCities: parsed.visitedCities ?? {},
          visitedProvinces: parsed.visitedProvinces ?? {},
        }
      }
    }
  } catch (err) {
    console.warn('[store] Failed to load saved state:', err)
  }
  return { visitedCountries: {}, visitedCities: {}, visitedProvinces: {} }
}

function saveState(state: MapState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ─── 状态管理 Hook ────────────────────────────────────────────────────────────
// 使用 React useState + localStorage，无外部状态库。
// 每次写操作后立即同步到 localStorage，保证刷新不丢数据。

export function useMapStore() {
  const [state, setState] = useState<MapState>(loadState)

  // 新增或更新国家记录
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

  // 删除国家记录（不级联删除省份，保留省份数据）
  const removeCountry = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, visitedCountries: { ...prev.visitedCountries } }
      delete next.visitedCountries[id]
      saveState(next)
      return next
    })
  }, [])

  // 新增或更新省份记录
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

  // 删除省份记录
  const removeProvince = useCallback((id: string) => {
    setState(prev => {
      const next = { ...prev, visitedProvinces: { ...prev.visitedProvinces } }
      delete next.visitedProvinces[id]
      saveState(next)
      return next
    })
  }, [])

  // 统计数据（直接从 state 派生，不缓存，量小无需 useMemo）
  const stats = {
    totalCountries: Object.keys(state.visitedCountries).length,
    passed: Object.values(state.visitedCountries).filter(p => p.visitDepth === 'passed').length,
    short: Object.values(state.visitedCountries).filter(p => p.visitDepth === 'short').length,
    long: Object.values(state.visitedCountries).filter(p => p.visitDepth === 'long').length,
  }

  return { state, updateCountry, removeCountry, updateProvince, removeProvince, stats }
}
