# 旅行足迹地图 Travel Map

一个可视化记录你走过的国家和地区的互动地图应用。

## 功能

- 点击地图上的国家/地区，标记为「路过」「短住」「长居」三种深度
- 已标记国家显示动态点阵光效 + 流光边框
- 保存时触发国家区域发光动画（3 秒渐出）
- 顶部统计栏展示已探索比例、国家数，支持展开查看分类数据
- 多语言支持（中文、英文、日文、韩文、西班牙文、法文）
- 分享足迹卡片，可下载为图片
- 数据持久化到 localStorage

## 技术栈

- React 18 + TypeScript
- MapLibre GL JS（Globe 投影）
- Framer Motion
- Vite

## 本地运行

```bash
npm install
npm run dev
```

## 构建部署

```bash
npm run build
# 产物在 dist/ 目录，可部署到 Vercel / Netlify 等静态托管
```

## 地图数据

地图使用 Natural Earth 50m 行政区划数据。
如网络访问不稳定，可将 GeoJSON 下载到 `public/` 目录并修改 `WorldMap.tsx` 中的 source URL 为本地路径：

```
/ne_50m_admin_0_countries.geojson
```

## 特别说明

- 台湾、香港、澳门在地图上与中国大陆合并为同一区域（ISO: CHN）
- 统计总国家数基准为 195 个
