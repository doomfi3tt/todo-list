const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Vercel KV Redis 客户端
let kv;

async function initKV() {
  try {
    const { KvRestApi } = require('@vercel/kv');
    // 使用环境变量 KV_REST_API_URL 和 KV_REST_API_TOKEN
    kv = new KvRestApi({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
    // 测试连接
    await kv.ping();
    console.log('Redis 连接成功');
  } catch (err) {
    console.log('Redis 连接失败，将使用内存存储:', err.message);
    // 回退到内存存储
    kv = null;
  }
}

// 内存存储（回退方案）
let memoryStore = {
  todos: [],
  progress: {}
};

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// 默认返回 todo.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'todo.html'));
});

// API 路由

// 获取所有任务
app.get('/api/todos', async (req, res) => {
  try {
    let todos;
    if (kv) {
      todos = await kv.get('todos') || [];
    } else {
      todos = memoryStore.todos;
    }

    // 获取所有任务的进度
    const todosWithProgress = await Promise.all(todos.map(async (todo) => {
      let progress;
      if (kv) {
        progress = await kv.hgetall(`progress:${todo.id}`) || [];
      } else {
        progress = memoryStore.progress[todo.id] || [];
      }
      // 将进度对象转换为数组
      if (progress && typeof progress === 'object' && !Array.isArray(progress)) {
        progress = Object.values(progress);
      }
      todo.progress = progress || [];
      return todo;
    }));

    // 按创建时间排序
    todosWithProgress.sort((a, b) => b.created_at - a.created_at);
    res.json(todosWithProgress);
  } catch (err) {
    console.error('获取任务失败:', err);
    res.json([]);
  }
});

// 添加任务
app.post('/api/todos', async (req, res) => {
  try {
    const { title, text, duration, party, category, deadline, reminder_time, reminder_type } = req.body;
    const created_at = Date.now();

    let todos;
    if (kv) {
      todos = await kv.get('todos') || [];
    } else {
      todos = memoryStore.todos;
    }

    const newTodo = {
      id: Date.now(),
      title,
      text: text || '',
      duration: duration || '长期',
      party: party || 'CM',
      category: category || '采购',
      completed: 0,
      created_at,
      completed_at: null,
      deadline: deadline || null,
      reminder_time: reminder_time || null,
      reminder_type: reminder_type || 'none'
    };

    todos.push(newTodo);

    if (kv) {
      await kv.set('todos', todos);
    } else {
      memoryStore.todos = todos;
    }

    // 添加初始进度记录
    const progressRecord = {
      content: '任务已创建',
      time: created_at
    };

    if (kv) {
      await kv.hset(`progress:${newTodo.id}`, { [created_at]: progressRecord });
    } else {
      if (!memoryStore.progress[newTodo.id]) {
        memoryStore.progress[newTodo.id] = [];
      }
      memoryStore.progress[newTodo.id].push(progressRecord);
    }

    res.json({ id: newTodo.id, success: true });
  } catch (err) {
    console.error('添加任务失败:', err);
    res.status(500).json({ error: '添加任务失败' });
  }
});

// 更新任务
app.put('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, text, duration, party, category, deadline, reminder_time, reminder_type } = req.body;

    let todos;
    if (kv) {
      todos = await kv.get('todos') || [];
    } else {
      todos = memoryStore.todos;
    }

    const index = todos.findIndex(t => t.id == id);
    if (index !== -1) {
      todos[index] = {
        ...todos[index],
        title: title || todos[index].title,
        text: text !== undefined ? text : todos[index].text,
        duration: duration || todos[index].duration,
        party: party || todos[index].party,
        category: category || todos[index].category,
        deadline: deadline !== undefined ? deadline : todos[index].deadline,
        reminder_time: reminder_time !== undefined ? reminder_time : todos[index].reminder_time,
        reminder_type: reminder_type !== undefined ? reminder_type : todos[index].reminder_type
      };

      if (kv) {
        await kv.set('todos', todos);
      } else {
        memoryStore.todos = todos;
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('更新任务失败:', err);
    res.status(500).json({ error: '更新任务失败' });
  }
});

// 更新任务完成状态
app.put('/api/todos/:id/completed', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed } = req.body;
    const completed_at = completed ? Date.now() : null;

    let todos;
    if (kv) {
      todos = await kv.get('todos') || [];
    } else {
      todos = memoryStore.todos;
    }

    const index = todos.findIndex(t => t.id == id);
    if (index !== -1) {
      todos[index].completed = completed ? 1 : 0;
      todos[index].completed_at = completed_at;

      if (kv) {
        await kv.set('todos', todos);
      } else {
        memoryStore.todos = todos;
      }

      // 添加进度记录
      if (completed) {
        const progressRecord = {
          content: '任务已完成',
          time: completed_at
        };

        if (kv) {
          await kv.hset(`progress:${id}`, { [completed_at]: progressRecord });
        } else {
          if (!memoryStore.progress[id]) {
            memoryStore.progress[id] = [];
          }
          memoryStore.progress[id].push(progressRecord);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('更新完成状态失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除任务
app.delete('/api/todos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let todos;
    if (kv) {
      todos = await kv.get('todos') || [];
    } else {
      todos = memoryStore.todos;
    }

    todos = todos.filter(t => t.id != id);

    if (kv) {
      await kv.set('todos', todos);
      await kv.del(`progress:${id}`);
    } else {
      memoryStore.todos = todos;
      delete memoryStore.progress[id];
    }

    res.json({ success: true });
  } catch (err) {
    console.error('删除任务失败:', err);
    res.status(500).json({ error: '删除任务失败' });
  }
});

// 添加进度
app.post('/api/todos/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const time = Date.now();

    const progressRecord = {
      content,
      time
    };

    if (kv) {
      await kv.hset(`progress:${id}`, { [time]: progressRecord });
    } else {
      if (!memoryStore.progress[id]) {
        memoryStore.progress[id] = [];
      }
      memoryStore.progress[id].push(progressRecord);
    }

    res.json(progressRecord);
  } catch (err) {
    console.error('添加进度失败:', err);
    res.status(500).json({ error: '添加进度失败' });
  }
});

// 启动服务器
initKV().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('存储方式:', kv ? 'Redis (Vercel KV)' : '内存存储 (本地测试)');
  });
}).catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
