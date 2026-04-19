"""Iteration 14 — Lawyer marketplace + Razorpay LIVE migration.

Covers:
- POST /api/lawyers/register (role=lawyer, verified=false default, 409 duplicate)
- GET /api/lawyers (public, only verified)
- GET /api/lawyers/me + POST /api/lawyers/me (profile update)
- GET /api/lawyers/me/reviews
- Admin: POST /api/admin/lawyers/verify, GET /api/admin/lawyers, 403 for non-admin
- POST /api/will/book-lawyer — order creation with rzp_live key (user must have will draft)
- POST /api/will/book-lawyer/verify — signature mismatch rejection
- POST /api/public/will-review/{token}/endorse — pending => 400
- Billing regression: POST /api/billing/create-order returns key starting rzp_live_
- Regression: demo login + will draft
"""
import os
import time
import uuid
import pytest
import requests

_FRONTEND_ENV = "/app/frontend/.env"
if not os.environ.get("REACT_APP_BACKEND_URL") and os.path.exists(_FRONTEND_ENV):
    for _line in open(_FRONTEND_ENV):
        if _line.startswith("REACT_APP_BACKEND_URL="):
            os.environ["REACT_APP_BACKEND_URL"] = _line.split("=", 1)[1].strip()
            break
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@estima.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
VERIFIED_LAWYER_EMAIL = os.environ.get("VERIFIED_LAWYER_EMAIL", "adv.ravi@estima.com")
VERIFIED_LAWYER_PASSWORD = os.environ.get("VERIFIED_LAWYER_PASSWORD", "Advocate@123")
VERIFIED_LAWYER_ID = os.environ.get("VERIFIED_LAWYER_ID", "69e4f192664052de23481578")
TEST_USER_PASSWORD = os.environ.get("TEST_USER_PASSWORD", "Test@1234")


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=30)
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def lawyer_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login",
               json={"email": VERIFIED_LAWYER_EMAIL, "password": VERIFIED_LAWYER_PASSWORD},
               timeout=20)
    assert r.status_code == 200, f"lawyer login: {r.status_code} {r.text[:300]}"
    return s


@pytest.fixture(scope="module")
def fresh_lawyer_email():
    return f"TEST_lawyer_{uuid.uuid4().hex[:10]}@estima.com"


