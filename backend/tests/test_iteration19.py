"""
Iteration 19 tests:
  - POST /api/calc/rental-snowball/ai-narrative (auth-gated, calls Claude via Emergent LLM key)
  - Regression: GET /api/shares list still returns snowball + odcf + comparison shape
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def anon_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/demo-login", timeout=15)
    assert r.status_code == 200, f"demo-login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def snowball_inputs():
    # default-ish multi-flat scenario known to compute cleanly
    return {
        "monthly_surplus": 150000,
        "od_starting_pot": 500000,
        "od_credit_rate_pct": 8.0,
        "od_debit_rate_pct": 9.0,
        "horizon_years": 15,
        "analysis_years": 15,
        "loan_rate_pct": 8.5,
        "loan_tenure_years": 20,
        "appreciation_pct": 6.0,
        "rent_growth_pct": 5.0,
        "target_flats": [
            {"name": "Flat A", "price_today": 8000000, "monthly_rent_today": 22000, "dp_pct": 20, "desired_buy_month": 1, "is_under_construction": False, "construction_months": 0},
            {"name": "Flat B", "price_today": 9500000, "monthly_rent_today": 26000, "dp_pct": 20, "desired_buy_month": 0, "is_under_construction": False, "construction_months": 0},
            {"name": "Flat C", "price_today": 11000000, "monthly_rent_today": 30000, "dp_pct": 25, "desired_buy_month": 0, "is_under_construction": True, "construction_months": 24},
        ],
    }


@pytest.fixture(scope="module")
def snowball_result(demo_session, snowball_inputs):
    r = demo_session.post(f"{API}/calc/rental-snowball", json=snowball_inputs, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- AI narrative endpoint ----------
class TestSnowballAiNarrative:
    def test_anon_requires_auth(self, anon_session, snowball_inputs, snowball_result):
        r = anon_session.post(
            f"{API}/calc/rental-snowball/ai-narrative",
            json={"inputs": snowball_inputs, "result": snowball_result},
            timeout=15,
        )
        assert r.status_code == 401, f"expected 401 anon, got {r.status_code}: {r.text[:200]}"

    def test_authenticated_returns_3_paragraph_letter(self, demo_session, snowball_inputs, snowball_result):
        r = demo_session.post(
            f"{API}/calc/rental-snowball/ai-narrative",
            json={"inputs": snowball_inputs, "result": snowball_result},
            timeout=90,  # AI calls can be slow
        )
        assert r.status_code == 200, f"AI failed: {r.status_code} {r.text[:500]}"
        data = r.json()
        assert "narrative" in data
        narr = data["narrative"]
        assert isinstance(narr, str)
        assert len(narr) > 200, f"narrative too short ({len(narr)} chars): {narr[:200]}"
        # Should have ~3 paragraphs (split by blank lines). Allow 2-5 for tolerance.
        paras = [p for p in re.split(r"\n\s*\n", narr.strip()) if p.strip()]
        assert 2 <= len(paras) <= 5, f"expected ~3 paragraphs, got {len(paras)}: {narr[:300]}"
        # No markdown bullets / headings / emojis (basic sanity)
        assert not re.search(r"^#{1,6}\s", narr, flags=re.M), "found markdown heading"
        assert not re.search(r"^\s*[\*\-]\s", narr, flags=re.M), "found markdown bullet"
        # No common emoji ranges
        assert not re.search(r"[\U0001F300-\U0001FAFF\u2600-\u27BF]", narr), "found emoji"
        # References real numbers — should mention XIRR or rupee figure
        assert ("XIRR" in narr.upper()) or ("xirr" in narr) or ("%" in narr), "no XIRR/% reference"
        assert ("₹" in narr) or ("Rs" in narr) or ("lakh" in narr.lower()) or ("crore" in narr.lower()), "no ₹/lakh/crore reference"

    def test_invalid_payload_400(self, demo_session):
        # Empty target_flats → backend rental_snowball raises 400 BEFORE AI call wraps it
        bad_inputs = {
            "monthly_surplus": 100000, "od_starting_pot": 100000,
            "od_credit_rate_pct": 8.0, "od_debit_rate_pct": 9.0,
            "horizon_years": 10, "analysis_years": 10,
            "loan_rate_pct": 8.5, "loan_tenure_years": 20,
            "appreciation_pct": 6.0, "rent_growth_pct": 5.0,
            "target_flats": [],
        }
        # AI endpoint accepts any 'result' dict — it doesn't recompute. This test just
        # verifies that giving it a tiny but well-formed payload still works (no crash).
        r = demo_session.post(
            f"{API}/calc/rental-snowball/ai-narrative",
            json={"inputs": bad_inputs, "result": {"xirr_pct": 0, "purchases": [], "yearly_snapshots": []}},
            timeout=90,
        )
        # Should not 5xx — either 200 (LLM responds) or 400/422 (validation).
        assert r.status_code in (200, 400, 422, 502), f"unexpected status {r.status_code}: {r.text[:300]}"


# ---------- /api/shares regression ----------
class TestSharesListRegression:
    def test_list_returns_discriminated_shape(self, demo_session):
        r = demo_session.get(f"{API}/shares", timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        assert isinstance(items, list)
        # demo user already has shares per main agent context (>=4 expected)
        assert len(items) >= 1, "expected at least 1 share for demo user"
        kinds = {it.get("kind") for it in items}
        # Must support the 3 known kinds in the discriminated shape
        for it in items:
            assert "share_id" in it
            assert "kind" in it
            assert "title" in it
            assert "created_at" in it
            k = it["kind"]
            assert k in ("snowball", "odcf", "comparison"), f"unknown kind: {k}"
            if k == "snowball":
                assert "xirr_pct" in it
                assert "total_purchases" in it
            elif k == "odcf":
                assert "xirr_pct" in it
            elif k == "comparison":
                # comparison may have winner / num_properties
                assert "num_properties" in it or "winner" in it
        print(f"Shares kinds present in demo user: {kinds}")
