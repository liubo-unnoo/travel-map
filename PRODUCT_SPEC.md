# 足迹地图 · 产品功能规格文档

> 本文档完整描述产品的技术实现细节，依照此文档可从零复现完整产品。

---

## 一、项目概述

**产品名称**：足迹地图（Travel Map）
**产品定位**：个人旅行足迹记录工具，在可交互的三维地球上标记去过的国家及其省份
**技术栈**：React 18 + TypeScript + Vite + MapLibre GL JS + Framer Motion
**数据存储**：localStorage（纯前端，无后端）
**部署**：Cloudflare Pages，GitHub 仓库 `liubo-unnoo/travel-map`，push main 后自动部署
**线上地址**：https://travel-map-8lw.pages.dev
**本地启动**：`npm run dev`（默认 http://localhost:5173）

---

## 二、目录结构

```
travel-map/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.app.json
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types.ts
    ├── store.ts
    ├── components/
    │   ├── WorldMap.tsx       # 地球地图（核心）
    │   ├── ProvinceMap.tsx    # 省份地图（双击国家后进入）
    │   ├── WarpEffect.tsx     # 穿越动效（Canvas）
    │   ├── StarField.tsx      # 星空背景（Canvas）
    │   ├── CountryPanel.tsx   # 国家标记面板
    │   ├── StatsBar.tsx       # 顶部统计栏
    │   ├── ShareCard.tsx      # 分享卡片
    │   ├── Toast.tsx          # 底部提示
    │   └── GlowButton.tsx     # 发光按钮组件
    ├── i18n/
    │   ├── LangContext.tsx    # 语言 Context
    │   ├── ui.ts              # UI 字符串（6语言）
    │   └── countries.ts       # 国家名数据库（6语言）
    └── utils/
        └── mapPatterns.ts     # 点阵/流光 pattern 渲染（WorldMap 和 ProvinceMap 共用）
```

---

## 三、依赖清单

```json
"dependencies": {
  "react": "^18.x",
  "react-dom": "^18.x",
  "maplibre-gl": "^5.x",
  "framer-motion": "^12.x",
  "html2canvas": "^1.4.1"
}
```

---

## 四、类型定义（src/types.ts）

```typescript
export interface VisitedPlace {
  id: string                              // ISO3 国家代码，如 'CHN'
  type: 'country' | 'city'
  name: string                            // 当前语言名称
  nameEn: string                          // 英文名（来自 GeoJSON）
  countryCode?: string
  visitDepth: 'passed' | 'short' | 'long' // 路过 / 短住 / 长居
  visitedAt?: string
  note?: string
}

export interface VisitedProvince {
  id: string            // 格式：{countryCode}_{iso_3166_2}，如 'CHN_CN-BJ'
  countryCode: string
  name: string
  nameEn: string
  visitDepth: 'passed' | 'short' | 'long'
  note?: string
}

export interface MapState {
  visitedCountries: Record<string, VisitedPlace>
  visitedCities: Record<string, VisitedPlace>
  visitedProvinces: Record<string, VisitedProvince>
}

export const TOTAL_COUNTRIES = 195

export const DEPTH_COLORS = {
  passed: '#93C5FD',  // 浅蓝
  short:  '#3B82F6',  // 中蓝
  long:   '#1D4ED8',  // 深蓝
}
```

---

## 五、状态管理（src/store.ts）

- 使用 React `useState` + localStorage，无外部状态库
- localStorage key：`'travel-map-data'`
- 加载时校验数据结构，兼容旧版本（`visitedProvinces` 不存在时初始化为 `{}`）
- 暴露方法：`updateCountry`、`removeCountry`、`updateProvince`、`removeProvince`、`stats`

```typescript
// stats 结构
{ totalCountries: number, passed: number, short: number, long: number }
```

---

## 六、根组件（src/App.tsx）

用 `<LangProvider>` 包裹，内部 `AppInner` 管理两种视图模式：

```typescript
type AppMode = 'globe' | 'country'
```

**状态：**
- `mode` — 当前视图模式
- `activeCountry` — 当前进入的国家（country 模式时使用）
- `selectedPlace` — 当前单击选中的国家（显示 CountryPanel）
- `warping` — 穿越动效是否正在播放
- `lightCountry` — 当前需要闪光的国家 ISO3 code
- `showShare` — 分享卡片是否显示
- `toast` — 底部提示文字

**交互流程：**
1. 单击国家 → `setSelectedPlace` → 显示 CountryPanel
2. 双击国家 → `setActiveCountry` + `setMode('country')` + `setWarping(true)` → WarpEffect 播放 → 切换到省份地图
3. 点击返回 → `setMode('globe')` + 清空 `activeCountry`、`selectedPlace`、`warping`

