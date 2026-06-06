# Process Barcode Scanning — PRD

## Problem Statement
Build a full-stack Process Barcode Scanning web application for a manufacturing/production environment. Operators scan a machine barcode, pick a process, then scan multiple batch cards. All scans are linked to the operator and timestamped. Supervisors/admins get reports + admin tools.

## Tech Stack (chosen by user)
- **Backend:** Node.js + Express + better-sqlite3 (SQLite file at `/app/data/barcode_scanner.db`)
- **Frontend:** React (CRA + craco) + Tailwind + shadcn/ui + recharts
- **Auth:** JWT (8h expiry, `pb_token` in localStorage)
- **Excel/CSV:** xlsx (import), ExcelJS + json2csv (export)
- **Supervisor:** backend runs `node index.js` on 0.0.0.0:8001; frontend on 3000

## User personas
- **Operator** — scans barcodes on the factory floor; tablet/desktop in HID mode
- **Supervisor** — runs reports, views machine/process mapping
- **Admin** — manages users, imports master data, all supervisor + operator powers

## Implemented (2026-02 / 2026-06)
- [x] Default admin auto-seed (`admin` / `admin123`, bcrypt hashed at startup)
- [x] JWT auth + rate-limited login (20/15min), `/api/auth/login`, `/api/auth/me`
- [x] Users CRUD (POST/PUT, list) with role guard
- [x] Masters: machines list, lookup-by-barcode, process-types, summary, Excel import (case-insensitive column detection, transactional)
- [x] Scans: session create, record (with duplicate-today warning, never blocks), batch journey lookup
- [x] Reports: daily/weekly/monthly with summary breakdowns (by machine/process/operator)
- [x] Reports export to Excel (`.xlsx` via ExcelJS) and CSV (`json2csv`)
- [x] Frontend pages: Login, 3-step Scan workflow, Batch History timeline, Reports w/ charts, Admin → Import Master, Machines, Users
- [x] Role-based navigation (operator hides reports/admin links; supervisor hides import/users)
- [x] Honeywell scanner UX (Enter-to-submit, auto-clear + re-focus on Step 3)
- [x] Verified end-to-end: 25/25 backend tests pass, full Playwright run passes

## Backlog / P1
- [ ] Per-user lockout after repeated login failures (currently IP-level rate limit only)
- [ ] Timezone-aware daily report (currently uses UTC `DATE(scanned_at)`)
- [ ] Re-import update (currently `INSERT OR IGNORE` — additive only)
- [ ] User soft delete endpoint (UI uses is_active toggle today)
- [ ] Add notes field UX on scan (backend supports it; frontend doesn't expose it yet)

## Backlog / P2
- [ ] Print-friendly daily summary view
- [ ] Per-machine throughput targets and alerts
- [ ] Multi-language UI

## Key files
- Backend: `/app/backend/node_src/{index.js, db.js, middleware.js, routes/*.js}`
- Frontend: `/app/frontend/src/{App.js, context/AuthContext.jsx, components/Layout.jsx, pages/*.jsx}`
- DB: `/app/data/barcode_scanner.db`
- Tests: `/app/backend/tests/test_backend.py`
- Credentials: `/app/memory/test_credentials.md`
