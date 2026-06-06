const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { auth } = require('../middleware');

const router = express.Router();
router.use(auth);

router.post('/session', (req, res) => {
  const { machine_id, process_type_id } = req.body || {};
  if (!machine_id || !process_type_id) {
    return res.status(400).json({ error: 'machine_id and process_type_id are required' });
  }
  const machine = db.prepare('SELECT * FROM machines WHERE id = ?').get(machine_id);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  const process = db.prepare('SELECT * FROM process_types WHERE id = ?').get(process_type_id);
  if (!process) return res.status(404).json({ error: 'Process type not found' });
  const mapping = db
    .prepare('SELECT 1 FROM machine_processes WHERE machine_id = ? AND process_type_id = ?')
    .get(machine_id, process_type_id);
  if (!mapping)
    return res.status(400).json({ error: 'This process is not configured for the selected machine' });

  const session_uuid = uuidv4();
  const info = db
    .prepare(
      `INSERT INTO scan_sessions (session_uuid, user_id, machine_id, process_type_id)
       VALUES (?, ?, ?, ?)`
    )
    .run(session_uuid, req.user.id, machine_id, process_type_id);

  res.status(201).json({ session_id: info.lastInsertRowid, session_uuid, machine, process });
});

router.post('/record', (req, res) => {
  const { session_uuid, batch_barcode, notes } = req.body || {};
  if (!session_uuid || !batch_barcode) {
    return res.status(400).json({ error: 'session_uuid and batch_barcode are required' });
  }
  const session = db
    .prepare('SELECT * FROM scan_sessions WHERE session_uuid = ?')
    .get(session_uuid);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const previous = db
    .prepare(
      `SELECT id, scanned_at FROM scan_records
       WHERE batch_barcode = ? AND machine_id = ? AND process_type_id = ?
         AND DATE(scanned_at) = date('now')
       ORDER BY scanned_at DESC LIMIT 1`
    )
    .get(batch_barcode.trim(), session.machine_id, session.process_type_id);

  const info = db
    .prepare(
      `INSERT INTO scan_records (session_id, batch_barcode, user_id, machine_id, process_type_id, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      session.id,
      batch_barcode.trim(),
      req.user.id,
      session.machine_id,
      session.process_type_id,
      notes || null
    );

  const record = db
    .prepare(
      `SELECT sr.*, strftime('%Y-%m-%d', sr.scanned_at) as scan_date,
              strftime('%H:%M:%S', sr.scanned_at) as scan_time
       FROM scan_records sr WHERE sr.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json({
    id: record.id,
    record,
    duplicate_today: !!previous,
    previous_scan: previous || null,
  });
});

router.get('/session/:uuid', (req, res) => {
  const session = db
    .prepare(
      `SELECT s.*, m.machine_no, m.machine_name, p.process_code, p.process_name,
              u.full_name AS operator_name, u.employee_id AS operator_id
       FROM scan_sessions s
       JOIN machines m ON m.id = s.machine_id
       JOIN process_types p ON p.id = s.process_type_id
       JOIN users u ON u.id = s.user_id
       WHERE s.session_uuid = ?`
    )
    .get(req.params.uuid);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const records = db
    .prepare(
      `SELECT sr.id, sr.batch_barcode, sr.scanned_at, sr.notes,
              strftime('%H:%M:%S', sr.scanned_at) as scan_time
       FROM scan_records sr WHERE sr.session_id = ? ORDER BY sr.scanned_at DESC`
    )
    .all(session.id);

  res.json({ session, records });
});

router.get('/batch/:barcode', (req, res) => {
  const records = db
    .prepare(
      `SELECT sr.id, sr.batch_barcode, sr.scanned_at,
              strftime('%Y-%m-%d', sr.scanned_at) as scan_date,
              strftime('%H:%M:%S', sr.scanned_at) as scan_time,
              m.machine_no, m.machine_name,
              p.process_code, p.process_name,
              u.employee_id AS operator_id, u.full_name AS operator_name,
              sr.notes
       FROM scan_records sr
       JOIN machines m ON m.id = sr.machine_id
       JOIN process_types p ON p.id = sr.process_type_id
       JOIN users u ON u.id = sr.user_id
       WHERE sr.batch_barcode = ?
       ORDER BY sr.scanned_at ASC`
    )
    .all(req.params.barcode.trim());
  res.json({ batch_barcode: req.params.barcode.trim(), records });
});

router.get('/', (req, res) => {
  const { from, to, machine_id, process_type_id, user_id, batch } = req.query;
  const page = parseInt(req.query.page || '1', 10);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];
  if (from) { where.push("DATE(sr.scanned_at) >= ?"); params.push(from); }
  if (to) { where.push("DATE(sr.scanned_at) <= ?"); params.push(to); }
  if (machine_id) { where.push('sr.machine_id = ?'); params.push(machine_id); }
  if (process_type_id) { where.push('sr.process_type_id = ?'); params.push(process_type_id); }
  if (user_id) { where.push('sr.user_id = ?'); params.push(user_id); }
  if (batch) { where.push('sr.batch_barcode LIKE ?'); params.push(`%${batch}%`); }
  const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const total = db
    .prepare(`SELECT COUNT(*) c FROM scan_records sr ${whereSQL}`)
    .get(...params).c;

  const records = db
    .prepare(
      `SELECT sr.id, sr.batch_barcode, sr.scanned_at,
              strftime('%Y-%m-%d', sr.scanned_at) AS scan_date,
              strftime('%H:%M:%S', sr.scanned_at) AS scan_time,
              m.machine_no, m.machine_name,
              p.process_code, p.process_name,
              u.employee_id AS operator_id, u.full_name AS operator_name,
              sr.notes
       FROM scan_records sr
       JOIN machines m ON m.id = sr.machine_id
       JOIN process_types p ON p.id = sr.process_type_id
       JOIN users u ON u.id = sr.user_id
       ${whereSQL}
       ORDER BY sr.scanned_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.json({ total, page, limit, records });
});

module.exports = router;