# ---------------- Lawyer registration ----------------
class TestLawyerRegistration:
    def test_register_returns_role_lawyer(self, fresh_lawyer_email):
        s = requests.Session()
        body = {
            "email": fresh_lawyer_email,
            "password": "LawyerPass@123",
            "name": "TEST Counsel One",
            "bar_council_id": f"BC/{uuid.uuid4().hex[:8]}",
            "rate_inr": 2500,
            "bio": "Test wills & estates counsel",
            "specialization": "Wills & Estates",
        }
        r = s.post(f"{API}/lawyers/register", json=body, timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("role") == "lawyer", f"role != lawyer: {data}"
        assert data.get("email") == fresh_lawyer_email.lower() or data.get("email") == fresh_lawyer_email

        # Cookies set - /api/lawyers/me should work and show verified=false
        me = s.get(f"{API}/lawyers/me", timeout=15)
        assert me.status_code == 200, f"lawyers/me: {me.status_code} {me.text[:300]}"
        body = me.json()
        prof = body.get("profile", body)
        assert prof.get("verified") is False, f"default verified should be False, got {prof}"
        assert prof.get("rate_inr") == 2500

    def test_duplicate_email_409(self, fresh_lawyer_email):
        r = requests.post(f"{API}/lawyers/register",
                          json={"email": fresh_lawyer_email, "password": "AnotherPass@1",
                                "name": "Dup", "bar_council_id": "BC/DUP",
                                "rate_inr": 1000, "bio": "dup"},
                          timeout=20)
        assert r.status_code in (409, 400), f"Expected 409 got {r.status_code}: {r.text[:200]}"


# ---------------- Public lawyers listing ----------------
class TestPublicLawyerList:
    def test_list_only_verified(self):
        r = requests.get(f"{API}/lawyers", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        body = r.json()
        lawyers = body.get("lawyers", [])
        assert isinstance(lawyers, list)
        # Seeded verified Adv Ravi Menon must be present
        ids = [x.get("id") for x in lawyers]
        assert VERIFIED_LAWYER_ID in ids, f"verified lawyer missing from public list: ids={ids[:5]}"
        # platform_fee_pct present
        assert body.get("platform_fee_pct") is not None


# ---------------- Lawyer self-service ----------------
class TestLawyerProfile:
    def test_me_returns_profile(self, lawyer_session):
        r = lawyer_session.get(f"{API}/lawyers/me", timeout=15)
        assert r.status_code == 200
        body = r.json()
        p = body.get("profile", body)
        assert p.get("verified") is True
        assert p.get("rate_inr") == 4000

    def test_update_profile_persists(self, lawyer_session):
        new_bio = f"Updated bio {uuid.uuid4().hex[:6]}"
        r = lawyer_session.post(f"{API}/lawyers/me",
                                json={"rate_inr": 4000, "bio": new_bio, "specialization": "Wills & Trusts"},
                                timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        g = lawyer_session.get(f"{API}/lawyers/me", timeout=15)
        assert g.status_code == 200
        body = g.json()
        p = body.get("profile", body)
        assert p.get("bio") == new_bio
        assert p.get("specialization") == "Wills & Trusts"
        assert p.get("rate_inr") == 4000

    def test_me_reviews_returns_list(self, lawyer_session):
        r = lawyer_session.get(f"{API}/lawyers/me/reviews", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        body = r.json()
        # Accept either list or {"reviews":[...]}
        reviews = body if isinstance(body, list) else body.get("reviews", body)
        assert reviews is not None


# ---------------- Admin endpoints ----------------
class TestAdminLawyers:
    def test_list_all_requires_admin(self, admin_session):
        r = admin_session.get(f"{API}/admin/lawyers", timeout=20)
        assert r.status_code == 200
        body = r.json()
        lawyers = body.get("lawyers", [])
        assert isinstance(lawyers, list)
        ids = [x.get("id") for x in lawyers]
        assert VERIFIED_LAWYER_ID in ids

    def test_non_admin_forbidden(self, demo_session):
        r = demo_session.get(f"{API}/admin/lawyers", timeout=15)
        assert r.status_code == 403, f"Expected 403 got {r.status_code}: {r.text[:200]}"

    def test_verify_toggle(self, admin_session):
        # Create a throwaway lawyer to toggle verify state
        email = f"TEST_verify_{uuid.uuid4().hex[:8]}@estima.com"
        reg = requests.post(f"{API}/lawyers/register",
                            json={"email": email, "password": "Verify@123",
                                  "name": "TEST Verify", "bar_council_id": "BC/VF",
                                  "rate_inr": 1500, "bio": "to be verified"},
                            timeout=20)
        assert reg.status_code == 200
        lid = reg.json().get("id")
        assert lid

        # Flip verified=true
        r = admin_session.post(f"{API}/admin/lawyers/verify",
                               json={"lawyer_id": lid, "verified": True}, timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        assert r.json().get("verified") is True

        # Now appears in public list
        pub = requests.get(f"{API}/lawyers", timeout=15).json()
        assert lid in [x.get("id") for x in pub.get("lawyers", [])]

        # Revoke
        r2 = admin_session.post(f"{API}/admin/lawyers/verify",
                                json={"lawyer_id": lid, "verified": False}, timeout=15)
        assert r2.status_code == 200 and r2.json().get("verified") is False
        pub2 = requests.get(f"{API}/lawyers", timeout=15).json()
        assert lid not in [x.get("id") for x in pub2.get("lawyers", [])]

    def test_non_admin_verify_forbidden(self, demo_session):
        r = demo_session.post(f"{API}/admin/lawyers/verify",
                              json={"lawyer_id": VERIFIED_LAWYER_ID, "verified": True}, timeout=15)
        assert r.status_code == 403


# ---------------- Book lawyer (order creation) ----------------
class TestBookLawyer:
    def _ensure_will(self, session):
        # Try reading will; if none, create minimal draft via POST /api/will (common pattern).
        r = session.get(f"{API}/will", timeout=15)
        if r.status_code == 200 and r.json():
            data = r.json()
            if data and (data.get("executor_name") or data.get("assets") or data.get("beneficiaries")):
                return
        # Draft a minimal will — endpoint often is POST /api/will
        payload = {
            "testator_name": "Demo User",
            "executor_name": "Executor One",
            "beneficiaries": [{"name": "Ben One", "relation": "Son", "share_pct": 100}],
            "assets": [{"kind": "bank", "description": "HDFC sav", "value_inr": 100000}],
        }
        for path in ("/will", "/will/draft", "/will/save"):
            rr = session.post(f"{API}{path}", json=payload, timeout=20)
            if rr.status_code in (200, 201):
                return
        # Fallback: just proceed — the booking endpoint will 404 if no will and we'll detect it.

    def test_book_no_will_returns_404(self):
        # Fresh user with no will
        s = requests.Session()
        email = f"TEST_nobill_{uuid.uuid4().hex[:8]}@estima.com"
        reg = s.post(f"{API}/auth/register",
                     json={"email": email, "password": TEST_USER_PASSWORD, "name": "TEST NoWill"},
                     timeout=20)
        if reg.status_code not in (200, 201):
            pytest.skip(f"register failed {reg.status_code}: {reg.text[:120]}")
        r = s.post(f"{API}/will/book-lawyer",
                   json={"lawyer_id": VERIFIED_LAWYER_ID, "note": "hello"},
                   timeout=20)
        assert r.status_code == 404, f"Expected 404 got {r.status_code}: {r.text[:200]}"

    def test_book_unverified_lawyer_404(self, demo_session):
        self._ensure_will(demo_session)
        r = demo_session.post(f"{API}/will/book-lawyer",
                              json={"lawyer_id": "000000000000000000000000", "note": "x"},
                              timeout=20)
        assert r.status_code == 404, f"Expected 404 got {r.status_code}: {r.text[:200]}"

    def test_book_verified_lawyer_returns_live_key(self, demo_session):
        self._ensure_will(demo_session)
        r = demo_session.post(f"{API}/will/book-lawyer",
                              json={"lawyer_id": VERIFIED_LAWYER_ID, "note": "Please review"},
                              timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("razorpay_key_id", "").startswith("rzp_live_"), f"key not live: {data.get('razorpay_key_id')}"
        assert data.get("amount") == data.get("fee_inr", 4000) * 100
        assert data.get("order_id", "").startswith("order_")
        assert data.get("token")
        # Stash token for signature-mismatch test
        TestBookLawyer._token = data["token"]
        TestBookLawyer._order_id = data["order_id"]

    def test_verify_signature_mismatch(self, demo_session):
        token = getattr(TestBookLawyer, "_token", None)
        order_id = getattr(TestBookLawyer, "_order_id", None)
        if not token:
            pytest.skip("No booking token from previous test")
        r = demo_session.post(f"{API}/will/book-lawyer/verify",
                              json={
                                  "token": token,
                                  "razorpay_order_id": order_id,
                                  "razorpay_payment_id": "pay_FAKE123456",
                                  "razorpay_signature": "deadbeef" * 8,
                              }, timeout=20)
        assert r.status_code == 400, f"Expected 400 got {r.status_code}: {r.text[:200]}"
        assert "signature" in r.text.lower()


# ---------------- Endorse (pending => 400) ----------------
class TestEndorse:
    def test_endorse_pending_review_400(self, demo_session):
        # Create a booking => status pending, then try to endorse
        # Ensure will
        TestBookLawyer()._ensure_will(demo_session)
        r = demo_session.post(f"{API}/will/book-lawyer",
                              json={"lawyer_id": VERIFIED_LAWYER_ID, "note": "endorse pending test"},
                              timeout=30)
        if r.status_code != 200:
            pytest.skip(f"could not create booking: {r.status_code}")
        token = r.json()["token"]
        er = requests.post(f"{API}/public/will-review/{token}/endorse", timeout=15)
        assert er.status_code == 400, f"Expected 400 got {er.status_code}: {er.text[:200]}"

    def test_endorse_invalid_token_404(self):
        r = requests.post(f"{API}/public/will-review/definitely-no-such-token/endorse", timeout=15)
        assert r.status_code == 404


# ---------------- Billing regression ----------------
class TestBilling:
    def test_billing_order_returns_live_key(self, demo_session):
        r = demo_session.post(f"{API}/billing/create-order",
                              json={"plan_id": "monthly"}, timeout=20)
        # If user already pro/demo has pro plan some APIs may 400; accept both but when 200 key must be rzp_live
        if r.status_code == 200:
            data = r.json()
            key = data.get("key_id") or data.get("razorpay_key_id")
            assert key and key.startswith("rzp_live_"), f"Expected rzp_live_ key, got {key}"
        else:
            # Still flag if it's 500
            assert r.status_code < 500, f"billing server error: {r.status_code}: {r.text[:200]}"

    def test_billing_order_pro(self, demo_session):
        r = demo_session.post(f"{API}/billing/create-order",
                              json={"plan_id": "pro"}, timeout=20)
        assert r.status_code < 500, f"billing pro: {r.status_code}: {r.text[:200]}"


# ---------------- Regression smoke ----------------
class TestRegression:
    def test_demo_login_still_works(self):
        r = requests.post(f"{API}/auth/demo-login", timeout=30)
        assert r.status_code == 200

    def test_login_role_lawyer_returns_lawyer_role(self, lawyer_session):
        r = lawyer_session.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json().get("role") == "lawyer"
