const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 使用 sql.js
const initSqlJs = require('sql.js');
// 使用 node-notifier 发送通知
const notifier = require('node-notifier');

const app = express();
const PORT = 8080;
const DB_PATH = path.join(__dirname, 'todo.db');

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// 默认返回 todo.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'todo.html'));
});

let db = null;

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();

  // 尝试加载已有数据库
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      text TEXT,
      duration TEXT DEFAULT '长期',
      party TEXT DEFAULT 'CM',
      category TEXT DEFAULT '采购',
      completed INTEGER DEFAULT 0,
      created_at INTEGER,
      completed_at INTEGER,
      deadline INTEGER,
      reminder_time INTEGER,
      reminder_type TEXT DEFAULT 'none'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER,
      content TEXT,
      time INTEGER,
      FOREIGN KEY (todo_id) REFERENCES todos(id)
    )
  `);
}

// 保存数据库
function saveDatabase() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

// 发送系统通知
function sendNotification(title, message) {
  notifier.notify({
    title: title,
    message: message,
    sound: 'Bottle',
    timeout: 10,
    wait: true
  });
}

// 检查提醒任务
function checkReminders() {
  const now = Date.now();
  const result = db.exec(`
    SELECT id, title, text, reminder_time, reminder_type
    FROM todos
    WHERE completed = 0 AND reminder_time IS NOT NULL AND reminder_type != 'none'
  `);

  if (result.length === 0) return;

  const { columns, values } = result[0];
  const remindedIds = new Set();

  values.forEach(row => {
    const todo = {};
    columns.forEach((col, i) => {
      todo[col] = row[i];
    });

    if (remindedIds.has(todo.id)) return;

    let shouldNotify = false;
    const reminderTime = new Date(todo.reminder_time);
    const nowDate = new Date(now);

    switch (todo.reminder_type) {
      case 'once':
        // 单次提醒：检查是否到了提醒时间且未过太久（1分钟内）
        if (now >= todo.reminder_time && now < todo.reminder_time + 60000) {
          shouldNotify = true;
        }
        break;
      case 'daily':
        // 每天提醒：检查小时和分钟是否匹配
        if (reminderTime.getHours() === nowDate.getHours() &&
            reminderTime.getMinutes() === nowDate.getMinutes()) {
          shouldNotify = true;
        }
        break;
      case 'weekly':
        // 每周提醒：检查星期几、小时和分钟
        if (reminderTime.getDay() === nowDate.getDay() &&
            reminderTime.getHours() === nowDate.getHours() &&
            reminderTime.getMinutes() === nowDate.getMinutes()) {
          shouldNotify = true;
        }
        break;
      case 'monthly':
        // 每月提醒：检查日期、小时和分钟
        if (reminderTime.getDate() === nowDate.getDate() &&
            reminderTime.getHours() === nowDate.getHours() &&
            reminderTime.getMinutes() === nowDate.getMinutes()) {
          shouldNotify = true;
        }
        break;
    }

    if (shouldNotify) {
      const timeStr = `${nowDate.getHours().toString().padStart(2, '0')}:${nowDate.getMinutes().toString().padStart(2, '0')}`;
      sendNotification('待办提醒', `[${timeStr}] ${todo.title}`);
      remindedIds.add(todo.id);
      console.log(`已发送提醒: ${todo.title} (${todo.reminder_type})`);
    }
  });
}

// 每分钟检查一次提醒
setInterval(checkReminders, 60000);

// API 路由

// 获取所有任务
app.get('/api/todos', (req, res) => {
  const result = db.exec(`
    SELECT id, title, text, duration, party, category, completed, created_at, completed_at, deadline, reminder_time, reminder_type
    FROM todos ORDER BY created_at DESC
  `);

  if (result.length === 0) {
    return res.json([]);
  }

  const todos = [];
  const { columns, values } = result[0];

  values.forEach(row => {
    const todo = {};
    columns.forEach((col, i) => {
      todo[col] = row[i];
    });

    // 获取进度记录
    const stmt = db.prepare(`SELECT content, time FROM progress WHERE todo_id = ? ORDER BY time DESC`);
    stmt.bind([todo.id]);
    const progress = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      progress.push(row);
    }
    stmt.free();
    todo.progress = progress;
    todos.push(todo);
  });

  res.json(todos);
});

// 添加任务
app.post('/api/todos', (req, res) => {
  const { title, text, duration, party, category, deadline, reminder_time, reminder_type } = req.body;
  const created_at = Date.now();

  db.run(`
    INSERT INTO todos (title, text, duration, party, category, completed, created_at, completed_at, deadline, reminder_time, reminder_type)
    VALUES (?, ?, ?, ?, ?, 0, ?, NULL, ?, ?, ?)
  `, [title, text || '', duration || '长期', party || 'CM', category || '采购', created_at, deadline || null, reminder_time || null, reminder_type || 'none']);

  const result = db.exec("SELECT COALESCE(MAX(id), 0) as last_id FROM todos");
  const lastId = result[0].values[0][0];

  // 添加初始进度记录
  db.run(`INSERT INTO progress (todo_id, content, time) VALUES (?, '任务已创建', ?)`, [lastId, created_at]);
  saveDatabase();

  res.json({ id: lastId, success: true });
});

// 更新任务
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const { title, text, duration, party, category, deadline, reminder_time, reminder_type } = req.body;

  db.run(`
    UPDATE todos
    SET title = ?, text = ?, duration = ?, party = ?, category = ?, deadline = ?, reminder_time = ?, reminder_type = ?
    WHERE id = ?
  `, [
    title, text || '', duration || '长期', party || 'CM', category || '采购',
    deadline || null, reminder_time || null, reminder_type || 'none', id
  ]);

  saveDatabase();
  res.json({ success: true });
});

// 更新任务完成状态
app.put('/api/todos/:id/completed', (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  const completed_at = completed ? Date.now() : null;

  db.run(`UPDATE todos SET completed = ?, completed_at = ? WHERE id = ?`, [completed ? 1 : 0, completed_at, id]);

  if (completed) {
    db.run(`INSERT INTO progress (todo_id, content, time) VALUES (?, '任务已完成', ?)`, [id, completed_at]);
  }
  saveDatabase();

  res.json({ success: true });
});

// 删除任务
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM progress WHERE todo_id = ?`, [id]);
  db.run(`DELETE FROM todos WHERE id = ?`, [id]);
  saveDatabase();

  res.json({ success: true });
});

// 添加进度
app.post('/api/todos/:id/progress', (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const time = Date.now();

  db.run(`INSERT INTO progress (todo_id, content, time) VALUES (?, ?, ?)`, [id, content, time]);
  saveDatabase();

  res.json({ content, time, success: true });
});

// 启动服务器
initDatabase().then(() => {
  console.log('数据库初始化完成');
  // 启动时立即检查一次提醒
  setTimeout(checkReminders, 2000);
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
