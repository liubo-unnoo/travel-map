import { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { motion, AnimatePresence } from 'framer-motion'
import type { VisitedProvince } from '../types'
import { DEPTH_COLORS } from '../types'
import { useLang } from '../i18n/LangContext'
import GlowButton from './GlowButton'
import StarField from './StarField'
import { renderDotPattern, renderHiDotPattern, renderFlowPattern } from '../utils/mapPatterns'

// 进入中国省份视图时，台湾在 Natural Earth 数据中 adm0_a3 为 'TWN'，
// 需要将其合并显示在中国地图内。
const CHINA_MERGE_CODES = new Set(['TWN'])

/** 返回该国家在 GeoJSON 中实际使用的所有 adm0_a3 代码集合 */
function getAdm0Codes(countryCode: string): string[] {
  if (countryCode === 'CHN') return ['CHN', ...CHINA_MERGE_CODES]
  return [countryCode]
}
import { getProvinceData } from '../utils/prefetch'

const GLOW_DIM = '#0099bb'

interface ProvinceFeatureProps {
  name: string
  name_en: string
  name_zh: string
  name_ja: string
  name_ko: string
  name_es: string
  name_fr: string
  iso_3166_2: string
  adm0_a3: string
}

interface SelectedProvince {
  id: string
  name: string
  nameEn: string
  code: string
}

interface Props {
  countryCode: string
  visitedProvinces: Record<string, VisitedProvince>
  onSaveProvince: (province: VisitedProvince) => void
  onRemoveProvince: (id: string) => void
  onAutoLightCountry?: () => void
}

function getProvinceName(props: ProvinceFeatureProps, lang: string): string {
  const map: Record<string, string> = {
    zh: props.name_zh,
    ja: props.name_ja,
    ko: props.name_ko,
    es: props.name_es,
    fr: props.name_fr,
    en: props.name_en,
  }
  return map[lang] || props.name_en || props.name
}

// 计算 GeoJSON 几何的 bbox（原始坐标，不做任何 shift）
function computeBounds(features: GeoJSON.Feature[]): { minLng: number; maxLng: number; minLat: number; maxLat: number; crossesDateline: boolean } {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity

  for (const f of features) {
    const geom = f.geometry
    const rings: number[][][] = []
    if (geom.type === 'Polygon') {
      rings.push(...geom.coordinates)
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) rings.push(...poly)
    }
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng
        if (lng > maxLng) maxLng = lng
        if (lat < minLat) minLat = lat
        if (lat > maxLat) maxLat = lat
      }
    }
  }

  const crossesDateline = (maxLng - minLng) > 180
  return { minLng, maxLng, minLat, maxLat, crossesDateline }
}

