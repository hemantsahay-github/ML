"""
Iteration 11 backend tests
- POST /api/auth/demo-login (no body) — UserOut + 4 seeded properties with lowercase 'type'
- POST /api/will/ai-draft  — Claude drafts distribution
- POST /api/listings/generate + GET /api/listings
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://property-decision-4.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def fresh_user_session():
    """A brand new user with NO properties (for the 400-error test)."""
    import uuid as _u
    s = requests.Session()
    email = f"TEST_it11_{_u.uuid4().hex[:8]}@estima.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "Pass@1234", "name": "It11 Tester"}, timeout=30)
    assert r.status_code in (200, 201), f"register failed {r.status_code} {r.text}"
    return s


# ---------- Demo login + seeded properties ----------
class TestDemoLogin:
    def test_demo_login_returns_pro(self):
        r = requests.post(f"{API}/auth/demo-login", timeout=30)
        assert r.status_code == 200
        j = r.json()
        assert j.get("email") == "demo@estima.com"
        # is_pro should be true (plan=pro)
        assert j.get("is_pro") is True or j.get("plan") == "pro"

    def test_demo_seeded_properties(self, demo_session):
        r = demo_session.get(f"{API}/properties", timeout=30)
        assert r.status_code == 200, r.text
        props = r.json()
        assert isinstance(props, list)
        assert len(props) >= 4, f"expected >=4 seeded props, got {len(props)}"
        valid_types = {"flat", "villa", "plot", "commercial", "other"}
        for p in props:
            t = p.get("type")
            assert t is not None, f"property missing 'type': {p.get('name')}"
            assert t == str(t).lower(), f"'type' should be lowercase: {t}"
            assert t in valid_types, f"unexpected type '{t}' on {p.get('name')}"


# ---------- /will/ai-draft ----------
class TestWillAIDraft:
    def test_ai_draft_requires_auth(self):
        r = requests.post(f"{API}/will/ai-draft", json={"family_context": "x"}, timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_ai_draft_no_properties_400(self, fresh_user_session):
        r = fresh_user_session.post(
            f"{API}/will/ai-draft",
            json={"family_context": "Wife and 2 kids", "distribution_style": "equal"},
            timeout=60,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        assert "No properties" in r.text or "distribute" in r.text.lower()

    def test_ai_draft_happy_path(self, demo_session):
        # AI call: allow up to 60s
        r = demo_session.post(
            f"{API}/will/ai-draft",
            json={"family_context": "Wife Priya + 2 children aged 12 and 8", "distribution_style": "equal"},
            timeout=90,
        )
        assert r.status_code == 200, f"status {r.status_code}: {r.text[:400]}"
        j = r.json()
        assert j.get("ok") is True
        benes = j.get("beneficiaries") or []
        allocs = j.get("allocations") or []
        assert len(benes) >= 1, "expected >=1 beneficiary"
        assert isinstance(j.get("reasoning"), str)

        # allocations must reference only user's property IDs
        props = demo_session.get(f"{API}/properties", timeout=30).json()
        owned_ids = {p["id"] for p in props if p.get("status") != "sold"}
        for a in allocs:
            assert a.get("property_id") in owned_ids, f"unknown property_id {a.get('property_id')}"
            total = sum(float(s.get("percentage") or 0) for s in a.get("splits", []))
            # After normalization server ensures ~100
            assert 98 <= total <= 102, f"splits sum {total} not near 100 for {a.get('property_id')}"


# ---------- /listings/generate + /listings ----------
class TestListings:
    def _owned_property_id(self, sess):
        props = sess.get(f"{API}/properties", timeout=30).json()
        owned = [p for p in props if p.get("status") in ("owned", "rented", "self_occupied")]
        if not owned:
            owned = [p for p in props if p.get("status") != "sold"]
        assert owned, "no owned property to list"
        return owned[0]["id"]

    def test_generate_requires_auth(self):
        r = requests.post(f"{API}/listings/generate", json={"property_id": "x", "monthly_rent": 10000}, timeout=30)
        assert r.status_code in (401, 403)

    def test_generate_invalid_property_id_404(self, demo_session):
        r = demo_session.post(
            f"{API}/listings/generate",
            json={"property_id": "does-not-exist-xxx", "monthly_rent": 42000, "use_ai": False},
            timeout=30,
        )
        assert r.status_code == 404, f"got {r.status_code}: {r.text}"

    def test_generate_no_ai(self, demo_session):
        pid = self._owned_property_id(demo_session)
        r = demo_session.post(
            f"{API}/listings/generate",
            json={
                "property_id": pid,
                "monthly_rent": 42000,
                "security_deposit": 100000,
                "furnishing": "semi_furnished",
                "amenities": ["Pool", "Gym"],
                "use_ai": False,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ai_description") is None
        assert isinstance(j.get("title"), str) and len(j["title"]) > 0
        assert "Rent" in j.get("body", "")
        assert isinstance(j.get("links"), list) and len(j["links"]) == 7
        portals = {l["portal"] for l in j["links"]}
        assert {"99acres", "MagicBricks", "Housing.com", "NoBroker", "OLX", "Quikr Homes", "WhatsApp share"} <= portals
        for l in j["links"]:
            assert l["url"].startswith("https://"), f"portal {l['portal']} not https: {l['url']}"
        assert j.get("listing", {}).get("id")

    def test_generate_with_ai(self, demo_session):
        pid = self._owned_property_id(demo_session)
        r = demo_session.post(
            f"{API}/listings/generate",
            json={
                "property_id": pid,
                "monthly_rent": 42000,
                "amenities": ["Pool", "Gym", "Clubhouse"],
                "tenant_preferences": ["family"],
                "use_ai": True,
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        # ai_description can be a string (success) or None (AI failure fallback); we expect string
        assert j.get("ai_description") is not None, "AI description expected"
        assert isinstance(j["ai_description"], str) and len(j["ai_description"]) > 30
        assert len(j.get("links", [])) == 7

    def test_list_my_listings(self, demo_session):
        r = demo_session.get(f"{API}/listings", timeout=30)
        assert r.status_code == 200, r.text
        arr = r.json()
        assert isinstance(arr, list)
        assert len(arr) >= 1  # previous tests created some
        first = arr[0]
        assert "id" in first and "title" in first and "body" in first
        # _id should be excluded
        assert "_id" not in first
