// ─── 访问深度 ─────────────────────────────────────────────────────────────────
// 三个等级适用于国家和省份
export type VisitDepth = 'passed' | 'short' | 'long' // 路过 / 短住 / 长居

// ─── 国家 / 城市记录 ──────────────────────────────────────────────────────────
export interface VisitedPlace {
  id: string          // ISO3 国家代码，如 'CHN'；城市暂不使用
  type: 'country' | 'city'
  name: string        // 当前语言名称（由 getCountryName 获取）
  nameEn: string      // 英文名（来自 GeoJSON properties.NAME）
  countryCode?: string
  visitDepth: VisitDepth
  visitedAt?: string  // 预留字段，目前未填写
  note?: string
}

// ─── 省份记录 ─────────────────────────────────────────────────────────────────
export interface VisitedProvince {
  id: string          // 格式：{countryCode}_{iso_3166_2}，如 'CHN_CN-BJ'
  countryCode: string
  name: string
  nameEn: string
  visitDepth: VisitDepth
  note?: string
}

// ─── 全局地图状态 ─────────────────────────────────────────────────────────────
export interface MapState {
  visitedCountries: Record<string, VisitedPlace>
  visitedCities: Record<string, VisitedPlace>     // 预留字段，当前功能未使用
  visitedProvinces: Record<string, VisitedProvince>
}

// ─── 常量 ─────────────────────────────────────────────────────────────────────
export const TOTAL_COUNTRIES = 195

export const DEPTH_COLORS: Record<VisitDepth, string> = {
  passed: '#93C5FD',  // 浅蓝 - 路过
  short:  '#3B82F6',  // 中蓝 - 短住
  long:   '#1D4ED8',  // 深蓝 - 长居
}