**视图渲染策略：**
- WorldMap 和 ProvinceMap 都**始终挂载**，用 `opacity` + `pointerEvents` 控制显隐
- 避免 AnimatePresence 条件卸载导致 MapLibre 实例重建，引发双击失效问题
- WarpEffect 通过 `{warping && <WarpEffect />}` 条件渲染，播放完毕后自动卸载

---

## 七、全局样式（src/index.css）

```css
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

/* 按钮样式 */
.glow-btn {
  padding: 10px 20px; border-radius: 10px; border: 1px solid #00e5ff;
  background: rgba(0,229,255,0.08); color: #00e5ff;
  font-size: 13px; font-weight: 600; cursor: pointer;
  box-shadow: 0 0 12px rgba(0,229,255,0.15); transition: all 0.15s;
}
.glow-btn:hover { background: rgba(0,229,255,0.18); box-shadow: 0 0 20px rgba(0,229,255,0.35); }
.glow-btn:active { transform: scale(0.97); }

.close-btn:hover { color: #94a3b8; }
.close-btn:active { transform: scale(0.92); }
.danger-btn:hover { background: rgba(239,68,68,0.1) !important; }
.danger-btn:active { transform: scale(0.97); }
.depth-btn:hover { border-color: #334155 !important; background: #0d1f35 !important; }

/* 滚动条 */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
```

---

## 八、共享 Pattern 渲染（src/utils/mapPatterns.ts）

WorldMap 和 ProvinceMap 共用，避免重复代码。

### 8.1 低精度点阵（renderDotPattern）

- Canvas 尺寸：48×48 px，用于 zoom < 3（WorldMap）/ zoom < 4（ProvinceMap）
- 13 个固定光点，每点参数 `{x, y, r, a, phase}`
- 每帧：呼吸（sin 波）、漂移（±1.5px）、hue 漂移（165~205°）

### 8.2 高精度点阵（renderHiDotPattern）

- Canvas 尺寸：256×256 px，用于高缩放级别
- 60 个 seeded RNG 随机点（seed=137），漂移幅度 ±2.5px，光晕半径 `r*4`

### 8.3 流光边框（renderFlowPattern）

- Canvas 尺寸：1024×5 px（水平 pattern，贴在图层边框上循环）
- 5 条彗星，各有独立 speed / tailLen / brightness / offset
- 拖尾平方衰减，色相 hue 188~213（青→蓝）

---

## 九、地球地图（src/components/WorldMap.tsx）

### 9.1 初始化

```typescript
new maplibregl.Map({
  container, style: { version: 8, projection: { type: 'globe' }, ... },
  center: [104, 35],  // 中国地理中心
  zoom: 1.8, minZoom: 0.8, maxZoom: 6,
  attributionControl: false,
})
map.setSky({ 'sky-color': '#060d1a', 'atmosphere-blend': 0.15, ... })
map.doubleClickZoom.disable()  // 禁用默认双击缩放，防止与进入国家视图冲突
```

### 9.2 数据源

```
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
```
- `generateId: true`，用于 feature-state hover

### 9.3 图层结构

| 图层 ID | 类型 | 作用 |
|---|---|---|
| `countries-unvisited-fill` | fill | 未访问底色 `#0d2540` |
| `countries-unvisited-border` | line | 未访问边框 `#1e4060`，宽 0.6 |
| `countries-visited-fill` | fill | 已访问暗底 `#041520` |
| `countries-visited-dots` | fill | 点阵动画（fill-pattern: dot-pattern） |
| `countries-visited-glow3` | line | 外层光晕 `#0099bb`，宽3，blur3，opacity0.2 |
| `countries-visited-glow2` | line | 中层光晕 `#00e5ff`，宽1.5，blur1.5，opacity0.5 |
| `countries-visited-glow1` | line | 流光边框（line-pattern: flow-pattern），宽1.5 |
| `countries-hover` | fill | hover 白色高亮 opacity0.08（仅未访问国家） |
| `countries-flash-fill` | fill | 保存时发光闪烁（临时图层，opacity 动画） |
| `countries-flash-glow` | line | 保存时边框闪烁（宽4，blur6） |

### 9.4 台湾/香港/澳门合并逻辑

```typescript
const MERGE_TO_CHINA = new Set(['TWN', 'HKG', 'MAC'])
// 点击/hover 时统一映射到 CHN
// buildVisitedSet: 若 CHN 已访问，自动将三者加入已访问集合
```

### 9.5 点击去抖（防止双击误触单击）

```typescript
let clickTimer: ReturnType<typeof setTimeout> | null = null

// handleClick: 延迟 250ms 执行，dblclick 发生时取消
clickTimer = setTimeout(() => { onCountryClick(...) }, 250)

// handleDblClick: 先 clearTimeout(clickTimer)，再触发进入逻辑
```

