# 足迹地图 · 产品功能规格文档

> 本文档完整描述产品的技术实现细节，依照此文档可从零复现完整产品。

---

## 一、项目概述

**产品名称**：足迹地图（Travel Map）
**产品定位**：个人旅行足迹记录工具，在可交互的三维地球上标记并展示去过的国家
**技术栈**：React 19 + TypeScript + Vite 8 + MapLibre GL 5 + Framer Motion 12
**数据存储**：localStorage（纯前端，无后端）
**构建命令**：`npm run dev`（开发）/ `npm run build`（生产）

---

## 二、目录结构

```
travel-map/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.app.json
└── src/
    ├── main.tsx              # 入口
    ├── App.tsx               # 根组件
    ├── index.css             # 全局样式
    ├── types.ts              # 类型定义 + 常量
    ├── store.ts              # 状态管理（localStorage）
    ├── components/
    │   ├── WorldMap.tsx      # 地球地图（核心）
    │   ├── StarField.tsx     # 星空背景
    │   ├── CountryPanel.tsx  # 国家编辑面板
    │   ├── StatsBar.tsx      # 顶部统计栏
    │   ├── ShareCard.tsx     # 分享卡片
    │   └── Toast.tsx         # 提示通知
    └── i18n/
        ├── LangContext.tsx   # 语言 Context
        ├── ui.ts             # UI 字符串（6语言）
        └── countries.ts     # 国家名称数据库（6语言）
```

---

## 三、依赖清单

```json
"dependencies": {
  "react": "^19.2.4",
  "react-dom": "^19.2.4",
  "maplibre-gl": "^5.20.2",
  "framer-motion": "^12.38.0",
  "html2canvas": "^1.4.1",
  "@supabase/supabase-js": "^2.99.2"
}
```

---

## 四、类型定义（src/types.ts）

```typescript
export interface VisitedPlace {
  id: string                          // ISO3 国家代码，如 'CHN'
  type: 'country' | 'city'
  name: string                        // 当前语言下的名称
  nameEn: string                      // 英文名（来自 GeoJSON）
  countryCode?: string
  visitDepth: 'passed' | 'short' | 'long'  // 路过 / 短住 / 长居
  visitedAt?: string
  note?: string                       // 用户备注
}

export interface MapState {
  visitedCountries: Record<string, VisitedPlace>  // key = ISO3
  visitedCities: Record<string, VisitedPlace>
}

export const TOTAL_COUNTRIES = 195

export const DEPTH_COLORS = {
  passed: '#93C5FD',   // 浅蓝
  short:  '#3B82F6',   // 中蓝
  long:   '#1D4ED8',   // 深蓝
}
```

---

## 五、状态管理（src/store.ts）

- 使用 React `useState` + localStorage，无外部状态库
- localStorage key：`'travel-map-data'`
- 加载时校验数据结构（`visitedCountries` 必须为 object）
- 暴露方法：`updateCountry(place)`、`removeCountry(id)`、`stats`

```typescript
// stats 结构
{
  totalCountries: number,
  passed: number,
  short: number,
  long: number,
}
```

---

## 六、根组件（src/App.tsx）

- 用 `<LangProvider>` 包裹整个应用（i18n 根节点）
- 内部组件 `AppInner` 使用 `useLang()` 获取翻译
- 管理状态：`selectedPlace`、`showShare`、`toast`
- `handleRemove`：调用 `removeCountry(id)` + `setSelectedPlace(null)`，不再 reload 页面
- Toast 消息格式：`${place.name} ${t.lit}`

---

## 七、全局样式（src/index.css）

```css
/* 全局重置 */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { width: 100%; height: 100%; overflow: hidden; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
               'Microsoft YaHei', sans-serif;
  background: #0f172a;
  color: #f1f5f9;
}

/* MapLibre tooltip */
.map-tooltip .maplibregl-popup-content {
  background: #1e293b; border: 1px solid #334155; border-radius: 8px;
  padding: 8px 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); pointer-events: none;
}
.map-tooltip .maplibregl-popup-tip { display: none; }
.tooltip-content { display: flex; align-items: center; gap: 8px; }
.tooltip-name { font-size: 13px; color: #f1f5f9; font-weight: 500; }
.tooltip-badge {
  font-size: 11px; color: #3b82f6;
  background: rgba(59,130,246,0.12); padding: 2px 6px; border-radius: 4px;
}

/* 滚动条 */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
```