export default function ProvinceMap({ countryCode, visitedProvinces, onSaveProvince, onRemoveProvince, onAutoLightCountry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rafRef = useRef<number>(0)
  const visitedRef = useRef(visitedProvinces)
  visitedRef.current = visitedProvinces
  const onAutoLightRef = useRef(onAutoLightCountry)
  onAutoLightRef.current = onAutoLightCountry
  const { t, lang } = useLang()
  const tRef = useRef(t)
  const langRef = useRef(lang)
  tRef.current = t
  langRef.current = lang

  const [selectedProvince, setSelectedProvince] = useState<SelectedProvince | null>(null)
  const [selectedDepth, setSelectedDepth] = useState<'passed' | 'short' | 'long'>('short')
  const [note, setNote] = useState('')

  const buildVisitedFilter = useCallback(() => {
    const codes = Object.keys(visitedRef.current)
      .filter(id => id.startsWith(countryCode + '_'))
      .map(id => id.replace(countryCode + '_', ''))
    const adm0Codes = getAdm0Codes(countryCode)
    // 匹配本国所有 adm0_a3（中国包含 TWN），且 iso_3166_2 在已访问列表中
    const adm0Filter = adm0Codes.length === 1
      ? ['==', ['get', 'adm0_a3'], adm0Codes[0]]
      : ['in', ['get', 'adm0_a3'], ['literal', adm0Codes]]
    if (codes.length === 0) {
      return ['all', adm0Filter, ['==', ['get', 'iso_3166_2'], '']] as unknown as maplibregl.ExpressionSpecification
    }
    return ['all',
      adm0Filter,
      ['in', ['get', 'iso_3166_2'], ['literal', codes]],
    ] as unknown as maplibregl.ExpressionSpecification
  }, [countryCode])

  const updateLayers = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (!map.getLayer('provinces-visited-fill')) return
    const visitedFilter = buildVisitedFilter()
    map.setFilter('provinces-visited-fill', visitedFilter)
    map.setFilter('provinces-visited-dots', visitedFilter)
    map.setFilter('provinces-visited-glow2', visitedFilter)
    map.setFilter('provinces-visited-glow1', visitedFilter)
  }, [buildVisitedFilter])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    // 使用预取缓存获取省份数据（若已在地球视图期间预取完成则直接命中）
    getProvinceData()
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (cancelled || !containerRef.current) return

        // 过滤本国所有省份（中国同时包含台湾的 adm0_a3=TWN 记录）
        const adm0Codes = getAdm0Codes(countryCode)
        const countryFeatures = geojson.features.filter(
          f => adm0Codes.includes(f.properties?.adm0_a3)
        )

        const countryGeoJSON: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: countryFeatures,
        }

        const { minLng, maxLng, minLat, maxLat, crossesDateline } = computeBounds(countryFeatures)

        // 跨日期线国家：负经度 +360 加权平均求真实中心
        let initCenter: [number, number]
        if (countryFeatures.length === 0) {
          initCenter = [0, 20]
        } else if (crossesDateline) {
          let sumLng = 0, count = 0
          for (const f of countryFeatures) {
            const rings: number[][][] = []
            if (f.geometry.type === 'Polygon') rings.push(...f.geometry.coordinates)
            else if (f.geometry.type === 'MultiPolygon') for (const p of f.geometry.coordinates) rings.push(...p)
            for (const ring of rings) for (const [lng] of ring) { sumLng += lng < 0 ? lng + 360 : lng; count++ }
          }
          const avgLng = count > 0 ? sumLng / count : 0
          initCenter = [avgLng > 180 ? avgLng - 360 : avgLng, (minLat + maxLat) / 2]
        } else {
          initCenter = [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
        }

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style: {
            version: 8,
            sources: {},
            layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#060d1a' } }],
            glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
          },
          attributionControl: false,
          center: initCenter,
          zoom: 2,
          minZoom: 2,   // zoom=2 时屏幕约 90°，绝不会出现第二份世界
          maxZoom: 12,
          // renderWorldCopies 保持默认 true，允许地球连续渲染，配合 minZoom:2 不会出现重复
        })

        mapRef.current = map

        map.on('load', () => {
          // Animated dot/flow patterns
          map.addImage('dot-pattern', renderDotPattern(0))
          map.addImage('flow-pattern', renderFlowPattern(0))
          let t = 0
          let useHiRes = false
          const animatePattern = () => {
            t += 0.016
            const zoom = map.getZoom()
            const shouldHiRes = zoom >= 4
            if (shouldHiRes !== useHiRes) {
              useHiRes = shouldHiRes
              if (map.hasImage('dot-pattern')) map.removeImage('dot-pattern')
              map.addImage('dot-pattern', useHiRes ? renderHiDotPattern(t) : renderDotPattern(t))
            } else {
              if (map.hasImage('dot-pattern')) map.updateImage('dot-pattern', useHiRes ? renderHiDotPattern(t) : renderDotPattern(t))
            }
            if (map.hasImage('flow-pattern')) map.updateImage('flow-pattern', renderFlowPattern(t))
            map.triggerRepaint()
            rafRef.current = requestAnimationFrame(animatePattern)
          }
          rafRef.current = requestAnimationFrame(animatePattern)

          // Use pre-filtered data directly — no need for querySourceFeatures
          map.addSource('provinces', { type: 'geojson', data: countryGeoJSON, generateId: true })

          // source 内已只含本国数据（含合并省份），countryFilter 直接放行全部
          const countryFilter = ['!=', ['get', 'adm0_a3'], ''] as unknown as maplibregl.ExpressionSpecification
          const visitedFilter = buildVisitedFilter()

          map.addLayer({ id: 'provinces-unvisited-fill', type: 'fill', source: 'provinces', filter: countryFilter,
            paint: { 'fill-color': '#0d2540', 'fill-opacity': 0.9 } })
          map.addLayer({ id: 'provinces-unvisited-border', type: 'line', source: 'provinces', filter: countryFilter,
            paint: { 'line-color': '#1e4060', 'line-width': 0.8 } })
          map.addLayer({ id: 'provinces-visited-fill', type: 'fill', source: 'provinces', filter: visitedFilter,
            paint: { 'fill-color': '#041520', 'fill-opacity': 0.9 } })
          map.addLayer({ id: 'provinces-visited-dots', type: 'fill', source: 'provinces', filter: visitedFilter,
            paint: { 'fill-pattern': 'dot-pattern', 'fill-opacity': 0.9 } })
          map.addLayer({ id: 'provinces-visited-glow2', type: 'line', source: 'provinces', filter: visitedFilter,
            paint: { 'line-color': GLOW_DIM, 'line-width': 2, 'line-blur': 3, 'line-opacity': 0.25 } })
          map.addLayer({ id: 'provinces-visited-glow1', type: 'line', source: 'provinces', filter: visitedFilter,
            paint: { 'line-pattern': 'flow-pattern', 'line-width': 1.5 } })
          map.addLayer({ id: 'provinces-hover', type: 'fill', source: 'provinces', filter: countryFilter,
            paint: { 'fill-color': '#ffffff', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0] } })

          // 定位到国家范围
          if (countryFeatures.length > 0) {
            if (crossesDateline) {
              // 跨日期线大国：根据纬度跨度估算 zoom，用 jumpTo 定位
              const latSpan = maxLat - minLat
              const zoom = Math.max(2, Math.min(5, Math.log2(60 / latSpan)))
              map.jumpTo({ center: initCenter, zoom: Math.round(zoom * 10) / 10 })
            } else {
              map.fitBounds(
                [[minLng, minLat], [maxLng, maxLat]],
                { padding: 60, duration: 0, maxZoom: 7 }
              )
            }
          }

          // Hover & click handlers
          let hoveredId: string | number | null = null

          function handleMouseMove(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
            if (!e.features?.length) return
            if (hoveredId !== null) map.setFeatureState({ source: 'provinces', id: hoveredId }, { hover: false })
            hoveredId = e.features[0].id ?? null
            if (hoveredId !== null) map.setFeatureState({ source: 'provinces', id: hoveredId }, { hover: true })
            map.getCanvas().style.cursor = 'pointer'

            const props = e.features[0].properties as ProvinceFeatureProps
            if (!popupRef.current) {
              popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'map-tooltip' })
            }
            const pid = `${countryCode}_${props.iso_3166_2}`
            const visited = visitedRef.current[pid]
            const depthMap: Record<string, string> = { passed: String(tRef.current.passed), short: String(tRef.current.short), long: String(tRef.current.long) }
            const depthLabel = visited ? depthMap[visited.visitDepth] ?? '' : ''
            const displayName = getProvinceName(props, langRef.current)
            popupRef.current.setLngLat(e.lngLat).setHTML(`
              <div class="tooltip-content">
                <span class="tooltip-name">${displayName}</span>
                ${visited ? `<span class="tooltip-badge">${depthLabel}</span>` : ''}
              </div>
            `).addTo(map)
          }

          function handleMouseLeave() {
            if (hoveredId !== null) { map.setFeatureState({ source: 'provinces', id: hoveredId }, { hover: false }); hoveredId = null }
            map.getCanvas().style.cursor = ''
            popupRef.current?.remove(); popupRef.current = null
          }

          map.on('mousemove', 'provinces-unvisited-fill', handleMouseMove)
          map.on('mousemove', 'provinces-visited-fill', handleMouseMove)
          map.on('mouseleave', 'provinces-unvisited-fill', handleMouseLeave)
          map.on('mouseleave', 'provinces-visited-fill', handleMouseLeave)

          map.on('click', 'provinces-unvisited-fill', handleClick)
          map.on('click', 'provinces-visited-fill', handleClick)

          function handleClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
            if (!e.features?.length) return
            const props = e.features[0].properties as ProvinceFeatureProps
            const pid = `${countryCode}_${props.iso_3166_2}`
            const existing = visitedRef.current[pid]
            const displayName = getProvinceName(props, langRef.current)
            setSelectedProvince({ id: pid, name: displayName, nameEn: props.name_en ?? props.name, code: props.iso_3166_2 })
            setSelectedDepth(existing?.visitDepth ?? 'short')
            setNote(existing?.note ?? '')
          }
        })
      })
      .catch(err => {
        console.error('[ProvinceMap] Failed to load province data:', err)
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafRef.current)
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateLayers()
  }, [visitedProvinces, updateLayers])

  const isVisited = selectedProvince ? !!visitedProvinces[selectedProvince.id] : false
  const depthLabels = { passed: t.passed, short: t.shortStay, long: t.longStay }

  const handleSave = () => {
    if (!selectedProvince) return
    onSaveProvince({
      id: selectedProvince.id,
      countryCode,
      name: selectedProvince.name,
      nameEn: selectedProvince.nameEn,
      visitDepth: selectedDepth,
      note,
    })
    onAutoLightRef.current?.()
    setSelectedProvince(null)
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <StarField />
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      <AnimatePresence>
        {selectedProvince && (
          <motion.div
            key={selectedProvince.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'absolute', right: 24, top: 0, bottom: 0,
              margin: 'auto 0', height: 'fit-content', zIndex: 10,
            }}
          >
            <div style={{
              width: 260, background: '#0d1f35', borderRadius: 16, padding: 20,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid #1e3a5f',
              position: 'relative',
            }}>
              <button
                onClick={() => setSelectedProvince(null)}
                className="close-btn"
                style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 20, lineHeight: 1 }}
              >×</button>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 4 }}>{isVisited ? t.visited : t.unvisited}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e0f7ff' }}>{selectedProvince.name}</div>
                <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>{selectedProvince.nameEn}</div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>{t.depthLabel}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(['passed', 'short', 'long'] as const).map(depth => (
                    <button
                      key={depth}
                      onClick={() => setSelectedDepth(depth)}
                      className="depth-btn"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                        border: selectedDepth === depth ? `1px solid ${DEPTH_COLORS[depth]}` : '1px solid #1e3a5f',
                        background: selectedDepth === depth ? `${DEPTH_COLORS[depth]}18` : '#060d1a',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: DEPTH_COLORS[depth], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{depthLabels[depth]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#475569', marginBottom: 6 }}>{t.note}</div>
                <textarea
                  placeholder={String(t.notePlaceholder)}
                  defaultValue={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: '#060d1a', border: '1px solid #1e3a5f', borderRadius: 8,
                    padding: '6px 8px', color: '#e0f7ff', fontSize: 12, resize: 'none',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                {isVisited && (
                  <button
                    onClick={() => { onRemoveProvince(selectedProvince.id); setSelectedProvince(null) }}
                    className="danger-btn"
                    style={{
                      flex: 1, padding: '8px 0', borderRadius: 8,
                      border: '1px solid #ef4444', background: 'transparent',
                      color: '#ef4444', cursor: 'pointer', fontSize: 12,
                    }}
                  >{String(t.remove)}</button>
                )}
                <GlowButton onClick={handleSave} fullWidth style={{ flex: 2, padding: '8px 0' }}>
                  {isVisited ? String(t.update) : String(t.save)}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
