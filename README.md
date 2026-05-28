# 爆款主图复刻 · Web

电商爆款主图拆解 + 裂变 + 一键生图工具。

## 使用流程

1. 上传一张爆款主图
2. AI 按「场景 × 人群 × 需求」三要素拆解
3. 选择裂变方向（换场景 / 换需求 / 交叉重组）
4. 选择裂变张数（1-8）
5. 生成方案 → 一键生图

## API 配置

打开网站右上角「⚙️ 设置」填写：

- **Base URL** — 中转站根地址（默认 `https://yunwu.ai`，不带 `/v1`）
- **API Key** — 中转站 key，去 https://yunwu.ai/console/token 创建
- **Claude 模型** — 默认 `claude-opus-4-7`（拆解 + 裂变）
- **生图模型** — 默认 `gpt-5.5`

API Key 只保存在浏览器 `localStorage`，每次请求由浏览器 header 传给后端，后端转发到中转站，不落库。

## 本地开发

```bash
npm install
npm run dev
```

## 部署

```bash
vercel --prod
```

无需配置任何环境变量 —— 所有 API key 在前端运行时输入。

## 技术栈

- Next.js 16 (App Router, Turbopack)
- Tailwind v4
- Claude Opus 4.7 (Vision) — 拆解 + 裂变
- gpt-5.5 — 生图