---

## 八、地球地图（src/components/WorldMap.tsx）

### 8.1 地图初始化

```typescript
new maplibregl.Map({
  container: containerRef.current,
  style: {
    version: 8,
    projection: { type: 'globe' },   // 球形投影（MapLibre v5）
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#060d1a' } }],
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  },
  center: [104, 35],   // 初始中心：中国地理中心
  zoom: 1.8,
  minZoom: 0.8,
  maxZoom: 6,
  attributionControl: false,
})
```

### 8.2 大气层效果（setSky）

```typescript
map.setSky({
  'sky-color': '#060d1a',
  'sky-horizon-blend': 0.2,
  'horizon-color': '#0a1628',
  'horizon-fog-blend': 0.05,
  'fog-color': '#060d1a',
  'fog-ground-blend': 0.98,
  'atmosphere-blend': 0.15,
})
```

### 8.3 GeoJSON 数据源

```
URL: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
```
- 使用 `ne_50m`（1:5000万）精度，包含新加坡等小国
- `generateId: true` 用于 feature-state hover

### 8.4 图层结构（按渲染顺序）

| 图层 ID | 类型 | 作用 | 过滤条件 |
|---|---|---|---|
| `countries-unvisited-fill` | fill | 未访问国家底色 `#0d2540` | 非已访问 |
| `countries-unvisited-border` | line | 未访问国家边框 `#1e4060`，宽 0.6 | 非已访问 |
| `countries-visited-fill` | fill | 已访问国家暗底 `#041520` | 已访问 |
| `countries-visited-dots` | fill | 点阵动画叠加（fill-pattern） | 已访问 |
| `countries-visited-glow3` | line | 外层光晕 `#0099bb`，宽3，blur3，opacity0.2 | 已访问 |
| `countries-visited-glow2` | line | 中层光晕 `#00e5ff`，宽1.5，blur1.5，opacity0.5 | 已访问 |
| `countries-visited-glow1` | line | 流光边框（line-pattern），宽1.5 | 已访问 |
| `countries-hover` | fill | hover 白色高亮 opacity0.08 | 非已访问 |

### 8.5 点阵动画（低精度，zoom < 3）

- Canvas 尺寸：48×48 px
- 13 个固定光点，每点有 `{x, y, r, a, phase}` 参数
- 每帧更新：
  - 呼吸：`wave = (sin(t*1.2 + phase) + 1) / 2`
  - 漂移：`drift = sin(t*0.7 + phase*1.3) * 1.5`（±1.5px）
  - 颜色：hue 在 165~205 之间漂移（青色↔蓝紫色）
  - 光晕半径：`r * 2.2`，透明度 `alpha * 0.35`
  - 核心半径：`r * (0.8 + wave * 0.5)`

### 8.6 点阵动画（高精度，zoom ≥ 3）

- Canvas 尺寸：256×256 px
- 60 个随机分布光点（seeded RNG，seed=137，避免重复规律）
- 漂移幅度更大（±2.5px），光晕半径 `r * 4`

### 8.7 流光边框动画

- Canvas 尺寸：1024×5 px（水平重复 pattern）
- 5 条彗星，参数各异：

```typescript
const COMETS = [
  { speed: 72,  tailLen: 280, brightness: 1.0,  offset: 0   },
  { speed: 45,  tailLen: 200, brightness: 0.7,  offset: 310 },
  { speed: 110, tailLen: 160, brightness: 0.55, offset: 620 },
  { speed: 58,  tailLen: 240, brightness: 0.85, offset: 180 },
  { speed: 88,  tailLen: 120, brightness: 0.5,  offset: 750 },
]
```
- 拖尾：平方衰减，色相青→蓝（hue 188~213）
- 头部：±3px 扩散，颜色 `rgba(210, 248, 255, a)`

### 8.8 动画切换逻辑

```typescript
const shouldHiRes = zoom >= 3
if (shouldHiRes !== useHiRes) {
  // 切换分辨率：removeImage + addImage（不能直接 updateImage 改尺寸）
  map.removeImage('dot-pattern')
  map.addImage('dot-pattern', useHiRes ? renderHiDotPattern(t) : renderDotPattern(t))
} else {
  map.updateImage('dot-pattern', ...)
}
```

