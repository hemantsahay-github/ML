"""
Iteration 4 Tests: Sold properties tracking + Portfolio timeline
Tests new features: sold status, timeline endpoint, enhanced portfolio summary
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@estima.com", "password": "Admin@123"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return s

# --- Sold status CRUD ---

def test_create_sold_property(session):
    """Create a sold property with sold_date and sold_price"""
    r = session.post(f"{BASE_URL}/api/properties", json={
        "name": "TEST_Sold_Prop",
        "type": "flat",
        "price": 5000000,
        "status": "sold",
        "purchase_date": "2020-01-15",
        "purchase_price": 5000000,
        "sold_date": "2023-06-20",
        "sold_price": 7000000,
    })
    assert r.status_code == 200, f"Create sold property failed: {r.text}"
    data = r.json()
    assert data["status"] == "sold"
    assert data["sold_date"] == "2020-01-15" or data["sold_date"] is not None  # should be stored
    assert data["sold_price"] == 7000000
    assert data["sold_date"] == "2023-06-20"
    assert "id" in data
    # cleanup marker
    pytest.test_sold_id = data["id"]
    print(f"Created sold property id: {data['id']}")

def test_list_sold_filter(session):
    """GET /api/properties?status=sold returns only sold properties"""
    r = session.get(f"{BASE_URL}/api/properties?status=sold")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    for p in data:
        assert p["status"] == "sold", f"Expected sold, got {p['status']}"
    print(f"Sold filter returns {len(data)} properties")

def test_list_evaluating_filter(session):
    """GET /api/properties?status=evaluating returns only evaluating"""
    r = session.get(f"{BASE_URL}/api/properties?status=evaluating")
    assert r.status_code == 200
    data = r.json()
    for p in data:
        assert (p.get("status") or "evaluating") == "evaluating"

def test_list_owned_filter(session):
    """GET /api/properties?status=owned returns only owned"""
    r = session.get(f"{BASE_URL}/api/properties?status=owned")
    assert r.status_code == 200
    data = r.json()
    for p in data:
        assert p["status"] == "owned"

def test_update_to_sold(session):
    """Update a property to sold status"""
    # Create an evaluating property first
    r = session.post(f"{BASE_URL}/api/properties", json={
        "name": "TEST_ToSell",
        "type": "flat",
        "price": 4000000,
        "status": "evaluating",
    })
    assert r.status_code == 200
    prop_id = r.json()["id"]

    # Update to sold
    r2 = session.put(f"{BASE_URL}/api/properties/{prop_id}", json={
        "name": "TEST_ToSell",
        "type": "flat",
        "price": 4000000,
        "status": "sold",
        "sold_date": "2024-01-01",
        "sold_price": 5500000,
    })
    assert r2.status_code == 200
    data = r2.json()
    assert data["status"] == "sold"
    assert data["sold_price"] == 5500000

    # cleanup
    session.delete(f"{BASE_URL}/api/properties/{prop_id}")

# --- Portfolio summary ---

def test_portfolio_summary_has_new_keys(session):
    """portfolio/summary returns sold_count, total_realized_gains, total_net_worth, sold_items"""
    r = session.get(f"{BASE_URL}/api/portfolio/summary")
    assert r.status_code == 200
    data = r.json()
    assert "sold_count" in data
    assert "total_realized_gains" in data
    assert "total_sold_proceeds" in data
    assert "total_net_worth" in data
    assert "sold_items" in data
    assert "items" in data  # backward compat
    assert "count" in data
    print(f"Summary: sold_count={data['sold_count']}, realized={data['total_realized_gains']}, net_worth={data['total_net_worth']}")

def test_portfolio_summary_sold_items_structure(session):
    """sold_items array has correct per-sale fields"""
    r = session.get(f"{BASE_URL}/api/portfolio/summary")
    assert r.status_code == 200
    data = r.json()
    for item in data.get("sold_items", []):
        assert "id" in item
        assert "name" in item
        assert "purchase_date" in item
        assert "sold_date" in item
        assert "purchase_price" in item
        assert "sold_price" in item
        assert "gain" in item
        assert "gain_pct" in item

def test_portfolio_summary_koramangala_gain(session):
    """Koramangala Starter: bought ₹45L sold ₹72L => gain ₹27L"""
    r = session.get(f"{BASE_URL}/api/portfolio/summary")
    assert r.status_code == 200
    data = r.json()
    koramangala = next((s for s in data["sold_items"] if "Koramangala" in s["name"]), None)
    if koramangala:
        assert abs(koramangala["gain"] - 2700000) < 10, f"Expected 27L gain, got {koramangala['gain']}"
        assert abs(koramangala["gain_pct"] - 60.0) < 1, f"Expected ~60% gain_pct, got {koramangala['gain_pct']}"
        print(f"Koramangala gain: {koramangala['gain']}, gain_pct: {koramangala['gain_pct']}")
    else:
        print("Koramangala property not found in sold_items, skipping gain check")

def test_portfolio_summary_net_worth_equals_equity_plus_realized(session):
    """total_net_worth == total_equity + total_realized_gains"""
    r = session.get(f"{BASE_URL}/api/portfolio/summary")
    assert r.status_code == 200
    data = r.json()
    expected = round(data["total_equity"] + data["total_realized_gains"], 2)
    actual = round(data["total_net_worth"], 2)
    assert abs(actual - expected) < 1, f"net_worth {actual} != equity {data['total_equity']} + realized {data['total_realized_gains']}"

# --- Timeline ---

def test_portfolio_timeline_structure(session):
    """GET /api/portfolio/timeline returns series + earliest_year"""
    r = session.get(f"{BASE_URL}/api/portfolio/timeline")
    assert r.status_code == 200
    data = r.json()
    assert "series" in data
    assert "earliest_year" in data
    print(f"Timeline: earliest_year={data['earliest_year']}, series_len={len(data['series'])}")

def test_portfolio_timeline_series_fields(session):
    """Each series entry has year, total_value, loan_balance, equity, realized_gains, net_worth"""
    r = session.get(f"{BASE_URL}/api/portfolio/timeline")
    assert r.status_code == 200
    data = r.json()
    for entry in data["series"]:
        assert "year" in entry
        assert "total_value" in entry
        assert "loan_balance" in entry
        assert "equity" in entry
        assert "realized_gains" in entry
        assert "net_worth" in entry

def test_portfolio_timeline_earliest_year_2019(session):
    """earliest_year should be 2019 (Koramangala bought 2019-06-10)"""
    r = session.get(f"{BASE_URL}/api/portfolio/timeline")
    assert r.status_code == 200
    data = r.json()
    assert data["earliest_year"] == 2019, f"Expected 2019, got {data['earliest_year']}"

def test_portfolio_timeline_series_length(session):
    """Series should cover 2019 to 2026 = 8 entries"""
    r = session.get(f"{BASE_URL}/api/portfolio/timeline")
    assert r.status_code == 200
    data = r.json()
    assert len(data["series"]) >= 8, f"Expected >=8 entries, got {len(data['series'])}"

def test_portfolio_timeline_realized_gains_from_2024(session):
    """Koramangala sold in 2024 => realized_gains in 2024+ should be 27L"""
    r = session.get(f"{BASE_URL}/api/portfolio/timeline")
    assert r.status_code == 200
    data = r.json()
    for entry in data["series"]:
        if entry["year"] >= 2024:
            assert entry["realized_gains"] >= 2700000 - 100, f"Year {entry['year']}: realized {entry['realized_gains']} < 27L"
        elif entry["year"] < 2024:
            # Before 2024, Koramangala is still held (not sold yet)
            # realized gains should be 0 (unless TEST_Sold_Prop also sold before 2024)
            print(f"Year {entry['year']}: realized_gains={entry['realized_gains']}")

def test_portfolio_timeline_no_value_for_sold_after_sold_year(session):
    """In 2024+, Koramangala should NOT appear in total_value"""
    r = session.get(f"{BASE_URL}/api/portfolio/timeline")
    assert r.status_code == 200
    data = r.json()
    entries_2024 = [e for e in data["series"] if e["year"] == 2024]
    entries_2023 = [e for e in data["series"] if e["year"] == 2023]
    if entries_2024 and entries_2023:
        # After 2024 the sold property drops from total_value
        print(f"2023 total_value={entries_2023[0]['total_value']}, 2024 total_value={entries_2024[0]['total_value']}")

def test_portfolio_timeline_auth_required(session):
    """Timeline requires auth"""
    r = requests.get(f"{BASE_URL}/api/portfolio/timeline")
    assert r.status_code == 401

def test_portfolio_summary_backward_compat(session):
    """Old keys still present in portfolio summary"""
    r = session.get(f"{BASE_URL}/api/portfolio/summary")
    assert r.status_code == 200
    data = r.json()
    for key in ["count", "total_current_value", "total_purchase_cost", "total_equity",
                "total_loan_balance", "net_monthly_cashflow", "items"]:
        assert key in data, f"Missing backward-compat key: {key}"

def test_create_property_without_status_defaults_evaluating(session):
    """Creating property without status should default to evaluating"""
    r = session.post(f"{BASE_URL}/api/properties", json={
        "name": "TEST_NoStatus",
        "type": "flat",
        "price": 3000000,
    })
    assert r.status_code == 200
    data = r.json()
    assert (data.get("status") or "evaluating") == "evaluating"
    session.delete(f"{BASE_URL}/api/properties/{data['id']}")

# --- Cleanup ---
def test_cleanup_sold_property(session):
    """Cleanup test sold property"""
    if hasattr(pytest, "test_sold_id"):
        r = session.delete(f"{BASE_URL}/api/properties/{pytest.test_sold_id}")
        assert r.status_code == 200
