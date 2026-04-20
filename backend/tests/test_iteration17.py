"""
Iteration 17: OD-Cashflow Share endpoint tests
- POST /api/calc/od-cashflow/share (auth required)
- GET /api/shares/{share_id} for kind='odcf'
- GET /api/shares lists both kinds with summary fields
- DELETE /api/shares/{share_id} (owner only)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # fallback to frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip()
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- Fixtures ----------

@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=20)
    assert r.status_code == 200, f"demo-login failed {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": "admin@estima.com", "password": "Admin@123"},
               timeout=20)
    assert r.status_code == 200, f"admin login failed {r.text}"
    return s


@pytest.fixture(scope="module")
def sample_inputs():
    return {
        "property_price": 12000000,
        "down_payment_pct": 20,
        "loan_rate": 8.5,
        "loan_tenure_years": 20,
        "monthly_rent": 35000,
        "rent_growth_pct": 6,
        "monthly_od_topup": 25000,
        "od_rate": 8.5,
        "builder_plan": "rtm",
        "possession_months": 0,
        "horizon_years": 10,
        "maintenance_monthly": 3000,
        "property_tax_yearly": 12000,
        "appreciation_pct": 6,
    }


# ---------- Tests ----------

class TestOdcfShareCreate:
    def test_anon_blocked_401(self, sample_inputs):
        r = requests.post(f"{API}/calc/od-cashflow/share",
                          json={"inputs": sample_inputs, "title": "anon"},
                          timeout=20)
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_demo_create_share(self, demo_session, sample_inputs):
        r = demo_session.post(f"{API}/calc/od-cashflow/share",
                              json={"inputs": sample_inputs,
                                    "title": "TEST_iter17_share"},
                              timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["kind"] == "odcf"
        assert "share_id" in data and len(data["share_id"]) >= 10
        assert data["url"] == f"/share/{data['share_id']}"
        # store for next tests
        pytest.odcf_share_id = data["share_id"]


class TestOdcfShareGet:
    def test_get_share_public_no_user_id(self):
        sid = pytest.odcf_share_id
        r = requests.get(f"{API}/shares/{sid}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["kind"] == "odcf"
        assert data["title"] == "TEST_iter17_share"
        assert "user_id" not in data, "user_id leaked in public share!"
        assert "owner_name" in data
        assert "created_at" in data
        assert "inputs" in data
        # result has xirr_pct + monthly_series
        res = data["result"]
        assert "xirr_pct" in res
        assert isinstance(res.get("monthly_series"), list)
        assert len(res["monthly_series"]) > 0

    def test_get_unknown_404(self):
        r = requests.get(f"{API}/shares/__nonexistent__id__", timeout=20)
        assert r.status_code == 404


class TestListShares:
    def test_anon_blocked(self):
        r = requests.get(f"{API}/shares", timeout=20)
        assert r.status_code == 401

    def test_list_includes_odcf(self, demo_session):
        r = demo_session.get(f"{API}/shares", timeout=20)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        sid = pytest.odcf_share_id
        odcf_items = [x for x in items if x["share_id"] == sid]
        assert len(odcf_items) == 1, f"odcf share not in list: {items}"
        item = odcf_items[0]
        assert item["kind"] == "odcf"
        assert item["title"] == "TEST_iter17_share"
        assert "xirr_pct" in item
        assert "builder_plan" in item
        assert item["builder_plan"] == "rtm"

    def test_list_summary_shape_for_comparison(self, demo_session):
        r = demo_session.get(f"{API}/shares", timeout=20)
        items = r.json()
        comp = [x for x in items if x.get("kind") == "comparison"]
        # may be zero for fresh demo, but if any exist, validate shape
        for c in comp:
            assert "winner" in c
            assert "num_properties" in c


class TestDeleteOdcfShare:
    def test_non_owner_cannot_delete(self, admin_session):
        # admin tries to delete demo's share -> should 404 (owner-scoped query)
        sid = pytest.odcf_share_id
        r = admin_session.delete(f"{API}/shares/{sid}", timeout=20)
        assert r.status_code == 404, f"non-owner delete should 404; got {r.status_code}"

    def test_owner_deletes(self, demo_session):
        sid = pytest.odcf_share_id
        r = demo_session.delete(f"{API}/shares/{sid}", timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # Verify gone
        r2 = requests.get(f"{API}/shares/{sid}", timeout=20)
        assert r2.status_code == 404