### 8.9 台湾/香港/澳门合并逻辑

```typescript
const MERGE_TO_CHINA = new Set(['TWN', 'HKG', 'MAC'])
// 点击/hover 时：isoCode = MERGE_TO_CHINA.has(rawCode) ? 'CHN' : rawCode
// 图层过滤时：若 CHN 已访问，自动将 TWN/HKG/MAC 加入已访问集合
```

### 8.10 地球边界检测

```typescript
function isOnGlobe(e): boolean {
  const cx = canvas.offsetWidth / 2
  const cy = canvas.offsetHeight / 2
  const globeRadius = 512 * Math.pow(2, map.getZoom()) / (2 * Math.PI)
  const dx = e.point.x - cx
  const dy = e.point.y - cy
  return dx * dx + dy * dy <= globeRadius * globeRadius
}
// 地球外的 click 和 mousemove 均不触发
```

### 8.11 stale closure 解决方案

```typescript
const mapStateRef = useRef(mapState)
const langRef = useRef(lang)
mapStateRef.current = mapState   // 每次渲染同步
langRef.current = lang
// MapLibre 事件回调中读 mapStateRef.current 而非 mapState
```

---

## 九、星空背景（src/components/StarField.tsx）

- 280 颗星，Canvas 全屏覆盖，`pointerEvents: none`
- 每颗星参数：`{x, y, vx, vy, radius, phase, speed, baseAlpha}`
- 漂移速度：`vx/vy = (random - 0.5) * 0.16`（极慢）
- 超出屏幕边界时从对侧回绕
- 呼吸：`wave = (sin(t*speed + phase) + 1) / 2`
- 亮度：`alpha = (0.05 + wave * baseAlpha) * 0.8`（峰值降低20%）
- 光晕：`sr * 2` 半径，透明度 `alpha * 0.5`
- 核心：`rgba(220, 235, 255, min(1, alpha*1.5))`

---

## 十、国家编辑面板（src/components/CountryPanel.tsx）

- 位置：右侧，垂直居中（`right: 24, top: 50%, translateY(-50%)`）
- 宽度：280px，背景 `#0d1f35`，圆角 16px
- 入场动画：`x: 40 → 0`，spring 弹簧动画

**交互逻辑**：
- 停留深度按钮：点击只更新本地 `selectedDepth` state，**不立即保存**
- 备注：受控 textarea，本地 `note` state
- 保存按钮：`onSave({ ...place, visitDepth: selectedDepth, note })`，保存后面板关闭
- 移除按钮：仅在 `isVisited` 时显示

**左侧细分数据浮层**（有已访问数据时显示）：
- 显示长居/深度游/路过各自数量
- 延迟 0.08s 入场，`x: 16 → 0`

---

## 十一、顶部统计栏（src/components/StatsBar.tsx）

- 位置：顶部居中，`top: 20`，`zIndex: 50`
- 背景：`rgba(15, 23, 42, 0.85)` + `backdropFilter: blur(12px)`
- 圆角 16px，边框 `#1e3a5f`

**展示内容（从左到右）**：
1. App 名称（`t.appName`）
2. 分隔线
3. 已探索 % + 国家数（点击国家数可展开/收起路过/短住/长居细分）
4. 分隔线
5. 语言切换下拉（`<select>`，自定义箭头图标）
6. 分隔线
7. 分享按钮

**展开动画**：`AnimatePresence` + `width: 0 → auto`，duration 0.2s

---

## 十二、分享卡片（src/components/ShareCard.tsx）

- 全屏遮罩：`rgba(0,0,0,0.7)` + `backdropFilter: blur(4px)`
- 卡片宽度：360px，渐变背景 `135deg, #0f172a → #1e293b → #0f2744`
- 使用 `html2canvas` 截图，scale: 2（2倍清晰度）
- 下载文件名：`${t.shareTitle}.png`

**卡片内容**：
- 标题：`t.shareTitle`
- 数字：`total` + `t.countriesUnit`（单位字段，各语言独立）
- 副标题：`t.shareSubtitle(pct)`
- 进度条：`width: 0 → pct%`，delay 0.3s，duration 1s
- 分类列表：长居/深度游/路过（有数据才显示），国家名超40字截断
- 底部：`t.shareFooter`

