const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const dbPath = path.join(DATA_DIR, 'barcode_scanner.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('operator','supervisor','admin')),
      department TEXT,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS machines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_no TEXT UNIQUE NOT NULL,
      machine_name TEXT,
      location TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS process_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_code TEXT UNIQUE NOT NULL,
      process_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS machine_processes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_id INTEGER NOT NULL,
      process_type_id INTEGER NOT NULL,
      UNIQUE(machine_id, process_type_id),
      FOREIGN KEY(machine_id) REFERENCES machines(id) ON DELETE CASCADE,
      FOREIGN KEY(process_type_id) REFERENCES process_types(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scan_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      machine_id INTEGER NOT NULL,
      process_type_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(machine_id) REFERENCES machines(id),
      FOREIGN KEY(process_type_id) REFERENCES process_types(id)
    );

    CREATE TABLE IF NOT EXISTS scan_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      batch_barcode TEXT NOT NULL,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER NOT NULL,
      machine_id INTEGER NOT NULL,
      process_type_id INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY(session_id) REFERENCES scan_sessions(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(machine_id) REFERENCES machines(id),
      FOREIGN KEY(process_type_id) REFERENCES process_types(id)
    );

    CREATE INDEX IF NOT EXISTS idx_records_batch ON scan_records(batch_barcode);
    CREATE INDEX IF NOT EXISTS idx_records_scanned_at ON scan_records(scanned_at);
    CREATE INDEX IF NOT EXISTS idx_records_machine ON scan_records(machine_id);
    CREATE INDEX IF NOT EXISTS idx_records_process ON scan_records(process_type_id);
  `);

  // Seed default admin
  const existing = db.prepare('SELECT id FROM users WHERE employee_id = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      `INSERT INTO users (employee_id, full_name, password_hash, role, department, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    ).run('admin', 'System Administrator', hash, 'admin', 'IT');
    console.log('[seed] Default admin user created: admin / admin123');
  }
}

init();

module.exports = db;
