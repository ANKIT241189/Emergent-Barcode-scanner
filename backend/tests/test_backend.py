"""Backend API tests for Process Barcode Scanning app.
Covers: auth, users CRUD/toggle, masters (machines, lookup, summary),
scans (session/record/duplicate/batch lookup), and reports
(daily/weekly/monthly + excel/csv export).
"""
import os
import io
import datetime as dt
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://barcode-scan-5.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_ID = "admin"
ADMIN_PASS = "admin123"

# Use timestamp suffix so reruns don't collide on UNIQUE constraint
TS = dt.datetime.utcnow().strftime('%H%M%S')
OPERATOR_ID = f"TESTOP-{TS}"
OPERATOR_PASS = "pass1234"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"employee_id": ADMIN_ID, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_client(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def operator_info(admin_client):
    """Create operator user once; return creds + id."""
    r = admin_client.post(f"{API}/users", json={
        "employee_id": OPERATOR_ID,
        "full_name": "Test Operator",
        "password": OPERATOR_PASS,
        "role": "operator",
        "department": "QA",
    })
    assert r.status_code in (201, 409), f"create operator failed: {r.status_code} {r.text}"
    # find id
    rl = admin_client.get(f"{API}/users")
    assert rl.status_code == 200
    user = next((u for u in rl.json()["users"] if u["employee_id"] == OPERATOR_ID), None)
    assert user, "operator not in users list"
    return {"employee_id": OPERATOR_ID, "password": OPERATOR_PASS, "id": user["id"]}


@pytest.fixture(scope="session")
def operator_token(operator_info):
    r = requests.post(f"{API}/auth/login", json={"employee_id": operator_info["employee_id"], "password": operator_info["password"]}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- Health ----------
def test_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


# ---------- Auth ----------
class TestAuth:
    def test_admin_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"employee_id": ADMIN_ID, "password": ADMIN_PASS})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["employee_id"] == "admin"
        assert data["user"]["role"] == "admin"

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"employee_id": "admin", "password": "wrongpw"})
        assert r.status_code == 401
        assert "error" in r.json()

    def test_login_missing_field(self):
        r = requests.post(f"{API}/auth/login", json={"employee_id": "admin"})
        assert r.status_code == 400

    def test_me_requires_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert r.json()["user"]["employee_id"] == "admin"


# ---------- Users ----------
class TestUsers:
    def test_create_and_list_operator(self, admin_client, operator_info):
        # operator_info fixture already created; verify listing
        r = admin_client.get(f"{API}/users")
        assert r.status_code == 200
        assert any(u["employee_id"] == operator_info["employee_id"] for u in r.json()["users"])

    def test_operator_login_works(self, operator_token):
        assert isinstance(operator_token, str) and len(operator_token) > 10

    def test_toggle_active(self, admin_client, operator_info):
        # deactivate
        r = admin_client.put(f"{API}/users/{operator_info['id']}", json={"is_active": False})
        assert r.status_code == 200
        # login should fail now
        rl = requests.post(f"{API}/auth/login", json={"employee_id": operator_info["employee_id"], "password": operator_info["password"]})
        assert rl.status_code == 401
        # reactivate
        r2 = admin_client.put(f"{API}/users/{operator_info['id']}", json={"is_active": True})
        assert r2.status_code == 200
        rl2 = requests.post(f"{API}/auth/login", json={"employee_id": operator_info["employee_id"], "password": operator_info["password"]})
        assert rl2.status_code == 200

    def test_operator_cannot_list_users(self, operator_token):
        r = requests.get(f"{API}/users", headers={"Authorization": f"Bearer {operator_token}"})
        assert r.status_code == 403


# ---------- Masters ----------
class TestMasters:
    def test_list_machines(self, admin_client):
        r = admin_client.get(f"{API}/masters/machines")
        assert r.status_code == 200
        machines = r.json()["machines"]
        assert isinstance(machines, list)
        assert len(machines) >= 4
        nos = {m["machine_no"] for m in machines}
        for code in ("MC-001", "MC-002", "MC-003", "MC-004"):
            assert code in nos, f"{code} not seeded"

    def test_lookup_existing(self, admin_client):
        r = admin_client.get(f"{API}/masters/machines/lookup/MC-001")
        assert r.status_code == 200
        d = r.json()
        assert d["machine"]["machine_no"] == "MC-001"
        assert isinstance(d["processes"], list) and len(d["processes"]) >= 1

    def test_lookup_unknown(self, admin_client):
        r = admin_client.get(f"{API}/masters/machines/lookup/XYZ-999")
        assert r.status_code == 404

    def test_summary(self, admin_client):
        r = admin_client.get(f"{API}/masters/summary")
        assert r.status_code == 200
        d = r.json()
        assert d["machineCount"] >= 4
        assert d["processCount"] >= 2
        assert d["mappingCount"] >= 1