### 9.6 保存闪光动效

- 触发：`lightCountry` prop 变化时
- 持续 3000ms，先快速点亮（0→150ms），再缓慢衰减
- 图层 `countries-flash-fill`（fill-opacity 动画）+ `countries-flash-glow`（line-opacity 动画）

### 9.7 Stale Closure 处理

```typescript
const mapStateRef = useRef(mapState)
const langRef = useRef(lang)
mapStateRef.current = mapState  // 每次渲染同步，事件回调中读 .current
```

---

## 十、省份地图（src/components/ProvinceMap.tsx）

### 10.1 触发方式

在 WorldMap 双击国家 → App.tsx 触发 WarpEffect + setMode('country') → ProvinceMap 显示

### 10.2 初始化

```typescript
new maplibregl.Map({
  container, style: { version: 8, ... },
  attributionControl: false,
  minZoom: 1,
  renderWorldCopies: false,  // 防止俄罗斯等大国地图左右重复
})
```

### 10.3 数据源

```
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson
```
- 用 `adm0_a3` 字段匹配国家，`iso_3166_2` 字段标识省份

### 10.4 图层结构

与 WorldMap 一致，过滤条件改为 `['==', ['get', 'adm0_a3'], countryCode]`：

| 图层 ID | 作用 |
|---|---|
| `provinces-unvisited-fill` | 未访问省份底色 |
| `provinces-unvisited-border` | 未访问边框 |
| `provinces-visited-fill` | 已访问暗底 |
| `provinces-visited-dots` | 点阵动画 |
| `provinces-visited-glow2` | 外层光晕 |
| `provinces-visited-glow1` | 流光边框 |
| `provinces-hover` | hover 高亮 |

### 10.5 自动定位

```typescript
map.on('sourcedata', e => {
  if (e.sourceId === 'provinces' && e.isSourceLoaded) {
    // querySourceFeatures 获取该国所有省份，计算 bounds
    map.fitBounds(bounds, { padding: 60, duration: 0, animate: false })
  }
})
```
`animate: false` 让地图瞬间定位，配合外层 opacity 过渡，避免看到滑动过程。

### 10.6 省份 ID 格式

```
{countryCode}_{iso_3166_2}
// 例：'CHN_CN-BJ'（中国北京）
```

### 10.7 自动点亮父国家

每次保存省份时都调用 `onAutoLightCountry()`，App.tsx 内 `handleAutoLightCountry` 检查该国是否已访问，未访问则自动保存（visitDepth 取国家已有深度或默认 `'short'`）。

---

## 十一、穿越动效（src/components/WarpEffect.tsx）

- 全屏 Canvas，`position: fixed`，`zIndex: 300`，`pointerEvents: none`
- 持续 1200ms，`onDone` 回调通过 ref 保存（`useEffect` 依赖 `[]`，不因回调引用变化重启）

**动效内容：**
1. 背景 vignette 渐深（中心透明 → 边缘深色）
2. 4 圈扩散光环（从中心向外扩散，循环）
3. 120 个矩阵光点向外飞散（含拖尾渐变）
4. 末尾白光闪烁（进度 75%~100%）

---

## 十二、星空背景（src/components/StarField.tsx）

- 280 颗星，Canvas 全屏，`pointerEvents: none`
- 每帧慢速漂移（±0.5px），边界回绕
- 呼吸动画（sin 波），光晕 + 核心双层绘制
- WorldMap 和 ProvinceMap 均使用

---

## 十三、国家标记面板（src/components/CountryPanel.tsx）

- 位置：`position: fixed`，右侧 128px，垂直居中（`top:0, bottom:0, margin: auto 0`）
- 宽度：280px，背景 `#0d1f35`，圆角 16px，padding 24px
- 入场：`x: 40 → 0`，spring 弹簧（stiffness:300, damping:30）
- `key={place.id}` 确保切换国家时 state 自动重置

**交互：**
- 深度按钮：本地 state，不立即保存
- 备注：`defaultValue` + `onChange` 受控
- 保存：调用 `onSave({ ...place, visitDepth, note })`
- 移除：仅 `isVisited` 时显示，调用 `onRemove(place.id)`

---

## 十四、顶部统计栏（src/components/StatsBar.tsx）

两种模式，通过 discriminated union props 区分：

### Globe 模式（mode: 'global'）

布局（从左到右）：语言选择器 | 应用名 | 已探索% | 国家数（可展开细分）| 分享按钮

### Country 模式（mode: 'country'）

布局：← 返回按钮（替代语言选择器位置）| 国家名 | 省份数（可展开细分）

