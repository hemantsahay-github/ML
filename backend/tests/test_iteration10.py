"""Iteration-10 backend tests — demo-login, Will CRUD+PDF, enhanced calculators.

Covers:
- POST /api/auth/demo-login (idempotent; seeds 4 properties; cookie set)
- GET/POST /api/will (persistence + PDF)
- POST /api/calc/car-vs-property (new schema → xirr)
- POST /api/calc/uc-projection (pre_emi_by_builder)
- POST /api/calc/breakeven-rtm-uc (subvention + xirr_5y_pct)
- POST /api/calc/loan-optimizer (leverage_xirr_pct, best_leverage_xirr, narrative)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-decision-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------
@pytest.fixture(scope="module")
def demo_session():
    """Login as demo user; keeps cookies."""
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text[:200]}"
    return s, r


# -----------------------------------------------------------------------------
# Demo login
# -----------------------------------------------------------------------------
class TestDemoLogin:
    def test_demo_login_creates_user(self, demo_session):
        _, r = demo_session
        data = r.json()
        assert data["email"] == "demo@estima.com"
        # NOTE: is_demo is set in DB but NOT exposed in UserOut response model.
        # Verifying via plan==pro which IS exposed.
        assert data.get("plan") == "pro", f"Expected plan=pro, got {data.get('plan')}"
        assert data.get("is_pro") is True
        # Cookie set
        s, _ = demo_session
        assert "access_token" in s.cookies.get_dict(), f"cookies={s.cookies.get_dict()}"

    def test_demo_login_idempotent(self, demo_session):
        s, r1 = demo_session
        id1 = r1.json()["id"]
        # Second call → same user
        r2 = requests.post(f"{API}/auth/demo-login", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["id"] == id1
        assert r2.json()["email"] == "demo@estima.com"

    def test_demo_properties_seeded(self, demo_session):
        s, _ = demo_session
        r = s.get(f"{API}/properties", timeout=20)
        assert r.status_code == 200
        props = r.json()
        assert isinstance(props, list)
        assert len(props) >= 4, f"Expected 4 seeded properties, got {len(props)}"
        names = " ".join([p.get("name", "") for p in props]).lower()
        for expected in ["prestige", "sarjapur", "indiranagar", "koramangala"]:
            assert expected in names, f"Expected '{expected}' in seeded property names: {names}"


# -----------------------------------------------------------------------------
# Will CRUD + PDF
# -----------------------------------------------------------------------------
class TestWill:
    def test_get_will_empty(self, demo_session):
        s, _ = demo_session
        # Wipe first via save with empty then test? We can't reliably — accept either
        r = s.get(f"{API}/will", timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "exists" in body

    def test_post_will_and_get(self, demo_session):
        s, _ = demo_session
        # Get property ids for allocations
        props = s.get(f"{API}/properties", timeout=20).json()
        assert len(props) > 0
        payload = {
            "testator_name": "Demo Testator",
            "testator_pan": "ABCDE1234F",
            "testator_address": "Bangalore, KA",
            "executor_name": "Demo Executor",
            "executor_relation": "Brother",
            "witness_1": "Witness One",
            "witness_2": "Witness Two",
            "beneficiaries": [
                {"name": "Alice", "relation": "Daughter", "email": "alice@example.com"},
                {"name": "Bob", "relation": "Son", "phone": "+919999999999"},
            ],
            "allocations": [
                {
                    "property_id": props[0]["id"],
                    "splits": [
                        {"beneficiary_index": 0, "percentage": 60},
                        {"beneficiary_index": 1, "percentage": 40},
                    ],
                }
            ],
            "preamble_notes": "Drafted via iteration-10 test.",
        }
        r = s.post(f"{API}/will", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("ok") is True
        will = body.get("will", {})
        assert will.get("testator_name") == "Demo Testator"
        assert len(will.get("beneficiaries", [])) == 2
        assert len(will.get("allocations", [])) == 1

        # GET returns same
        g = s.get(f"{API}/will", timeout=20).json()
        assert g.get("exists") is True
        assert g.get("testator_name") == "Demo Testator"

    def test_will_pdf(self, demo_session):
        s, _ = demo_session
        r = s.get(f"{API}/will/pdf", timeout=30)
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_will_pdf_404_for_nonwill_user(self):
        """Login as a fresh user and ensure PDF 404's."""
        s = requests.Session()
        # Register a fresh user
        import uuid
        email = f"TEST_will_{uuid.uuid4().hex[:8]}@estima.com"
        reg = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass@1234", "name": "TestWill"}, timeout=20)
        assert reg.status_code in (200, 201), reg.text[:200]
        r = s.get(f"{API}/will/pdf", timeout=20)
        assert r.status_code == 404


