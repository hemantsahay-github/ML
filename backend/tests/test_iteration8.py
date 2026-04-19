"""Iteration 8 backend tests — new calculators + builder-projects directory.

Covers:
  - POST /api/calc/wealth-narrative
  - POST /api/calc/loan-optimizer (under-construction + subvention)
  - POST /api/calc/rent-for-cashflow
  - POST /api/calc/resale-estimate (min/current rent + misc expenses)
  - POST /api/calc/prepayment-analysis
  - GET  /api/builder-projects (filters + cities)
  - POST /api/builder-projects/community (auth)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-decision-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@estima.com"
ADMIN_PASS = "Admin@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_session(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text[:200]}")
    return session


# ---------- Wealth Narrative ----------
class TestWealthNarrative:
    def test_wealth_narrative_basic(self, session):
        body = {
            "property_price": 10000000,
            "down_payment_pct": 20,
            "loan_rate": 8.5,
            "loan_tenure_years": 20,
            "appreciation_pct": 7.0,
            "city_tier": "tier1",
            "monthly_rent_today": 30000,
            "rent_increase_pct": 8.0,
            "alt_return_pct": 12.0,
            "horizon_years": 25,
            "pass_to_generation": True,
            "legacy_bonus_pct": 15.0,
        }
        r = session.post(f"{API}/calc/wealth-narrative", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["winner"] in ("Buy", "Rent")
        assert isinstance(data["series"], list) and len(data["series"]) == 25
        # tier-1 premium applied -> effective appreciation > input
        assert data["tier_premium_applied_pct"] > 0
        assert isinstance(data["narratives"], list) and len(data["narratives"]) >= 4
        assert "final_buy_wealth" in data and "final_rent_wealth" in data
        # crossover may be None when buy never crosses, but key must exist
        assert "crossover_year" in data
        # legacy bonus: enabling should produce a mention in narratives
        legacy_mentioned = any("Generational" in n or "legacy" in n.lower() for n in data["narratives"])
        assert legacy_mentioned

    def test_wealth_narrative_tier3_no_premium(self, session):
        body = {"city_tier": "tier3", "pass_to_generation": False}
        r = session.post(f"{API}/calc/wealth-narrative", json=body)
        assert r.status_code == 200
        data = r.json()
        # tier3 -> negative premium (0.85x)
        assert data["tier_premium_applied_pct"] < 0


# ---------- Loan Optimizer: UC + Subvention ----------
class TestLoanOptimizerUC:
    def _base(self):
        return {
            "property_price": 10000000,
            "monthly_rent": 35000,
            "loan_rate": 8.5,
            "loan_tenure_years": 20,
            "maintenance_monthly": 2000,
            "property_tax_yearly": 12000,
        }

    def test_under_construction_clp(self, session):
        body = {**self._base(), "under_construction": True, "possession_months": 36, "disbursement_schedule": "clp"}
        r = session.post(f"{API}/calc/loan-optimizer", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["under_construction"] is True
        assert data["possession_months"] == 36
        assert data["disbursement_schedule"] == "clp"
        # grid rows must carry pre-EMI fields
        row = next(g for g in data["grid"] if g["down_payment_pct"] == 20)
        assert "pre_emi_total" in row and "pre_emi_monthly" in row
        assert row["pre_emi_total"] > 0
        assert row["pre_emi_monthly"] > 0

    def test_subvention_zeros_pre_emi(self, session):
        body = {
            **self._base(),
            "under_construction": True,
            "possession_months": 36,
            "disbursement_schedule": "clp",
            "subvention_by_builder": True,
        }
        r = session.post(f"{API}/calc/loan-optimizer", json=body)
        assert r.status_code == 200
        data = r.json()
        assert data["subvention_by_builder"] is True
        for g in data["grid"]:
            assert g["pre_emi_total"] == 0
            assert g["pre_emi_monthly"] == 0


# ---------- Rent for Cashflow ----------
class TestRentForCashflow:
    def test_basic(self, session):
        body = {
            "current_value": 8000000,
            "outstanding_loan": 4500000,
            "current_emi": 39000,
            "current_rent": 25000,
            "rent_increase_pct": 8.0,
            "maintenance_monthly": 3000,
            "property_tax_yearly": 12000,
            "target_years_to_positive": 3,
        }
        r = session.post(f"{API}/calc/rent-for-cashflow", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "required_rent_today" in data
        assert "gap_monthly" in data
        assert isinstance(data["trajectory"], list) and len(data["trajectory"]) == 15
        assert "year_cashflow_turns_positive" in data
        # required rent today should be less than required at target year (due to rent inflation)
        assert data["required_rent_today"] < data["required_rent_at_target_year"]


# ---------- Resale estimate with min/current rent + misc ----------
class TestResaleEstimate:
    def test_avg_rent_from_min_current(self, session):
        body = {
            "purchase_price": 8000000,
            "current_value": 12000000,
            "outstanding_loan": 3000000,
            "years_held": 5,
            "maintenance_monthly": 2500,
            "property_tax_yearly": 10000,
            "min_rent_monthly": 20000,
            "current_rent_monthly": 30000,
            "misc_expenses_inr": 200000,
            "broker_fee_pct": 1.0,
            "ltcg_pct": 20.0,
            "target_profit_inr": 500000,
        }
        r = session.post(f"{API}/calc/resale-estimate", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        # avg of 20000 + 30000 = 25000
        assert data["average_rent_used"] == 25000
        assert data["misc_expenses"] == 200000
        # carrying cost should include misc (200000) + (2500 + 10000/12)*12*5
        base_carry = (2500 + 10000 / 12) * 12 * 5
        assert abs(data["total_carrying_cost"] - (base_carry + 200000)) < 1.0


# ---------- Prepayment Analysis ----------
class TestPrepayment:
    def test_four_scenarios(self, session):
        body = {
            "outstanding_loan": 4500000,
            "loan_rate": 8.5,
            "remaining_tenure_years": 15,
            "current_emi": 44300,
            "surplus_amount": 1000000,
            "alt_invest_return_pct": 12.0,
            "rental_income_monthly": 30000,
            "maintenance_monthly": 2000,
            "property_tax_yearly": 12000,
        }
        r = session.post(f"{API}/calc/prepayment-analysis", json=body)
        assert r.status_code == 200, r.text
        data = r.json()
        ids = [s["id"] for s in data["scenarios"]]
        assert ids == ["part", "full", "invest", "part_plus_invest_savings"]
        assert data["winner"] in ids
        assert isinstance(data["winner_name"], str)
        assert "current_monthly_cashflow" in data


# ---------- Builder Projects ----------
class TestBuilderProjects:
    def test_list_all(self, session):
        r = session.get(f"{API}/builder-projects")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] >= 15
        assert isinstance(data["cities"], list) and len(data["cities"]) >= 7
        assert isinstance(data["projects"], list)

    def test_city_filter_bengaluru(self, session):
        r = session.get(f"{API}/builder-projects", params={"city": "Bengaluru"})
        assert r.status_code == 200
        data = r.json()
        # Curated dataset has 3 Bengaluru projects. Community submissions may add more; ensure at least 3.
        bengaluru_count = sum(1 for p in data["projects"] if p["city"] == "Bengaluru")
        assert bengaluru_count >= 3
        assert data["count"] == bengaluru_count

    def test_area_filter_whitefield(self, session):
        r = session.get(f"{API}/builder-projects", params={"area": "whitefield"})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] >= 1
        for p in data["projects"]:
            assert "whitefield" in p["area"].lower()

    def test_community_submit_requires_auth(self, session):
        # Use fresh unauthenticated session
        s = requests.Session()
        r = s.post(f"{API}/builder-projects/community", json={
            "city": "Bengaluru", "area": "TestArea", "name": "TestProj", "builder": "TestBuilder"
        })
        assert r.status_code in (401, 403)

    def test_community_submit_authenticated(self, auth_session):
        payload = {
            "city": "Bengaluru", "area": "TEST_Area", "name": "TEST_Project_IT8",
            "builder": "TEST Builder", "status": "Upcoming", "possession": "2028-03",
            "config": "3 BHK", "price_from_inr": 15000000, "price_per_sqft": 9000,
            "highlight": "Test submission from iteration-8", "rera_id": "TEST/RERA/001"
        }
        r = auth_session.post(f"{API}/builder-projects/community", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("id", "").startswith("u-")
        assert data["name"] == "TEST_Project_IT8"
        assert "_id" not in data
        # Verify it shows up in the list
        r2 = auth_session.get(f"{API}/builder-projects")
        assert r2.status_code == 200
        names = [p["name"] for p in r2.json()["projects"]]
        assert "TEST_Project_IT8" in names
