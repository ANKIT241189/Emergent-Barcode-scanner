const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, requireRole } = require('../middleware');

const router = express.Router();

router.use(auth);

router.get('/', requireRole('admin', 'supervisor'), (req, res) => {
  const users = db
    .prepare(
      `SELECT id, employee_id, full_name, role, department, is_active, last_login, created_at
       FROM users ORDER BY created_at DESC`
    )
    .all();
  res.json({ users });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { employee_id, full_name, password, role, department } = req.body || {};
  if (!employee_id || !full_name || !password || !role) {
    return res.status(400).json({ error: 'employee_id, full_name, password, role are required' });
  }
  if (!['operator', 'supervisor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE employee_id = ?').get(employee_id);
  if (exists) return res.status(409).json({ error: 'employee_id already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (employee_id, full_name, password_hash, role, department, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`
    )
    .run(employee_id, full_name, hash, role, department || null);

  res.status(201).json({ id: info.lastInsertRowid });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const { id } = req.params;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'User not found' });

  const { full_name, role, department, is_active, password } = req.body || {};
  const updates = [];
  const params = [];

  if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name); }
  if (role !== undefined) {
    if (!['operator', 'supervisor', 'admin'].includes(role))
      return res.status(400).json({ error: 'Invalid role' });
    updates.push('role = ?'); params.push(role);
  }
  if (department !== undefined) { updates.push('department = ?'); params.push(department); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (password) { updates.push('password_hash = ?'); params.push(bcrypt.hashSync(password, 10)); }

  if (!updates.length) return res.json({ ok: true });
  params.push(id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

module.exports = router;
