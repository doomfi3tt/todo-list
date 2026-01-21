# Todo List Application

待办事项管理应用，支持任务管理、进度追踪、截止时间、提醒通知等功能。

## 技术栈

- **前端**: HTML + CSS + JavaScript
- **后端**: Node.js + Express
- **数据库**: SQLite (sql.js)
- **通知**: node-notifier (macOS 系统通知)

## 项目结构

```
/Users/ggec/Desktop/Code Project/
├── todo.html          # 前端界面
├── server.js          # Express 后端服务器
├── package.json       # 项目依赖
├── todo.db            # SQLite 数据库文件
├── lib/               # sql.js WebAssembly 文件
│   ├── sql-wasm.js
│   └── sql-wasm.wasm
└── CLAUDE.md          # 本文档
```

## 启动方式

```bash
cd /Users/ggec/Desktop/Code Project
npm start
```

服务器运行在 http://localhost:8080

## 功能特性

1. **任务管理**
   - 添加/删除任务
   - 设置任务标题、描述、时间类型(长期/短期)、甲方、分类
   - 设置截止时间
   - 任务完成后无法取消

2. **进度追踪**
   - 添加进度记录
   - 查看历史进度

3. **提醒功能**
   - 单次提醒
   - 每天提醒
   - 每周提醒
   - 每月提醒
   - macOS 系统通知

4. **筛选与排序**
   - 按时间类型筛选
   - 按甲方筛选
   - 按分类筛选
   - 按添加时间/截止时间排序
   - 模糊搜索（标题、内容、进度记录）

5. **月度统计**
   - 按月份分组统计
   - 显示完成率
   - 过期任务高亮显示

## 数据库结构

### todos 表
- id, title, text, duration, party, category
- completed, created_at, completed_at, deadline
- reminder_time, reminder_type

### progress 表
- id, todo_id, content, time

## Git 仓库

https://github.com/doomfi3tt/todo-list
