# FlowDesk

桌面自动化工作流引擎 — 用拖拽的方式构建自动化任务。

![demo](docs/demo.gif)  <!-- 替换为你的 GIF 路径 -->

## 功能

- 可视化画布编辑器，拖拽节点、连线即可构建工作流
- 多种触发方式：手动执行、定时任务(Cron)、文件监听、全局热键
- 丰富的节点类型：
  - 操作：剪贴板、数据库、延时、邮件、文件操作、HTTP请求、系统通知、命令执行、数据转换
  - 逻辑：条件判断、循环、重试、异常捕获、变量、子工作流调用
- 工作流管理：创建、重命名、复制、删除、批量操作
- 执行日志：完整的工作流执行历史记录
- 系统托盘：最小化到托盘，快速运行工作流
- 深色主题 UI

## 下载

前往 [Releases](https://github.com/你的用户名/flowdesk/releases) 下载最新版本安装包。

## 技术栈

- Electron + React + TypeScript
- React Flow (画布编辑器)
- Zustand (状态管理)
- better-sqlite3 (本地数据库)

## 开发

npm install
npm run dev

## 构建安装包

npm run package:win

## 许可证

MIT
