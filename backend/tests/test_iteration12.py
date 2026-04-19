"""Iteration 12 tests: market data, aadhaar stub, will lawyer/witness/notify flows."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-decision-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


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


# ---------------- Regression: demo login + properties ----------------
class TestRegression:
    def test_demo_login_and_me(self, demo_session, me):
        assert me.get("is_demo") is True
        assert me.get("email")

    def test_properties_lists_demo_props(self, demo_session):
        r = demo_session.get(f"{API}/properties", timeout=15)
        assert r.status_code == 200
        data = r.json()
        # Expect list (wrapped or bare)
        props = data if isinstance(data, list) else data.get("properties", [])
        assert isinstance(props, list)
        assert len(props) >= 4, f"Expected >=4 demo properties, got {len(props)}"

    def test_calc_endpoint_responds(self, demo_session):
        # Known calc endpoint — just ensure 200/4xx not 500
        r = demo_session.post(f"{API}/calc/emi", json={"principal": 5000000, "rate": 8.5, "years": 20}, timeout=15)
        assert r.status_code < 500, f"Calc 5xx: {r.status_code} {r.text[:200]}"


# ---------------- Market data ----------------
class TestMarket:
    def test_nearby_no_filter(self, demo_session):
        r = demo_session.get(f"{API}/market/nearby", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "rows" in d and "summary" in d and "cities" in d
        assert isinstance(d["cities"], list) and len(d["cities"]) > 0

    def test_nearby_with_city(self, demo_session):
        # Pull a real city first
        cities = demo_session.get(f"{API}/market/nearby", timeout=15).json().get("cities", [])
        if not cities:
            pytest.skip("No curated market cities")
        city = cities[0]
        r = demo_session.get(f"{API}/market/nearby", params={"city": city, "type": "flat"}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["summary"] is not None
        assert d["summary"]["rent_avg"] > 0
        assert d["summary"]["psf_avg"] > 0
        assert d["summary"]["sample_size"] == len(d["rows"])

    def test_contribute(self, demo_session):
        payload = {"city": "TestCity", "area": "TEST_area", "type": "flat", "bhk": "2BHK", "rent_avg": 40000, "psf_avg": 8000}
        r = demo_session.post(f"{API}/market/contribute", json=payload, timeout=15)
        assert r.status_code == 200, r.text[:200]
        row = r.json()["row"]
        assert row["city"] == "TestCity"
        assert row["rent_min"] > 0 and row["psf_max"] > 0
        # Confirm persisted
        r2 = demo_session.get(f"{API}/market/nearby", params={"city": "TestCity"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["summary"]["sample_size"] >= 1


# ---------------- Aadhaar stub ----------------
class TestAadhaar:
    def test_initiate_validation(self, demo_session):
        r = demo_session.post(f"{API}/verify/aadhaar/initiate", json={
            "subject_type": "self", "subject_id": "self", "aadhaar_last_4": "abcd", "phone": "9999999999", "name": "T"
        }, timeout=15)
        assert r.status_code == 400

    def test_initiate_and_confirm_self(self, demo_session):
        r = demo_session.post(f"{API}/verify/aadhaar/initiate", json={
            "subject_type": "self", "subject_id": "self", "aadhaar_last_4": "1234", "phone": "9999999999", "name": "Demo"
        }, timeout=15)
        assert r.status_code == 200, r.text[:200]
        txn = r.json()["txn_id"]
        # Wrong OTP length
        r2 = demo_session.post(f"{API}/verify/aadhaar/confirm", json={"txn_id": txn, "otp": "12"}, timeout=15)
        assert r2.status_code == 400
        # Accept any 6-digit
        r3 = demo_session.post(f"{API}/verify/aadhaar/confirm", json={"txn_id": txn, "otp": "123456"}, timeout=15)
        assert r3.status_code == 200, r3.text[:200]
        d = r3.json()
        assert d["verified"] is True
        assert d["aadhaar_last_4"] == "1234"

    def test_tenant_aadhaar_flow(self, demo_session):
        # Need property_id first
        props = demo_session.get(f"{API}/properties", timeout=15).json()
        plist = props if isinstance(props, list) else props.get("properties", [])
        if not plist:
            pytest.skip("no properties")
        pid = plist[0]["id"]
        tr = demo_session.post(f"{API}/tenants", json={
            "property_id": pid, "name": "TEST_Tenant_Aadhaar", "phone": "9876543210",
            "email": "TEST_tenant@example.com", "deposit": 60000
        }, timeout=15)
        if tr.status_code not in (200, 201):
            pytest.skip(f"Tenant create failed: {tr.status_code} {tr.text[:200]}")
        tenant = tr.json()
        tenant_id = tenant.get("id") or tenant.get("tenant", {}).get("id")
        if not tenant_id:
            pytest.skip(f"No tenant id returned: {tenant}")
        # Initiate
        r = demo_session.post(f"{API}/verify/aadhaar/initiate", json={
            "subject_type": "tenant", "subject_id": tenant_id, "aadhaar_last_4": "5678",
            "phone": "9876543210", "name": "TEST_Tenant_Aadhaar"
        }, timeout=15)
        assert r.status_code == 200, r.text[:200]
        txn = r.json()["txn_id"]
        # Confirm
        r2 = demo_session.post(f"{API}/verify/aadhaar/confirm", json={"txn_id": txn, "otp": "654321"}, timeout=15)
        assert r2.status_code == 200
        # Verify tenant reflects
        tl = demo_session.get(f"{API}/tenants", timeout=15).json()
        tlist = tl if isinstance(tl, list) else tl.get("tenants", [])
        found = next((t for t in tlist if t.get("id") == tenant_id), None)
        assert found is not None, "tenant not found in list"
        assert found.get("aadhaar_verified") is True
        assert found.get("aadhaar_last_4") == "5678"


# ---------------- Will lawyer/witness/notify ----------------
@pytest.fixture(scope="module")
def will_created(demo_session):
    # Try to create minimal will
    payload = {
        "testator_name": "Demo Testator",
        "testator_pan": "ABCDE1234F",
        "testator_address": "123 Test St",
        "executor_name": "Exec One",
        "executor_relation": "friend",
        "beneficiaries": [
            {"name": "Alice", "relation": "spouse", "email": "alice@example.com", "phone": "9000000001"},
            {"name": "Bob", "relation": "son", "email": "bob@example.com", "phone": "9000000002"},
        ],
        "allocations": [],
        "preamble_notes": "",
        "witness_1": "W1 name",
        "witness_2": "W2 name",
    }
    r = demo_session.post(f"{API}/will", json=payload, timeout=15)
    return r.status_code in (200, 201)


class TestWill:
    def test_lawyer_review(self, demo_session, will_created):
        if not will_created:
            pytest.skip("Will draft endpoint unavailable")
        r = demo_session.post(f"{API}/will/send-for-lawyer-review", json={
            "lawyer_name": "Adv. Test", "lawyer_email": "lawyer@example.com", "lawyer_phone": "9000000000", "note": "please review"
        }, timeout=20)
        assert r.status_code == 200, r.text[:300]
        token = r.json()["token"]
        assert token
        # public endpoint
        p = requests.get(f"{API}/public/will-review/{token}", timeout=15)
        assert p.status_code == 200, p.text[:200]
        assert p.json()["will"]["testator_name"] == "Demo Testator"
        # submit review
        s = requests.post(f"{API}/public/will-review/{token}/submit", json={"status": "reviewed", "comments": "LGTM"}, timeout=15)
        assert s.status_code == 200
        # Check signatures endpoint
        sig = demo_session.get(f"{API}/will/signatures", timeout=15)
        assert sig.status_code == 200
        assert sig.json()["lawyer_review_status"] == "reviewed"

    def test_witness_invite_and_sign(self, demo_session, will_created):
        if not will_created:
            pytest.skip("Will not created")
        r = demo_session.post(f"{API}/will/invite-witness", json={
            "witness_index": 0, "witness_name": "Wit One", "witness_email": "wit1@example.com", "witness_phone": "9111111111"
        }, timeout=15)
        assert r.status_code == 200, r.text[:300]
        token = r.json()["token"]
        # GET public
        g = requests.get(f"{API}/public/witness-sign/{token}", timeout=15)
        assert g.status_code == 200
        d = g.json()
        assert "witness" in d and "will_summary" in d
        # POST sign
        p = requests.post(f"{API}/public/witness-sign/{token}",
                          json={"aadhaar_last_4": "4321", "otp": "123456"}, timeout=15)
        assert p.status_code == 200
        assert p.json()["signed"] is True
        # 400 on bad otp
        p2 = requests.post(f"{API}/public/witness-sign/{token}",
                           json={"aadhaar_last_4": "4321", "otp": "12"}, timeout=15)
        assert p2.status_code == 400

    def test_notify_beneficiaries(self, demo_session, will_created):
        if not will_created:
            pytest.skip("Will not created")
        r = demo_session.post(f"{API}/will/notify-beneficiaries",
                              json={"personal_note": "Please keep safe", "cc_lawyer": True}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["ok"] is True
        assert d["count"] >= 1
        assert d["review_due_at"]
