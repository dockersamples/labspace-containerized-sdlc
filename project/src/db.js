const { Pool } = require('pg');

// Pool is created lazily so environment variables can be set before the first connection.
let _pool;

function getPool() {
  if (!_pool) {
    _pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'taskflow',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });
  }
  return _pool;
}

async function initDb() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id        SERIAL PRIMARY KEY,
      title     VARCHAR(255) NOT NULL,
      description TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getTasks() {
  const result = await getPool().query(
    'SELECT * FROM tasks ORDER BY created_at DESC'
  );
  return result.rows;
}

async function createTask(title, description) {
  const result = await getPool().query(
    'INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *',
    [title, description]
  );
  return result.rows[0];
}

async function deleteTask(id) {
  const result = await getPool().query(
    'DELETE FROM tasks WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

async function closePool() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

module.exports = { initDb, getTasks, createTask, deleteTask, closePool };
