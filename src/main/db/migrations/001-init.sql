CREATE TABLE IF NOT EXISTS workflows (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL DEFAULT '未命名工作流',
  description      TEXT NOT NULL DEFAULT '',
  nodes            TEXT NOT NULL DEFAULT '[]',
  edges            TEXT NOT NULL DEFAULT '[]',
  enabled          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  execution_count  INTEGER NOT NULL DEFAULT 0,
  last_executed_at TEXT
);

CREATE TABLE IF NOT EXISTS execution_logs (
  id            TEXT PRIMARY KEY,
  workflow_id   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running',
  trigger_type  TEXT NOT NULL DEFAULT 'manual',
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  node_logs     TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exec_logs_workflow
  ON execution_logs(workflow_id, started_at DESC);
