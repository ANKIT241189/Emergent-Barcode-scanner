const express = require('express');
const ExcelJS = require('exceljs');
const { Parser } = require('json2csv');
const db = require('../db');
const { auth, requireRole } = require('../middleware');

const router = express.Router();
router.use(auth);
router.use(requireRole('supervisor', 'admin'));

function fetchRecords({ from, to }) {
  return db
    .prepare(
      `SELECT sr.batch_barcode,
              m.machine_no, m.machine_name,
              p.process_name,
              u.employee_id AS operator_id, u.full_name AS operator_name,
              strftime('%Y-%m-%d', sr.scanned_at) AS scan_date,
              strftime('%H:%M:%S', sr.scanned_at) AS scan_time,
              sr.notes
       FROM scan_records sr
       JOIN machines m ON m.id = sr.machine_id
       JOIN process_types p ON p.id = sr.process_type_id
       JOIN users u ON u.id = sr.user_id
       WHERE DATE(sr.scanned_at) BETWEEN ? AND ?
       ORDER BY sr.scanned_at ASC`
    )
    .all(from, to);
}

function summarize(records) {
  const byMachine = {};
  const byProcess = {};
  const byOperator = {};
  const machinesUsed = new Set();
  for (const r of records) {
    machinesUsed.add(r.machine_no);
    byMachine[r.machine_no] = (byMachine[r.machine_no] || 0) + 1;
    byProcess[r.process_name] = (byProcess[r.process_name] || 0) + 1;
    const opKey = `${r.operator_id} - ${r.operator_name}`;
    byOperator[opKey] = (byOperator[opKey] || 0) + 1;
  }
  return {
    totalScans: records.length,
    machinesUsed: machinesUsed.size,
    byMachine: Object.entries(byMachine).map(([k, v]) => ({ label: k, count: v })),
    byProcess: Object.entries(byProcess).map(([k, v]) => ({ label: k, count: v })),
    byOperator: Object.entries(byOperator).map(([k, v]) => ({ label: k, count: v })),
  };
}

router.get('/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  const records = fetchRecords({ from: date, to: date });
  res.json({ date, summary: summarize(records), records });
});

router.get('/weekly', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const records = fetchRecords({ from, to });
  res.json({ from, to, summary: summarize(records), records });
});

router.get('/monthly', (req, res) => {
  const year = parseInt(req.query.year, 10);
  const month = parseInt(req.query.month, 10);
  if (!year || !month) return res.status(400).json({ error: 'year and month required' });
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const records = fetchRecords({ from, to });
  res.json({ year, month, from, to, summary: summarize(records), records });
});

router.get('/export/excel', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const records = fetchRecords({ from, to });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Scan Report');
  ws.columns = [
    { header: 'Batch Barcode', key: 'batch_barcode', width: 22 },
    { header: 'Machine No', key: 'machine_no', width: 18 },
    { header: 'Machine Name', key: 'machine_name', width: 22 },
    { header: 'Process', key: 'process_name', width: 20 },
    { header: 'Operator ID', key: 'operator_id', width: 15 },
    { header: 'Operator Name', key: 'operator_name', width: 22 },
    { header: 'Date', key: 'scan_date', width: 14 },
    { header: 'Time', key: 'scan_time', width: 12 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.addRows(records);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="scan_report_${from}_to_${to}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
});

router.get('/export/csv', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to required' });
  const records = fetchRecords({ from, to });
  const fields = [
    { label: 'Batch Barcode', value: 'batch_barcode' },
    { label: 'Machine No', value: 'machine_no' },
    { label: 'Machine Name', value: 'machine_name' },
    { label: 'Process', value: 'process_name' },
    { label: 'Operator ID', value: 'operator_id' },
    { label: 'Operator Name', value: 'operator_name' },
    { label: 'Date', value: 'scan_date' },
    { label: 'Time', value: 'scan_time' },
    { label: 'Notes', value: 'notes' },
  ];
  const csv = new Parser({ fields }).parse(records);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="scan_report_${from}_to_${to}.csv"`);
  res.send(csv);
});

module.exports = router;
