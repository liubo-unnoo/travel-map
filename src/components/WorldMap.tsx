import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapState, VisitedPlace } from '../types'
import StarField from './StarField'
import { getCountryName } from '../i18n/countries'
import { useLang } from '../i18n/LangContext'
import { UI_STRINGS } from '../i18n/ui'
import { renderDotPattern, renderHiDotPattern, renderFlowPattern } from '../utils/mapPatterns'
import { prefetchProvinceData } from '../utils/prefetch'

interface Props {
  mapState: MapState
  onCountryClick: (place: VisitedPlace) => void
  onCountryDblClick?: (place: VisitedPlace) => void
  onEmptyClick?: () => void          // 点击地球外围空白区域时触发（用于关闭面板）
  lightCountry?: string | null
  onLightDone?: () => void
}

const MERGE_TO_CHINA = new Set(['TWN', 'HKG', 'MAC'])

// 已访问国家发光边框颜色
const GLOW_COLOR = '#00e5ff'
const GLOW_COLOR_DIM = '#0099bb'

// 将已访问国家集合构建为 Set，同时处理台湾/香港/澳门归并逻辑
function buildVisitedSet(visited: MapState['visitedCountries']): Set<string> {
  const s = new Set(Object.keys(visited))
  if (s.has('CHN')) MERGE_TO_CHINA.forEach(c => s.add(c))
  return s
}

export default function WorldMap({ mapState, onCountryClick, onCountryDblClick, onEmptyClick, lightCountry, onLightDone }: Props) {
  const { lang } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const rafRef = useRef<number>(0)

  // Stale closure 处理：MapLibre 事件回调在 useEffect 初始化时捕获，
  // 如果直接读 mapState/lang 会永远是初始值。
  // 通过 ref 每次渲染同步最新值，回调中读 .current 来获取最新状态。
  const mapStateRef = useRef(mapState)
  const langRef = useRef(lang)
  mapStateRef.current = mapState
  langRef.current = lang

  const onCountryDblClickRef = useRef(onCountryDblClick)
  onCountryDblClickRef.current = onCountryDblClick
  const onEmptyClickRef = useRef(onEmptyClick)
  onEmptyClickRef.current = onEmptyClick

  const buildVisitedFilter = useCallback(() => {
    const codes = [...buildVisitedSet(mapStateRef.current.visitedCountries)]
    // 无访问记录时返回永不匹配的 filter，避免图层报错
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

    // 监听容器尺寸变化，自动触发 map.resize()
    // 解决 SplashScreen 遮盖期间 MapLibre canvas 尺寸为 0，消失后地图空白的问题
    const ro = new ResizeObserver(() => { map.resize() })
    if (containerRef.current) ro.observe(containerRef.current)

    let clickTimer: ReturnType<typeof setTimeout> | null = null

    map.on('load', () => {
      // 地球加载完成后立即预取省份 GeoJSON，用户浏览地球期间后台下载
      prefetchProvinceData()

      map.setSky({
        'sky-color': '#060d1a',
        'sky-horizon-blend': 0.2,
        'horizon-color': '#0a1628',
        'horizon-fog-blend': 0.05,
        'fog-color': '#060d1a',
        'fog-ground-blend': 0.98,
        'atmosphere-blend': 0.15,
      })

      // ── Pattern 动画 ──────────────────────────────────────────────────────
      // 点阵/流光 pattern 每帧通过 updateImage 替换，配合 triggerRepaint 强制重绘。
      // zoom 跨越阈值时需先 removeImage 再 addImage（不能直接用 updateImage 改尺寸）。
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
        // GeoJSON 托管在 public/ 目录，由 Cloudflare CDN 提供服务，避免 raw.githubusercontent.com 在国内被墙
        data: '/ne_50m_admin_0_countries.geojson',
        generateId: true,
      })

      const initFilter = buildVisitedFilter()
      const initNotFilter = ['!', initFilter] as unknown as maplibregl.ExpressionSpecification

      // ── 图层结构 ──────────────────────────────────────────────────────────
      // 未访问：底色 + 边框
      // 已访问：暗底 → 点阵叠加 → 三层发光边框（外→内模拟晕光）
      // hover：仅覆盖未访问国家，已访问国家不需要额外 hover 状态

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

      // ── 点击去抖 ──────────────────────────────────────────────────────────
      // 单击：延迟 300ms 执行（等待确认不是双击）
      // 双击：300ms 内连续两次点击同一国家 = 双击，取消待执行的单击 timer，直接进入省份视图
      // 注意 clickTimer 声明在 useEffect 外层作用域，确保 cleanup 可以访问并清除

      // 禁用地图默认双击缩放
      map.doubleClickZoom.disable()

      // 用连击计数检测双击，彻底规避 MapLibre dblclick 事件的不稳定问题：
      // 300ms 内连续两次点击同一国家 = 进入省份视图
      let lastClickCode = ''
      let lastClickTime = 0

      map.on('click', 'countries-unvisited-fill', e => handleClick(e))
      map.on('click', 'countries-visited-fill', e => handleClick(e))

      function handleClick(e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) {
        if (!e.features || e.features.length === 0) return
        if (!isOnGlobe(e)) return  // 地球外围区域不响应点击
        const props = e.features[0].properties as { ADM0_A3: string; NAME: string }
        const rawCode = props.ADM0_A3
        const isoCode = MERGE_TO_CHINA.has(rawCode) ? 'CHN' : rawCode
        const chName = getCountryName(isoCode, langRef.current, props.NAME)
        const existing = mapStateRef.current.visitedCountries[isoCode]
        const place: VisitedPlace = {
          id: isoCode, type: 'country', name: chName, nameEn: props.NAME,
          visitDepth: existing?.visitDepth ?? 'short', note: existing?.note,
        }

        const now = Date.now()
        const isDoubleClick = isoCode === lastClickCode && now - lastClickTime < 350
        lastClickCode = isoCode
        lastClickTime = now

        if (isDoubleClick) {
          // 双击：取消待执行的单击，触发进入
          if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
          lastClickCode = ''
          lastClickTime = 0
          onCountryDblClickRef.current?.(place)
          return
        }

        // 单击：延迟 300ms，等待确认不是双击再弹面板
        if (clickTimer) clearTimeout(clickTimer)
        clickTimer = setTimeout(() => {
          clickTimer = null
          onCountryClick(place)
        }, 300)
      }

      // 点击地球外围空白区域（非国家图层）时关闭面板
      map.on('click', (e: maplibregl.MapMouseEvent) => {
        // 查询点击位置是否命中了国家图层
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['countries-unvisited-fill', 'countries-visited-fill'],
        })
        if (features.length === 0 || !isOnGlobe(e)) {
          onEmptyClickRef.current?.()
        }
      })
    })

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafRef.current)
      if (clickTimer) clearTimeout(clickTimer)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 保存闪光动效 ────────────────────────────────────────────────────────
  // lightCountry prop 变化时触发，持续 3000ms：
  //   0~5%   → 快速点亮（fill + glow 同步上升）
  //   5~100% → 缓慢衰减（平方曲线，视觉上先亮后暗）
  // flash 图层懒创建：首次触发时 addLayer，后续切换国家只更新 filter

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
