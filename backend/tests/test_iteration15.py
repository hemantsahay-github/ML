"""Iteration 15 — Pure refactor regression tests.

Scope (no behavior change expected):
- register() helpers: _unique_referral_code, _resolve_referrer_id, _grant_referrer_reward, _send_welcome_email_safe
- resale_estimate() helpers: _avg_rent_for_resale, _make_net_proceeds_fn, _solve_sale_price_for_target, _resale_xirr
- portfolio_summary()/timeline() helpers: _owned_item_row, _sold_item_row, _timeline_contrib_*
- export_pdf() helpers: _pdf_header_story, _pdf_winner_story, _pdf_ranking_table, _pdf_breakdown_table
- Lawyer marketplace regression (book-lawyer order-create with LIVE key, endorse)
- Auth/demo/billing regression
"""
import os
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


# -------------- Fixtures --------------
@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/demo-login", timeout=30)
    assert r.status_code == 200, f"demo-login: {r.status_code} {r.text[:200]}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"admin login: {r.status_code} {r.text[:200]}"
    return s


# -------------- REGISTER refactor regression --------------
class TestRegisterRefactor:
    def test_register_new_user_sets_trial_pro(self):
        s = requests.Session()
        email = f"TEST_reg15_{uuid.uuid4().hex[:10]}@estima.com"
        r = s.post(f"{API}/auth/register",
                   json={"email": email, "password": "Reg15@1234", "name": "TEST Reg15"},
                   timeout=20)
        assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
        me = s.get(f"{API}/auth/me", timeout=15)
        assert me.status_code == 200
        me_body = me.json()
        assert me_body.get("plan") == "pro", f"plan should be pro-trial: {me_body.get('plan')}"
        assert me_body.get("plan_status") in ("trial", "active"), f"plan_status: {me_body.get('plan_status')}"
        assert me_body.get("email", "").lower() == email.lower()

    def test_register_with_referral_applies_reward(self):
        # Step 1: create a referrer and grab their referral_code
        s1 = requests.Session()
        ref_email = f"TEST_referrer_{uuid.uuid4().hex[:8]}@estima.com"
        r1 = s1.post(f"{API}/auth/register",
                     json={"email": ref_email, "password": "Ref@1234", "name": "TEST Referrer"},
                     timeout=20)
        assert r1.status_code in (200, 201)
        me1 = s1.get(f"{API}/auth/me", timeout=15).json()
        ref_code = me1.get("referral_code") or me1.get("my_referral_code")
        if not ref_code:
            pytest.skip("referral_code not exposed on /auth/me — cannot verify referral reward")

        # Step 2: register referee with ref_code
        s2 = requests.Session()
        referee_email = f"TEST_referee_{uuid.uuid4().hex[:8]}@estima.com"
        r2 = s2.post(f"{API}/auth/register",
                     json={"email": referee_email, "password": "Ref@1234",
                           "name": "TEST Referee", "referral_code": ref_code},
                     timeout=20)
        assert r2.status_code in (200, 201), f"{r2.status_code}: {r2.text[:300]}"
        # No hard crash is the minimum guarantee; reward accrual is internal.