# -----------------------------------------------------------------------------
# Calculators
# -----------------------------------------------------------------------------
class TestCarVsProperty:
    def test_new_schema(self):
        payload = {
            "car_price": 1500000, "car_dp": 300000, "car_loan_rate": 10.5, "car_loan_tenure_years": 5,
            "car_depreciation_pct": 15.0, "car_running_cost_monthly": 12000, "car_replace_years": 8,
            "property_price": 8000000, "property_dp": 1600000, "property_loan_rate": 8.5,
            "property_loan_tenure_years": 20, "appreciation_pct": 7.0, "monthly_rent": 22000,
            "rent_increase_pct": 7.0, "years": 10,
        }
        r = requests.post(f"{API}/calc/car-vs-property", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        for k in ["car_xirr_pct", "property_xirr_pct", "final_car_net_worth", "final_property_net_worth", "winner", "narrative"]:
            assert k in data, f"missing {k}"
        assert data["winner"] in ("Car", "Property")
        assert isinstance(data["narrative"], list) and len(data["narrative"]) >= 4


class TestUCProjection:
    def test_pre_emi_by_builder(self):
        payload = {
            "purchase_price": 8000000, "down_payment_pct": 20, "loan_rate": 8.5,
            "loan_tenure_years": 20, "possession_months": 36,
            "area_price_inflation_pct": 7.0, "construction_cost_inflation_pct": 6.0,
            "post_possession_boost_pct": 5.0, "disbursement_schedule": "clp",
            "pre_emi_by_builder": True,
        }
        r = requests.post(f"{API}/calc/uc-projection", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data.get("pre_emi_by_builder_total", 0) > 0, data
        # Confirm xirr present
        assert "xirr_pct" in data, f"xirr_pct missing: keys={list(data.keys())}"
        # Compare with pre_emi_by_builder=False - buyer total should be higher
        payload2 = {**payload, "pre_emi_by_builder": False}
        r2 = requests.post(f"{API}/calc/uc-projection", json=payload2, timeout=30)
        assert r2.status_code == 200
        d2 = r2.json()
        assert data.get("pre_emi_by_buyer_total", 0) < d2.get("pre_emi_by_buyer_total", 0), \
            f"builder subvention should reduce buyer's pre-EMI. with={data.get('pre_emi_by_buyer_total')} without={d2.get('pre_emi_by_buyer_total')}"


class TestBreakevenRtmUc:
    def test_subvention_and_xirr(self):
        payload = {
            "rtm_price": 9000000, "uc_price": 8000000,
            "down_payment_pct": 20, "loan_rate": 8.5, "loan_tenure_years": 20,
            "possession_months": 36, "appreciation_pct": 7.0,
            "uc_pre_emi_by_builder": True,
        }
        r = requests.post(f"{API}/calc/breakeven-rtm-uc", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "rtm" in data and "uc" in data
        assert "xirr_5y_pct" in data["rtm"], f"rtm keys={list(data['rtm'].keys())}"
        assert "xirr_5y_pct" in data["uc"], f"uc keys={list(data['uc'].keys())}"
        assert data["uc"].get("pre_emi_by_builder") is True
        assert data.get("winner") in ("RTM", "UC")


class TestLoanOptimizer:
    def test_leverage_xirr(self):
        payload = {
            "property_price": 8000000, "rental_yield_pct": 3.3, "loan_rate": 8.5,
            "loan_tenure_years": 20, "appreciation_pct": 7.0, "analysis_years": 10,
            "under_construction": False,
        }
        r = requests.post(f"{API}/calc/loan-optimizer", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert isinstance(data.get("grid"), list) and len(data["grid"]) > 0
        g0 = data["grid"][0]
        for k in ["leverage_xirr_pct", "leverage_cagr_pct", "net_equity_at_horizon"]:
            assert k in g0, f"missing {k} in grid entry: {list(g0.keys())}"
        assert data.get("best_leverage_xirr") is not None
        assert data.get("analysis_years") == 10
        assert data.get("monthly_rent_used", 0) > 0
        assert isinstance(data.get("narrative"), list)
