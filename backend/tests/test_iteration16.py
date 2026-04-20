"""Iteration 16: OD-Cashflow Calculator + Admin Analytics regression tests."""
import os
import uuid
import pytest
import requests

def _read_env_url():
    # Read REACT_APP_BACKEND_URL from frontend/.env as authoritative source
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    return os.environ["REACT_APP_BACKEND_URL"].rstrip("/")

BASE_URL = _read_env_url()
ADMIN_EMAIL = "admin@estima.com"
ADMIN_PASS = "Admin@123"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login",
                     json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json().get("access_token")


@pytest.fixture(scope="module")
def admin_session(session, admin_token):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json",
                      "Authorization": f"Bearer {admin_token}"})
    return s


# -----------------------------------------------------------------
# OD-Cashflow Calculator
# -----------------------------------------------------------------
class TestOdCashflow:
    def _payload(self, plan="rtm", possession=0):
        return {
            "property_price": 8000000,
            "monthly_rent": 32000,
            "loan_rate": 8.5,
            "loan_tenure_years": 20,
            "down_payment_pct": 20,
            "builder_plan": plan,
            "possession_months": possession,
            "surplus_cash_today": 1000000,
            "monthly_od_topup": 10000,
            "appreciation_pct": 7,
            "analysis_years": 10,
            "maintenance_monthly": 2000,
            "property_tax_yearly": 12000,
        }

    def test_od_cashflow_rtm(self):
        r = requests.post(f"{BASE_URL}/api/calc/od-cashflow", json=self._payload("rtm", 0))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("xirr_pct", "emi_post_possession", "min_od_balance_for_cf_positive",
                  "narrative", "monthly_series", "down_payment", "loan_amount"):
            assert k in d, f"missing {k}"
        assert isinstance(d["narrative"], list) and len(d["narrative"]) > 0
        assert isinstance(d["monthly_series"], list) and len(d["monthly_series"]) > 0
        assert d["down_payment"] == 1600000
        assert d["loan_amount"] == 6400000
        assert d["emi_post_possession"] > 0

    def test_od_cashflow_20_80(self):
        r = requests.post(f"{BASE_URL}/api/calc/od-cashflow",
                          json=self._payload("20_80", 24))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["xirr_pct"] is not None
        assert isinstance(d["narrative"], list)
        # 20:80 forces 20% upfront
        assert d["down_payment"] == 1600000

    def test_od_cashflow_subvention(self):
        r = requests.post(f"{BASE_URL}/api/calc/od-cashflow",
                          json=self._payload("subvention", 24))
        assert r.status_code == 200
        d = r.json()
        # subvention -> builder pays pre-EMI, buyer pre-EMI should be 0
        assert d["total_pre_emi_paid_by_buyer"] == 0


# -----------------------------------------------------------------
# Analytics
# -----------------------------------------------------------------
class TestAnalytics:
    def test_track_anonymous(self):
        sid = f"TEST_{uuid.uuid4().hex[:12]}"
        r = requests.post(f"{BASE_URL}/api/analytics/track",
                          json={"route": "/app/dashboard", "session_id": sid,
                                "time_on_page_ms": 5000, "user_agent": "pytest"})
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_track_multiple_routes_then_admin_sees(self, admin_session):
        before = admin_session.get(f"{BASE_URL}/api/admin/analytics").json()
        before_total = before["total_pageviews"]
        sid = f"TEST_{uuid.uuid4().hex[:12]}"
        for route in ["/app/calculators", "/app/portfolio", "/app/admin"]:
            r = requests.post(f"{BASE_URL}/api/analytics/track",
                              json={"route": route, "session_id": sid,
                                    "time_on_page_ms": 1500})
            assert r.status_code == 200
        after = admin_session.get(f"{BASE_URL}/api/admin/analytics").json()
        assert after["total_pageviews"] >= before_total + 3

    def test_admin_analytics_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/admin/analytics")
        assert r.status_code == 401

    def test_admin_analytics_forbids_non_admin(self):
        # demo login -> not admin
        demo = requests.post(f"{BASE_URL}/api/auth/demo-login")
        assert demo.status_code == 200
        tok = demo.json().get("access_token")
        r = requests.get(f"{BASE_URL}/api/admin/analytics",
                         headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 403

    def test_admin_analytics_fields(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/admin/analytics")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total_pageviews", "last_7d_pageviews", "last_24h_pageviews",
                  "unique_sessions_24h", "top_routes", "top_features",
                  "least_used_features", "daily_series"):
            assert k in d, f"missing field {k}"
        assert isinstance(d["top_routes"], list)
        assert isinstance(d["daily_series"], list)

    def test_admin_analytics_window_param(self, admin_session):
        r7 = admin_session.get(f"{BASE_URL}/api/admin/analytics?days=7")
        r90 = admin_session.get(f"{BASE_URL}/api/admin/analytics?days=90")
        assert r7.status_code == 200 and r90.status_code == 200
        assert r7.json()["days"] == 7
        assert r90.json()["days"] == 90
