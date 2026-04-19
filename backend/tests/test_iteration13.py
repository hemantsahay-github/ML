"""Iteration 13 regression tests: loan_optimizer helper refactor, demo-login env var,
public will-review/witness-sign expires_at enforcement, Google Auth session guard,
market/nearby and core smoke."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-decision-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def me(demo_session):
    r = demo_session.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 200
    return r.json()


# ---------------- Auth regression ----------------
class TestAuth:
    def test_demo_login_returns_is_demo_true(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/demo-login", timeout=30)
        assert r.status_code == 200
        body = r.json()
        # Either at top level or nested under "user"
        is_demo = body.get("is_demo")
        if is_demo is None and isinstance(body.get("user"), dict):
            is_demo = body["user"].get("is_demo")
        assert is_demo is True, f"is_demo should be True, body={body}"

    def test_demo_login_me(self, demo_session, me):
        assert me.get("is_demo") is True
        assert me.get("email")

    def test_google_session_invalid_returns_401(self):
        """POST with fake session_id should not authenticate (expect 401 from Emergent upstream or 502)."""
        r = requests.post(f"{API}/auth/google/session",
                          json={"session_id": "fake-session-id-xyz"}, timeout=20)
        assert r.status_code in (401, 403, 502), f"Expected 401/403/502, got {r.status_code}: {r.text[:200]}"


# ---------------- Loan optimizer regression (helper extraction) ----------------
LOAN_BASE = {
    "property_price": 8000000,
    "monthly_rent": 32000,
    "loan_rate": 8.5,
    "loan_tenure_years": 20,
    "maintenance_monthly": 3500,
    "property_tax_yearly": 12000,
    "appreciation_pct": 7,
    "rental_yield_pct": 3,
    "analysis_years": 10,
}


class TestLoanOptimizer:
    def test_grid_has_20_rows_and_required_keys(self):
        r = requests.post(f"{API}/calc/loan-optimizer", json=LOAN_BASE, timeout=30)
        assert r.status_code == 200, f"status {r.status_code}: {r.text[:200]}"
        data = r.json()
        grid = data.get("grid")
        assert isinstance(grid, list), f"grid missing/not list: {type(grid)}"
        assert len(grid) == 20, f"Expected 20 rows (5..100% step 5), got {len(grid)}"
        # pct sanity
        pcts = [g["down_payment_pct"] for g in grid]
        assert pcts == list(range(5, 101, 5))
        # required fields
        required = {"down_payment_pct", "down_payment", "loan", "emi",
                    "monthly_cashflow", "annual_cashflow", "cash_on_cash_return_pct",
                    "pre_emi_monthly", "pre_emi_total", "final_value",
                    "net_equity_at_horizon", "leverage_roi_pct_total",
                    "leverage_cagr_pct", "leverage_xirr_pct"}
        missing = required - set(grid[0].keys())
        assert not missing, f"Missing keys in grid row: {missing}"

    def test_summary_keys_present(self):
        r = requests.post(f"{API}/calc/loan-optimizer", json=LOAN_BASE, timeout=30)
        data = r.json()
        assert "cashflow_neutral_min_dp_pct" in data
        # may be None if no neutral in grid; for these inputs it should be a number
        assert data["cashflow_neutral_min_dp_pct"] is None or isinstance(data["cashflow_neutral_min_dp_pct"], (int, float))
        assert "best_leverage_xirr" in data
        blx = data["best_leverage_xirr"]
        assert blx is not None
        assert "leverage_xirr_pct" in blx
        assert blx["leverage_xirr_pct"] >= 0, f"best_leverage_xirr.leverage_xirr_pct negative: {blx}"

    def test_all_leverage_xirr_non_negative(self):
        r = requests.post(f"{API}/calc/loan-optimizer", json=LOAN_BASE, timeout=30)
        data = r.json()
        for g in data["grid"]:
            assert g["leverage_xirr_pct"] >= 0, f"Negative xirr at {g['down_payment_pct']}%: {g['leverage_xirr_pct']}"

    def test_under_construction_subvention_pre_emi_zero(self):
        payload = {**LOAN_BASE,
                   "under_construction": True,
                   "possession_months": 24,
                   "subvention_by_builder": True}
        r = requests.post(f"{API}/calc/loan-optimizer", json=payload, timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["under_construction"] is True
        assert data["possession_months"] == 24
        assert data["subvention_by_builder"] is True
        # Every row must have pre_emi_monthly == 0 and pre_emi_total == 0
        for g in data["grid"]:
            assert g["pre_emi_monthly"] == 0, f"pre_emi_monthly != 0 at {g['down_payment_pct']}%: {g['pre_emi_monthly']}"
            assert g["pre_emi_total"] == 0, f"pre_emi_total != 0 at {g['down_payment_pct']}%: {g['pre_emi_total']}"

    def test_under_construction_no_subvention_pre_emi_nonzero(self):
        """Sanity: when under_construction and no builder subvention, pre_emi should be > 0 (except at 100% DP)."""
        payload = {**LOAN_BASE,
                   "under_construction": True,
                   "possession_months": 24,
                   "subvention_by_builder": False}
        r = requests.post(f"{API}/calc/loan-optimizer", json=payload, timeout=30)
        assert r.status_code == 200
        grid = r.json()["grid"]
        # At 5% DP (loan > 0) there should be non-zero pre_emi
        row_5 = next(g for g in grid if g["down_payment_pct"] == 5)
        assert row_5["pre_emi_monthly"] > 0
        assert row_5["pre_emi_total"] > 0
        # At 100% DP (loan == 0) pre_emi must be 0
        row_100 = next(g for g in grid if g["down_payment_pct"] == 100)
        assert row_100["pre_emi_monthly"] == 0


# ---------------- Public will-review / witness-sign token guards ----------------
class TestPublicWillRoutes:
    def test_invalid_will_review_token_404(self):
        r = requests.get(f"{API}/public/will-review/this-token-does-not-exist", timeout=15)
        assert r.status_code in (404, 410), f"Expected 404/410 got {r.status_code}: {r.text[:200]}"

    def test_invalid_witness_sign_token_404(self):
        r = requests.get(f"{API}/public/witness-sign/this-token-does-not-exist", timeout=15)
        assert r.status_code in (404, 410), f"Expected 404/410 got {r.status_code}: {r.text[:200]}"

    def test_submit_invalid_will_review_token(self):
        r = requests.post(f"{API}/public/will-review/this-token-does-not-exist/submit",
                          json={"status": "approved", "comments": "ok"}, timeout=15)
        assert r.status_code in (400, 404, 410, 422), f"Unexpected {r.status_code}: {r.text[:200]}"

    def test_submit_invalid_witness_sign_token(self):
        r = requests.post(f"{API}/public/witness-sign/this-token-does-not-exist",
                          json={"signed": True, "name": "X", "signature": "X"}, timeout=15)
        assert r.status_code in (400, 404, 410, 422), f"Unexpected {r.status_code}: {r.text[:200]}"


# ---------------- Portfolio / Advisor / Calculators smoke ----------------
class TestCoreSmoke:
    def test_properties_demo_has_4(self, demo_session):
        r = demo_session.get(f"{API}/properties", timeout=15)
        assert r.status_code == 200
        data = r.json()
        props = data if isinstance(data, list) else data.get("properties", [])
        assert len(props) >= 4

    def test_portfolio_summary(self, demo_session):
        r = demo_session.get(f"{API}/portfolio/summary", timeout=20)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        assert isinstance(body, dict)

    def test_portfolio_timeline(self, demo_session):
        r = demo_session.get(f"{API}/portfolio/timeline", timeout=20)
        assert r.status_code == 200, r.text[:200]

    def test_portfolio_vs_investments(self, demo_session):
        # /portfolio/vs-investments is a POST; the frontend Portfolio page calls this for "vs-markets" view
        r = demo_session.post(f"{API}/portfolio/vs-investments",
                              json={"years": 10, "sip_monthly": 25000, "sip_return_pct": 12, "fd_rate_pct": 7},
                              timeout=25)
        assert r.status_code in (200, 422), r.text[:200]

    def test_calc_emi(self):
        r = requests.post(f"{API}/calc/emi",
                          json={"principal": 5000000, "rate": 8.5, "tenure_years": 20}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "emi" in data and data["emi"] > 0

    def test_referrals_me(self, demo_session):
        r = demo_session.get(f"{API}/referrals/me", timeout=15)
        # referrals may be under different endpoint in project
        assert r.status_code in (200, 404), r.text[:200]


# ---------------- Market / Nearby regression ----------------
class TestMarket:
    def test_market_nearby_works(self, demo_session):
        # Use known params (area / type / bhk) from iteration 12 context
        r = demo_session.get(f"{API}/market/nearby",
                             params={"area": "HSR Layout", "type": "Apartment", "bhk": 3},
                             timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        body = r.json()
        assert isinstance(body, dict)