**共同样式：**
- `position: absolute`，`top: 20`，水平居中，`zIndex: 50`
- 背景 `rgba(15,23,42,0.85)` + `backdropFilter: blur(12px)`
- 圆角 16px，边框 `#1e3a5f`

**展开动画：** `AnimatePresence` + `width: 0 → auto`，200ms

**语言选择器：** `<select>` 透明覆盖在自定义 UI 上，显示当前语言名称 + 三角箭头

---

## 十五、发光按钮（src/components/GlowButton.tsx）

```typescript
interface Props {
  onClick?: () => void
  children: ReactNode
  fullWidth?: boolean
  style?: CSSProperties
}
// 渲染 <button className="glow-btn" style={{ width: fullWidth ? '100%' : undefined, ...style }}>
```

所有视觉样式在 `index.css` 的 `.glow-btn` 类中定义（hover/active 状态通过 CSS 实现）。

---

## 十六、分享卡片（src/components/ShareCard.tsx）

- 全屏遮罩 `rgba(0,0,0,0.7)` + `backdropFilter: blur(4px)`
- 卡片 360px，渐变背景 `135deg, #0f172a → #1e293b → #0f2744`
- 使用 `html2canvas` 截图，scale: 2
- 下载文件名：`${t.shareTitle}.png`

**内容：** 标题 → 数字+单位 → 已探索% 副标题 → 进度条（动画）→ 按深度分类的国家列表（名称超40字截断）→ 底部署名

---

## 十七、Toast 通知（src/components/Toast.tsx）

- 底部居中，`bottom: 32`
- 青色风格：背景 `rgba(0,229,255,0.12)`，边框 `rgba(0,229,255,0.35)`
- 2500ms 后自动消失，调用 `onDone()`
- 触发：保存国家后，消息格式 `${place.name} ${t.lit}`

---

## 十八、国际化（src/i18n/）

### 支持语言

| 代码 | 显示名 |
|---|---|
| zh | 中文 |
| en | English |
| ja | 日本語 |
| ko | 한국어 |
| es | Español |
| fr | Français |

### 语言检测（LangContext.tsx）

优先级：localStorage → 浏览器语言 → 英文
localStorage key：`'travel-map-lang'`

### UI 字符串键（ui.ts）

```
appName, countries, explored, passed, short, long, share, hint,
visited, unvisited, depthLabel, note, notePlaceholder, remove, save,
update, lit, shortStay, longStay, shareTitle, shareSubtitle(fn),
shareCountries(fn), countriesUnit, shareFooter, download, close,
longStayLabel, shortStayLabel, passedLabel, provinces
```

### 国家名数据库（countries.ts）

- 195 个国家，ISO3 为 key，6 种语言名称
- `getCountryName(iso3, lang, fallback?)` 查找函数

---

## 十九、视觉设计规范

### 配色

| 用途 | 颜色值 |
|---|---|
| 页面背景 | `#0f172a` |
| 地球/省份地图背景 | `#060d1a` |
| 未访问国家/省份 | `#0d2540` |
| 未访问边框 | `#1e4060` |
| 已访问暗底 | `#041520` |
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

| 场景 | 参数 |
|---|---|
| 面板入场 | spring stiffness:300 damping:30，x: 40→0 |
| 统计栏入场 | y: -20→0，opacity: 0→1 |
| 展开细分数据 | width: 0→auto，200ms |
| 进度条 | width: 0→pct%，1000ms，delay 300ms |
| 穿越动效 | Canvas，1200ms |
| 省份视图切入 | opacity 过渡 300ms |

---

## 二十、关键实现细节

1. **WorldMap/ProvinceMap 始终挂载**：用 `opacity`+`pointerEvents` 切换，不用条件渲染，防止 MapLibre 实例重建导致事件失效
2. **WarpEffect onDone 用 ref**：`useEffect([], [])` 只运行一次，通过 `onDoneRef.current()` 调用最新回调，防止 cleanup 中断动画
3. **双击去抖**：click 延迟 250ms 执行，dblclick 时清除 timer，防止双击同时触发单击面板
4. **pattern 动画**：`updateImage` 每帧更新后必须调用 `triggerRepaint()`，否则 MapLibre 不会重绘
5. **pattern 分辨率切换**：zoom 阈值达到时先 `removeImage` 再 `addImage`（不能直接 `updateImage` 改尺寸）
6. **GeoJSON 异步加载**：监听 `sourcedata` + `isSourceLoaded`，加载完后重新 `setFilter` 更新图层
7. **Stale closure**：MapLibre 事件回调通过 `ref.current` 读取最新 React state
8. **renderWorldCopies: false**：ProvinceMap 关闭世界重复渲染，防止俄罗斯等大国地图左右复制