---

## 十三、Toast 通知（src/components/Toast.tsx）

- 位置：底部居中，`bottom: 32`
- 样式：`rgba(0, 229, 255, 0.12)` 背景，`rgba(0, 229, 255, 0.35)` 边框
- 自动消失：2500ms 后调用 `onDone()`
- 触发时机：保存国家后，消息格式 `${place.name} ${t.lit}`

---

## 十四、国际化系统（src/i18n/）

### 14.1 支持语言

| 代码 | 显示名 |
|---|---|
| zh | 中文 |
| en | English |
| ja | 日本語 |
| ko | 한국어 |
| es | Español |
| fr | Français |

### 14.2 语言检测与持久化（LangContext.tsx）

```typescript
// 优先级：localStorage > 浏览器语言 > 英文
const LANG_STORAGE_KEY = 'travel-map-lang'
function detectInitialLang(): LangCode {
  const saved = localStorage.getItem(LANG_STORAGE_KEY)
  if (saved && saved in UI_STRINGS) return saved as LangCode
  const b = navigator.language.toLowerCase()
  if (b.startsWith('zh')) return 'zh'
  if (b.startsWith('ja')) return 'ja'
  if (b.startsWith('ko')) return 'ko'
  if (b.startsWith('es')) return 'es'
  if (b.startsWith('fr')) return 'fr'
  return 'en'
}
// 切换语言时同步写入 localStorage
```

### 14.3 UI 字符串键（ui.ts）

每种语言包含以下所有键：

```
appName, countries, explored, passed, short, long, share, hint,
visited, unvisited, depthLabel, note, notePlaceholder, remove, save,
update, lit, shortStay, longStay, shareTitle, shareSubtitle(fn),
shareCountries(fn), countriesUnit, shareFooter, download, close,
longStayLabel, shortStayLabel, passedLabel
```

### 14.4 国家名数据库（countries.ts）

- 195 个国家，ISO3 代码为 key
- 每个国家包含 6 种语言名称
- `getCountryName(iso3, lang, fallback?)` 查找函数，找不到时返回 fallback 或 iso3

---

## 十五、视觉设计规范

### 配色

| 用途 | 颜色值 |
|---|---|
| 页面背景 | `#0f172a` |
| 地球背景 | `#050a14` / `#060d1a` |
| 未访问国家 | `#0d2540` |
| 未访问边框 | `#1e4060` |
| 已访问国家底色 | `#041520` |
| 发光边框（亮） | `#00e5ff` |
| 发光边框（暗） | `#0099bb` |
| 面板背景 | `#0d1f35` |
| 面板边框 | `#1e3a5f` |
| 主文字 | `#e0f7ff` |
| 次要文字 | `#94a3b8` |
| 青色高亮 | `#80f0ff` |
| 路过颜色 | `#93C5FD` |
| 短住颜色 | `#3B82F6` |
| 长居颜色 | `#1D4ED8` |

### 动画规范

- 面板入场：`spring { stiffness: 300, damping: 30 }`，`x: 40 → 0`
- 统计栏入场：`y: -20 → 0`
- 展开收起：`width: 0 → auto`，duration 0.2s
- 进度条：`width: 0 → pct%`，duration 1s，delay 0.3s

---

## 十六、关键实现细节

1. **MapLibre v5 不支持 `setFog()`**，必须用 `setSky()` 实现大气效果
2. **动态 pattern 动画**：用 `map.addImage()` 注册，每帧 `map.updateImage()` 更新；切换尺寸时必须先 `removeImage` 再 `addImage`
3. **GeoJSON 异步加载**：监听 `sourcedata` 事件，在 `isSourceLoaded` 时重新应用图层过滤器
4. **stale closure**：MapLibre 事件回调中通过 `ref.current` 读取最新 React state
5. **地球外点击屏蔽**：用公式 `512 * 2^zoom / 2π` 计算地球像素半径，超出圆形范围不触发
6. **pattern 切换阈值**：zoom ≥ 3 切换到 256px 高精度 pattern，避免放大时看到重复规律
