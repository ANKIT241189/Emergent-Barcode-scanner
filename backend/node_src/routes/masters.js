const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { auth, requireRole } = require('../middleware');

const router = express.Router();
router.use(auth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/machines', (req, res) => {
  const machines = db
    .prepare('SELECT * FROM machines WHERE is_active = 1 ORDER BY machine_no')
    .all();
  res.json({ machines });
});

router.get('/machines/lookup/:barcode', (req, res) => {
  const machine = db
    .prepare('SELECT * FROM machines WHERE machine_no = ? AND is_active = 1')
    .get(req.params.barcode);
  if (!machine) return res.status(404).json({ error: 'Machine not found' });
  const processes = db
    .prepare(
      `SELECT pt.* FROM process_types pt
       JOIN machine_processes mp ON mp.process_type_id = pt.id
       WHERE mp.machine_id = ? AND pt.is_active = 1
       ORDER BY pt.process_name`
    )
    .all(machine.id);
  res.json({ machine, processes });
});

router.get('/process-types', (req, res) => {
  const processes = db
    .prepare('SELECT * FROM process_types WHERE is_active = 1 ORDER BY process_name')
    .all();
  res.json({ processes });
});

router.get('/summary', (req, res) => {
  const machineCount = db.prepare('SELECT COUNT(*) c FROM machines WHERE is_active = 1').get().c;
  const processCount = db
    .prepare('SELECT COUNT(*) c FROM process_types WHERE is_active = 1')
    .get().c;
  const mappingCount = db.prepare('SELECT COUNT(*) c FROM machine_processes').get().c;
  res.json({ machineCount, processCount, mappingCount });
});

router.get('/machines/:id/processes', (req, res) => {
  const processes = db
    .prepare(
      `SELECT pt.* FROM process_types pt
       JOIN machine_processes mp ON mp.process_type_id = pt.id
       WHERE mp.machine_id = ? ORDER BY pt.process_name`
    )
    .all(req.params.id);
  res.json({ processes });
});

router.post('/import', requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'Invalid Excel file' });
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) return res.status(400).json({ error: 'Sheet is empty' });

  // Detect column names case-insensitively
  const headers = Object.keys(rows[0]);
  const machineCol = headers.find((h) => /machine/i.test(h));
  const processCol = headers.find((h) => /process/i.test(h));
  if (!machineCol || !processCol) {
    return res
      .status(400)
      .json({ error: 'Could not detect machine and process columns in the sheet' });
  }

  const insertMachine = db.prepare(
    'INSERT OR IGNORE INTO machines (machine_no, machine_name, is_active) VALUES (?, ?, 1)'
  );
  const insertProcess = db.prepare(
    'INSERT OR IGNORE INTO process_types (process_code, process_name, is_active) VALUES (?, ?, 1)'
  );
  const getMachineId = db.prepare('SELECT id FROM machines WHERE machine_no = ?');
  const getProcessId = db.prepare('SELECT id FROM process_types WHERE process_code = ?');
  const insertMapping = db.prepare(
    'INSERT OR IGNORE INTO machine_processes (machine_id, process_type_id) VALUES (?, ?)'
  );

  let processed = 0;
  let skipped = 0;

  const txn = db.transaction((rows) => {
    for (const row of rows) {
      const machineNo = String(row[machineCol] || '').trim();
      const processName = String(row[processCol] || '').trim();
      if (!machineNo || !processName) {
        skipped++;
        continue;
      }
      insertMachine.run(machineNo, machineNo);
      const processCode = processName.toUpperCase().replace(/\s+/g, '_');
      insertProcess.run(processCode, processName);
      const m = getMachineId.get(machineNo);
      const p = getProcessId.get(processCode);
      if (m && p) {
        insertMapping.run(m.id, p.id);
        processed++;
      } else {
        skipped++;
      }
    }
  });
  txn(rows);

  res.json({ success: true, processed, skipped, total: rows.length });
});

module.exports = router;