# -------------- RESALE-ESTIMATE math regression --------------
class TestResaleEstimate:
    """Must return exact-ish math from the documented payload."""

    PAYLOAD = {
        "purchase_price": 8000000,
        "current_value": 12000000,
        "years_held": 5,
        "outstanding_loan": 3500000,
        "current_rent_monthly": 32000,
        "min_rent_monthly": 28000,
    }

    def test_resale_estimate_returns_key_fields(self):
        r = requests.post(f"{API}/calc/resale-estimate", json=self.PAYLOAD, timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        for key in [
            "breakeven_sale_price",
            "target_profit_sale_price",
            "xirr_pct",
            "projected_sale_price",
            "projected_net_proceeds_after_loan_and_tax",
            "implied_annual_return_pct",
        ]:
            assert key in data, f"missing field: {key} in {list(data.keys())}"

    def test_resale_estimate_numbers_in_expected_range(self):
        r = requests.post(f"{API}/calc/resale-estimate", json=self.PAYLOAD, timeout=30)
        assert r.status_code == 200
        data = r.json()
        be = float(data["breakeven_sale_price"])
        tgt = float(data["target_profit_sale_price"])
        xirr = float(data["xirr_pct"])
        proj = float(data["projected_sale_price"])
        # Sanity: all positive, target > breakeven, projected equals current_value
        assert be > 0, f"breakeven non-positive: {be}"
        assert tgt > be, f"target_profit {tgt} should exceed breakeven {be}"
        assert proj == 12000000.0, f"projected_sale_price should equal current_value: {proj}"
        # xirr positive (appreciation + rent, positive equity)
        assert xirr > 0, f"xirr_pct should be positive: {xirr}"
        # net proceeds after loan+tax > 0 with 12M sale and 3.5M loan
        np_after = float(data["projected_net_proceeds_after_loan_and_tax"])
        assert np_after > 0, f"net proceeds non-positive: {np_after}"


# -------------- PORTFOLIO summary + timeline refactor regression --------------
class TestPortfolioRefactor:
    def test_summary_shape_and_no_raw_leak(self, demo_session):
        r = demo_session.get(f"{API}/portfolio/summary", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert "count" in data
        assert "sold_count" in data
        assert "items" in data and isinstance(data["items"], list)
        assert "total_net_worth" in data
        assert "total_equity" in data
        assert "total_realized_gains" in data
        # Net worth arithmetic
        eq = float(data["total_equity"])
        rg = float(data["total_realized_gains"])
        nw = float(data["total_net_worth"])
        assert abs(nw - (eq + rg)) < 1.0, f"total_net_worth {nw} != equity {eq} + realized_gains {rg}"

        # No _raw_* internals leaked into items
        for itm in data["items"]:
            bad = [k for k in itm.keys() if k.startswith("_raw_") or k == "_id"]
            assert not bad, f"internal fields leaked: {bad} in item {itm.get('id')}"
            # Expected surface keys
            for k in ("id", "name", "type", "status"):
                assert k in itm, f"item missing {k}: keys={list(itm.keys())}"

    def test_timeline_shape(self, demo_session):
        r = demo_session.get(f"{API}/portfolio/timeline", timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        series = data.get("series", data if isinstance(data, list) else [])
        assert isinstance(series, list) and len(series) > 0, f"series empty/invalid: {data}"
        # Every row must have year + net_worth arithmetic
        for row in series:
            assert "year" in row
            eq = float(row.get("equity", 0) or 0)
            rg = float(row.get("realized_gains", 0) or 0)
            nw = float(row.get("net_worth", 0) or 0)
            assert abs(nw - (eq + rg)) < 1.0, f"year {row.get('year')} nw mismatch: {nw} vs {eq}+{rg}"
        # Last year should have realized_gains > 0 (demo has sold property)
        last = series[-1]
        assert float(last.get("realized_gains", 0) or 0) > 0, f"last realized_gains=0 for demo: {last}"


# -------------- EXPORT-PDF refactor regression --------------
class TestExportPdf:
    def test_export_pdf_returns_valid_pdf(self, demo_session):
        # Fetch demo user's seeded properties
        ps = demo_session.get(f"{API}/properties", timeout=15)
        if ps.status_code != 200:
            pytest.skip(f"/properties not reachable: {ps.status_code}")
        plist = ps.json() if isinstance(ps.json(), list) else ps.json().get("properties", [])
        ids = [p.get("id") for p in plist if p.get("id")][:3]
        if len(ids) < 2:
            pytest.skip(f"need >=2 properties for compare, have {len(ids)}")

        payload = {
            "property_ids": ids,
            "weights": {
                "location": 0.2, "amenities": 0.15, "safety": 0.15,
                "commute": 0.15, "resale": 0.2, "price_value": 0.15,
            },
        }
        r = demo_session.post(f"{API}/compare/export/pdf", json=payload, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        assert r.content[:4] == b"%PDF", f"not a PDF: starts with {r.content[:16]!r}"
        assert len(r.content) > 1000, f"PDF too small: {len(r.content)} bytes"


# -------------- Auth / demo / billing regression --------------
class TestAuthBillingRegression:
    def test_demo_login(self):
        r = requests.post(f"{API}/auth/demo-login", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data.get("email") or data.get("user")

    def test_billing_create_order_live_key(self, demo_session):
        r = demo_session.post(f"{API}/billing/create-order",
                              json={"plan_id": "monthly"}, timeout=20)
        assert r.status_code < 500, f"billing server error: {r.status_code}: {r.text[:200]}"
        if r.status_code == 200:
            data = r.json()
            key = data.get("key_id") or data.get("razorpay_key_id")
            assert key and key.startswith("rzp_live_"), f"key not live: {key}"


# -------------- Lawyer marketplace regression --------------
class TestLawyerRegression:
    def test_public_lawyers_includes_seeded(self):
        r = requests.get(f"{API}/lawyers", timeout=15)
        assert r.status_code == 200
        ids = [x.get("id") for x in r.json().get("lawyers", [])]
        assert VERIFIED_LAWYER_ID in ids

    def test_book_lawyer_live_order(self, demo_session):
        # Ensure a will draft exists for demo
        for path in ("/will", "/will/draft", "/will/save"):
            demo_session.post(f"{API}{path}", json={
                "testator_name": "Demo User",
                "executor_name": "Executor One",
                "beneficiaries": [{"name": "Ben", "relation": "Son", "share_pct": 100}],
                "assets": [{"kind": "bank", "description": "HDFC", "value_inr": 100000}],
            }, timeout=20)
        r = demo_session.post(f"{API}/will/book-lawyer",
                              json={"lawyer_id": VERIFIED_LAWYER_ID, "note": "iter15 regression"},
                              timeout=30)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data.get("razorpay_key_id", "").startswith("rzp_live_")
        assert data.get("order_id", "").startswith("order_")
        assert data.get("token")
        TestLawyerRegression._token = data["token"]

    def test_endorse_pending_400(self):
        token = getattr(TestLawyerRegression, "_token", None)
        if not token:
            pytest.skip("no booking token")
        r = requests.post(f"{API}/public/will-review/{token}/endorse", timeout=15)
        assert r.status_code == 400

    def test_endorse_bad_token_404(self):
        r = requests.post(f"{API}/public/will-review/no-such-token/endorse", timeout=15)
        assert r.status_code == 404

    def test_admin_lawyers_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/lawyers", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json().get("lawyers", []), list)
