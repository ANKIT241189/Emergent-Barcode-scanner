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

// Strip trailing "NO.1 / NO 1 / 01 / M/C 1" style suffix to derive a machine "type"
function machineType(name) {
  if (!name) return '';
  let s = String(name).trim().toUpperCase();
  // Remove trailing optional "NO." or "#" + spaces + digits
  s = s.replace(/\s+(NO\.?|#)?\s*\.?\s*\d+\s*$/g, '');
  return s.trim();
}

// Find machine column / details column / process-code column / process-desc column
function detectColumns(headers) {
  const lower = headers.map((h) => h.toLowerCase());
  const find = (re) => {
    const i = lower.findIndex((h) => re.test(h));
    return i >= 0 ? headers[i] : null;
  };
  // 4-column layout (M/C code, M/C details, Proc code, Proc desc)
  const machineNoCol =
    find(/m\/?c.*(no|number|code)/) || find(/machine.*(no|number|code)/) || find(/^mc/);
  const machineNameCol =
    find(/process.*m\/?c.*detail/) ||
    find(/m\/?c.*(detail|desc|name)/) ||
    find(/machine.*(name|detail|desc)/);
  const procCodeCol = find(/proc.*(cd|code)/) || find(/^pcode/);
  const procNameCol = find(/proc.*(desc|name|type)/);

  if (machineNoCol && procCodeCol && procNameCol) {
    return { mode: 'full4', machineNoCol, machineNameCol, procCodeCol, procNameCol };
  }
  // 2-column fallback (Machine, Process)
  const machineCol = find(/machine/);
  const processCol = find(/process/);
  if (machineCol && processCol) return { mode: 'simple2', machineCol, processCol };
  return null;
}

router.post('/import', requireRole('admin'), upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name must be "file")' });

  // XLSX.read handles both Excel and CSV when given a buffer
  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (e) {
    return res.status(400).json({ error: 'Invalid file: could not parse as Excel or CSV' });
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) return res.status(400).json({ error: 'File is empty' });

  const cols = detectColumns(Object.keys(rows[0]));
  if (!cols) {
    return res
      .status(400)
      .json({ error: 'Could not detect required columns. Expected either (Machine,Process) or (M/C Code, M/C Details, Proc Code, Proc Desc).' });
  }

  // Step 1: Parse rows into machines map.
  //   machineNo -> { name, processes: Map<process_code, process_name> }
  // Continuation rows (empty machine_no) attach to previously seen machine in the file.
  const machinesMap = new Map(); // preserves insertion order
  let lastMachineNo = null;

  for (const row of rows) {
    let machineNo, machineName, procCode, procName;
    if (cols.mode === 'full4') {
      machineNo = String(row[cols.machineNoCol] || '').trim();
      machineName = String(row[cols.machineNameCol] || '').trim();
      procCode = String(row[cols.procCodeCol] || '').trim();
      procName = String(row[cols.procNameCol] || '').trim();
    } else {
      machineNo = String(row[cols.machineCol] || '').trim();
      machineName = machineNo;
      procName = String(row[cols.processCol] || '').trim();
      procCode = procName ? procName.toUpperCase().replace(/\s+/g, '_') : '';
    }

    // Continuation row: empty machine no → reuse the previous machine
    const effectiveMachineNo = machineNo || lastMachineNo;
    if (!effectiveMachineNo) continue;

    if (!machinesMap.has(effectiveMachineNo)) {
      machinesMap.set(effectiveMachineNo, {
        machine_no: effectiveMachineNo,
        machine_name: machineName || effectiveMachineNo,
        processes: new Map(), // process_code -> process_name
      });
    } else if (machineNo && machineName) {
      // Update name on first proper row
      const existing = machinesMap.get(effectiveMachineNo);
      if (!existing.machine_name || existing.machine_name === existing.machine_no) {
        existing.machine_name = machineName;
      }
    }

    if (procCode && procName) {
      machinesMap.get(effectiveMachineNo).processes.set(procCode, procName);
    }
    if (machineNo) lastMachineNo = machineNo;
  }

  // Step 2: Compute inheritance groups by machine "type"
  // type -> Map<process_code, process_name>
  const typeProcesses = new Map();
  for (const m of machinesMap.values()) {
    const t = machineType(m.machine_name);
    if (!t) continue;
    if (!typeProcesses.has(t)) typeProcesses.set(t, new Map());
    const bucket = typeProcesses.get(t);
    for (const [code, name] of m.processes) bucket.set(code, name);
  }

  // Step 3: For machines with no processes, inherit from siblings of same type
  let inheritedCount = 0;
  for (const m of machinesMap.values()) {
    if (m.processes.size > 0) continue;
    const t = machineType(m.machine_name);
    const bucket = typeProcesses.get(t);
    if (bucket && bucket.size) {
      for (const [code, name] of bucket) m.processes.set(code, name);
      inheritedCount++;
    }
  }

  // Step 4: Bulk insert
  const insertMachine = db.prepare(
    'INSERT OR IGNORE INTO machines (machine_no, machine_name, is_active) VALUES (?, ?, 1)'
  );
  const updateMachineName = db.prepare(
    'UPDATE machines SET machine_name = ? WHERE machine_no = ? AND (machine_name IS NULL OR machine_name = machine_no)'
  );
  const insertProcess = db.prepare(
    'INSERT OR IGNORE INTO process_types (process_code, process_name, is_active) VALUES (?, ?, 1)'
  );
  const getMachineId = db.prepare('SELECT id FROM machines WHERE machine_no = ?');
  const getProcessId = db.prepare('SELECT id FROM process_types WHERE process_code = ?');
  const insertMapping = db.prepare(
    'INSERT OR IGNORE INTO machine_processes (machine_id, process_type_id) VALUES (?, ?)'
  );

  let machinesAdded = 0;
  let processesAdded = 0;
  let mappingsAdded = 0;
  const machinesWithoutProcesses = [];

  const txn = db.transaction(() => {
    for (const m of machinesMap.values()) {
      const info = insertMachine.run(m.machine_no, m.machine_name || m.machine_no);
      if (info.changes) machinesAdded++;
      else updateMachineName.run(m.machine_name, m.machine_no);

      if (m.processes.size === 0) {
        machinesWithoutProcesses.push(`${m.machine_no} (${m.machine_name})`);
        continue;
      }
      for (const [procCode, procName] of m.processes) {
        const pInfo = insertProcess.run(procCode, procName);
        if (pInfo.changes) processesAdded++;
        const mid = getMachineId.get(m.machine_no);
        const pid = getProcessId.get(procCode);
        if (mid && pid) {
          const mapInfo = insertMapping.run(mid.id, pid.id);
          if (mapInfo.changes) mappingsAdded++;
        }
      }
    }
  });
  txn();

  res.json({
    success: true,
    totalRows: rows.length,
    machines: machinesMap.size,
    machinesAdded,
    processesAdded,
    mappingsAdded,
    inheritedMachines: inheritedCount,
    machinesWithoutProcesses,
    // Legacy fields for older clients
    processed: mappingsAdded,
    skipped: machinesWithoutProcesses.length,
  });
});

// Admin: wipe all master data (machines, processes, mappings).
// Scan history (scan_records, scan_sessions) is preserved by default.
router.post('/reset', requireRole('admin'), (req, res) => {
  const wipeHistory = req.query.wipe_history === '1';
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM machine_processes');
    if (wipeHistory) {
      db.exec('DELETE FROM scan_records');
      db.exec('DELETE FROM scan_sessions');
    }
    db.exec('DELETE FROM machines');
    db.exec('DELETE FROM process_types');
    db.exec('COMMIT');
    res.json({ success: true, wipedHistory: wipeHistory });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
