const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { auth } = require('../middleware');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { employee_id, password } = req.body || {};
  if (!employee_id || !password) {
    return res.status(400).json({ error: 'employee_id and password are required' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE employee_id = ? AND is_active = 1')
    .get(employee_id);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

  const token = jwt.sign(
    { uid: user.id, role: user.role, eid: user.employee_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      employee_id: user.employee_id,
      full_name: user.full_name,
      role: user.role,
      department: user.department,
    },
  });
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
