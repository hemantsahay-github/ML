"""Backend tests for Estima — Property Decision Engine"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

TEST_EMAIL = f"TEST_{uuid.uuid4().hex[:8]}@estima.com"
TEST_PASSWORD = "Test@1234"
TEST_NAME = "Test User"

session = requests.Session()  # unauthenticated
auth_session = requests.Session()  # authenticated
no_auth_session = requests.Session()  # always fresh/unauthenticated


# ---- Health ----

def test_health():
    r = session.get(f"{BASE_URL}/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "healthy"


# ---- Auth ----

def test_register():
    r = auth_session.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": TEST_NAME,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == TEST_EMAIL.lower()
    assert "id" in data


def test_register_duplicate_email():
    r = no_auth_session.post(f"{BASE_URL}/api/auth/register", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "name": TEST_NAME,
    })
    assert r.status_code == 400


def test_login():
    r = auth_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == TEST_EMAIL.lower()


def test_login_wrong_password():
    r = no_auth_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": "wrongpass",
    })
    assert r.status_code == 401


def test_me():
    r = auth_session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == TEST_EMAIL.lower()


def test_me_no_auth():
    r = no_auth_session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 401


# ---- Properties ----

prop_id = None


def test_create_property():
    global prop_id
    r = auth_session.post(f"{BASE_URL}/api/properties", json={
        "name": "TEST_Flat Bandra",
        "type": "flat",
        "location": "Bandra, Mumbai",
        "price": 10000000,
        "area_sqft": 900,
        "down_payment": 2000000,
        "loan_rate": 8.5,
        "loan_tenure_years": 20,
        "maintenance_monthly": 5000,
        "property_tax_yearly": 20000,
        "expected_appreciation": 6.0,
        "rental_yield": 3.0,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "TEST_Flat Bandra"
    assert "id" in data
    prop_id = data["id"]


def test_list_properties():
    r = auth_session.get(f"{BASE_URL}/api/properties")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(p["id"] == prop_id for p in data)


def test_update_property():
    r = auth_session.put(f"{BASE_URL}/api/properties/{prop_id}", json={
        "name": "TEST_Flat Bandra Updated",
        "type": "flat",
        "location": "Bandra, Mumbai",
        "price": 11000000,
        "area_sqft": 900,
        "down_payment": 2000000,
        "loan_rate": 8.5,
        "loan_tenure_years": 20,
    })
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "TEST_Flat Bandra Updated"


def test_properties_no_auth():
    r = no_auth_session.get(f"{BASE_URL}/api/properties")
    assert r.status_code == 401


# ---- Calculators ----

def test_calc_emi():
    r = session.post(f"{BASE_URL}/api/calc/emi", json={
        "principal": 8000000,
        "annual_rate": 8.5,
        "tenure_years": 20,
    })
    assert r.status_code == 200
    data = r.json()
    assert "emi" in data
    assert "schedule" in data
    assert len(data["schedule"]) == 20
    assert data["emi"] > 0


def test_calc_rent_vs_buy():
    r = session.post(f"{BASE_URL}/api/calc/rent-vs-buy", json={
        "property_price": 10000000,
        "down_payment": 2000000,
        "loan_rate": 8.5,
        "loan_tenure_years": 20,
        "appreciation": 6.0,
        "monthly_rent": 30000,
        "rent_increase": 7.0,
        "invest_return": 12.0,
        "years": 10,
    })
    assert r.status_code == 200
    data = r.json()
    assert "series" in data
    assert "breakeven_year" in data
    assert len(data["series"]) == 10
    assert "buy_net_worth" in data["series"][0]
    assert "rent_net_worth" in data["series"][0]


def test_calc_investment_compare():
    r = session.post(f"{BASE_URL}/api/calc/investment-compare", json={
        "property_price": 10000000,
        "down_payment": 2000000,
        "loan_rate": 8.5,
        "loan_tenure_years": 20,
        "appreciation": 6.0,
        "rental_yield": 3.0,
        "mf_return": 12.0,
        "equity_return": 15.0,
        "years": 10,
    })
    assert r.status_code == 200
    data = r.json()
    assert "series" in data
    assert "summary" in data
    assert "winner" in data["summary"]
    assert len(data["series"]) == 10
    assert "property" in data["series"][0]
    assert "mutual_funds" in data["series"][0]
    assert "equity" in data["series"][0]


# ---- Compare / Score ----

prop_id2 = None


def test_create_second_property():
    global prop_id2
    r = auth_session.post(f"{BASE_URL}/api/properties", json={
        "name": "TEST_Villa Powai",
        "type": "villa",
        "location": "Powai, Mumbai",
        "price": 15000000,
        "area_sqft": 1500,
        "down_payment": 3000000,
        "loan_rate": 8.5,
        "loan_tenure_years": 20,
        "score_location": 8,
        "score_amenities": 7,
        "score_safety": 9,
        "score_commute": 6,
        "score_resale": 7,
    })
    assert r.status_code == 200
    prop_id2 = r.json()["id"]


def test_compare_score():
    r = auth_session.post(f"{BASE_URL}/api/compare/score", json={
        "property_ids": [prop_id, prop_id2],
        "weights": {
            "location": 0.25,
            "amenities": 0.15,
            "safety": 0.15,
            "commute": 0.15,
            "resale": 0.15,
            "price_value": 0.15,
        }
    })
    assert r.status_code == 200
    data = r.json()
    assert "results" in data
    assert "winner" in data
    assert len(data["results"]) == 2


def test_compare_score_no_auth():
    r = no_auth_session.post(f"{BASE_URL}/api/compare/score", json={
        "property_ids": [prop_id],
        "weights": {}
    })
    assert r.status_code == 401


# ---- AI Advisor ----

def test_advisor_chat():
    r = auth_session.post(f"{BASE_URL}/api/advisor/chat", json={
        "question": "Should I buy a flat in Mumbai or invest in mutual funds?",
    })
    assert r.status_code in [200, 502]  # 502 if LLM key issues
    if r.status_code == 200:
        data = r.json()
        assert "session_id" in data
        assert "reply" in data
        assert len(data["reply"]) > 0


def test_advisor_no_auth():
    r = no_auth_session.post(f"{BASE_URL}/api/advisor/chat", json={
        "question": "Test"
    })
    assert r.status_code == 401


# ---- Logout ----

def test_logout():
    r = auth_session.post(f"{BASE_URL}/api/auth/logout")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_me_after_logout():
    r = auth_session.get(f"{BASE_URL}/api/auth/me")
    # cookies deleted, should be 401
    assert r.status_code == 401


# ---- Cleanup ----

def test_cleanup():
    """Re-login and delete test properties"""
    r = auth_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
    })
    assert r.status_code == 200
    if prop_id:
        auth_session.delete(f"{BASE_URL}/api/properties/{prop_id}")
    if prop_id2:
        auth_session.delete(f"{BASE_URL}/api/properties/{prop_id2}")
