import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapState, VisitedPlace } from '../types'
import StarField from './StarField'
import { getCountryName } from '../i18n/countries'
import { useLang } from '../i18n/LangContext'
import { UI_STRINGS } from '../i18n/ui'
import { renderDotPattern, renderHiDotPattern, renderFlowPattern } from '../utils/mapPatterns'

interface Props {
  mapState: MapState
  onCountryClick: (place: VisitedPlace) => void
  onCountryDblClick?: (place: VisitedPlace) => void
  lightCountry?: string | null
  onLightDone?: () => void
}

const MERGE_TO_CHINA = new Set(['TWN', 'HKG', 'MAC'])

// 点亮国家的青色系配色
const GLOW_COLOR = '#00e5ff'
const GLOW_COLOR_DIM = '#0099bb'

function buildVisitedSet(visited: MapState['visitedCountries']): Set<string> {
  const s = new Set(Object.keys(visited))
  if (s.has('CHN')) MERGE_TO_CHINA.forEach(c => s.add(c))
  return s
}

export default function WorldMap({ mapState, onCountryClick, onCountryDblClick, lightCountry, onLightDone }: Props) {
  const { lang } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rafRef = useRef<number>(0)
  const mapStateRef = useRef(mapState)
  const langRef = useRef(lang)
  mapStateRef.current = mapState
  langRef.current = lang

  const onCountryDblClickRef = useRef(onCountryDblClick)
  onCountryDblClickRef.current = onCountryDblClick

  const buildVisitedFilter = useCallback(() => {
    const codes = [...buildVisitedSet(mapStateRef.current.visitedCountries)]
    if (codes.length === 0) return ['==', 'ADM0_A3', ''] as unknown as maplibregl.ExpressionSpecification
    return ['in', ['get', 'ADM0_A3'], ['literal', codes]] as unknown as maplibregl.ExpressionSpecification
  }, [])

  const updateLayers = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const filter = buildVisitedFilter()
    const notFilter = ['!', filter] as unknown as maplibregl.ExpressionSpecification

    if (map.getLayer('countries-visited-fill')) {
      map.setFilter('countries-visited-fill', filter)
      map.setFilter('countries-visited-dots', filter)
      map.setFilter('countries-visited-glow3', filter)
      map.setFilter('countries-visited-glow2', filter)
      map.setFilter('countries-visited-glow1', filter)
      map.setFilter('countries-unvisited-fill', notFilter)
      map.setFilter('countries-unvisited-border', notFilter)
      map.setFilter('countries-hover', notFilter)
    }
  }, [buildVisitedFilter])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        projection: { type: 'globe' },
        sources: {},
        layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#060d1a' } }],
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      },
      center: [104, 35],
      zoom: 1.8,
      minZoom: 0.8,
      maxZoom: 6,
      attributionControl: false,
    })

    mapRef.current = map

    map.on('load', () => {
      map.setSky({
        'sky-color': '#060d1a',
        'sky-horizon-blend': 0.2,
        'horizon-color': '#0a1628',
        'horizon-fog-blend': 0.05,
        'fog-color': '#060d1a',
        'fog-ground-blend': 0.98,
        'atmosphere-blend': 0.15,
      })

      // 注册点阵 pattern + 流光 pattern，并启动动画
      map.addImage('dot-pattern', renderDotPattern(0))
      map.addImage('flow-pattern', renderFlowPattern(0))
      let t = 0
      let useHiRes = false
      const animatePattern = () => {
        t += 0.016
        const zoom = map.getZoom()
        const shouldHiRes = zoom >= 3

        if (shouldHiRes !== useHiRes) {
          useHiRes = shouldHiRes
          // 切换 pattern 尺寸：先移除再重新注册
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

      map.addSource('countries', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson',
        generateId: true,
      })

      const initFilter = buildVisitedFilter()
      const initNotFilter = ['!', initFilter] as unknown as maplibregl.ExpressionSpecification

      // === 未点亮国家 ===
      map.addLayer({
        id: 'countries-unvisited-fill',
        type: 'fill',
        source: 'countries',
        filter: initNotFilter,
        paint: {
          'fill-color': '#0d2540',
          'fill-opacity': 0.9,
        },
      })
      map.addLayer({
        id: 'countries-unvisited-border',
        type: 'line',
        source: 'countries',
        filter: initNotFilter,
        paint: {
          'line-color': '#1e4060',
          'line-width': 0.6,
        },
      })

      // === 已点亮国家 - 暗底填充 ===
      map.addLayer({
        id: 'countries-visited-fill',
        type: 'fill',
        source: 'countries',
        filter: initFilter,
        paint: {
          'fill-color': '#041520',
          'fill-opacity': 0.9,
        },
      })

      // === 已点亮国家 - 点阵叠加 ===
      map.addLayer({
        id: 'countries-visited-dots',
        type: 'fill',
        source: 'countries',
        filter: initFilter,
        paint: {
          'fill-pattern': 'dot-pattern',
          'fill-opacity': 0.9,
        },
      })

      // === 发光边框三层（由外到内，模拟晕光）===
      map.addLayer({
        id: 'countries-visited-glow3',
        type: 'line',
        source: 'countries',
        filter: initFilter,
        paint: {
          'line-color': GLOW_COLOR_DIM,
          'line-width': 3,
          'line-blur': 3,
          'line-opacity': 0.2,
        },
      })
      map.addLayer({
        id: 'countries-visited-glow2',
        type: 'line',
        source: 'countries',
        filter: initFilter,
        paint: {
          'line-color': GLOW_COLOR,
          'line-width': 1.5,
          'line-blur': 1.5,
          'line-opacity': 0.5,
        },
      })
      map.addLayer({
        id: 'countries-visited-glow1',
        type: 'line',
        source: 'countries',
        filter: initFilter,
        paint: {
          'line-pattern': 'flow-pattern',
          'line-width': 1.5,
        },
      })

      // hover 高亮层（仅未选中国家）
      map.addLayer({
        id: 'countries-hover',
        type: 'fill',
        source: 'countries',
        filter: initNotFilter,
        paint: {
          'fill-color': '#ffffff',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0],
        },
      })

      map.on('sourcedata', e => {
        if (e.sourceId === 'countries' && e.isSourceLoaded) updateLayers()
      })

      let hoveredId: string | number | null = null
      let clickTimer: ReturnType<typeof setTimeout> | null = null

      map.on('mousemove', 'countries-unvisited-fill', e => handleMouseMove(e))
      map.on('mousemove', 'countries-visited-fill', e => handleMouseMove(e))

      function handleMouseMove(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
        if (!e.features || e.features.length === 0) return
        if (!isOnGlobe(e)) { handleMouseLeave(); return }
        if (hoveredId !== null) map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false })
        hoveredId = e.features[0].id ?? null
        if (hoveredId !== null) map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: true })
        map.getCanvas().style.cursor = 'pointer'

        const props = e.features[0].properties as { ADM0_A3: string; NAME: string }
        const rawCode = props.ADM0_A3
        const isoCode = MERGE_TO_CHINA.has(rawCode) ? 'CHN' : rawCode
        const chName = getCountryName(isoCode, langRef.current, props.NAME)
        const visited = mapStateRef.current.visitedCountries[isoCode]

        if (!popupRef.current) {
          popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'map-tooltip' })
        }
        const strings = UI_STRINGS[langRef.current]
        const depthLabel = visited
          ? { passed: strings.passed, short: strings.short, long: strings.long }[visited.visitDepth]
          : ''
        popupRef.current.setLngLat(e.lngLat).setHTML(`
          <div class="tooltip-content">
            <span class="tooltip-name">${chName}</span>
            ${visited ? `<span class="tooltip-badge">${depthLabel}</span>` : ''}
          </div>
        `).addTo(map)
      }

      map.on('mouseleave', 'countries-unvisited-fill', handleMouseLeave)
      map.on('mouseleave', 'countries-visited-fill', handleMouseLeave)

      function handleMouseLeave() {
        if (hoveredId !== null) { map.setFeatureState({ source: 'countries', id: hoveredId }, { hover: false }); hoveredId = null }
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove(); popupRef.current = null
      }

      map.on('click', 'countries-unvisited-fill', e => handleClick(e))
      map.on('click', 'countries-visited-fill', e => handleClick(e))
      map.on('dblclick', 'countries-unvisited-fill', e => handleDblClick(e))
      map.on('dblclick', 'countries-visited-fill', e => handleDblClick(e))
      // 禁用地图默认双击缩放，避免与进入国家视图冲突
      map.doubleClickZoom.disable()

      function handleDblClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
        // 取消因双击第一下触发的 click
        if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
        e.preventDefault()
        if (!e.features || e.features.length === 0) return
        const props = e.features[0].properties as { ADM0_A3: string; NAME: string }
        const rawCode = props.ADM0_A3
        const isoCode = MERGE_TO_CHINA.has(rawCode) ? 'CHN' : rawCode
        const chName = getCountryName(isoCode, langRef.current, props.NAME)
        const existing = mapStateRef.current.visitedCountries[isoCode]
        onCountryDblClickRef.current?.({ id: isoCode, type: 'country', name: chName, nameEn: props.NAME, visitDepth: existing?.visitDepth ?? 'short', note: existing?.note })
      }

      function isOnGlobe(e: maplibregl.MapMouseEvent): boolean {
        const canvas = map.getCanvas()
        const cx = canvas.offsetWidth / 2
        const cy = canvas.offsetHeight / 2
        const zoom = map.getZoom()
        const globeRadius = 512 * Math.pow(2, zoom) / (2 * Math.PI)
        const dx = e.point.x - cx
        const dy = e.point.y - cy
        return dx * dx + dy * dy <= globeRadius * globeRadius
      }

      function handleClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
        if (!e.features || e.features.length === 0) return
        if (!isOnGlobe(e)) return
        const props = e.features[0].properties as { ADM0_A3: string; NAME: string }
        const rawCode = props.ADM0_A3
        const isoCode = MERGE_TO_CHINA.has(rawCode) ? 'CHN' : rawCode
        const chName = getCountryName(isoCode, langRef.current, props.NAME)
        const existing = mapStateRef.current.visitedCountries[isoCode]
        // 延迟执行，等待 250ms 确认不是双击
        if (clickTimer) clearTimeout(clickTimer)
        clickTimer = setTimeout(() => {
          clickTimer = null
          onCountryClick({ id: isoCode, type: 'country', name: chName, nameEn: props.NAME, visitDepth: existing?.visitDepth ?? 'short', note: existing?.note })
        }, 250)
      }
    })

    return () => {
      cancelAnimationFrame(rafRef.current)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flashRafRef = useRef<number>(0)

  useEffect(() => {
    const map = mapRef.current
    if (!map || !lightCountry || !map.isStyleLoaded()) return

    const FLASH_DURATION = 3000
    const filter = ['==', ['get', 'ADM0_A3'], lightCountry] as unknown as maplibregl.ExpressionSpecification

    // Add flash fill layer if not exists
    if (!map.getLayer('countries-flash-fill')) {
      map.addLayer({
        id: 'countries-flash-fill',
        type: 'fill',
        source: 'countries',
        filter,
        paint: { 'fill-color': '#00e5ff', 'fill-opacity': 0 },
      })
      map.addLayer({
        id: 'countries-flash-glow',
        type: 'line',
        source: 'countries',
        filter,
        paint: { 'line-color': '#00e5ff', 'line-width': 4, 'line-blur': 6, 'line-opacity': 0 },
      })
    } else {
      map.setFilter('countries-flash-fill', filter)
      map.setFilter('countries-flash-glow', filter)
    }

    cancelAnimationFrame(flashRafRef.current)
    const start = performance.now()

    const animate = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / FLASH_DURATION, 1)

      // ease in fast (0→0.15s), hold bright, ease out slow (0.3→1.0)
      let fillOpacity: number
      let glowOpacity: number
      if (t < 0.05) {
        // rapid rise
        fillOpacity = (t / 0.05) * 0.55
        glowOpacity = (t / 0.05) * 0.9
      } else {
        // slow decay
        const decay = 1 - (t - 0.05) / 0.95
        fillOpacity = decay * decay * 0.55
        glowOpacity = decay * decay * 0.9
      }

      map.setPaintProperty('countries-flash-fill', 'fill-opacity', fillOpacity)
      map.setPaintProperty('countries-flash-glow', 'line-opacity', glowOpacity)

      if (t < 1) {
        flashRafRef.current = requestAnimationFrame(animate)
      } else {
        map.setPaintProperty('countries-flash-fill', 'fill-opacity', 0)
        map.setPaintProperty('countries-flash-glow', 'line-opacity', 0)
        onLightDone?.()
      }
    }

    flashRafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(flashRafRef.current)
  }, [lightCountry]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    updateLayers()
  }, [mapState.visitedCountries, updateLayers])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#050a14' }}>
      <StarField />
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
