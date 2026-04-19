"""
Portfolio & ownership tracking tests - iteration 3
Tests: property status fields, status filtering, portfolio summary math, regression
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@estima.com")
ADMIN_PASS = os.environ.get("ADMIN_PASSWORD", "Admin@123")


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return s


# ── Auth ──────────────────────────────────────────────────────────────────────
class TestAuth:
    def test_portfolio_summary_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/portfolio/summary")
        assert r.status_code == 401

    def test_login_success(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ── Property model new fields ─────────────────────────────────────────────────
class TestPropertyOwnershipFields:
    created_id = None

    def test_create_evaluating_property_defaults(self, session):
        r = session.post(f"{BASE_URL}/api/properties", json={
            "name": "TEST_Evaluating Simple",
            "type": "flat",
            "price": 5000000,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "evaluating"
        assert d["rented"] == False
        assert d["monthly_rent_income"] == 0.0
        assert d["purchase_price"] is None
        assert d["current_value"] is None
        TestPropertyOwnershipFields.created_id = d["id"]

    def test_create_owned_property_with_fields(self, session):
        r = session.post(f"{BASE_URL}/api/properties", json={
            "name": "TEST_Owned Full Fields",
            "type": "flat",
            "price": 7500000,
            "down_payment": 1500000,
            "loan_rate": 8.5,
            "loan_tenure_years": 20,
            "maintenance_monthly": 3500,
            "status": "owned",
            "purchase_date": "2022-01-15",
            "purchase_price": 7500000,
            "current_value": 9500000,
            "current_loan_balance": 4800000,
            "monthly_rent_income": 32000,
            "rented": True,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "owned"
        assert d["purchase_price"] == 7500000
        assert d["current_value"] == 9500000
        assert d["current_loan_balance"] == 4800000
        assert d["monthly_rent_income"] == 32000
        assert d["rented"] == True
        assert d["purchase_date"] == "2022-01-15"
        TestPropertyOwnershipFields.owned_id = d["id"]

    def test_update_property_status_to_owned(self, session):
        pid = TestPropertyOwnershipFields.created_id
        r = session.put(f"{BASE_URL}/api/properties/{pid}", json={
            "name": "TEST_Evaluating Simple",
            "type": "flat",
            "price": 5000000,
            "status": "owned",
            "purchase_price": 5000000,
            "current_value": 5500000,
        })
        assert r.status_code == 200
        assert r.json()["status"] == "owned"


# ── Status filter ─────────────────────────────────────────────────────────────
class TestStatusFilter:
    def test_get_all_properties(self, session):
        r = session.get(f"{BASE_URL}/api/properties")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # all items should have status field
        for p in items:
            assert p.get("status") in ("evaluating", "owned")

    def test_filter_owned(self, session):
        r = session.get(f"{BASE_URL}/api/properties?status=owned")
        assert r.status_code == 200
        items = r.json()
        for p in items:
            assert p["status"] == "owned"

    def test_filter_evaluating(self, session):
        r = session.get(f"{BASE_URL}/api/properties?status=evaluating")
        assert r.status_code == 200
        items = r.json()
        for p in items:
            assert p.get("status", "evaluating") == "evaluating"


# ── Portfolio summary ─────────────────────────────────────────────────────────
class TestPortfolioSummary:
    def test_portfolio_summary_returns_correct_schema(self, session):
        r = session.get(f"{BASE_URL}/api/portfolio/summary")
        assert r.status_code == 200
        d = r.json()
        required_keys = [
            "count", "total_current_value", "total_purchase_cost",
            "total_equity", "total_loan_balance", "total_appreciation_pct",
            "total_appreciation_inr", "net_monthly_cashflow",
            "total_monthly_rent", "total_monthly_emi",
            "total_monthly_maintenance", "items"
        ]
        for k in required_keys:
            assert k in d, f"Missing key: {k}"

    def test_portfolio_items_schema(self, session):
        r = session.get(f"{BASE_URL}/api/portfolio/summary")
        assert r.status_code == 200
        d = r.json()
        for item in d["items"]:
            for k in ["id", "name", "type", "location", "purchase_price",
                      "current_value", "loan_balance", "equity",
                      "appreciation_pct", "emi", "monthly_rent",
                      "monthly_cashflow", "rented"]:
                assert k in item, f"Item missing key: {k}"

    def test_portfolio_math_for_owned_property(self, session):
        """
        For property: purchase_price=7500000, current_value=9500000,
        current_loan_balance=4800000, price=7500000, down_payment=1500000,
        loan_rate=8.5%, loan_tenure_years=20, monthly_rent_income=32000, rented=True, maintenance=3500
        Expected: equity=4700000, appreciation_pct≈26.67, emi≈52069.39, cashflow≈-23569.39
        """
        # Create fresh owned property for math test
        r = session.post(f"{BASE_URL}/api/properties", json={
            "name": "TEST_Math Check",
            "type": "flat",
            "price": 7500000,
            "down_payment": 1500000,
            "loan_rate": 8.5,
            "loan_tenure_years": 20,
            "maintenance_monthly": 3500,
            "status": "owned",
            "purchase_price": 7500000,
            "current_value": 9500000,
            "current_loan_balance": 4800000,
            "monthly_rent_income": 32000,
            "rented": True,
        })
        assert r.status_code == 200
        pid = r.json()["id"]

        # Get portfolio summary and find this item
        sr = session.get(f"{BASE_URL}/api/portfolio/summary")
        assert sr.status_code == 200
        data = sr.json()
        item = next((i for i in data["items"] if i["id"] == pid), None)
        assert item is not None, "Created owned property not found in portfolio"

        assert item["equity"] == pytest.approx(4700000, rel=0.01)
        assert item["appreciation_pct"] == pytest.approx(26.67, rel=0.01)
        assert item["emi"] == pytest.approx(52069.39, rel=0.01)
        assert item["monthly_cashflow"] == pytest.approx(-23569.39, rel=0.02)

        # cleanup
        session.delete(f"{BASE_URL}/api/properties/{pid}")

    def test_portfolio_summary_count_positive(self, session):
        r = session.get(f"{BASE_URL}/api/portfolio/summary")
        d = r.json()
        assert d["count"] == len(d["items"])


# ── Regression: no owned fields still works ───────────────────────────────────
class TestRegression:
    def test_create_property_without_owned_fields(self, session):
        r = session.post(f"{BASE_URL}/api/properties", json={
            "name": "TEST_Regression Simple",
            "type": "villa",
            "price": 8000000,
            "area_sqft": 2000,
        })
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "evaluating"
        # cleanup
        session.delete(f"{BASE_URL}/api/properties/{d['id']}")

    def test_compare_score_flow(self, session):
        # get evaluating properties
        r = session.get(f"{BASE_URL}/api/properties?status=evaluating")
        items = r.json()
        if len(items) < 2:
            pytest.skip("Need at least 2 evaluating properties to test compare")
        ids = [p["id"] for p in items[:2]]
        r2 = session.post(f"{BASE_URL}/api/compare/score", json={"property_ids": ids})
        assert r2.status_code == 200
        assert "results" in r2.json()

    def test_cleanup_test_properties(self, session):
        r = session.get(f"{BASE_URL}/api/properties")
        for p in r.json():
            if p["name"].startswith("TEST_"):
                session.delete(f"{BASE_URL}/api/properties/{p['id']}")
