# 番茄时钟应用 - 时光机

一款基于 Electron + Vue 3 开发的番茄时钟应用，帮助用户有效管理时间，提高工作效率。

## 功能特性

### 核心功能
- **计时器功能**
  - 支持倒计时和正计时两种模式
  - 自定义任务时长设置
  - 快捷时间按钮（如25分钟标准番茄钟）
  - 任务暂停/继续功能
  - 任务延长功能

- **任务管理**
  - 任务名称设置
  - 任务标签支持（分类管理）
  - 任务备注功能（支持Markdown编辑）
  - 任务历史记录查询

- **数据统计与可视化**
  - 任务历史记录查看与搜索
  - 按时间范围、标签过滤任务
  - 周统计数据展示
  - 每日任务时长分布图表
  - 每小时任务时长趋势图表

### 技术亮点
- 本地数据持久化存储（SQLite）
- 跨平台支持（Windows、macOS、Linux）
- 响应式UI设计
- Markdown编辑器支持
- 数据可视化展示

## 安装与运行

### 开发环境

1. 克隆项目代码
```bash
git clone [项目仓库地址]
cd tomato-clock
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm start
```

这将同时启动 Vite 开发服务器和 Electron 应用。

### 构建发布版本

构建所有平台版本：
```bash
npm run build
```

构建特定平台版本：
```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

构建产物将位于 `dist-electron` 目录。

## 使用指南

### 1. 计时器界面
- **设置任务**：输入任务名称，选择计时模式（倒计时/正计时）
- **设置时长**：倒计时模式下可自定义分钟和秒数，或使用快捷时间按钮
- **控制计时**：点击开始按钮启动计时器，可暂停/继续或停止任务
- **任务标签**：为任务添加标签，方便后续分类统计

### 2. 历史记录界面
- **查看历史**：浏览所有已完成的任务记录
- **搜索过滤**：通过搜索框、时间范围和标签筛选任务
- **任务操作**：查看/编辑任务备注，删除任务记录

### 3. 周统计界面
- **时间选择**：查看本周或其他周的统计数据
- **数据概览**：查看总时长、任务数量、平均时长等关键指标
- **图表分析**：通过图表直观了解每日和每小时的任务分布
- **任务详情**：按日期分组查看任务列表

## 代码结构

### 项目目录结构
```
tomato-clock/
├── assets/             # 静态资源文件
│   ├── tomato.png      # 应用图标
│   └── tomato.svg
├── src/                # 源代码目录
│   ├── components/     # Vue组件
│   │   ├── MarkdownEditor.vue    # Markdown编辑器组件
│   │   ├── MarkdownViewer.vue    # Markdown查看器组件
│   │   └── TaskItem.vue          # 任务项组件
│   ├── router/         # 路由配置
│   │   └── index.js
│   ├── store/          # Vuex状态管理
│   │   └── index.js
│   ├── views/          # 视图组件
│   │   ├── HistoryView.vue       # 历史记录页面
│   │   ├── NotificationView.vue  # 通知页面
│   │   ├── TimerView.vue         # 计时器页面
│   │   └── WeekStatsView.vue     # 周统计页面
│   ├── App.vue         # 根组件
│   ├── main.js         # Vue应用入口
│   └── index.html      # HTML模板
├── db-service.js       # 数据库服务模块
├── main.js             # Electron主进程入口
├── preload.js          # 预加载脚本
├── package.json        # 项目配置文件
└── vite.config.js      # Vite配置文件
```

### 关键模块说明

#### 1. Electron主进程 (main.js)
- 负责创建和管理应用窗口
- 处理应用生命周期
- 提供数据库服务实例
- 实现主进程与渲染进程通信

#### 2. Vue应用入口 (src/main.js)
- 创建Vue应用实例
- 注册路由和状态管理
- 提供任务时间延长等全局功能

#### 3. 数据库服务 (db-service.js)
- 基于SQLite实现本地数据存储
- 提供任务和标签的增删改查功能
- 管理数据库表结构和迁移

#### 4. 状态管理 (src/store/index.js)
- 管理计时器状态
- 存储任务历史数据
- 提供任务操作相关的mutations和actions

#### 5. 视图组件
- **TimerView.vue**: 核心计时器界面，包含任务设置和计时控制
- **HistoryView.vue**: 历史记录页面，支持任务搜索和过滤
- **WeekStatsView.vue**: 统计分析页面，展示图表和周任务数据

## 技术栈

- **前端框架**: Vue 3
- **状态管理**: Vuex 4
- **路由**: Vue Router 4
- **构建工具**: Vite
- **桌面应用框架**: Electron
- **数据库**: SQLite3
- **图表库**: Chart.js
- **Markdown解析**: marked

## 开发说明

### 数据库设计
应用使用SQLite数据库，主要包含两个表：
- **tasks表**: 存储任务记录，包含任务名称、时长、完成时间、备注和标签等信息
- **tags表**: 存储所有使用过的标签信息

### 路由配置
- `/`: 计时器主页面
- `/history`: 历史记录页面
- `/week-stats`: 周统计页面
- `/notification`: 通知页面

### 构建配置
应用支持多平台构建，配置位于package.json的build字段中。

## 许可证

MIT
