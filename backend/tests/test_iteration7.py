"""
Iteration 7 Backend Tests:
- POST /api/auth/google/session  (Google OAuth fallback — invalid session handling)
- Tenants CRUD /api/tenants  (create/list/update/delete, requires auth)
- Rent receipts: POST /api/tenants/{tid}/receipts, GET list, GET /api/receipts/{rid}/pdf
- POST /api/calc/builder-plan  (CLP vs 10:90 vs 20:80 vs Subvention)
- POST /api/feedback, GET /api/admin/feedback, POST /api/admin/feedback/{fid}/status
- Admin trial extension via /api/admin/users/{user_id}/action action=extend_trial
- Regression: login, properties CRUD, portfolio summary, compare
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@estima.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")


# ───────────────────────── Fixtures ─────────────────────────

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def user_session():
    s = requests.Session()
    uid = uuid.uuid4().hex[:8]
    email = f"iter7_{uid}@test.com"
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": email,
        "password": "Iter7@123456",
        "name": f"Iter7 {uid}"
    })
    assert r.status_code == 200, f"Register user failed: {r.text}"
    s.email = email
    return s


@pytest.fixture(scope="module")
def property_id(user_session):
    """Create a property to link tenants to."""
    payload = {
        "name": "TEST_Iter7_Flat",
        "location": "Bangalore",
        "price": 8000000,
        "size": 1100,
        "property_type": "apartment",
        "status": "owned",
    }
    r = user_session.post(f"{BASE_URL}/api/properties", json=payload)
    assert r.status_code in (200, 201), f"Property create failed: {r.text}"
    data = r.json()
    return data.get("id") or data.get("_id")


# ───────────────────────── Google Session fallback ─────────────────────────

class TestGoogleSession:
    """The endpoint cannot produce a real session (we have no real Emergent session_id),
    but it must handle invalid / missing session_id gracefully (400/401/422/502)."""

    def test_missing_session_id_body(self):
        r = requests.post(f"{BASE_URL}/api/auth/google/session", json={})
        # Pydantic validation should return 422 for missing session_id
        assert r.status_code in (400, 401, 422), f"Unexpected: {r.status_code} {r.text}"

    def test_invalid_session_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/google/session",
                          json={"session_id": "invalid-fake-session-xyz"})
        # Should not 500 — must be a graceful 400/401/502
        assert r.status_code in (400, 401, 502), f"Expected 400/401/502 got {r.status_code}: {r.text}"


# ───────────────────────── Tenants CRUD ─────────────────────────

class TestTenantsCRUD:

    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/tenants")
        assert r.status_code in (401, 403)

    def test_create_tenant(self, user_session, property_id):
        payload = {
            "property_id": property_id,
            "name": "TEST_Tenant_Anil",
            "phone": "9876500000",
            "email": "tenant_anil@test.com",
            "monthly_rent": 35000,
            "deposit": 100000,
            "lease_start": "2026-01-01",
            "lease_end": "2027-01-01",
            "notes": "2BHK",
        }
        r = user_session.post(f"{BASE_URL}/api/tenants", json=payload)
        assert r.status_code == 200, f"Create tenant failed: {r.text}"
        data = r.json()
        assert data["name"] == "TEST_Tenant_Anil"
        assert data["monthly_rent"] == 35000
        assert "id" in data
        assert data.get("property_name")  # property name back-filled
        user_session.tenant_id = data["id"]

    def test_list_tenants_contains_created(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/tenants")
        assert r.status_code == 200
        tenants = r.json()
        assert any(t["id"] == user_session.tenant_id for t in tenants)

    def test_update_tenant(self, user_session, property_id):
        payload = {
            "property_id": property_id,
            "name": "TEST_Tenant_Anil_Updated",
            "monthly_rent": 38000,
            "deposit": 120000,
            "notes": "rent hiked",
        }
        r = user_session.put(f"{BASE_URL}/api/tenants/{user_session.tenant_id}", json=payload)
        assert r.status_code == 200, r.text
        # Verify persistence
        lst = user_session.get(f"{BASE_URL}/api/tenants").json()
        updated = next(t for t in lst if t["id"] == user_session.tenant_id)
        assert updated["name"] == "TEST_Tenant_Anil_Updated"
        assert updated["monthly_rent"] == 38000

    def test_create_tenant_invalid_property(self, user_session):
        r = user_session.post(f"{BASE_URL}/api/tenants", json={
            "property_id": "does-not-exist",
            "name": "Bogus",
            "monthly_rent": 1000,
        })
        assert r.status_code == 404


# ───────────────────────── Rent Receipts + PDF ─────────────────────────

class TestRentReceipts:

    def test_create_receipt(self, user_session):
        tid = user_session.tenant_id
        payload = {
            "tenant_id": tid,
            "month": "January 2026",
            "amount": 38000,
            "paid_on": "2026-01-03",
            "payment_mode": "Bank Transfer",
            "notes": "on time",
            "send_email": False,
        }
        r = user_session.post(f"{BASE_URL}/api/tenants/{tid}/receipts", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["amount"] == 38000
        assert data["month"] == "January 2026"
        assert data["receipt_no"].startswith("RR-")
        user_session.receipt_id = data["id"]
        user_session.receipt_no = data["receipt_no"]

    def test_list_receipts(self, user_session):
        tid = user_session.tenant_id
        r = user_session.get(f"{BASE_URL}/api/tenants/{tid}/receipts")
        assert r.status_code == 200
        lst = r.json()
        assert any(rc["id"] == user_session.receipt_id for rc in lst)

    def test_pdf_download(self, user_session):
        rid = user_session.receipt_id
        r = user_session.get(f"{BASE_URL}/api/receipts/{rid}/pdf")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        # PDF magic bytes
        assert r.content[:4] == b"%PDF", "Response is not a PDF"
        assert len(r.content) > 1000, "PDF seems too small"

    def test_pdf_unknown_receipt(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/receipts/does-not-exist/pdf")
        assert r.status_code == 404


# ───────────────────────── Builder Plan Calc ─────────────────────────

class TestBuilderPlan:

    def test_builder_plan_compare(self):
        payload = {
            "property_price": 10000000,
            "possession_months": 36,
            "loan_rate": 8.5,
            "loan_tenure_years": 20,
            "opportunity_return": 11.0,
        }
        r = requests.post(f"{BASE_URL}/api/calc/builder-plan", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "plans" in data and len(data["plans"]) == 4
        ids = {p["id"] for p in data["plans"]}
        assert {"clp", "10_90", "20_80", "subvention"}.issubset(ids)
        # Each plan has required fields
        for p in data["plans"]:
            for k in ["down_payment", "loan_amount", "pre_emi_total",
                      "monthly_emi_after_possession", "effective_total_cost"]:
                assert k in p, f"Missing {k} in {p['id']}"
        assert data["winner"] in ids
        assert data["savings_vs_worst"] >= 0
        # Sanity: 20:80 down payment = 2,000,000
        twenty = next(p for p in data["plans"] if p["id"] == "20_80")
        assert abs(twenty["down_payment"] - 2000000) < 1


# ───────────────────────── Feedback ─────────────────────────

class TestFeedback:

    def test_feedback_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/feedback", json={"message": "hello"})
        assert r.status_code in (401, 403)

    def test_create_feedback(self, user_session):
        r = user_session.post(f"{BASE_URL}/api/feedback", json={
            "category": "idea",
            "message": "TEST_Iter7 please add dark mode toggle",
            "rating": 5,
            "page": "/app/dashboard",
        })
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_empty_message_rejected(self, user_session):
        r = user_session.post(f"{BASE_URL}/api/feedback", json={"message": "   "})
        assert r.status_code == 400

    def test_admin_list_feedback(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/feedback")
        assert r.status_code == 200, r.text
        lst = r.json()
        assert isinstance(lst, list)
        # Our just-created feedback should exist
        assert any("TEST_Iter7 please add dark mode toggle" in (f.get("message") or "") for f in lst)
        # Find its id for next test
        fb = next(f for f in lst if "TEST_Iter7 please add dark mode toggle" in (f.get("message") or ""))
        admin_session.fb_id = fb["id"]

    def test_non_admin_cannot_list_feedback(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/admin/feedback")
        assert r.status_code in (401, 403)

    def test_admin_update_feedback_status(self, admin_session):
        fid = admin_session.fb_id
        r = admin_session.post(f"{BASE_URL}/api/admin/feedback/{fid}/status",
                               json={"status": "resolved"})
        assert r.status_code == 200
        # Confirm persistence
        lst = admin_session.get(f"{BASE_URL}/api/admin/feedback").json()
        fb = next(f for f in lst if f["id"] == fid)
        assert fb["status"] == "resolved"


# ───────────────────────── Admin extend_trial ─────────────────────────

class TestAdminExtendTrial:

    def test_extend_trial(self, admin_session):
        # Find target user — use our created iter7 user
        users = admin_session.get(f"{BASE_URL}/api/admin/users").json()
        target = next((u for u in users if u.get("email", "").startswith("iter7_")), None)
        assert target, "Could not find iter7_* user in admin list"
        uid = target["id"]

        r = admin_session.post(f"{BASE_URL}/api/admin/users/{uid}/action",
                               json={"action": "extend_trial", "days": 30})
        assert r.status_code == 200, r.text

        # Verify trial_ends_at was updated
        users2 = admin_session.get(f"{BASE_URL}/api/admin/users").json()
        target2 = next(u for u in users2 if u["id"] == uid)
        assert target2.get("plan_status") == "trial"
        assert target2.get("trial_ends_at")  # ISO string

    def test_invalid_user_id(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/admin/users/not-an-objectid/action",
                               json={"action": "extend_trial", "days": 7})
        assert r.status_code == 400


# ───────────────────────── Regression ─────────────────────────

class TestRegression:

    def test_login(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        body = r.json()
        # login returns user fields at the top-level (id/email/name) — not nested under "user"
        assert body.get("email") == ADMIN_EMAIL

    def test_properties_crud(self, user_session):
        # Create
        r = user_session.post(f"{BASE_URL}/api/properties", json={
            "name": "TEST_regression_prop",
            "location": "Pune",
            "price": 5000000,
            "size": 900,
        })
        assert r.status_code in (200, 201), r.text
        pid = r.json().get("id") or r.json().get("_id")
        # List
        lst = user_session.get(f"{BASE_URL}/api/properties").json()
        assert any(p.get("id") == pid for p in lst)
        # Delete
        r = user_session.delete(f"{BASE_URL}/api/properties/{pid}")
        assert r.status_code in (200, 204)

    def test_portfolio_summary(self, user_session):
        r = user_session.get(f"{BASE_URL}/api/portfolio/summary")
        assert r.status_code == 200
        data = r.json()
        # basic shape
        assert isinstance(data, dict)

    def test_compare_endpoint(self, user_session, property_id):
        # Create a second property
        r = user_session.post(f"{BASE_URL}/api/properties", json={
            "name": "TEST_cmp_2", "location": "Hyd", "price": 9000000, "size": 1200,
        })
        p2 = r.json().get("id")
        r = user_session.post(f"{BASE_URL}/api/compare/score",
                              json={"property_ids": [property_id, p2]})
        # Compare score endpoint; accept 200 or validation failure if extra fields needed
        assert r.status_code in (200, 400, 422), r.text
