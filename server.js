import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { Client } from "pg";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// DB Client factory
function getClient() {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // Neon requires this
  });
}

// Sample schema to create table in SQL Editor if not done:
const tableSchema = `
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  priority TEXT DEFAULT 'low'
);`;

// Initialize table if needed
async function initDB() {
  const client = getClient();
  await client.connect();
  await client.query(tableSchema);
  await client.end();
}
initDB();

// ===== ROUTES =====

// (1) GET all tasks (with optional search, pagination)
app.get("/tasks", async (req, res) => {
  const { q = "", limit = 20, offset = 0 } = req.query;
  const client = getClient();
  try {
    await client.connect();
    const result = await client.query(
      `SELECT * FROM tasks WHERE title ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [`%${q}%`, limit, offset]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("GET /tasks error:", error);
    res.status(500).json({ error: "Database error" });
  } finally {
    await client.end();
  }
});

// (2) GET a single task
app.get("/tasks/:id", async (req, res) => {
  const client = getClient();
  try {
    await client.connect();
    const result = await client.query(`SELECT * FROM tasks WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  } finally {
    await client.end();
  }
});

// (3) POST a new task
app.post("/tasks", async (req, res) => {
  const { title, description, status = "pending", priority = "low" } = req.body;
  const client = getClient();
  try {
    await client.connect();
    const result = await client.query(
      `INSERT INTO tasks (title, description, status, priority) VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description, status, priority]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("POST /tasks error:", error);
    res.status(500).json({ error: "Database error" });
  } finally {
    await client.end();
  }
});

// (4) PUT to update a task
app.put("/tasks/:id", async (req, res) => {
  const { title, description, status, priority } = req.body;
  const client = getClient();
  try {
    await client.connect();
    const result = await client.query(
      `UPDATE tasks SET title = $1, description = $2, status = $3, priority = $4 WHERE id = $5 RETURNING *`,
      [title, description, status, priority, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  } finally {
    await client.end();
  }
});

// (5) DELETE a task
app.delete("/tasks/:id", async (req, res) => {
  const client = getClient();
  try {
    await client.connect();
    const result = await client.query(`DELETE FROM tasks WHERE id = $1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Task not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  } finally {
    await client.end();
  }
});

// ===== START SERVER =====
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
