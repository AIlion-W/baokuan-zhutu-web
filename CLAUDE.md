@AGENTS.md

# CLAUDE.md · 爆款主图复刻 Web

## 这是什么

这是一个 Next.js 16 Web 应用，用于电商爆款主图拆解、裂变方案生成和一键生图。用户上传爆款主图后，系统按“场景 × 人群 × 需求”拆解，再支持换场景、换需求、交叉重组和批量生成方案。

## 什么时候调用

- 用户说的是“爆款主图复刻”的 Web 产品、页面、接口、部署或交互。
- 用户要修改上传主图、AI 拆解、裂变方向、裂变张数、一键生图、设置弹窗等功能。
- 用户要维护 Claude Vision / 生图模型在这个工具里的调用链路。

## 什么时候不要调用

- 只是做主图评分或改图建议：优先看 `main-image-advisor`。
- 只是做 CTR 潜力排序模块：优先看 `main-image-ctr-test`。
- 只是沉淀主图方法论：优先写到 `/Users/wangxinlong/Obsidian/Lion的知识库/`。

## 初始化规则

- 这是已有 Next.js 16 项目，不要重新脚手架。
- API Key 由用户在浏览器设置弹窗填写，保存在 `localStorage`。浏览器直连用户配置的中转站，不写入仓库、不落库，也不经过 Vercel API 中转层。
- 裂变方案里的 `image_prompt` 必须保持中文结构化格式，便于用户直接理解和编辑。
- 新功能先更新 `ROADMAP.md` 的当前状态或下一步，再改代码。

## 编辑规则

编辑前先读：

1. `AGENTS.md`，确认 Next.js 16 规则。
2. `README.md`，确认现有使用流程和 API 配置。
3. `ROADMAP.md`，确认当前阶段。
4. 相关源码：`app/`、`lib/`。

不要引入服务端持久化或登录体系，除非用户明确要求。这一版的边界是浏览器运行时配置 + 浏览器直连中转站。

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm run build
```

完成代码改动前至少跑 `npm run lint`；涉及 Next.js 构建、路由或 API route 时再跑 `npm run build`。
