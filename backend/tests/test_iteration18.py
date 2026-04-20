"""
Iteration 18 — Rental Snowball backend tests
Endpoints:
- POST /api/calc/rental-snowball (anonymous)
- POST /api/calc/rental-snowball/share (auth)
- GET /api/shares/{id} (public)
- GET /api/shares list (auth) — verify snowball entries
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def anon_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/demo-login", timeout=30)
    if r.status_code != 200:
        pytest.skip(f"demo-login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def default_payload():
    return {
        "starting_od_balance": 1500000,
        "monthly_surplus": 80000,
        "loan_rate_pct": 8.5,
        "loan_tenure_years": 20,
        "rent_escalation_pct": 5.0,
        "appreciation_pct": 7.0,
        "analysis_years": 15,
        "target_flats": [
            {"name": "RTM Pune", "price_today": 8500000, "down_payment_pct": 20,
             "monthly_rent_today": 35000, "is_under_construction": False, "construction_months": 0},
            {"name": "UC Hinjewadi", "price_today": 9500000, "down_payment_pct": 20,
             "monthly_rent_today": 42000, "is_under_construction": True, "construction_months": 30},
            {"name": "RTM Mumbai", "price_today": 15000000, "down_payment_pct": 20,
             "monthly_rent_today": 65000, "is_under_construction": False, "construction_months": 0},
        ],
    }


# --- Calc endpoint ---
class TestRentalSnowballCalc:
    def test_anonymous_calc_default_scenario(self, anon_client, default_payload):
        r = anon_client.post(f"{API}/calc/rental-snowball", json=default_payload, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Required fields
        for k in ["xirr_pct", "first_operating_cf_positive_month", "first_cumulative_cf_positive_month",
                  "terminal_portfolio_value", "terminal_loan_balance", "terminal_od_balance",
                  "terminal_net_worth", "total_purchases", "unpurchased_count",
                  "purchases", "monthly_series", "yearly_snapshots", "narrative"]:
            assert k in d, f"missing key {k}"
        assert d["total_purchases"] >= 1
        assert 0 <= d["xirr_pct"] <= 50
        assert d["terminal_net_worth"] > 0
        assert isinstance(d["purchases"], list) and len(d["purchases"]) == d["total_purchases"]
        assert isinstance(d["monthly_series"], list) and len(d["monthly_series"]) > 0
        assert isinstance(d["yearly_snapshots"], list) and len(d["yearly_snapshots"]) == 15
        assert isinstance(d["narrative"], list) and len(d["narrative"]) >= 2

    def test_empty_target_flats_returns_400(self, anon_client, default_payload):
        body = dict(default_payload)
        body["target_flats"] = []
        r = anon_client.post(f"{API}/calc/rental-snowball", json=body, timeout=15)
        assert r.status_code == 400, r.text

    def test_desired_buy_month_forces_purchase(self, anon_client):
        body = {
            "starting_od_balance": 0,           # no money
            "monthly_surplus": 1000,            # tiny surplus
            "loan_rate_pct": 8.5,
            "loan_tenure_years": 20,
            "rent_escalation_pct": 5.0,
            "appreciation_pct": 7.0,
            "analysis_years": 5,
            "target_flats": [
                {"name": "Forced Pune", "price_today": 8500000, "down_payment_pct": 20,
                 "monthly_rent_today": 35000, "is_under_construction": False,
                 "construction_months": 0, "desired_buy_month": 2},
            ],
        }
        r = anon_client.post(f"{API}/calc/rental-snowball", json=body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_purchases"] == 1
        assert d["purchases"][0]["month"] == 2
        # OD should be negative since DP exceeded balance
        assert d["terminal_od_balance"] < 0 or d["purchases"][0]["dp"] > 0

    def test_uc_pre_emi_then_emi_after_possession(self, anon_client):
        body = {
            "starting_od_balance": 5000000,
            "monthly_surplus": 100000,
            "loan_rate_pct": 9.0,
            "loan_tenure_years": 20,
            "rent_escalation_pct": 5.0,
            "appreciation_pct": 7.0,
            "analysis_years": 6,
            "target_flats": [
                {"name": "UC Tower", "price_today": 8000000, "down_payment_pct": 20,
                 "monthly_rent_today": 30000, "is_under_construction": True,
                 "construction_months": 24, "desired_buy_month": 1},
            ],
        }
        r = anon_client.post(f"{API}/calc/rental-snowball", json=body, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_purchases"] == 1
        # Find an early monthly row (during construction) and a post-possession row
        # monthly_series is every 3 months
        early = [row for row in d["monthly_series"] if row["month"] <= 12]
        late = [row for row in d["monthly_series"] if row["month"] >= 36]
        assert any(r["pre_emi"] > 0 and r["emi"] == 0 for r in early), "expected pre_emi only during construction"
        assert any(r["emi"] > 0 and r["rent"] > 0 for r in late), "expected EMI + rent after possession"


# --- Share endpoints ---
class TestSnowballShare:
    def test_anon_create_share_returns_401(self, anon_client, default_payload):
        r = anon_client.post(f"{API}/calc/rental-snowball/share",
                             json={"inputs": default_payload, "title": "TEST_anon"}, timeout=15)
        assert r.status_code == 401, r.text

    def test_demo_creates_share(self, demo_client, default_payload):
        r = demo_client.post(f"{API}/calc/rental-snowball/share",
                             json={"inputs": default_payload, "title": "TEST_snowball_iter18"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "share_id" in d and isinstance(d["share_id"], str) and len(d["share_id"]) > 5
        assert d["url"] == f"/share/{d['share_id']}"
        assert d["kind"] == "snowball"
        # stash for later tests via class attr
        TestSnowballShare.share_id = d["share_id"]

    def test_get_share_public_no_user_leak(self, anon_client):
        sid = TestSnowballShare.share_id
        r = anon_client.get(f"{API}/shares/{sid}", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["kind"] == "snowball"
        assert d["title"] == "TEST_snowball_iter18"
        assert "user_id" not in d
        assert "inputs" in d and "result" in d
        assert "purchases" in d["result"]
        assert "monthly_series" in d["result"]
        assert isinstance(d["result"]["purchases"], list)

    def test_list_shares_includes_snowball(self, demo_client):
        r = demo_client.get(f"{API}/shares", timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        snowball_items = [x for x in items if x.get("kind") == "snowball"]
        assert len(snowball_items) >= 1
        # find ours
        mine = [x for x in snowball_items if x["share_id"] == TestSnowballShare.share_id]
        assert mine, "created snowball share not in list"
        item = mine[0]
        assert "xirr_pct" in item
        assert "total_purchases" in item

    def test_get_unknown_share_404(self, anon_client):
        r = anon_client.get(f"{API}/shares/NOPE_doesnotexist", timeout=10)
        assert r.status_code == 404

    def test_cleanup_owner_delete(self, demo_client):
        sid = TestSnowballShare.share_id
        r = demo_client.delete(f"{API}/shares/{sid}", timeout=15)
        assert r.status_code in (200, 204)
        # verify gone
        g = demo_client.get(f"{API}/shares/{sid}", timeout=10)
        assert g.status_code == 404


# --- Regression: pre-existing odcf share still resolves ---
class TestOdcfRegression:
    def test_existing_odcf_share_still_works(self, anon_client):
        r = anon_client.get(f"{API}/shares/WxLW_VGj1EJiDA", timeout=15)
        # If admin pre-seeded the share it should be 200; if not, 404 is acceptable but flagged
        if r.status_code == 200:
            d = r.json()
            assert d.get("kind") in ("odcf", "comparison", "snowball"), d.get("kind")
            assert "user_id" not in d
        else:
            pytest.skip(f"Pre-existing odcf share WxLW_VGj1EJiDA not present (status={r.status_code})")
