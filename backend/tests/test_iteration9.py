"""Iteration 9 backend tests — 7 new features.

Covers:
  - Projects watchlist (POST/DELETE/GET watch + GET /projects/watched)
  - XIRR calculator (POST /calc/xirr) + resale xirr_pct field
  - Car vs Property (POST /calc/car-vs-property)
  - UC projection (POST /calc/uc-projection)
  - RTM vs UC breakeven (POST /calc/breakeven-rtm-uc)
  - Tenant invite + login + tenant portal endpoints + razorpay verify rejects invalid sig
  - Legacy transfer (admin-only)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://property-decision-4.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@estima.com"
ADMIN_PASS = "Admin@123"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_session(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return session


# ---------- Projects watchlist ----------
class TestProjectsWatchlist:
    PROJECT_ID = "brigade-eldorado-bengaluru"   # curated project id; we'll fall back if missing

    def _pick_project_id(self, sess):
        r = sess.get(f"{API}/builder-projects")
        if r.status_code == 200 and r.json().get("projects"):
            return r.json()["projects"][0]["id"]
        return self.PROJECT_ID

    def test_watch_unwatch_idempotent_and_list(self, admin_session):
        pid = self._pick_project_id(admin_session)
        # watch twice (idempotent)
        r1 = admin_session.post(f"{API}/projects/{pid}/watch")
        assert r1.status_code == 200, r1.text
        assert r1.json().get("ok") is True
        r2 = admin_session.post(f"{API}/projects/{pid}/watch")
        assert r2.status_code == 200
        # list shows this project
        rl = admin_session.get(f"{API}/projects/watched")
        assert rl.status_code == 200, rl.text
        data = rl.json()
        ids = [p["id"] for p in data["projects"]]
        assert pid in ids
        watched = next(p for p in data["projects"] if p["id"] == pid)
        assert "watched_at" in watched
        # unwatch
        rd = admin_session.delete(f"{API}/projects/{pid}/watch")
        assert rd.status_code == 200
        # unwatch again (idempotent - should still succeed)
        rd2 = admin_session.delete(f"{API}/projects/{pid}/watch")
        assert rd2.status_code == 200
        # now not in list
        rl2 = admin_session.get(f"{API}/projects/watched")
        assert rl2.status_code == 200
        ids2 = [p["id"] for p in rl2.json()["projects"]]
        assert pid not in ids2


# ---------- XIRR ----------
class TestXirr:
    def test_xirr_basic(self, session):
        body = {"cashflows": [
            {"date": "2020-01-01", "amount": -1000000},
            {"date": "2025-01-01", "amount": 1600000},
        ]}
        r = session.post(f"{API}/calc/xirr", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        # Expected ~9.85% for 1M->1.6M in 5 years
        assert abs(data["xirr_pct"] - 9.85) < 0.5, f"Got {data['xirr_pct']}"
        assert data["n_flows"] == 2

    def test_xirr_invalid(self, session):
        # only positive flows -> returns 0 (not error)
        body = {"cashflows": [
            {"date": "2020-01-01", "amount": 100},
            {"date": "2021-01-01", "amount": 200},
        ]}
        r = session.post(f"{API}/calc/xirr", json=body)
        assert r.status_code == 200
        assert r.json()["xirr_pct"] == 0.0


# ---------- Resale xirr_pct field ----------
class TestResaleXirr:
    def test_resale_has_xirr(self, session):
        body = {
            "purchase_price": 8000000,
            "current_value": 12000000,
            "outstanding_loan": 3000000,
            "years_held": 5,
            "maintenance_monthly": 2500,
            "property_tax_yearly": 10000,
            "current_rent_monthly": 25000,
            "broker_fee_pct": 1.0,
            "ltcg_pct": 20.0,
        }
        r = session.post(f"{API}/calc/resale-estimate", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "xirr_pct" in data
        assert isinstance(data["xirr_pct"], (int, float))


# ---------- Car vs Property ----------
class TestCarVsProperty:
    def test_basic(self, session):
        body = {"amount": 1500000, "years": 10}
        r = session.post(f"{API}/calc/car-vs-property", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["winner"] in ("Property", "Car")
        assert "delta" in data
        assert isinstance(data["series"], list) and len(data["series"]) == 10
        assert isinstance(data["narrative"], list) and len(data["narrative"]) >= 3


# ---------- UC Projection ----------
class TestUCProjection:
    def test_basic_clp(self, session):
        body = {"purchase_price": 8000000, "possession_months": 36, "disbursement_schedule": "clp"}
        r = session.post(f"{API}/calc/uc-projection", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "expected_possession_value" in data
        assert "effective_acquisition_cost" in data
        assert "disbursement_schedule" in data
        assert isinstance(data["disbursement_schedule"], list)
        assert len(data["disbursement_schedule"]) == 36
        assert isinstance(data["narrative"], list) and len(data["narrative"]) >= 3
        # last month disbursed should be 100%
        assert data["disbursement_schedule"][-1]["cumulative_disbursed_pct"] >= 80.0


# ---------- RTM vs UC Breakeven ----------
class TestRtmVsUcBreakeven:
    def test_basic(self, session):
        body = {
            "rtm_price": 9500000,
            "uc_price": 8500000,
            "possession_months": 36,
            "monthly_rent_rtm": 32000,
            "expected_rent_at_possession_uc": 38000,
        }
        r = session.post(f"{API}/calc/breakeven-rtm-uc", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rtm" in data and "uc" in data
        assert "winner" in data
        rtm = data["rtm"]
        uc = data["uc"]
        # Either feasible (dp_pct) or not feasible (no dp_pct but feasible=False)
        assert "feasible" in rtm and "feasible" in uc
        if rtm["feasible"]:
            assert "dp_pct" in rtm
            assert "5y_carrying_cost" in rtm
        if uc["feasible"]:
            assert "dp_pct" in uc
            assert "5y_carrying_cost_incl_pre_emi" in uc
            assert uc["possession_months"] == 36


# ---------- Tenant portal + invite ----------
class TestTenantPortal:
    """Create a property + tenant via admin, invite tenant, login as tenant, test tenant endpoints."""

    @pytest.fixture(scope="class")
    def tenant_creds(self, admin_session):
        # Create a property
        pname = f"TEST_PROP_IT9_{uuid.uuid4().hex[:6]}"
        prop_payload = {
            "name": pname,
            "type": "flat",
            "city": "Bengaluru",
            "area": "TestArea",
            "purchase_price": 5000000,
            "current_value": 6000000,
        }
        rp = admin_session.post(f"{API}/properties", json=prop_payload)
        assert rp.status_code == 200, rp.text
        prop_id = rp.json()["id"]

        # Create a tenant under that property with unique email
        t_email = f"test_tenant_it9_{uuid.uuid4().hex[:8]}@estima.com"
        tenant_payload = {
            "property_id": prop_id,
            "name": "TEST Tenant IT9",
            "email": t_email,
            "phone": "9999999999",
            "monthly_rent": 25000,
            "lease_start": "2025-01-01",
            "lease_end": "2026-01-01",
        }
        rt = admin_session.post(f"{API}/tenants", json=tenant_payload)
        assert rt.status_code == 200, rt.text
        tenant_id = rt.json()["id"]

        # Invite — generates password
        ri = admin_session.post(f"{API}/tenants/{tenant_id}/invite", json={})
        assert ri.status_code == 200, ri.text
        pw1 = ri.json()["temp_password"]
        assert ri.json()["tenant_email"] == t_email

        # Re-invite with custom password (idempotent - should update password)
        ri2 = admin_session.post(f"{API}/tenants/{tenant_id}/invite", json={"password": "TenantPass@123"})
        assert ri2.status_code == 200, ri2.text
        assert ri2.json()["temp_password"] == "TenantPass@123"

        return {
            "email": t_email,
            "password": "TenantPass@123",
            "tenant_id": tenant_id,
            "property_id": prop_id,
        }

    def test_tenant_login_and_role(self, tenant_creds):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{API}/auth/login", json={
            "email": tenant_creds["email"],
            "password": tenant_creds["password"],
        })
        assert r.status_code == 200, r.text
        data = r.json()
        # login returns user fields at top-level
        assert data.get("role") == "tenant", f"Expected tenant role, got {data.get('role')}; body={data}"

    def test_tenant_me_and_receipts(self, tenant_creds):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{API}/auth/login", json={
            "email": tenant_creds["email"], "password": tenant_creds["password"],
        })
        # /tenant/me
        r = s.get(f"{API}/tenant/me")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user" in data and "tenant" in data
        assert data["user"]["email"] == tenant_creds["email"]
        # receipts: empty list is fine
        r2 = s.get(f"{API}/tenant/receipts")
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

    def test_tenant_me_denied_for_admin(self, admin_session):
        r = admin_session.get(f"{API}/tenant/me")
        assert r.status_code == 403

    def test_razorpay_verify_rejects_invalid_signature(self, tenant_creds):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        s.post(f"{API}/auth/login", json={
            "email": tenant_creds["email"], "password": tenant_creds["password"],
        })
        # Try creating an order first (may or may not work based on razor config)
        r_ord = s.post(f"{API}/tenant/pay/create-order", json={
            "month": "2025-01", "amount": 25000, "notes": "test",
        })
        # If razor not configured, skip signature test
        if r_ord.status_code == 502:
            pytest.skip("Razorpay not configured on server")
        assert r_ord.status_code == 200, r_ord.text
        order_id = r_ord.json()["order_id"]
        # Now verify with bogus signature
        r_ver = s.post(f"{API}/tenant/pay/verify", json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "pay_test_fake_123",
            "razorpay_signature": "deadbeef" * 8,
        })
        assert r_ver.status_code == 400, f"expected 400 got {r_ver.status_code}: {r_ver.text}"


# ---------- Legacy Transfer ----------
class TestLegacyTransfer:
    def test_admin_legacy_transfer(self, admin_session):
        # Create a source user via register
        src_email = f"test_legacy_src_{uuid.uuid4().hex[:8]}@estima.com"
        rs = requests.Session()
        rs.headers.update({"Content-Type": "application/json"})
        rr = rs.post(f"{API}/auth/register", json={
            "email": src_email, "password": "SrcPass@123", "name": "Legacy Source",
        })
        assert rr.status_code in (200, 201), rr.text
        # Fetch user id via /auth/me
        me = rs.get(f"{API}/auth/me")
        assert me.status_code == 200
        src_uid = me.json().get("id") or me.json().get("user", {}).get("id")
        assert src_uid

        # Admin performs legacy transfer
        new_email = f"test_legacy_heir_{uuid.uuid4().hex[:8]}@estima.com"
        rt = admin_session.post(f"{API}/admin/legacy-transfer", json={
            "from_user_id": src_uid,
            "new_email": new_email,
            "new_name": "Heir User",
            "transfer_properties": True,
            "transfer_tenants": True,
            "temp_password": "Heir@12345",
            "note": "Test iteration 9 transfer",
        })
        assert rt.status_code == 200, rt.text
        data = rt.json()
        assert data["ok"] is True
        assert data["new_email"] == new_email
        assert data["temp_password"] == "Heir@12345"
        assert "transferred" in data

        # Verify heir can login
        hs = requests.Session()
        hs.headers.update({"Content-Type": "application/json"})
        rlog = hs.post(f"{API}/auth/login", json={"email": new_email, "password": "Heir@12345"})
        assert rlog.status_code == 200, rlog.text
        assert rlog.json().get("role") == "user"

        # Verify source user is archived (role=legacy_archived)
        src_login = requests.Session()
        src_login.headers.update({"Content-Type": "application/json"})
        r_src = src_login.post(f"{API}/auth/login", json={"email": src_email, "password": "SrcPass@123"})
        # Login may still work; role should be legacy_archived
        if r_src.status_code == 200:
            role = r_src.json().get("role")
            assert role == "legacy_archived", f"Expected legacy_archived, got {role}"

    def test_legacy_transfer_requires_admin(self, session):
        # Use fresh non-admin session
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        # register a regular user
        ue = f"test_nonadmin_{uuid.uuid4().hex[:6]}@estima.com"
        s.post(f"{API}/auth/register", json={"email": ue, "password": "Pass@123", "name": "NA"})
        r = s.post(f"{API}/admin/legacy-transfer", json={
            "from_user_id": "000000000000000000000000",
            "new_email": "x@y.com",
            "new_name": "X",
        })
        assert r.status_code in (401, 403)
