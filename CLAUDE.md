# Todo List Application

待办事项管理应用，支持任务管理、进度追踪、截止时间、提醒通知等功能。

## 技术栈

- **前端**: HTML + CSS + JavaScript
- **后端**: Node.js + Express
- **数据库**: Vercel KV (Redis) 或内存存储（本地测试）
- **部署**: Vercel

## 项目结构

```
/Users/ggec/Desktop/Code Project/
├── todo.html          # 前端界面
├── server.js          # Express 后端服务器
├── package.json       # 项目依赖
└── CLAUDE.md          # 本文档
```

## 启动方式

```bash
cd /Users/ggec/Desktop/Code Project
npm install
npm start
```

服务器运行在 http://localhost:8080

## Vercel 部署

### 1. 安装 Vercel CLI
```bash
npm i -g vercel
```

### 2. 创建 Vercel KV 数据库
```bash
vercel kv create todo-db
```

### 3. 链接数据库
```bash
vercel link
vercel env pull
```

### 4. 部署
```bash
vercel --prod
```

## 功能特性

1. **任务管理**
   - 添加/删除任务
   - 设置任务标题、描述、时间类型(长期/短期)、甲方、分类
   - 设置截止时间
   - 任务完成后无法取消

2. **进度追踪**
   - 添加进度记录
   - 查看历史进度

3. **筛选与排序**
   - 按时间类型筛选
   - 按甲方筛选
   - 按分类筛选
   - 按添加时间/截止时间排序
   - 模糊搜索（标题、内容、进度记录）

4. **月度统计**
   - 按月份分组统计
   - 显示完成率
   - 过期任务高亮显示

## 数据存储

- **生产环境**: Vercel KV (Redis)，云端同步
- **本地测试**: 内存存储，数据重启丢失

## 环境变量 (Vercel)

- `KV_REST_API_URL`: Redis 连接地址
- `KV_REST_API_TOKEN`: Redis 访问令牌

## Git 仓库

https://github.com/doomfi3tt/todo-list
