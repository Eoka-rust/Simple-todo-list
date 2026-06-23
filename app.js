const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// База данных
const db = new Database('database.sqlite');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    completed INTEGER DEFAULT 0
  )
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Healthcheck для Railway
app.get('/health', (req, res) => res.status(200).send('OK'));

// API: получить все задачи
app.get('/api/todos', (req, res) => {
  const todos = db.prepare('SELECT * FROM todos ORDER BY id DESC').all();
  res.json(todos);
});

// API: добавить задачу
app.post('/api/todos', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Текст обязателен' });
  }
  const info = db.prepare('INSERT INTO todos (text, completed) VALUES (?, 0)').run(text.trim());
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(todo);
});

// API: обновить задачу (текст и/или статус)
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const { text, completed } = req.body;
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!todo) return res.status(404).json({ error: 'Не найдена' });

  const updates = [];
  const params = [];
  if (text !== undefined) { updates.push('text = ?'); params.push(text.trim()); }
  if (completed !== undefined) { updates.push('completed = ?'); params.push(completed ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: 'Нет полей для обновления' });

  params.push(id);
  db.prepare(`UPDATE todos SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  res.json(updated);
});

// API: удалить задачу
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(id);
  if (!todo) return res.status(404).json({ error: 'Не найдена' });
  db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  res.json({ message: 'Удалено' });
});

// Отдача index.html для всех остальных запросов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});
