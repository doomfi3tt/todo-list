// SQLite 数据库模块
let db = null;
let SQL = null;
const DB_PATH = 'todo.db';

async function initDatabase() {
  // 加载 sql.js
  if (!window.initSqlJs) {
    const response = await fetch('./lib/sql-wasm.js');
    const sqlJs = await response.text();
    eval(sqlJs);
  }

  SQL = await initSqlJs({
    locateFile: file => `./lib/${file}`
  });

  // 尝试加载已有数据库
  const savedData = localStorage.getItem('sqlite_db');
  if (savedData) {
    const buffer = base64ToArrayBuffer(savedData);
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
      completed_at INTEGER
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

  db.run(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`);

  return db;
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const base64 = arrayBufferToBase64(data);
    localStorage.setItem('sqlite_db', base64);
  }
}

// 获取下一个任务ID
function getNextTodoId() {
  const result = db.exec("SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM todos");
  return result.length > 0 ? result[0].values[0][0] : 1;
}

// 获取所有任务
function getAllTodos() {
  const result = db.exec(`
    SELECT id, title, text, duration, party, category, completed, created_at, completed_at
    FROM todos ORDER BY created_at DESC
  `);

  if (result.length === 0) return [];

  const todos = [];
  const { columns, values } = result[0];

  values.forEach(row => {
    const todo = {};
    columns.forEach((col, i) => {
      todo[col] = row[i];
    });
    // 获取进度记录
    const progressResult = db.exec(`SELECT content, time FROM progress WHERE todo_id = ? ORDER BY time DESC`, [todo.id]);
    todo.progress = [];
    if (progressResult.length > 0) {
      const progCols = progressResult[0].columns;
      todo.progress = progressResult[0].values.map(row => {
        const p = {};
        progCols.forEach((c, i) => p[c] = row[i]);
        return p;
      });
    }
    todos.push(todo);
  });

  return todos;
}

// 添加任务
function addTodo(todo) {
  db.run(`
    INSERT INTO todos (title, text, duration, party, category, completed, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, NULL)
  `, [todo.title, todo.text, todo.tag.duration, todo.tag.party, todo.tag.category, todo.createdAt]);

  const id = getNextTodoId();

  // 添加初始进度记录
  db.run(`INSERT INTO progress (todo_id, content, time) VALUES (?, '任务已创建', ?)`, [id, todo.createdAt]);

  saveDatabase();
  return id;
}

// 更新任务完成状态
function updateTodoCompleted(id, completed) {
  const completedAt = completed ? Date.now() : null;
  db.run(`UPDATE todos SET completed = ?, completed_at = ? WHERE id = ?`, [completed ? 1 : 0, completedAt, id]);

  if (completed) {
    db.run(`INSERT INTO progress (todo_id, content, time) VALUES (?, '任务已完成', ?)`, [id, completedAt]);
  }

  saveDatabase();
}

// 删除任务
function deleteTodo(id) {
  db.run(`DELETE FROM progress WHERE todo_id = ?`, [id]);
  db.run(`DELETE FROM todos WHERE id = ?`, [id]);
  saveDatabase();
}

// 添加进度
function addProgress(todoId, content) {
  const time = Date.now();
  db.run(`INSERT INTO progress (todo_id, content, time) VALUES (?, ?, ?)`, [todoId, content, time]);
  saveDatabase();
  return { content, time };
}

// 更新元数据
function setMeta(key, value) {
  db.run(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`, [key, value]);
  saveDatabase();
}

function getMeta(key) {
  const result = db.exec(`SELECT value FROM meta WHERE key = ?`, [key]);
  return result.length > 0 ? result[0].values[0][0] : null;
}
