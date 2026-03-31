// 省份 GeoJSON 预取缓存
// 在地球视图加载后尽早调用 prefetchProvinceData()，
// ProvinceMap 初始化时通过 getProvinceData() 直接取缓存，避免重复请求。

// GeoJSON 托管在 public/ 目录，由 Cloudflare CDN 提供服务，避免 raw.githubusercontent.com 在国内被墙
const PROVINCE_SOURCE = '/ne_10m_admin_1_states_provinces.geojson'

let cache: Promise<GeoJSON.FeatureCollection> | null = null

/** 开始预取省份数据（幂等，多次调用只发一次请求） */
export function prefetchProvinceData(): void {
  if (!cache) {
    cache = fetch(PROVINCE_SOURCE)
      .then(r => r.json())
      .catch(err => {
        // 预取失败不阻塞，清空缓存让后续重试
        console.warn('[prefetch] Province data prefetch failed:', err)
        cache = null
        throw err
      })
  }
}

/** 获取省份数据（若已预取则直接返回缓存的 Promise，否则现场发请求） */
export function getProvinceData(): Promise<GeoJSON.FeatureCollection> {
  if (!cache) {
    prefetchProvinceData()
  }
  return cache!
}
