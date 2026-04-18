"""Tests for new P1 features: city presets, CSV/PDF export, shareable links"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN_EMAIL = "admin@estima.com"
ADMIN_PASSWORD = "Admin@123"

auth_session = requests.Session()
no_auth_session = requests.Session()

prop_id1 = None
prop_id2 = None
share_id_created = None


# ---- Setup ----

def test_login_admin():
    r = auth_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASSWORD
    })
    assert r.status_code == 200, f"Login failed: {r.text}"


def test_create_prop1():
    global prop_id1
    r = auth_session.post(f"{BASE_URL}/api/properties", json={
        "name": "TEST_Preset Flat Bandra",
        "type": "flat",
        "location": "Bandra, Mumbai",
        "price": 10000000,
        "area_sqft": 900,
        "score_location": 8,
        "score_amenities": 7,
        "score_safety": 9,
        "score_commute": 6,
        "score_resale": 7,
    })
    assert r.status_code == 200
    prop_id1 = r.json()["id"]


def test_create_prop2():
    global prop_id2
    r = auth_session.post(f"{BASE_URL}/api/properties", json={
        "name": "TEST_Preset Villa Powai",
        "type": "villa",
        "location": "Powai, Mumbai",
        "price": 15000000,
        "area_sqft": 1500,
        "score_location": 7,
        "score_amenities": 8,
        "score_safety": 8,
        "score_commute": 5,
        "score_resale": 8,
    })
    assert r.status_code == 200
    prop_id2 = r.json()["id"]


# ---- City Presets ----

def test_city_presets_public():
    """GET /api/presets/cities should be public (no auth)"""
    r = no_auth_session.get(f"{BASE_URL}/api/presets/cities")
    assert r.status_code == 200
    data = r.json()
    assert "cities" in data
    cities = data["cities"]
    assert len(cities) == 8, f"Expected 8 cities, got {len(cities)}"


def test_city_presets_fields():
    r = no_auth_session.get(f"{BASE_URL}/api/presets/cities")
    data = r.json()
    required = ["city", "avg_price_per_sqft", "expected_appreciation", "rental_yield",
                "avg_monthly_rent_2bhk", "rent_increase", "notes"]
    for city in data["cities"]:
        for field in required:
            assert field in city, f"Missing field {field} in city {city.get('city')}"


def test_city_presets_names():
    r = no_auth_session.get(f"{BASE_URL}/api/presets/cities")
    names = [c["city"] for c in r.json()["cities"]]
    expected = ["Bengaluru", "Mumbai", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"]
    for city in expected:
        assert city in names, f"{city} not found in presets"


# ---- CSV Export ----

def test_export_csv_no_auth():
    r = no_auth_session.post(f"{BASE_URL}/api/compare/export/csv", json={
        "property_ids": ["dummy"], "weights": {}
    })
    assert r.status_code == 401


def test_export_csv():
    r = auth_session.post(f"{BASE_URL}/api/compare/export/csv", json={
        "property_ids": [prop_id1, prop_id2],
        "weights": {"location": 0.25, "amenities": 0.15, "safety": 0.15,
                    "commute": 0.15, "resale": 0.15, "price_value": 0.15}
    })
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    lines = r.text.strip().split("\n")
    assert len(lines) >= 3  # header + 2 properties
    header = lines[0]
    assert "Rank" in header
    assert "Name" in header
    assert "Total Score" in header


# ---- PDF Export ----

def test_export_pdf_no_auth():
    r = no_auth_session.post(f"{BASE_URL}/api/compare/export/pdf", json={
        "property_ids": ["dummy"], "weights": {}
    })
    assert r.status_code == 401


def test_export_pdf():
    r = auth_session.post(f"{BASE_URL}/api/compare/export/pdf", json={
        "property_ids": [prop_id1, prop_id2],
        "weights": {"location": 0.25, "amenities": 0.15, "safety": 0.15,
                    "commute": 0.15, "resale": 0.15, "price_value": 0.15}
    })
    assert r.status_code == 200
    assert "application/pdf" in r.headers.get("content-type", "")
    # Valid PDF starts with %PDF
    assert r.content[:4] == b"%PDF", "Response is not a valid PDF"


# ---- Shares ----

def test_create_share_no_auth():
    r = no_auth_session.post(f"{BASE_URL}/api/shares", json={
        "property_ids": ["dummy"]
    })
    assert r.status_code == 401


def test_create_share():
    global share_id_created
    r = auth_session.post(f"{BASE_URL}/api/shares", json={
        "property_ids": [prop_id1, prop_id2],
        "weights": {"location": 0.25, "amenities": 0.15, "safety": 0.15,
                    "commute": 0.15, "resale": 0.15, "price_value": 0.15},
        "title": "TEST Share Report"
    })
    assert r.status_code == 200
    data = r.json()
    assert "share_id" in data
    assert "url" in data
    assert data["url"].startswith("/share/")
    share_id_created = data["share_id"]


def test_get_share_public():
    """GET /api/shares/{share_id} is public - no auth required"""
    assert share_id_created, "share_id_created not set"
    r = no_auth_session.get(f"{BASE_URL}/api/shares/{share_id_created}")
    assert r.status_code == 200
    data = r.json()
    assert "title" in data
    assert "winner" in data
    assert "results" in data
    assert "properties" in data
    assert "weights" in data
    assert "created_at" in data
    assert "owner_name" in data
    # Must NOT leak user_id or _id
    assert "user_id" not in data, "user_id leaked in public share response"
    assert "_id" not in data, "_id leaked in public share response"


def test_get_share_invalid_id():
    r = no_auth_session.get(f"{BASE_URL}/api/shares/nonexistentid12345")
    assert r.status_code == 404


def test_list_shares_auth():
    r = auth_session.get(f"{BASE_URL}/api/shares")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert any(s["share_id"] == share_id_created for s in data)


def test_list_shares_no_auth():
    r = no_auth_session.get(f"{BASE_URL}/api/shares")
    assert r.status_code == 401


def test_delete_share_non_owner():
    """Another user cannot delete the share"""
    other = requests.Session()
    other_email = f"TEST_{uuid.uuid4().hex[:6]}@estima.com"
    other.post(f"{BASE_URL}/api/auth/register", json={
        "email": other_email, "password": "Test@1234", "name": "Other"
    })
    other.post(f"{BASE_URL}/api/auth/login", json={
        "email": other_email, "password": "Test@1234"
    })
    r = other.delete(f"{BASE_URL}/api/shares/{share_id_created}")
    assert r.status_code == 404, "Non-owner should get 404 when deleting"


def test_delete_share():
    r = auth_session.delete(f"{BASE_URL}/api/shares/{share_id_created}")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_get_share_after_delete():
    r = no_auth_session.get(f"{BASE_URL}/api/shares/{share_id_created}")
    assert r.status_code == 404


# ---- Cleanup ----

def test_cleanup_properties():
    for pid in [prop_id1, prop_id2]:
        if pid:
            auth_session.delete(f"{BASE_URL}/api/properties/{pid}")
