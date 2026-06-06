require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const mastersRouter = require('./routes/masters');
const scansRouter = require('./routes/scans');
const reportsRouter = require('./routes/reports');

const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/', (req, res) => res.json({ ok: true, service: 'process-barcode-scan-api' }));
app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/masters', mastersRouter);
app.use('/api/scans', scansRouter);
app.use('/api/reports', reportsRouter);

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
});

const port = parseInt(process.env.PORT || '8001', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`[server] listening on 0.0.0.0:${port}`);
});
