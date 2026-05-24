# FlowDesk

Electron 桌面自动化工作流引擎，使用 React Flow 画布编辑器。

## 技术栈

- electron-vite + React + TypeScript
- @xyflow/react (React Flow) 画布
- Zustand 状态管理
- chokidar 文件监听
- better-sqlite3 数据库
- fs-extra 文件操作

## 项目结构

- `src/main/` — Electron 主进程
  - `engine/` — 执行器、调度器、文件监听
  - `nodes/` — 节点处理器（triggers/actions/logic）
  - `ipc/` — IPC 通信处理
  - `db/` — 数据库操作
- `src/renderer/` — React 渲染进程
  - `components/Canvas/` — FlowCanvas、CustomNode
  - `pages/` — HomePage、EditorPage、SettingsPage
  - `stores/` — Zustand stores
  - `lib/node-definitions.ts` — 节点定义
- `src/shared/types.ts` — 共享类型

## 关键约定

- React Flow 节点统一用 `type: 'custom'` 渲染，实际类型存储在 `data.nodeType`
- 节点定义在 `node-definitions.ts`，包含 defaultData
- 执行器通过 nodeRegistry 注册处理器
- 窗口无边框，标题栏用 `-webkit-app-region: drag`
