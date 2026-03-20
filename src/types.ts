export interface VisitedPlace {
  id: string
  type: 'country' | 'city'
  name: string
  nameEn: string
  countryCode?: string
  visitDepth: 'passed' | 'short' | 'long' // 路过 / 短住 / 长居
  visitedAt?: string
  note?: string
}

export interface MapState {
  visitedCountries: Record<string, VisitedPlace>
  visitedCities: Record<string, VisitedPlace>
}

export const TOTAL_COUNTRIES = 195

export const DEPTH_COLORS = {
  passed: '#93C5FD',  // 浅蓝 - 路过
  short: '#3B82F6',   // 中蓝 - 短住
  long: '#1D4ED8',    // 深蓝 - 长居
}

export const DEPTH_LABELS = {
  passed: '路过',
  short: '短住（1天-1个月）',
  long: '长居（1个月以上）',
}