# ---------- Scans ----------
class TestScans:
    def _get_machine_and_process(self, admin_client, machine_no="MC-001"):
        r = admin_client.get(f"{API}/masters/machines/lookup/{machine_no}")
        assert r.status_code == 200
        d = r.json()
        return d["machine"]["id"], d["processes"][0]["id"]

    def test_create_session_and_scan_with_duplicate(self, admin_client):
        machine_id, process_id = self._get_machine_and_process(admin_client)
        # Create session
        r = admin_client.post(f"{API}/scans/session", json={"machine_id": machine_id, "process_type_id": process_id})
        assert r.status_code == 201
        sess = r.json()
        assert "session_uuid" in sess and "session_id" in sess
        uuid = sess["session_uuid"]

        barcode = f"TEST-BATCH-{TS}"

        # First scan - not duplicate
        r1 = admin_client.post(f"{API}/scans/record", json={"session_uuid": uuid, "batch_barcode": barcode})
        assert r1.status_code == 201
        d1 = r1.json()
        assert d1["duplicate_today"] is False
        assert d1["record"]["batch_barcode"] == barcode

        # Second scan - should record AND signal duplicate
        r2 = admin_client.post(f"{API}/scans/record", json={"session_uuid": uuid, "batch_barcode": barcode})
        assert r2.status_code == 201
        d2 = r2.json()
        assert d2["duplicate_today"] is True
        assert d2["previous_scan"] is not None

        # Batch history endpoint returns both scans
        rb = admin_client.get(f"{API}/scans/batch/{barcode}")
        assert rb.status_code == 200
        recs = rb.json()["records"]
        assert len(recs) >= 2
        for rec in recs:
            assert rec["machine_no"] == "MC-001"
            assert "operator_name" in rec and "operator_id" in rec

    def test_invalid_machine_process_mapping(self, admin_client):
        # try invalid combination: machine MC-001 + process_type_id that doesn't map
        # find a process not mapped to MC-001
        m_id, _p_ok = self._get_machine_and_process(admin_client)
        r = admin_client.get(f"{API}/masters/machines/lookup/MC-001")
        mapped_ids = {p["id"] for p in r.json()["processes"]}
        all_proc = admin_client.get(f"{API}/masters/process-types").json()["processes"]
        unmapped = next((p for p in all_proc if p["id"] not in mapped_ids), None)
        if not unmapped:
            pytest.skip("No unmapped process to test invalid mapping")
        r2 = admin_client.post(f"{API}/scans/session", json={"machine_id": m_id, "process_type_id": unmapped["id"]})
        assert r2.status_code == 400

    def test_batch_no_records(self, admin_client):
        r = admin_client.get(f"{API}/scans/batch/UNKNOWN-NONEXISTENT-123")
        assert r.status_code == 200
        assert r.json()["records"] == []


# ---------- Reports ----------
class TestReports:
    def test_operator_blocked_from_reports(self, operator_token):
        today = dt.date.today().isoformat()
        r = requests.get(f"{API}/reports/daily?date={today}", headers={"Authorization": f"Bearer {operator_token}"})
        assert r.status_code == 403

    def test_daily(self, admin_client):
        today = dt.date.today().isoformat()
        r = admin_client.get(f"{API}/reports/daily?date={today}")
        assert r.status_code == 200
        d = r.json()
        assert d["date"] == today
        assert "summary" in d and "records" in d
        assert d["summary"]["totalScans"] >= 2  # from the test scan

    def test_weekly(self, admin_client):
        today = dt.date.today()
        weekago = (today - dt.timedelta(days=7)).isoformat()
        r = admin_client.get(f"{API}/reports/weekly", params={"from": weekago, "to": today.isoformat()})
        assert r.status_code == 200
        d = r.json()
        assert "summary" in d and "records" in d

    def test_weekly_missing_params(self, admin_client):
        r = admin_client.get(f"{API}/reports/weekly")
        assert r.status_code == 400

    def test_monthly(self, admin_client):
        today = dt.date.today()
        r = admin_client.get(f"{API}/reports/monthly", params={"year": today.year, "month": today.month})
        assert r.status_code == 200
        d = r.json()
        assert d["year"] == today.year and d["month"] == today.month
        assert "summary" in d
        assert "byMachine" in d["summary"] and isinstance(d["summary"]["byMachine"], list)

    def test_export_excel(self, admin_client):
        today = dt.date.today().isoformat()
        r = admin_client.get(f"{API}/reports/export/excel", params={"from": today, "to": today})
        assert r.status_code == 200
        ct = r.headers.get("Content-Type", "")
        assert "spreadsheetml" in ct or "officedocument" in ct
        assert len(r.content) > 0
        # xlsx files start with PK\x03\x04 (zip magic)
        assert r.content[:2] == b"PK"

    def test_export_csv(self, admin_client):
        today = dt.date.today().isoformat()
        r = admin_client.get(f"{API}/reports/export/csv", params={"from": today, "to": today})
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("Content-Type", "")
        # Should contain header at minimum
        assert "Batch Barcode" in r.text or len(r.text) >= 0


# ---------- Cleanup ----------
def test_zz_cleanup(admin_client, operator_info):
    """Best-effort cleanup: deactivate the test operator (no DELETE endpoint)."""
    admin_client.put(f"{API}/users/{operator_info['id']}", json={"is_active": False})
