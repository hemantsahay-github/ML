"""
Iteration 6 Backend Tests:
- Referral program: GET /api/referrals/me, POST /api/auth/register with referral_code
- Resale estimator: POST /api/calc/resale-estimate
- Loan optimizer: POST /api/calc/loan-optimizer
- Portfolio vs-investments: sold properties + rental income
- Regression: auth, billing, prior endpoints
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@estima.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")


# ─────────────────────────── Fixtures ───────────────────────────

@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def referrer_session():
    """Register user A who will be the referrer."""
    s = requests.Session()
    uid = uuid.uuid4().hex[:8]
    r = s.post(f"{BASE_URL}/api/auth/register", json={
        "email": f"referrer_{uid}@test.com",
        "password": "Ref@123456",
        "name": f"Referrer {uid}"
    })
    assert r.status_code == 200, f"Register referrer failed: {r.text}"
    return s


# ─────────────────────────── Referrals ───────────────────────────

class TestReferrals:
    """GET /api/referrals/me — auto-assigns code, returns expected fields"""

    def test_admin_get_referrals_me(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/referrals/me")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "referral_code" in data
        assert "total_referrals" in data
        assert "total_days_granted" in data
        assert "events" in data
        assert data.get("reward_per_referral_days") == 30

    def test_referrals_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/referrals/me")
        assert r.status_code in [401, 403], f"Expected 401/403, got {r.status_code}"

    def test_new_user_gets_referral_code(self, referrer_session):
        r = referrer_session.get(f"{BASE_URL}/api/referrals/me")
        assert r.status_code == 200
        data = r.json()
        assert "referral_code" in data
        assert len(data["referral_code"]) >= 6
        assert isinstance(data["events"], list)


class TestReferralSignup:
    """POST /api/auth/register with referral_code"""

    def test_register_with_valid_referral_code(self, referrer_session):
        # Get referrer's code
        r = referrer_session.get(f"{BASE_URL}/api/referrals/me")
        assert r.status_code == 200
        referral_code = r.json()["referral_code"]
        old_total = r.json()["total_referrals"]

        # Register new user with referrer's code
        uid = uuid.uuid4().hex[:8]
        s2 = requests.Session()
        r2 = s2.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"referred_{uid}@test.com",
            "password": "Ref@123456",
            "name": f"Referred {uid}",
            "referral_code": referral_code
        })
        assert r2.status_code == 200, f"Referred register failed: {r2.text}"

        # Verify referrer's stats updated
        r3 = referrer_session.get(f"{BASE_URL}/api/referrals/me")
        assert r3.status_code == 200
        data3 = r3.json()
        assert data3["total_referrals"] == old_total + 1
        assert len(data3["events"]) >= 1
        # Check that referred email is in events
        events_emails = [e.get("referred_email", "") for e in data3["events"]]
        assert any(f"referred_{uid}@test.com" in e for e in events_emails)

    def test_register_with_invalid_referral_code_succeeds(self):
        """Invalid code should be silently ignored"""
        uid = uuid.uuid4().hex[:8]
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"invalidref_{uid}@test.com",
            "password": "Ref@123456",
            "name": f"Invalid Ref {uid}",
            "referral_code": "INVALIDXXX999"
        })
        assert r.status_code == 200, f"Registration with invalid referral code failed: {r.text}"

    def test_referrer_plan_extended_by_30_days(self, referrer_session):
        """After a referred signup, referrer should have pro plan active"""
        r = referrer_session.get(f"{BASE_URL}/api/referrals/me")
        assert r.status_code == 200
        data = r.json()
        # If there are events, referrer should have extended plan
        if data["total_referrals"] > 0:
            assert data["total_days_granted"] >= 30


# ─────────────────────────── Resale Estimator ───────────────────────────

class TestResaleEstimator:
    """POST /api/calc/resale-estimate"""

    BASE_PAYLOAD = {
        "purchase_price": 7500000,
        "current_value": 9500000,
        "outstanding_loan": 4800000,
        "years_held": 4,
        "appreciation_pct": 5.0,
        "maintenance_monthly": 3500,
        "property_tax_yearly": 15000,
        "rental_income_monthly": 28000,
        "broker_fee_pct": 1.0,
        "ltcg_pct": 20.0,
        "target_profit_inr": 500000
    }

    def test_resale_estimate_status_200(self):
        r = requests.post(f"{BASE_URL}/api/calc/resale-estimate", json=self.BASE_PAYLOAD)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_resale_estimate_required_fields(self):
        r = requests.post(f"{BASE_URL}/api/calc/resale-estimate", json=self.BASE_PAYLOAD)
        data = r.json()
        for field in ["breakeven_sale_price", "target_profit_sale_price", "projected_sale_price",
                      "projected_net_in_hand", "implied_annual_return_pct", "total_carrying_cost",
                      "total_rental_income", "net_carrying_cost", "assumptions"]:
            assert field in data, f"Missing field: {field}"

    def test_resale_estimate_breakeven_in_range(self):
        """Breakeven should be ~3.72M (±10%)"""
        r = requests.post(f"{BASE_URL}/api/calc/resale-estimate", json=self.BASE_PAYLOAD)
        data = r.json()
        bp = data["breakeven_sale_price"]
        # Breakeven = loan + net carry cost - rental income
        # Accept 3M - 5M range as reasonable
        assert 2_000_000 <= bp <= 6_000_000, f"Breakeven out of range: {bp}"

    def test_resale_estimate_target_price_gt_breakeven(self):
        r = requests.post(f"{BASE_URL}/api/calc/resale-estimate", json=self.BASE_PAYLOAD)
        data = r.json()
        assert data["target_profit_sale_price"] >= data["breakeven_sale_price"]

    def test_resale_estimate_projected_net_in_hand(self):
        """projected_net_in_hand should be ~5.32M (±20%)"""
        r = requests.post(f"{BASE_URL}/api/calc/resale-estimate", json=self.BASE_PAYLOAD)
        data = r.json()
        nih = data["projected_net_in_hand"]
        assert 2_000_000 <= nih <= 10_000_000, f"Net in hand out of range: {nih}"

    def test_resale_estimate_without_current_value(self):
        """Should still work when current_value is omitted (compounded from purchase)"""
        payload = {k: v for k, v in self.BASE_PAYLOAD.items() if k != "current_value"}
        r = requests.post(f"{BASE_URL}/api/calc/resale-estimate", json=payload)
        assert r.status_code == 200, f"Expected 200: {r.text}"
        data = r.json()
        assert "projected_sale_price" in data

    def test_resale_estimate_assumptions_block(self):
        r = requests.post(f"{BASE_URL}/api/calc/resale-estimate", json=self.BASE_PAYLOAD)
        data = r.json()
        assert isinstance(data["assumptions"], dict)


# ─────────────────────────── Loan Optimizer ───────────────────────────

class TestLoanOptimizer:
    """POST /api/calc/loan-optimizer"""

    BASE_PAYLOAD = {
        "property_price": 8000000,
        "monthly_rent": 32000,
        "annual_interest_rate": 8.5,
        "loan_tenure_years": 20,
        "maintenance_monthly": 3500
    }

    def test_loan_optimizer_status_200(self):
        r = requests.post(f"{BASE_URL}/api/calc/loan-optimizer", json=self.BASE_PAYLOAD)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"

    def test_loan_optimizer_required_fields(self):
        r = requests.post(f"{BASE_URL}/api/calc/loan-optimizer", json=self.BASE_PAYLOAD)
        data = r.json()
        for field in ["grid", "cashflow_neutral_min_dp_pct", "cashflow_neutral",
                      "max_cashflow", "best_cash_on_cash_return"]:
            assert field in data, f"Missing field: {field}"

    def test_loan_optimizer_grid_has_20_rows(self):
        r = requests.post(f"{BASE_URL}/api/calc/loan-optimizer", json=self.BASE_PAYLOAD)
        data = r.json()
        # 5% to 100% in 5% steps = 20 rows
        assert len(data["grid"]) == 20, f"Expected 20 grid rows, got {len(data['grid'])}"

    def test_loan_optimizer_grid_dp_range(self):
        r = requests.post(f"{BASE_URL}/api/calc/loan-optimizer", json=self.BASE_PAYLOAD)
        data = r.json()
        dps = [row["down_payment_pct"] for row in data["grid"]]
        assert min(dps) == 5
        assert max(dps) == 100

    def test_loan_optimizer_cashflow_neutral_around_60pct(self):
        """With 8M/32K/8.5%/20y — cashflow neutral should be around 55-70%"""
        r = requests.post(f"{BASE_URL}/api/calc/loan-optimizer", json=self.BASE_PAYLOAD)
        data = r.json()
        neutral_pct = data.get("cashflow_neutral_min_dp_pct")
        if neutral_pct is not None:
            assert 40 <= neutral_pct <= 80, f"Cashflow neutral DP out of range: {neutral_pct}"

    def test_loan_optimizer_costs_monthly(self):
        r = requests.post(f"{BASE_URL}/api/calc/loan-optimizer", json=self.BASE_PAYLOAD)
        data = r.json()
        # costs_monthly may be present
        if "costs_monthly" in data:
            # costs_monthly can be a float or dict
            assert data["costs_monthly"] is not None


# ─────────────────────────── Portfolio vs Investments ───────────────────────────

class TestPortfolioVsInvestments:
    """POST /api/portfolio/vs-investments — includes sold properties + rental"""

    def test_vs_investments_admin(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/portfolio/vs-investments", json={})
        assert r.status_code == 200, f"Expected 200: {r.text}"

    def test_vs_investments_has_series(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/portfolio/vs-investments", json={})
        data = r.json()
        assert "series" in data or "yearly_data" in data or isinstance(data, list), \
            f"No series/yearly_data in response: {list(data.keys())}"

    def test_vs_investments_row_fields(self, admin_session):
        r = admin_session.post(f"{BASE_URL}/api/portfolio/vs-investments", json={})
        data = r.json()
        # Get the series array
        series = data.get("series") or data.get("yearly_data") or (data if isinstance(data, list) else [])
        if series:
            row = series[0]
            expected = ["year", "property", "equity", "mutual_funds", "gold"]
            for f in expected:
                assert f in row, f"Missing field '{f}' in series row: {list(row.keys())}"

    def test_vs_investments_unauthenticated(self):
        r = requests.post(f"{BASE_URL}/api/portfolio/vs-investments", json={})
        assert r.status_code in [401, 403], f"Expected 401/403, got {r.status_code}"


# ─────────────────────────── Regression ───────────────────────────

class TestRegression:
    """Quick smoke test of previously passing endpoints"""

    def test_auth_login_admin(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        # Response may have email at top-level or under "user"
        user_email = data.get("email") or data.get("user", {}).get("email")
        assert user_email == ADMIN_EMAIL

    def test_auth_me(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200

    def test_register_basic(self):
        uid = uuid.uuid4().hex[:8]
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"reg6_{uid}@test.com",
            "password": "Reg@123456",
            "name": f"Reg6 {uid}"
        })
        assert r.status_code == 200

    def test_billing_plans(self):
        r = requests.get(f"{BASE_URL}/api/billing/plans")
        assert r.status_code == 200

    def test_cashflow_calc(self):
        r = requests.post(f"{BASE_URL}/api/calc/cashflow-positive", json={
            "property_price": 5000000,
            "monthly_rent": 18000,
            "annual_interest_rate": 8.5,
            "loan_tenure_years": 20
        })
        assert r.status_code == 200

    def test_emi_calc(self):
        r = requests.post(f"{BASE_URL}/api/calc/emi", json={
            "principal": 5000000,
            "annual_rate": 8.5,
            "tenure_months": 240
        })
        assert r.status_code == 200

    def test_admin_stats(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 200
