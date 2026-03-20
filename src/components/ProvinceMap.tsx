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

const PROVINCE_SOURCE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'
const GLOW_COLOR = '#00e5ff'
const GLOW_DIM = '#0099bb'

interface ProvinceFeatureProps {
  name: string
  name_en: string
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
  countryName: string
  visitedProvinces: Record<string, VisitedProvince>
  onSaveProvince: (province: VisitedProvince) => void
  onRemoveProvince: (id: string) => void
  onAutoLightCountry?: () => void  // 保存省份时如果国家未点亮则自动触发
}

export default function ProvinceMap({ countryCode, countryName, visitedProvinces, onSaveProvince, onRemoveProvince, onAutoLightCountry }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rafRef = useRef<number>(0)
  const visitedRef = useRef(visitedProvinces)
  visitedRef.current = visitedProvinces
  const onAutoLightRef = useRef(onAutoLightCountry)
  onAutoLightRef.current = onAutoLightCountry
  const { t } = useLang()

  const [selectedProvince, setSelectedProvince] = useState<SelectedProvince | null>(null)
  const [selectedDepth, setSelectedDepth] = useState<'passed' | 'short' | 'long'>('short')
  const [note, setNote] = useState('')

  const buildVisitedFilter = useCallback(() => {
    const codes = Object.keys(visitedRef.current)
      .filter(id => id.startsWith(countryCode + '_'))
      .map(id => id.replace(countryCode + '_', ''))
    if (codes.length === 0) {
      return ['all',
        ['==', ['get', 'adm0_a3'], countryCode],
        ['==', ['get', 'iso_3166_2'], ''],
      ] as unknown as maplibregl.ExpressionSpecification
    }
    return ['all',
      ['==', ['get', 'adm0_a3'], countryCode],
      ['in', ['get', 'iso_3166_2'], ['literal', codes]],
    ] as unknown as maplibregl.ExpressionSpecification
  }, [countryCode])

  const updateLayers = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (!map.getLayer('provinces-visited-fill')) return
    const vf = buildVisitedFilter()
    map.setFilter('provinces-visited-fill', vf)
    map.setFilter('provinces-visited-dots', vf)
    map.setFilter('provinces-visited-glow2', vf)
    map.setFilter('provinces-visited-glow1', vf)
  }, [buildVisitedFilter])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#060d1a' } }],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      },
      attributionControl: false,
      minZoom: 1,
      renderWorldCopies: false,
    })

    mapRef.current = map

    map.on('load', () => {
      // 注册点阵 + 流光 pattern 并启动动画
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

      map.addSource('provinces', {
        type: 'geojson',
        data: PROVINCE_SOURCE,
        generateId: true,
      })

      const cf = ['==', ['get', 'adm0_a3'], countryCode] as unknown as maplibregl.ExpressionSpecification
      const vf = buildVisitedFilter()

      // 未点亮省份
      map.addLayer({ id: 'provinces-unvisited-fill', type: 'fill', source: 'provinces', filter: cf,
        paint: { 'fill-color': '#0d2540', 'fill-opacity': 0.9 } })
      map.addLayer({ id: 'provinces-unvisited-border', type: 'line', source: 'provinces', filter: cf,
        paint: { 'line-color': '#1e4060', 'line-width': 0.8 } })

      // 已点亮省份 - 暗底
      map.addLayer({ id: 'provinces-visited-fill', type: 'fill', source: 'provinces', filter: vf,
        paint: { 'fill-color': '#041520', 'fill-opacity': 0.9 } })

      // 已点亮省份 - 点阵
      map.addLayer({ id: 'provinces-visited-dots', type: 'fill', source: 'provinces', filter: vf,
        paint: { 'fill-pattern': 'dot-pattern', 'fill-opacity': 0.9 } })

      // 已点亮省份 - 发光边框
      map.addLayer({ id: 'provinces-visited-glow2', type: 'line', source: 'provinces', filter: vf,
        paint: { 'line-color': GLOW_DIM, 'line-width': 2, 'line-blur': 3, 'line-opacity': 0.25 } })
      map.addLayer({ id: 'provinces-visited-glow1', type: 'line', source: 'provinces', filter: vf,
        paint: { 'line-pattern': 'flow-pattern', 'line-width': 1.5 } })

      // hover
      map.addLayer({ id: 'provinces-hover', type: 'fill', source: 'provinces', filter: cf,
        paint: { 'fill-color': '#ffffff', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0] } })

      map.on('sourcedata', e => {
        if (e.sourceId === 'provinces' && e.isSourceLoaded) {
          updateLayers()
          const features = map.querySourceFeatures('provinces', {
            filter: ['==', ['get', 'adm0_a3'], countryCode] as unknown as maplibregl.ExpressionSpecification,
          })
          if (features.length > 0) {
            const bounds = new maplibregl.LngLatBounds()
            features.forEach(f => {
              if (f.geometry.type === 'Polygon') {
                f.geometry.coordinates[0].forEach(([lng, lat]) => bounds.extend([lng, lat]))
              } else if (f.geometry.type === 'MultiPolygon') {
                f.geometry.coordinates.forEach(poly => poly[0].forEach(([lng, lat]) => bounds.extend([lng, lat])))
              }
            })
            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, duration: 0, animate: false })
          }
        }
      })

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
        const depthLabel = visited ? ({ passed: t.passed, short: t.short, long: t.long })[visited.visitDepth] : ''
        popupRef.current.setLngLat(e.lngLat).setHTML(`
          <div class="tooltip-content">
            <span class="tooltip-name">${props.name}</span>
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
        setSelectedProvince({ id: pid, name: props.name, nameEn: props.name_en ?? props.name, code: props.iso_3166_2 })
        setSelectedDepth(existing?.visitDepth ?? 'short')
        setNote(existing?.note ?? '')
      }
    })

    return () => {
      cancelAnimationFrame(rafRef.current)
      map.remove()
      mapRef.current = null
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
    // 每次保存都尝试点亮父国家（handleAutoLightCountry 内部会判断是否已点亮）
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
                  placeholder={t.notePlaceholder}
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
                  >{t.remove}</button>
                )}
                <GlowButton onClick={handleSave} fullWidth style={{ flex: 2, padding: '8px 0' }}>
                  {isVisited ? t.update : t.save}
                </GlowButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
