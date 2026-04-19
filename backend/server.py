from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import bcrypt
import jwt
from bson import ObjectId
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field, ConfigDict

from emergentintegrations.llm.chat import LlmChat, UserMessage

from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
import csv
import io
import hmac
import hashlib
import razorpay

from city_presets import CITY_PRESETS
from city_projects import UPCOMING_PROJECTS
import notifications as notify
import requests as httpx_requests

# ------------------------------------------------------------
# Setup
# ------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("estima")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "10"))
PRO_MONTHLY_INR = int(os.environ.get("PRO_MONTHLY_INR", "999"))
PRO_YEARLY_INR = int(os.environ.get("PRO_YEARLY_INR", "9999"))

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

razor_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    razor_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

app = FastAPI(title="Estima — Property Decision Engine")
api_router = APIRouter(prefix="/api")


# ------------------------------------------------------------
# Auth Helpers
# ------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60 * 24),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24 * 7, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ------------------------------------------------------------
# Auth Models
# ------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    referral_code: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "user"
    plan: str = "free"                    # free | pro
    plan_status: str = "none"             # none | trial | active | expired
    trial_ends_at: Optional[str] = None
    plan_expires_at: Optional[str] = None
    is_pro: bool = False


def _compute_plan_state(user: dict) -> dict:
    """Returns computed plan fields based on timestamps."""
    now = datetime.now(timezone.utc)
    trial_ends = user.get("trial_ends_at")
    plan_expires = user.get("plan_expires_at")
    plan = user.get("plan", "free")
    status = user.get("plan_status", "none")

    def _parse(dt):
        if not dt:
            return None
        try:
            return datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except Exception:
            return None

    t_end = _parse(trial_ends)
    p_end = _parse(plan_expires)

    is_pro = False
    if status == "active" and p_end and p_end > now:
        is_pro = True
    elif status == "trial" and t_end and t_end > now:
        is_pro = True
    elif status == "trial" and t_end and t_end <= now:
        status = "expired"
        plan = "free"
    elif status == "active" and p_end and p_end <= now:
        status = "expired"
        plan = "free"

    return {
        "plan": plan,
        "plan_status": status,
        "trial_ends_at": trial_ends,
        "plan_expires_at": plan_expires,
        "is_pro": is_pro,
    }


def _user_out(user: dict) -> UserOut:
    state = _compute_plan_state(user)
    return UserOut(
        id=user["id"],
        email=user["email"],
        name=user.get("name", ""),
        role=user.get("role", "user"),
        **state,
    )


# ------------------------------------------------------------
# Auth Endpoints
# ------------------------------------------------------------
@api_router.post("/auth/register", response_model=UserOut)
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    now = datetime.now(timezone.utc)
    trial_end = now + timedelta(days=TRIAL_DAYS)

    referral_code = secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8].upper()
    # ensure uniqueness (rare collision)
    while await db.users.find_one({"referral_code": referral_code}):
        referral_code = secrets.token_urlsafe(6).upper()[:8]

    referred_by = None
    if body.referral_code:
        ref_user = await db.users.find_one({"referral_code": body.referral_code.upper().strip()})
        if ref_user:
            referred_by = str(ref_user["_id"])

    doc = {
        "email": email,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "user",
        "plan": "pro",
        "plan_status": "trial",
        "trial_ends_at": trial_end.isoformat(),
        "plan_expires_at": None,
        "referral_code": referral_code,
        "referred_by": referred_by,
        "referral_reward_granted": False,
        "created_at": now.isoformat(),
    }
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)

    # Grant referrer +30 Pro days immediately upon successful signup
    if referred_by:
        try:
            ref_user_doc = await db.users.find_one({"_id": ObjectId(referred_by)})
            if ref_user_doc:
                state = _compute_plan_state(ref_user_doc)
                base = now
                if state.get("is_pro") and state.get("plan_expires_at"):
                    try:
                        ex = datetime.fromisoformat(state["plan_expires_at"].replace("Z", "+00:00"))
                        if ex > now:
                            base = ex
                    except Exception:
                        pass
                new_expires = base + timedelta(days=30)
                await db.users.update_one(
                    {"_id": ObjectId(referred_by)},
                    {"$set": {
                        "plan": "pro",
                        "plan_status": "active",
                        "plan_expires_at": new_expires.isoformat(),
                    },
                     "$inc": {"referral_count": 1}},
                )
                await db.referral_events.insert_one({
                    "referrer_id": referred_by,
                    "referred_user_id": uid,
                    "referred_email": email,
                    "days_granted": 30,
                    "created_at": now.isoformat(),
                })
                # Fire referral email
                try:
                    subj, html = notify.tpl_referral_reward(ref_user_doc.get("name", "there"), email, 30)
                    notify.send_email(ref_user_doc["email"], subj, html)
                except Exception:
                    logger.exception("referral email failed")
        except Exception:
            logger.exception("referral grant failed")

    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    doc["id"] = uid

    # Fire welcome email (no-op if RESEND_API_KEY missing)
    try:
        subj, html = notify.tpl_welcome(doc["name"], TRIAL_DAYS)
        notify.send_email(email, subj, html)
    except Exception:
        logger.exception("welcome email failed")

    return _user_out(doc)


@api_router.post("/auth/login", response_model=UserOut)
async def login(body: LoginIn, response: Response, request: Request):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"

    # brute force check
    la = await db.login_attempts.find_one({"identifier": identifier})
    if la and la.get("locked_until"):
        locked_until = la["locked_until"]
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        if locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        # increment
        fails = (la.get("failures", 0) if la else 0) + 1
        update = {"identifier": identifier, "failures": fails}
        if fails >= 5:
            update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    uid = str(user["_id"])
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    user["id"] = uid
    return _user_out(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)


@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    rt = request.cookies.get("refresh_token")
    if not rt:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(rt, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        new_access = create_access_token(str(user["_id"]), user["email"])
        response.set_cookie("access_token", new_access, httponly=True, secure=False, samesite="lax", max_age=60 * 60 * 24, path="/")
        return {"ok": True}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")


# ------------------------------------------------------------
# Properties Models
# ------------------------------------------------------------
PropertyType = Literal["flat", "villa", "plot", "commercial", "other"]
PropertyStatus = Literal["evaluating", "owned", "sold"]


class PropertyIn(BaseModel):
    name: str
    type: PropertyType = "flat"
    location: str = ""
    price: float = 0.0               # total price INR
    area_sqft: float = 0.0
    down_payment: float = 0.0
    loan_rate: float = 8.5           # %
    loan_tenure_years: int = 20
    maintenance_monthly: float = 0.0
    property_tax_yearly: float = 0.0
    expected_appreciation: float = 6.0  # % yearly
    rental_yield: float = 3.0         # % yearly of price
    image_url: Optional[str] = None
    notes: str = ""
    # Weighted decision attributes (0-10)
    score_location: float = 5
    score_amenities: float = 5
    score_safety: float = 5
    score_commute: float = 5
    score_resale: float = 5
    # Ownership tracking
    status: PropertyStatus = "evaluating"
    purchase_date: Optional[str] = None       # ISO date "YYYY-MM-DD"
    purchase_price: Optional[float] = None
    current_value: Optional[float] = None
    current_loan_balance: Optional[float] = None
    monthly_rent_income: float = 0.0
    rented: bool = False
    # Sold tracking
    sold_date: Optional[str] = None
    sold_price: Optional[float] = None


class PropertyOut(PropertyIn):
    id: str
    user_id: str
    created_at: str


@api_router.get("/properties", response_model=List[PropertyOut])
async def list_properties(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if status in ("evaluating", "owned", "sold"):
        q["status"] = status
    docs = await db.properties.find(q, {"_id": 0}).to_list(500)
    for d in docs:
        d.setdefault("status", "evaluating")
    return docs


@api_router.get("/portfolio/summary")
async def portfolio_summary(user: dict = Depends(get_current_user)):
    owned = await db.properties.find(
        {"user_id": user["id"], "status": "owned"}, {"_id": 0}
    ).to_list(500)
    sold = await db.properties.find(
        {"user_id": user["id"], "status": "sold"}, {"_id": 0}
    ).to_list(500)

    total_current_value = 0.0
    total_purchase_cost = 0.0
    total_loan_balance = 0.0
    total_monthly_rent = 0.0
    total_monthly_emi = 0.0
    total_monthly_maintenance = 0.0
    items = []

    for p in owned:
        purchase_price = p.get("purchase_price") or p.get("price") or 0
        current_value = p.get("current_value") or purchase_price
        loan_balance = p.get("current_loan_balance")
        if loan_balance is None:
            loan_balance = max((p.get("price", 0) - p.get("down_payment", 0)), 0)
        emi = _emi(max(p.get("price", 0) - p.get("down_payment", 0), 0),
                   p.get("loan_rate", 8.5), p.get("loan_tenure_years", 20))
        rent = p.get("monthly_rent_income", 0) if p.get("rented") else 0
        maint = p.get("maintenance_monthly", 0)

        equity = current_value - loan_balance
        appreciation_pct = ((current_value - purchase_price) / purchase_price * 100) if purchase_price else 0
        monthly_cashflow = rent - emi - maint

        total_current_value += current_value
        total_purchase_cost += purchase_price
        total_loan_balance += loan_balance
        total_monthly_rent += rent
        total_monthly_emi += emi
        total_monthly_maintenance += maint

        items.append({
            "id": p["id"],
            "name": p["name"],
            "type": p["type"],
            "location": p.get("location", ""),
            "status": "owned",
            "purchase_date": p.get("purchase_date"),
            "purchase_price": round(purchase_price, 2),
            "current_value": round(current_value, 2),
            "loan_balance": round(loan_balance, 2),
            "equity": round(equity, 2),
            "appreciation_pct": round(appreciation_pct, 2),
            "emi": round(emi, 2),
            "monthly_rent": round(rent, 2),
            "monthly_cashflow": round(monthly_cashflow, 2),
            "rented": bool(p.get("rented")),
        })

    # Sold properties — realized gains summary
    total_realized_gains = 0.0
    total_sold_proceeds = 0.0
    sold_items = []
    for p in sold:
        purchase_price = p.get("purchase_price") or p.get("price") or 0
        sold_price = p.get("sold_price") or purchase_price
        gain = sold_price - purchase_price
        gain_pct = (gain / purchase_price * 100) if purchase_price else 0
        total_realized_gains += gain
        total_sold_proceeds += sold_price
        sold_items.append({
            "id": p["id"],
            "name": p["name"],
            "type": p["type"],
            "location": p.get("location", ""),
            "status": "sold",
            "purchase_date": p.get("purchase_date"),
            "sold_date": p.get("sold_date"),
            "purchase_price": round(purchase_price, 2),
            "sold_price": round(sold_price, 2),
            "gain": round(gain, 2),
            "gain_pct": round(gain_pct, 2),
        })

    total_equity = total_current_value - total_loan_balance
    total_appreciation_pct = (
        (total_current_value - total_purchase_cost) / total_purchase_cost * 100
        if total_purchase_cost else 0
    )
    net_monthly_cashflow = total_monthly_rent - total_monthly_emi - total_monthly_maintenance
    total_net_worth = total_equity + total_realized_gains

    return {
        "count": len(owned),
        "sold_count": len(sold),
        "total_current_value": round(total_current_value, 2),
        "total_purchase_cost": round(total_purchase_cost, 2),
        "total_equity": round(total_equity, 2),
        "total_loan_balance": round(total_loan_balance, 2),
        "total_appreciation_pct": round(total_appreciation_pct, 2),
        "total_appreciation_inr": round(total_current_value - total_purchase_cost, 2),
        "net_monthly_cashflow": round(net_monthly_cashflow, 2),
        "total_monthly_rent": round(total_monthly_rent, 2),
        "total_monthly_emi": round(total_monthly_emi, 2),
        "total_monthly_maintenance": round(total_monthly_maintenance, 2),
        "total_realized_gains": round(total_realized_gains, 2),
        "total_sold_proceeds": round(total_sold_proceeds, 2),
        "total_net_worth": round(total_net_worth, 2),
        "items": items,
        "sold_items": sold_items,
    }


def _loan_balance_after_months(loan_amount: float, rate_pct: float, tenure_years: int, months_elapsed: int) -> float:
    if loan_amount <= 0 or months_elapsed <= 0:
        return max(loan_amount, 0)
    emi = _emi(loan_amount, rate_pct, tenure_years)
    r = (rate_pct / 100) / 12
    balance = loan_amount
    for _ in range(min(months_elapsed, tenure_years * 12)):
        if balance <= 0:
            break
        interest = balance * r
        principal = emi - interest
        balance = max(balance - principal, 0)
    return balance


@api_router.get("/portfolio/timeline")
async def portfolio_timeline(user: dict = Depends(get_current_user)):
    props = await db.properties.find(
        {"user_id": user["id"], "status": {"$in": ["owned", "sold"]}}, {"_id": 0}
    ).to_list(500)

    # Keep only those with a purchase_date we can use
    dated = [p for p in props if p.get("purchase_date")]
    if not dated:
        return {"series": [], "earliest_year": None}

    def _yr(s: Optional[str]) -> int:
        try:
            return int(s[:4])
        except Exception:
            return datetime.now(timezone.utc).year

    current_year = datetime.now(timezone.utc).year
    earliest_year = min(_yr(p["purchase_date"]) for p in dated)

    series = []
    for year in range(earliest_year, current_year + 1):
        total_value = 0.0
        total_loan = 0.0
        cumulative_realized = 0.0

        for p in dated:
            pyear = _yr(p["purchase_date"])
            if year < pyear:
                continue
            purchase_price = p.get("purchase_price") or p.get("price", 0) or 0
            loan_amount = max((p.get("price", 0) or 0) - (p.get("down_payment", 0) or 0), 0)
            rate = p.get("loan_rate", 8.5) or 8.5
            tenure = p.get("loan_tenure_years", 20) or 20

            if p.get("status") == "sold" and p.get("sold_date"):
                syear = _yr(p["sold_date"])
                sold_price = p.get("sold_price") or purchase_price
                if year < syear:
                    # still held that year — interpolate between purchase and sold
                    span = max(syear - pyear, 1)
                    ratio = (year - pyear) / span
                    val = purchase_price + (sold_price - purchase_price) * ratio
                    total_value += val
                    months = (year - pyear) * 12
                    total_loan += _loan_balance_after_months(loan_amount, rate, tenure, months)
                else:
                    cumulative_realized += (sold_price - purchase_price)
                continue

            # owned
            current_value = p.get("current_value") or purchase_price
            span = max(current_year - pyear, 1)
            ratio = min((year - pyear) / span, 1.0)
            val = purchase_price + (current_value - purchase_price) * ratio
            total_value += val
            months = (year - pyear) * 12
            total_loan += _loan_balance_after_months(loan_amount, rate, tenure, months)

        equity = total_value - total_loan
        series.append({
            "year": year,
            "total_value": round(total_value, 2),
            "loan_balance": round(total_loan, 2),
            "equity": round(equity, 2),
            "realized_gains": round(cumulative_realized, 2),
            "net_worth": round(equity + cumulative_realized, 2),
        })

    return {"series": series, "earliest_year": earliest_year}


@api_router.post("/properties", response_model=PropertyOut)
async def create_property(body: PropertyIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["id"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.properties.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/properties/{prop_id}", response_model=PropertyOut)
async def update_property(prop_id: str, body: PropertyIn, user: dict = Depends(get_current_user)):
    existing = await db.properties.find_one({"id": prop_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Property not found")
    data = body.model_dump()
    await db.properties.update_one({"id": prop_id, "user_id": user["id"]}, {"$set": data})
    existing.update(data)
    return existing


@api_router.delete("/properties/{prop_id}")
async def delete_property(prop_id: str, user: dict = Depends(get_current_user)):
    res = await db.properties.delete_one({"id": prop_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Property not found")
    return {"ok": True}


# ------------------------------------------------------------
# Financial Calculators
# ------------------------------------------------------------
class EMIRequest(BaseModel):
    principal: float
    annual_rate: float = 8.5
    tenure_years: int = 20


def _emi(principal: float, annual_rate: float, years: int) -> float:
    if principal <= 0 or years <= 0:
        return 0.0
    r = (annual_rate / 100) / 12
    n = years * 12
    if r == 0:
        return principal / n
    return principal * r * (1 + r) ** n / ((1 + r) ** n - 1)


@api_router.post("/calc/emi")
async def calc_emi(body: EMIRequest):
    emi = _emi(body.principal, body.annual_rate, body.tenure_years)
    total_payment = emi * body.tenure_years * 12
    total_interest = total_payment - body.principal
    # amortization yearly summary
    schedule = []
    balance = body.principal
    r = (body.annual_rate / 100) / 12
    for year in range(1, body.tenure_years + 1):
        interest_y = 0.0
        principal_y = 0.0
        for _ in range(12):
            if balance <= 0:
                break
            interest_m = balance * r
            principal_m = emi - interest_m
            balance -= principal_m
            interest_y += interest_m
            principal_y += principal_m
        schedule.append({
            "year": year,
            "principal_paid": round(principal_y, 2),
            "interest_paid": round(interest_y, 2),
            "balance": round(max(balance, 0), 2),
        })
    return {
        "emi": round(emi, 2),
        "total_payment": round(total_payment, 2),
        "total_interest": round(total_interest, 2),
        "schedule": schedule,
    }


class RentVsBuyRequest(BaseModel):
    property_price: float
    down_payment: float
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    appreciation: float = 6.0    # %/year
    monthly_rent: float          # if rented
    rent_increase: float = 7.0   # %/year
    invest_return: float = 12.0  # %/year (opportunity cost: down payment + rent savings)
    years: int = 10
    maintenance_monthly: float = 0.0


@api_router.post("/calc/rent-vs-buy")
async def calc_rent_vs_buy(body: RentVsBuyRequest):
    loan_amount = max(body.property_price - body.down_payment, 0)
    emi = _emi(loan_amount, body.loan_rate, body.loan_tenure_years)

    data = []
    cumulative_rent = 0.0
    cumulative_buy_cost = body.down_payment  # upfront
    rent_invested_corpus = body.down_payment  # alternative: if you rent, you invest the down payment
    monthly_rent = body.monthly_rent

    property_value = body.property_price
    loan_balance = loan_amount
    r_month = (body.loan_rate / 100) / 12

    for year in range(1, body.years + 1):
        # Rent yearly
        yearly_rent = monthly_rent * 12
        cumulative_rent += yearly_rent
        # Rent-case: invest emi - rent saved, plus grow existing corpus
        emi_yearly = emi * 12
        maint_yearly = body.maintenance_monthly * 12
        savings_for_investing = max(emi_yearly + maint_yearly - yearly_rent, 0)
        rent_invested_corpus = rent_invested_corpus * (1 + body.invest_return / 100) + savings_for_investing

        # Buy-case: EMI + maintenance
        cumulative_buy_cost += emi_yearly + maint_yearly

        # Pay down loan
        for _ in range(12):
            if loan_balance <= 0:
                break
            interest_m = loan_balance * r_month
            principal_m = emi - interest_m
            loan_balance = max(loan_balance - principal_m, 0)

        property_value *= (1 + body.appreciation / 100)
        monthly_rent *= (1 + body.rent_increase / 100)

        # net worth
        buy_net_worth = property_value - loan_balance - cumulative_buy_cost + (cumulative_buy_cost - (body.down_payment))  # simplified: owned equity
        # Cleaner: owned equity = property_value - loan_balance; minus rent paid? no, rent not paid in buy case
        owned_equity = property_value - loan_balance
        rent_net_worth = rent_invested_corpus - cumulative_rent  # remaining corpus adjusted for rent already paid (paid from income; this is what's left invested)

        data.append({
            "year": year,
            "property_value": round(property_value, 2),
            "loan_balance": round(loan_balance, 2),
            "owned_equity": round(owned_equity, 2),
            "buy_net_worth": round(owned_equity, 2),
            "rent_invested": round(rent_invested_corpus, 2),
            "rent_net_worth": round(rent_invested_corpus, 2),
            "cumulative_rent_paid": round(cumulative_rent, 2),
            "cumulative_buy_cost": round(cumulative_buy_cost, 2),
        })

    # Breakeven year
    breakeven_year = None
    for row in data:
        if row["buy_net_worth"] >= row["rent_net_worth"]:
            breakeven_year = row["year"]
            break

    return {
        "emi": round(emi, 2),
        "loan_amount": round(loan_amount, 2),
        "breakeven_year": breakeven_year,
        "series": data,
    }


class InvestmentCompareRequest(BaseModel):
    property_price: float
    down_payment: float
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    appreciation: float = 6.0
    rental_yield: float = 3.0
    mf_return: float = 12.0
    equity_return: float = 15.0
    years: int = 10


@api_router.post("/calc/investment-compare")
async def invest_compare(body: InvestmentCompareRequest):
    loan_amount = max(body.property_price - body.down_payment, 0)
    emi = _emi(loan_amount, body.loan_rate, body.loan_tenure_years)
    r_month = (body.loan_rate / 100) / 12

    data = []
    property_value = body.property_price
    loan_balance = loan_amount
    rental_collected = 0.0
    # Assume same total cash outflow: down_payment + monthly EMI is invested in MF / Equity in alternatives
    mf_corpus = body.down_payment
    eq_corpus = body.down_payment

    for year in range(1, body.years + 1):
        # Property
        property_value *= (1 + body.appreciation / 100)
        rental_collected += property_value * (body.rental_yield / 100)
        for _ in range(12):
            if loan_balance <= 0:
                break
            interest_m = loan_balance * r_month
            principal_m = emi - interest_m
            loan_balance = max(loan_balance - principal_m, 0)

        property_net = property_value - loan_balance + rental_collected

        # MF: invest emi monthly
        emi_yearly = emi * 12
        mf_corpus = mf_corpus * (1 + body.mf_return / 100) + emi_yearly
        eq_corpus = eq_corpus * (1 + body.equity_return / 100) + emi_yearly

        data.append({
            "year": year,
            "property": round(property_net, 2),
            "mutual_funds": round(mf_corpus, 2),
            "equity": round(eq_corpus, 2),
        })

    last = data[-1] if data else {"property": 0, "mutual_funds": 0, "equity": 0}
    winner = max([("Property", last["property"]), ("Mutual Funds", last["mutual_funds"]), ("Equity", last["equity"])], key=lambda x: x[1])
    return {
        "emi": round(emi, 2),
        "series": data,
        "summary": {
            "winner": winner[0],
            "winner_value": round(winner[1], 2),
            "property_final": last["property"],
            "mutual_funds_final": last["mutual_funds"],
            "equity_final": last["equity"],
        },
    }


# ------------------------------------------------------------
# Decision Scoring
# ------------------------------------------------------------
class ScoreRequest(BaseModel):
    property_ids: List[str]
    weights: dict = Field(default_factory=lambda: {
        "location": 0.25,
        "amenities": 0.15,
        "safety": 0.15,
        "commute": 0.15,
        "resale": 0.15,
        "price_value": 0.15,
    })


@api_router.post("/compare/score")
async def score_properties(body: ScoreRequest, user: dict = Depends(get_current_user)):
    props = await db.properties.find({"user_id": user["id"], "id": {"$in": body.property_ids}}, {"_id": 0}).to_list(100)
    if not props:
        raise HTTPException(404, "No matching properties")
    # normalize price_value: cheaper per sqft => higher score
    price_per_sqft = []
    for p in props:
        area = p.get("area_sqft") or 1
        pps = p["price"] / area if area > 0 else 0
        price_per_sqft.append(pps)
    max_pps = max(price_per_sqft) if price_per_sqft else 1
    min_pps = min(price_per_sqft) if price_per_sqft else 0
    results = []
    for i, p in enumerate(props):
        pps = price_per_sqft[i]
        # invert: cheapest = 10, priciest = 1
        if max_pps == min_pps:
            price_score = 7.5
        else:
            price_score = 10 - 9 * ((pps - min_pps) / (max_pps - min_pps))
        w = body.weights
        total = (
            p.get("score_location", 5) * w.get("location", 0.25) +
            p.get("score_amenities", 5) * w.get("amenities", 0.15) +
            p.get("score_safety", 5) * w.get("safety", 0.15) +
            p.get("score_commute", 5) * w.get("commute", 0.15) +
            p.get("score_resale", 5) * w.get("resale", 0.15) +
            price_score * w.get("price_value", 0.15)
        )
        results.append({
            "id": p["id"],
            "name": p["name"],
            "type": p["type"],
            "price": p["price"],
            "price_per_sqft": round(pps, 2),
            "price_score": round(price_score, 2),
            "total_score": round(total, 2),
            "breakdown": {
                "location": p.get("score_location", 5),
                "amenities": p.get("score_amenities", 5),
                "safety": p.get("score_safety", 5),
                "commute": p.get("score_commute", 5),
                "resale": p.get("score_resale", 5),
                "price_value": round(price_score, 2),
            }
        })
    results.sort(key=lambda x: x["total_score"], reverse=True)
    return {"results": results, "winner": results[0] if results else None}


# ------------------------------------------------------------
# AI Advisor
# ------------------------------------------------------------
class AdvisorRequest(BaseModel):
    question: str
    context: Optional[dict] = None   # property comparison data
    session_id: Optional[str] = None


@api_router.post("/advisor/chat")
async def advisor_chat(body: AdvisorRequest, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI advisor is not configured")
    _require_pro(user)
    session_id = body.session_id or f"{user['id']}-{uuid.uuid4()}"
    system = (
        "You are Estima, a sharp and empathetic property & personal finance advisor for Indian buyers. "
        "You specialize in comparing real estate (flats/villas/plots) against mutual funds, equity, and rent-vs-buy scenarios. "
        "Respond concisely with clear structure: a 2-line verdict first, then 3-5 bullet reasoning, then one concrete next step. "
        "Always show numbers in INR with ₹ and lakh/crore where helpful. Do not hallucinate market rates. "
        "If the user provides context (properties, calculators), ground your answer in those numbers."
    )
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=session_id, system_message=system).with_model("anthropic", "claude-sonnet-4-5-20250929")

    context_str = ""
    if body.context:
        try:
            import json
            context_str = f"\n\n[User context JSON]\n{json.dumps(body.context, default=str)[:6000]}"
        except Exception:
            context_str = ""

    try:
        reply = await chat.send_message(UserMessage(text=body.question + context_str))
    except Exception as e:
        logger.exception("advisor error")
        raise HTTPException(502, f"Advisor unavailable: {str(e)[:200]}")

    # persist
    await db.advisor_messages.insert_one({
        "user_id": user["id"],
        "session_id": session_id,
        "question": body.question,
        "context": body.context,
        "reply": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"session_id": session_id, "reply": reply}


@api_router.get("/advisor/history")
async def advisor_history(session_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if session_id:
        q["session_id"] = session_id
    docs = await db.advisor_messages.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


# ------------------------------------------------------------
# City Presets
# ------------------------------------------------------------
@api_router.get("/presets/cities")
async def get_city_presets():
    return {"cities": CITY_PRESETS}


# ------------------------------------------------------------
# Comparison Export (CSV / PDF)
# ------------------------------------------------------------
def _compute_score(props: list, weights: dict) -> dict:
    price_per_sqft = [(p["price"] / p["area_sqft"]) if p.get("area_sqft") else 0 for p in props]
    max_pps = max(price_per_sqft) if price_per_sqft else 1
    min_pps = min(price_per_sqft) if price_per_sqft else 0
    results = []
    for i, p in enumerate(props):
        pps = price_per_sqft[i]
        if max_pps == min_pps:
            price_score = 7.5
        else:
            price_score = 10 - 9 * ((pps - min_pps) / (max_pps - min_pps))
        w = weights
        total = (
            p.get("score_location", 5) * w.get("location", 0.25)
            + p.get("score_amenities", 5) * w.get("amenities", 0.15)
            + p.get("score_safety", 5) * w.get("safety", 0.15)
            + p.get("score_commute", 5) * w.get("commute", 0.15)
            + p.get("score_resale", 5) * w.get("resale", 0.15)
            + price_score * w.get("price_value", 0.15)
        )
        results.append({
            "id": p["id"],
            "name": p["name"],
            "type": p["type"],
            "location": p.get("location", ""),
            "price": p["price"],
            "area_sqft": p.get("area_sqft", 0),
            "price_per_sqft": round(pps, 2),
            "price_score": round(price_score, 2),
            "total_score": round(total, 2),
            "breakdown": {
                "location": p.get("score_location", 5),
                "amenities": p.get("score_amenities", 5),
                "safety": p.get("score_safety", 5),
                "commute": p.get("score_commute", 5),
                "resale": p.get("score_resale", 5),
                "price_value": round(price_score, 2),
            },
        })
    results.sort(key=lambda x: x["total_score"], reverse=True)
    return results


class ExportRequest(BaseModel):
    property_ids: List[str]
    weights: dict = Field(default_factory=lambda: {
        "location": 0.25, "amenities": 0.15, "safety": 0.15,
        "commute": 0.15, "resale": 0.15, "price_value": 0.15,
    })


def _inr(n: float) -> str:
    try:
        n = float(n)
    except Exception:
        return str(n)
    a = abs(n)
    if a >= 1e7:
        return f"INR {n/1e7:.2f} Cr"
    if a >= 1e5:
        return f"INR {n/1e5:.2f} L"
    return f"INR {n:,.0f}"


@api_router.post("/compare/export/csv")
async def export_csv(body: ExportRequest, user: dict = Depends(get_current_user)):
    _require_pro(user)
    props = await db.properties.find(
        {"user_id": user["id"], "id": {"$in": body.property_ids}}, {"_id": 0}
    ).to_list(100)
    if not props:
        raise HTTPException(404, "No matching properties")
    results = _compute_score(props, body.weights)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Rank", "Name", "Type", "Location", "Price (INR)", "Area (sqft)", "INR/sqft",
                     "Total Score", "Location", "Amenities", "Safety", "Commute", "Resale", "Price/Value"])
    for i, r in enumerate(results, 1):
        writer.writerow([
            i, r["name"], r["type"], r["location"], int(r["price"]), int(r["area_sqft"]),
            int(r["price_per_sqft"]), r["total_score"],
            r["breakdown"]["location"], r["breakdown"]["amenities"], r["breakdown"]["safety"],
            r["breakdown"]["commute"], r["breakdown"]["resale"], r["breakdown"]["price_value"],
        ])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=estima-comparison.csv"},
    )


@api_router.post("/compare/export/pdf")
async def export_pdf(body: ExportRequest, user: dict = Depends(get_current_user)):
    _require_pro(user)
    props = await db.properties.find(
        {"user_id": user["id"], "id": {"$in": body.property_ids}}, {"_id": 0}
    ).to_list(100)
    if not props:
        raise HTTPException(404, "No matching properties")
    results = _compute_score(props, body.weights)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = []

    # Header
    title_style = ParagraphStyle("title", parent=styles["Title"], fontName="Helvetica-Bold",
                                 fontSize=24, textColor=colors.HexColor("#0A0908"), spaceAfter=6)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"], fontSize=9,
                               textColor=colors.HexColor("#666666"), spaceAfter=20)

    story.append(Paragraph("Estima — Property Decision Report", title_style))
    story.append(Paragraph(
        f"Prepared for {user.get('name') or user['email']} · {datetime.now(timezone.utc).strftime('%d %b %Y')}",
        sub_style,
    ))

    # Winner box
    winner = results[0]
    winner_style = ParagraphStyle("winner", parent=styles["Heading2"], fontSize=16,
                                  textColor=colors.HexColor("#C85A32"), spaceAfter=4)
    story.append(Paragraph("Recommended winner", ParagraphStyle(
        "eyebrow", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#999999"),
        spaceAfter=6)))
    story.append(Paragraph(winner["name"], winner_style))
    story.append(Paragraph(
        f"Score {winner['total_score']} · {_inr(winner['price'])} · {int(winner['area_sqft'])} sqft · {_inr(winner['price_per_sqft'])}/sqft",
        styles["Normal"],
    ))
    story.append(Spacer(1, 16))

    # Ranking table
    header = ["#", "Property", "Type", "Price", "INR/sqft", "Score"]
    data = [header]
    for i, r in enumerate(results, 1):
        data.append([
            str(i),
            f"{r['name']}\n{r['location']}",
            r["type"].title(),
            _inr(r["price"]),
            _inr(r["price_per_sqft"]),
            str(r["total_score"]),
        ])
    t = Table(data, repeatRows=1, colWidths=[12 * mm, 60 * mm, 22 * mm, 32 * mm, 30 * mm, 20 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#141311")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#F4F0EA")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FAFAFA"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0DDD8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t)
    story.append(Spacer(1, 20))

    # Breakdown
    story.append(Paragraph("Score breakdown (0-10)", styles["Heading3"]))
    breakdown_data = [["Property", "Location", "Amenities", "Safety", "Commute", "Resale", "Price/Value"]]
    for r in results:
        b = r["breakdown"]
        breakdown_data.append([
            r["name"], str(b["location"]), str(b["amenities"]), str(b["safety"]),
            str(b["commute"]), str(b["resale"]), str(b["price_value"]),
        ])
    bt = Table(breakdown_data, repeatRows=1)
    bt.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#141311")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#F4F0EA")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E0DDD8")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(bt)

    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "<i>Weights used: " + ", ".join(f"{k}={int(v*100)}%" for k, v in body.weights.items()) + "</i>",
        ParagraphStyle("foot", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#999999")),
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Generated by Estima. Numbers are computed from user-supplied inputs; not financial advice.",
        ParagraphStyle("foot", parent=styles["Normal"], fontSize=7, textColor=colors.HexColor("#999999")),
    ))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=estima-comparison.pdf"},
    )


# ------------------------------------------------------------
# Shareable Public Comparison
# ------------------------------------------------------------
class ShareCreateRequest(BaseModel):
    property_ids: List[str]
    weights: dict = Field(default_factory=lambda: {
        "location": 0.25, "amenities": 0.15, "safety": 0.15,
        "commute": 0.15, "resale": 0.15, "price_value": 0.15,
    })
    title: Optional[str] = None


@api_router.post("/shares")
async def create_share(body: ShareCreateRequest, user: dict = Depends(get_current_user)):
    props = await db.properties.find(
        {"user_id": user["id"], "id": {"$in": body.property_ids}}, {"_id": 0}
    ).to_list(100)
    if not props:
        raise HTTPException(404, "No matching properties")
    results = _compute_score(props, body.weights)

    share_id = secrets.token_urlsafe(10)
    # snapshot so later edits to the property don't change the shared report
    snapshot_props = []
    for p in props:
        snapshot_props.append({
            "id": p["id"],
            "name": p["name"],
            "type": p["type"],
            "location": p.get("location", ""),
            "price": p["price"],
            "area_sqft": p.get("area_sqft", 0),
            "loan_rate": p.get("loan_rate", 0),
            "loan_tenure_years": p.get("loan_tenure_years", 0),
            "expected_appreciation": p.get("expected_appreciation", 0),
            "rental_yield": p.get("rental_yield", 0),
            "notes": p.get("notes", ""),
        })
    doc = {
        "share_id": share_id,
        "user_id": user["id"],
        "owner_name": user.get("name", ""),
        "title": body.title or "Property decision report",
        "weights": body.weights,
        "properties": snapshot_props,
        "results": results,
        "winner": results[0] if results else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.shares.insert_one(doc.copy())
    return {"share_id": share_id, "url": f"/share/{share_id}"}


@api_router.get("/shares/{share_id}")
async def get_share(share_id: str):
    doc = await db.shares.find_one({"share_id": share_id}, {"_id": 0, "user_id": 0})
    if not doc:
        raise HTTPException(404, "Share not found")
    return doc


@api_router.get("/shares")
async def list_shares(user: dict = Depends(get_current_user)):
    docs = await db.shares.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    # summarize
    return [
        {
            "share_id": d["share_id"],
            "title": d.get("title"),
            "created_at": d.get("created_at"),
            "winner": d.get("winner", {}).get("name") if d.get("winner") else None,
            "num_properties": len(d.get("properties", [])),
        }
        for d in docs
    ]


@api_router.delete("/shares/{share_id}")
async def delete_share(share_id: str, user: dict = Depends(get_current_user)):
    res = await db.shares.delete_one({"share_id": share_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Share not found")
    return {"ok": True}


class CashflowPositiveRequest(BaseModel):
    monthly_rent: float
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    maintenance_monthly: float = 2000.0
    property_tax_yearly: float = 0.0
    down_payment_pct: float = 20.0     # % of price
    target_cashflow_monthly: float = 0.0  # desired minimum monthly surplus


@api_router.post("/calc/cashflow-positive")
async def cashflow_positive(body: CashflowPositiveRequest):
    """Find the maximum property price that yields a cashflow-positive rental on loan.

    Math: EMI(loan) + maintenance + property_tax/12 <= monthly_rent - target_cashflow
    loan = price * (1 - down_payment_pct/100)
    Solve for max price via numerical bisection.
    """
    available_for_debt = body.monthly_rent - body.maintenance_monthly - body.property_tax_yearly / 12 - body.target_cashflow_monthly
    if available_for_debt <= 0:
        return {
            "feasible": False,
            "reason": "Rent doesn't cover maintenance + tax + desired cashflow even at zero EMI.",
            "max_price": 0,
            "max_loan": 0,
            "down_payment": 0,
            "emi": 0,
            "monthly_cashflow": round(body.monthly_rent - body.maintenance_monthly - body.property_tax_yearly / 12, 2),
            "breakdown": [],
        }

    # EMI formula inverse: loan = EMI * ((1+r)^n - 1) / (r*(1+r)^n)
    r = (body.loan_rate / 100) / 12
    n = body.loan_tenure_years * 12
    if r == 0:
        max_loan = available_for_debt * n
    else:
        max_loan = available_for_debt * ((1 + r) ** n - 1) / (r * (1 + r) ** n)
    down_pct = max(body.down_payment_pct, 0) / 100
    if down_pct >= 1.0:
        max_price = max_loan
    else:
        max_price = max_loan / max(1 - down_pct, 0.01)
    down_payment = max_price - max_loan
    emi = _emi(max_loan, body.loan_rate, body.loan_tenure_years)
    cashflow = body.monthly_rent - emi - body.maintenance_monthly - body.property_tax_yearly / 12

    # Scenario table: several price points
    breakdown = []
    for pct in [1.0, 0.9, 0.8, 0.7, 0.6, 0.5]:
        price = max_price * pct
        loan = price * (1 - down_pct)
        e = _emi(loan, body.loan_rate, body.loan_tenure_years)
        cf = body.monthly_rent - e - body.maintenance_monthly - body.property_tax_yearly / 12
        yield_pct = (body.monthly_rent * 12 / price * 100) if price else 0
        breakdown.append({
            "price": round(price, 2),
            "loan": round(loan, 2),
            "down_payment": round(price - loan, 2),
            "emi": round(e, 2),
            "cashflow": round(cf, 2),
            "gross_yield_pct": round(yield_pct, 2),
        })

    return {
        "feasible": True,
        "max_price": round(max_price, 2),
        "max_loan": round(max_loan, 2),
        "down_payment": round(down_payment, 2),
        "emi": round(emi, 2),
        "monthly_cashflow": round(cashflow, 2),
        "gross_yield_pct": round((body.monthly_rent * 12 / max_price * 100), 2) if max_price else 0,
        "breakdown": breakdown,
    }


# ------------------------------------------------------------
# Referrals
# ------------------------------------------------------------
@api_router.get("/referrals/me")
async def my_referrals(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    if not u:
        raise HTTPException(404, "User not found")
    if not u.get("referral_code"):
        code = secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8].upper()
        await db.users.update_one({"_id": u["_id"]}, {"$set": {"referral_code": code}})
        u["referral_code"] = code
    events = await db.referral_events.find({"referrer_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    total_days = sum(e.get("days_granted", 0) for e in events)
    return {
        "referral_code": u["referral_code"],
        "total_referrals": len(events),
        "total_days_granted": total_days,
        "events": events,
        "reward_per_referral_days": 30,
    }


# ------------------------------------------------------------
# Resale Estimator
# ------------------------------------------------------------
class ResaleEstimateRequest(BaseModel):
    purchase_price: float
    current_value: Optional[float] = None   # if known; else we'll project using appreciation
    outstanding_loan: float = 0.0
    years_held: float = 5.0
    appreciation_pct: float = 6.0           # if current_value absent
    maintenance_monthly: float = 0.0
    property_tax_yearly: float = 0.0
    rental_income_monthly: float = 0.0       # legacy — used when min/current not provided
    min_rent_monthly: Optional[float] = None   # lowest rent received during hold
    current_rent_monthly: Optional[float] = None   # latest / current rent
    misc_expenses_inr: float = 0.0           # one-time renovation/repair/furnishing (total over hold period)
    broker_fee_pct: float = 1.0              # on sale price
    ltcg_pct: float = 20.0                   # India LTCG on property (indexed) ~20%
    target_profit_inr: float = 500000.0


@api_router.post("/calc/resale-estimate")
async def resale_estimate(body: ResaleEstimateRequest):
    years = max(body.years_held, 0.01)
    projected_value = body.current_value if body.current_value else body.purchase_price * ((1 + body.appreciation_pct / 100) ** years)

    # Average rent: if both min + current provided, use their average; else fallback to rental_income_monthly
    if body.min_rent_monthly is not None and body.current_rent_monthly is not None:
        avg_rent = (body.min_rent_monthly + body.current_rent_monthly) / 2
    elif body.current_rent_monthly is not None:
        avg_rent = body.current_rent_monthly
    else:
        avg_rent = body.rental_income_monthly

    # carrying costs already borne
    monthly_costs = body.maintenance_monthly + body.property_tax_yearly / 12
    total_carry = monthly_costs * 12 * years + body.misc_expenses_inr
    total_rent = avg_rent * 12 * years
    net_carry = total_carry - total_rent  # positive = out-of-pocket, negative = net-positive

    b = body.broker_fee_pct / 100
    ltcg = body.ltcg_pct / 100
    loan = body.outstanding_loan
    P = body.purchase_price
    nc = net_carry
    target_profit = body.target_profit_inr

    def _net_proceeds(S):
        gain = max(S - P, 0)
        tax = gain * ltcg
        return S * (1 - b) - loan - tax

    def _solve_for_target_net(target):
        target_np = target + nc
        lo, hi = 0.0, max(P * 20, 1e9)
        for _ in range(60):
            mid = (lo + hi) / 2
            if _net_proceeds(mid) < target_np:
                lo = mid
            else:
                hi = mid
        return hi

    breakeven_price = _solve_for_target_net(0.0)
    target_price = _solve_for_target_net(target_profit)

    projected_np = _net_proceeds(projected_value)
    projected_net_after_carry = projected_np - nc
    implied_annual_return = 0.0
    if P > 0 and years > 0:
        capital_invested = max(P - loan, 1)
        if projected_net_after_carry > 0:
            implied_annual_return = ((projected_net_after_carry / capital_invested) ** (1 / years) - 1) * 100 if capital_invested > 0 else 0

    # True XIRR using cashflows: -dp at t0, periodic rent - costs, +projected_np at exit
    dp_initial = max(P - loan, 0)
    cfs = [(0, -dp_initial - body.misc_expenses_inr)]
    for y in range(1, int(years) + 1):
        cfs.append((y * 365, (avg_rent - monthly_costs) * 12))
    cfs.append((int(years * 365), projected_np))
    try:
        xirr_rate = _xirr(cfs) * 100
    except Exception:
        xirr_rate = 0.0

    return {
        "projected_sale_price": round(projected_value, 2),
        "projected_gross_proceeds": round(projected_value * (1 - b), 2),
        "projected_net_proceeds_after_loan_and_tax": round(projected_np, 2),
        "projected_net_in_hand": round(projected_net_after_carry, 2),
        "breakeven_sale_price": round(breakeven_price, 2),
        "target_profit_sale_price": round(target_price, 2),
        "total_carrying_cost": round(total_carry, 2),
        "misc_expenses": round(body.misc_expenses_inr, 2),
        "average_rent_used": round(avg_rent, 2),
        "total_rental_income": round(total_rent, 2),
        "net_carrying_cost": round(net_carry, 2),
        "implied_annual_return_pct": round(implied_annual_return, 2),
        "xirr_pct": round(xirr_rate, 2),
        "assumptions": {
            "broker_fee_pct": body.broker_fee_pct,
            "ltcg_pct": body.ltcg_pct,
            "years_held": body.years_held,
        },
    }


# ------------------------------------------------------------
# Loan Optimizer — sweep down_payment to find cashflow sweet spot
# ------------------------------------------------------------
class LoanOptimizerRequest(BaseModel):
    property_price: float
    monthly_rent: float = 0                   # legacy; optional if using rental_yield_pct
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    maintenance_monthly: float = 2000.0
    property_tax_yearly: float = 0.0
    # Under-construction mode
    under_construction: bool = False
    possession_months: int = 0
    pre_emi_only: bool = True
    disbursement_schedule: str = "linear"
    subvention_by_builder: bool = False
    # Leverage mode extensions
    appreciation_pct: float = 7.0
    rental_yield_pct: float = 3.0              # used if monthly_rent absent
    analysis_years: int = 10


@api_router.post("/calc/loan-optimizer")
async def loan_optimizer(body: LoanOptimizerRequest):
    # If monthly_rent missing, derive from yield
    monthly_rent = body.monthly_rent if body.monthly_rent > 0 else body.property_price * (body.rental_yield_pct / 100) / 12

    costs_monthly = body.maintenance_monthly + body.property_tax_yearly / 12
    grid = []
    months_build = max(body.possession_months if body.under_construction else 0, 0)
    r_m = (body.loan_rate / 100) / 12
    avg_frac = 0.5

    for pct in range(5, 101, 5):
        dp = body.property_price * pct / 100
        loan = body.property_price - dp
        emi = _emi(loan, body.loan_rate, body.loan_tenure_years)

        pre_emi_total = 0.0
        pre_emi_per_month = 0.0
        if body.under_construction and months_build > 0 and loan > 0:
            avg_disbursed = loan * avg_frac
            pre_emi_per_month = avg_disbursed * r_m
            pre_emi_total = pre_emi_per_month * months_build
            if body.subvention_by_builder:
                pre_emi_total = 0.0
                pre_emi_per_month = 0.0

        cashflow_after_possession = monthly_rent - emi - costs_monthly
        annual_cashflow = cashflow_after_possession * 12
        roi_annual = (annual_cashflow / dp * 100) if dp > 0 else 0

        # --- 10-year LEVERAGE ROI ---
        years = body.analysis_years
        final_value = body.property_price * ((1 + body.appreciation_pct / 100) ** years)
        # cumulative rent (growing at 7% p.a. as rough proxy)
        cum_rent = 0
        r_grow = 0.07
        for y in range(1, years + 1):
            cum_rent += monthly_rent * 12 * ((1 + r_grow) ** (y - 1))
        cum_emi_paid = emi * 12 * min(years, body.loan_tenure_years)
        out_loan_at_y = _loan_balance(loan, body.loan_rate, body.loan_tenure_years, min(years * 12, body.loan_tenure_years * 12))
        # Net equity at year N = final_value - outstanding_loan + cum_rent - cum_emi - pre_emi_total - costs_total
        costs_total = costs_monthly * 12 * years
        net_equity = final_value - out_loan_at_y + cum_rent - cum_emi_paid - pre_emi_total - costs_total
        # Leverage ROI = net_equity / dp (total over horizon)
        leverage_roi_total_pct = (net_equity / dp * 100) if dp > 0 else 0
        # CAGR
        cagr_pct = ((net_equity / dp) ** (1 / years) - 1) * 100 if dp > 0 and net_equity > 0 else 0

        # XIRR-based leverage return
        cfs = [(0, -dp)]
        if body.under_construction and pre_emi_per_month > 0:
            for m in range(1, months_build + 1):
                cfs.append((m * 30, -pre_emi_per_month))
        for y in range(1, years + 1):
            yearly_rent = monthly_rent * 12 * ((1 + r_grow) ** (y - 1))
            yearly_emi = emi * 12 if y * 12 <= body.loan_tenure_years * 12 else 0
            yearly_costs = costs_monthly * 12
            net = yearly_rent - yearly_emi - yearly_costs
            cfs.append((y * 365, net))
        cfs.append((years * 365, final_value - out_loan_at_y))
        try:
            xirr_pct = _xirr(cfs) * 100
        except Exception:
            xirr_pct = 0

        grid.append({
            "down_payment_pct": pct,
            "down_payment": round(dp, 2),
            "loan": round(loan, 2),
            "emi": round(emi, 2),
            "monthly_cashflow": round(cashflow_after_possession, 2),
            "annual_cashflow": round(annual_cashflow, 2),
            "cash_on_cash_return_pct": round(roi_annual, 2),
            "pre_emi_monthly": round(pre_emi_per_month, 2),
            "pre_emi_total": round(pre_emi_total, 2),
            "final_value": round(final_value, 2),
            "net_equity_at_horizon": round(net_equity, 2),
            "leverage_roi_pct_total": round(leverage_roi_total_pct, 2),
            "leverage_cagr_pct": round(cagr_pct, 2),
            "leverage_xirr_pct": round(xirr_pct, 2),
        })

    neutral = next((g for g in grid if g["monthly_cashflow"] >= 0), None)
    best_positive = max(grid, key=lambda g: g["monthly_cashflow"])
    best_coc = max([g for g in grid if g["down_payment"] > 0], key=lambda g: g["cash_on_cash_return_pct"], default=None)
    best_leverage_xirr = max([g for g in grid if g["down_payment"] > 0], key=lambda g: g["leverage_xirr_pct"], default=None)

    return {
        "grid": grid,
        "cashflow_neutral_min_dp_pct": neutral["down_payment_pct"] if neutral else None,
        "cashflow_neutral": neutral,
        "max_cashflow": best_positive,
        "best_cash_on_cash_return": best_coc,
        "best_leverage_xirr": best_leverage_xirr,
        "costs_monthly": round(costs_monthly, 2),
        "monthly_rent_used": round(monthly_rent, 2),
        "analysis_years": body.analysis_years,
        "under_construction": body.under_construction,
        "possession_months": months_build,
        "subvention_by_builder": body.subvention_by_builder,
        "disbursement_schedule": body.disbursement_schedule,
        "narrative": [
            f"Monthly rent used: ₹{int(monthly_rent):,} (from {'your input' if body.monthly_rent > 0 else f'{body.rental_yield_pct}% yield'}).",
            f"Best leverage XIRR over {body.analysis_years} years: {round((best_leverage_xirr or {}).get('leverage_xirr_pct', 0), 1)}% at {(best_leverage_xirr or {}).get('down_payment_pct', '—')}% DP.",
            f"Max monthly cashflow: +₹{int(best_positive['monthly_cashflow']):,} at {best_positive['down_payment_pct']}% DP.",
            f"Lower DP ⇒ higher leverage on appreciation; higher DP ⇒ better monthly cashflow. Pick your trade-off.",
        ],
    }


# ------------------------------------------------------------
# Billing / Razorpay
# ------------------------------------------------------------
PLANS = {
    "monthly": {"id": "monthly", "label": "Pro · Monthly", "amount_inr": PRO_MONTHLY_INR, "days": 30},
    "yearly": {"id": "yearly", "label": "Pro · Yearly", "amount_inr": PRO_YEARLY_INR, "days": 365, "savings": "save 17%"},
}


def _require_admin(user: dict):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")


def _require_pro(user: dict):
    state = _compute_plan_state(user)
    if not state["is_pro"]:
        raise HTTPException(status_code=402, detail="Pro plan required")


@api_router.get("/billing/plans")
async def billing_plans():
    return {
        "currency": "INR",
        "trial_days": TRIAL_DAYS,
        "razorpay_key_id": RAZORPAY_KEY_ID,
        "plans": [
            {
                "id": "free",
                "label": "Free",
                "amount_inr": 0,
                "features": [
                    "Up to 3 properties",
                    "EMI + Rent vs Buy calculators",
                    "Basic side-by-side compare",
                ],
            },
            {
                "id": "monthly",
                "label": "Pro · Monthly",
                "amount_inr": PRO_MONTHLY_INR,
                "features": [
                    "Unlimited properties & saved scenarios",
                    "AI Advisor (Claude Sonnet 4.5)",
                    "Portfolio timeline & Sold ledger",
                    "CSV / PDF exports & Share links",
                    "City presets, investments comparison, cashflow finder",
                ],
            },
            {
                "id": "yearly",
                "label": "Pro · Yearly",
                "amount_inr": PRO_YEARLY_INR,
                "savings": "Save ~17% (2 months free)",
                "features": [
                    "Everything in Monthly",
                    "17% savings vs monthly",
                    "Priority support",
                ],
            },
        ],
    }


@api_router.get("/billing/me")
async def billing_me(user: dict = Depends(get_current_user)):
    state = _compute_plan_state(user)
    # persist any state change (trial → expired etc.)
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"plan": state["plan"], "plan_status": state["plan_status"]}},
    )
    txns = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {**state, "transactions": txns}


class CreateOrderIn(BaseModel):
    plan_id: str  # "monthly" | "yearly"


@api_router.post("/billing/create-order")
async def create_order(body: CreateOrderIn, user: dict = Depends(get_current_user)):
    if not razor_client:
        raise HTTPException(500, "Razorpay not configured")
    plan = PLANS.get(body.plan_id)
    if not plan:
        raise HTTPException(400, "Invalid plan")
    amount_paise = plan["amount_inr"] * 100
    receipt = f"estima_{user['id'][:10]}_{int(datetime.now(timezone.utc).timestamp())}"[:40]
    try:
        order = razor_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
            "notes": {"plan_id": body.plan_id, "user_id": user["id"], "email": user["email"]},
        })
    except Exception as e:
        logger.exception("razorpay order failed")
        raise HTTPException(502, f"Could not create order: {str(e)[:200]}")
    await db.transactions.insert_one({
        "user_id": user["id"],
        "email": user["email"],
        "plan_id": body.plan_id,
        "amount_inr": plan["amount_inr"],
        "order_id": order["id"],
        "status": "created",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID,
        "plan_label": plan["label"],
        "customer": {"name": user.get("name", ""), "email": user["email"]},
    }


class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api_router.post("/billing/verify-payment")
async def verify_payment(body: VerifyPaymentIn, user: dict = Depends(get_current_user)):
    if not razor_client:
        raise HTTPException(500, "Razorpay not configured")
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        await db.transactions.update_one(
            {"order_id": body.razorpay_order_id, "user_id": user["id"]},
            {"$set": {"status": "failed", "payment_id": body.razorpay_payment_id}},
        )
        raise HTTPException(400, "Invalid payment signature")

    txn = await db.transactions.find_one({"order_id": body.razorpay_order_id, "user_id": user["id"]}, {"_id": 0})
    if not txn:
        raise HTTPException(404, "Transaction not found")

    plan = PLANS.get(txn["plan_id"])
    if not plan:
        raise HTTPException(400, "Invalid plan on transaction")

    # Extend from existing expiry if still active, else from now
    now = datetime.now(timezone.utc)
    current = await db.users.find_one({"_id": ObjectId(user["id"])})
    state = _compute_plan_state(current) if current else {"plan_expires_at": None, "is_pro": False}
    base = now
    if state.get("is_pro") and state.get("plan_expires_at"):
        try:
            existing = datetime.fromisoformat(state["plan_expires_at"].replace("Z", "+00:00"))
            if existing > now:
                base = existing
        except Exception:
            pass
    new_expires = base + timedelta(days=plan["days"])

    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {
            "plan": "pro",
            "plan_status": "active",
            "plan_expires_at": new_expires.isoformat(),
        }},
    )
    await db.transactions.update_one(
        {"order_id": body.razorpay_order_id, "user_id": user["id"]},
        {"$set": {
            "status": "success",
            "payment_id": body.razorpay_payment_id,
            "signature": body.razorpay_signature,
            "verified_at": now.isoformat(),
        }},
    )
    refreshed = await db.users.find_one({"_id": ObjectId(user["id"])})
    refreshed["id"] = user["id"]
    return {
        "ok": True,
        "plan_expires_at": new_expires.isoformat(),
        "user": _user_out(refreshed).model_dump(),
    }


@api_router.post("/billing/cancel")
async def cancel_plan(user: dict = Depends(get_current_user)):
    # "cancel" downgrades immediately to free (simple approach)
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$set": {"plan": "free", "plan_status": "expired", "plan_expires_at": None}},
    )
    return {"ok": True}


# ------------------------------------------------------------
# Admin
# ------------------------------------------------------------
@api_router.get("/admin/stats")
async def admin_stats(user: dict = Depends(get_current_user)):
    _require_admin(user)
    total_users = await db.users.count_documents({})
    pro_users = await db.users.count_documents({"plan": "pro", "plan_status": {"$in": ["active", "trial"]}})
    trial_users = await db.users.count_documents({"plan_status": "trial"})

    total_revenue = 0
    txn_count = 0
    async for t in db.transactions.find({"status": "success"}):
        total_revenue += t.get("amount_inr", 0)
        txn_count += 1

    total_properties = await db.properties.count_documents({})
    owned_props = await db.properties.count_documents({"status": "owned"})
    sold_props = await db.properties.count_documents({"status": "sold"})

    return {
        "users": {"total": total_users, "pro": pro_users, "trial": trial_users, "free": max(total_users - pro_users, 0)},
        "revenue": {"total_inr": total_revenue, "successful_transactions": txn_count},
        "properties": {"total": total_properties, "owned": owned_props, "sold": sold_props},
    }


@api_router.get("/admin/users")
async def admin_users(user: dict = Depends(get_current_user)):
    _require_admin(user)
    out = []
    async for u in db.users.find({}).sort("created_at", -1):
        uid = str(u["_id"])
        u["id"] = uid
        state = _compute_plan_state(u)
        out.append({
            "id": uid,
            "email": u["email"],
            "name": u.get("name", ""),
            "role": u.get("role", "user"),
            "plan": state["plan"],
            "plan_status": state["plan_status"],
            "trial_ends_at": state["trial_ends_at"],
            "plan_expires_at": state["plan_expires_at"],
            "is_pro": state["is_pro"],
            "created_at": u.get("created_at"),
        })
    return out


@api_router.get("/admin/transactions")
async def admin_transactions(user: dict = Depends(get_current_user)):
    _require_admin(user)
    out = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return out


class AdminActionIn(BaseModel):
    action: str  # "promote" | "demote" | "grant_pro" | "cancel_pro"
    days: int = 30


@api_router.post("/admin/users/{user_id}/action")
async def admin_user_action(user_id: str, body: AdminActionIn, user: dict = Depends(get_current_user)):
    _require_admin(user)
    try:
        target = await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(400, "Invalid user id")
    if not target:
        raise HTTPException(404, "User not found")

    update = {}
    if body.action == "promote":
        update["role"] = "admin"
    elif body.action == "demote":
        if target["_id"] == ObjectId(user["id"]):
            raise HTTPException(400, "Cannot demote yourself")
        update["role"] = "user"
    elif body.action == "grant_pro":
        now = datetime.now(timezone.utc)
        update["plan"] = "pro"
        update["plan_status"] = "active"
        update["plan_expires_at"] = (now + timedelta(days=body.days)).isoformat()
    elif body.action == "cancel_pro":
        update["plan"] = "free"
        update["plan_status"] = "expired"
        update["plan_expires_at"] = None
    elif body.action == "extend_trial":
        # Extend trial by body.days from now (or from current trial end if still trialing)
        now = datetime.now(timezone.utc)
        current_trial = target.get("trial_ends_at")
        base = now
        if current_trial:
            try:
                te = datetime.fromisoformat(current_trial.replace("Z", "+00:00"))
                if te > now:
                    base = te
            except Exception:
                pass
        new_end = base + timedelta(days=body.days)
        update["plan"] = "pro"
        update["plan_status"] = "trial"
        update["trial_ends_at"] = new_end.isoformat()
        update["plan_expires_at"] = None
    else:
        raise HTTPException(400, "Unknown action")

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update})
    return {"ok": True}


# ------------------------------------------------------------
# Portfolio vs Markets (Investments)
# ------------------------------------------------------------
DEFAULT_MARKET_RETURNS = {
    "equity": 13.0,        # Nifty 50 long-term CAGR
    "mutual_funds": 11.0,  # diversified MF CAGR
    "gold": 9.0,           # historical INR gold
    "silver": 8.5,
    "fd": 7.0,             # bank fixed deposit
}


class VsInvestmentsRequest(BaseModel):
    returns: Optional[dict] = None  # override DEFAULT_MARKET_RETURNS; keys -> % CAGR
    owned_ids: Optional[List[str]] = None  # subset


@api_router.post("/portfolio/vs-investments")
async def portfolio_vs_investments(body: VsInvestmentsRequest, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"], "status": {"$in": ["owned", "sold"]}}
    if body.owned_ids:
        q["id"] = {"$in": body.owned_ids}
    props = await db.properties.find(q, {"_id": 0}).to_list(500)
    # only dated
    props = [p for p in props if p.get("purchase_date") and (p.get("purchase_price") or p.get("price"))]
    if not props:
        return {"series": [], "earliest_year": None, "summary": {}}

    def _yr(s):
        try:
            return int(s[:4])
        except Exception:
            return datetime.now(timezone.utc).year

    current_year = datetime.now(timezone.utc).year
    earliest_year = min(_yr(p["purchase_date"]) for p in props)

    returns = {**DEFAULT_MARKET_RETURNS, **(body.returns or {})}

    series = []
    total_rental_accumulated = 0.0
    prev_year = earliest_year - 1
    for year in range(earliest_year, current_year + 1):
        prop_value = 0.0
        rental_this_year = 0.0
        alt_values = {k: 0.0 for k in returns.keys()}

        for p in props:
            pyear = _yr(p["purchase_date"])
            if year < pyear:
                continue
            purchase_price = p.get("purchase_price") or p.get("price") or 0
            # Property value contribution — different for owned vs sold
            if p.get("status") == "sold" and p.get("sold_date"):
                syear = _yr(p["sold_date"])
                sold_price = p.get("sold_price") or purchase_price
                if year < syear:
                    span = max(syear - pyear, 1)
                    ratio = (year - pyear) / span
                    pv = purchase_price + (sold_price - purchase_price) * ratio
                    prop_value += pv
                    # rental for owned-during-hold period only if marked rented historically — unknown, skip unless flag
                else:
                    # property realized — carry sold_price forward as "cash"
                    prop_value += sold_price
            else:
                current_value = p.get("current_value") or purchase_price
                span = max(current_year - pyear, 1)
                ratio = min((year - pyear) / span, 1.0)
                pv = purchase_price + (current_value - purchase_price) * ratio
                prop_value += pv
                # rental income (annual) if actively rented
                if p.get("rented") and p.get("monthly_rent_income"):
                    rental_this_year += p["monthly_rent_income"] * 12

            # Alt classes: invested staggered at purchase_year
            years_elapsed = year - pyear
            for k, rate in returns.items():
                alt_values[k] += purchase_price * ((1 + rate / 100) ** years_elapsed)

        total_rental_accumulated += rental_this_year
        prop_plus_rental = prop_value + total_rental_accumulated

        row = {
            "year": year,
            "property": round(prop_value, 2),
            "property_plus_rental": round(prop_plus_rental, 2),
            "rental_accumulated": round(total_rental_accumulated, 2),
        }
        for k, v in alt_values.items():
            row[k] = round(v, 2)
        series.append(row)
        prev_year = year

    last = series[-1] if series else {}
    total_invested = sum((p.get("purchase_price") or p.get("price") or 0) for p in props)
    summary = {
        "total_invested": round(total_invested, 2),
        "property_current": last.get("property", 0),
        "property_plus_rental_current": last.get("property_plus_rental", 0),
        "rental_income_total": round(total_rental_accumulated, 2),
        "property_gain_pct": round((last.get("property_plus_rental", 0) - total_invested) / total_invested * 100, 2) if total_invested else 0,
        "comparisons": [],
    }
    for k in returns.keys():
        final = last.get(k, 0)
        summary["comparisons"].append({
            "asset": k,
            "final": final,
            "gain_pct": round((final - total_invested) / total_invested * 100, 2) if total_invested else 0,
            "delta_vs_property": round(final - last.get("property_plus_rental", 0), 2),
            "rate": returns[k],
        })
    summary["comparisons"].sort(key=lambda x: x["final"], reverse=True)
    winners = sorted(
        [("Property + Rental", last.get("property_plus_rental", 0))]
        + [(c["asset"], c["final"]) for c in summary["comparisons"]],
        key=lambda x: x[1],
        reverse=True,
    )
    summary["winner"] = winners[0][0] if winners else None
    summary["winner_value"] = winners[0][1] if winners else 0

    return {
        "earliest_year": earliest_year,
        "series": series,
        "returns": returns,
        "summary": summary,
    }


# ------------------------------------------------------------
# Google Auth (Emergent-managed)
# ------------------------------------------------------------
class GoogleSessionIn(BaseModel):
    session_id: str


@api_router.post("/auth/google/session", response_model=UserOut)
async def google_session(body: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for user profile, create/merge our user, set JWT cookies."""
    try:
        r = httpx_requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
            timeout=10,
        )
        if r.status_code != 200:
            raise HTTPException(401, "Invalid Google session")
        data = r.json()
    except HTTPException:
        raise
    except Exception:
        logger.exception("google session failed")
        raise HTTPException(502, "Could not validate Google session")

    email = (data.get("email") or "").lower().strip()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    if not email:
        raise HTTPException(400, "Google profile missing email")

    now = datetime.now(timezone.utc)
    existing = await db.users.find_one({"email": email})
    if existing:
        uid = str(existing["_id"])
        updates = {"google_linked": True, "picture": picture}
        await db.users.update_one({"_id": existing["_id"]}, {"$set": updates})
        user_doc = {**existing, **updates, "id": uid}
    else:
        trial_end = now + timedelta(days=TRIAL_DAYS)
        referral_code = secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8].upper()
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = secrets.token_urlsafe(6).upper()[:8]
        doc = {
            "email": email,
            "name": name,
            "password_hash": "",          # no password — google-only
            "role": "user",
            "plan": "pro",
            "plan_status": "trial",
            "trial_ends_at": trial_end.isoformat(),
            "plan_expires_at": None,
            "google_linked": True,
            "picture": picture,
            "referral_code": referral_code,
            "created_at": now.isoformat(),
        }
        result = await db.users.insert_one(doc)
        uid = str(result.inserted_id)
        user_doc = {**doc, "id": uid}
        try:
            subj, html = notify.tpl_welcome(name, TRIAL_DAYS)
            notify.send_email(email, subj, html)
        except Exception:
            logger.exception("google welcome email failed")

    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return _user_out(user_doc)


# ------------------------------------------------------------
# Tenants + Rent Receipts
# ------------------------------------------------------------
class TenantIn(BaseModel):
    property_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    monthly_rent: float = 0.0
    deposit: float = 0.0
    lease_start: Optional[str] = None   # ISO
    lease_end: Optional[str] = None
    notes: str = ""


@api_router.get("/tenants")
async def list_tenants(property_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if property_id:
        q["property_id"] = property_id
    return await db.tenants.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/tenants")
async def create_tenant(body: TenantIn, user: dict = Depends(get_current_user)):
    # ensure property belongs to user
    prop = await db.properties.find_one({"user_id": user["id"], "id": body.property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(404, "Property not found")
    doc = body.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["user_id"] = user["id"]
    doc["property_name"] = prop["name"]
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.tenants.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, body: TenantIn, user: dict = Depends(get_current_user)):
    existing = await db.tenants.find_one({"id": tenant_id, "user_id": user["id"]}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Tenant not found")
    prop = await db.properties.find_one({"user_id": user["id"], "id": body.property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(404, "Property not found")
    data = body.model_dump()
    data["property_name"] = prop["name"]
    await db.tenants.update_one({"id": tenant_id, "user_id": user["id"]}, {"$set": data})
    existing.update(data)
    return existing


@api_router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, user: dict = Depends(get_current_user)):
    res = await db.tenants.delete_one({"id": tenant_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tenant not found")
    return {"ok": True}


class RentReceiptRequest(BaseModel):
    tenant_id: str
    month: str              # "April 2026"
    amount: float
    paid_on: Optional[str] = None   # ISO date
    payment_mode: str = "Bank Transfer"
    notes: str = ""
    send_email: bool = False


@api_router.post("/tenants/{tenant_id}/receipts")
async def generate_rent_receipt(tenant_id: str, body: RentReceiptRequest, user: dict = Depends(get_current_user)):
    tenant = await db.tenants.find_one({"id": tenant_id, "user_id": user["id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    prop = await db.properties.find_one({"user_id": user["id"], "id": tenant["property_id"]}, {"_id": 0})
    receipt_no = f"RR-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    paid_on = body.paid_on or datetime.now(timezone.utc).strftime("%Y-%m-%d")

    receipt_doc = {
        "id": str(uuid.uuid4()),
        "receipt_no": receipt_no,
        "user_id": user["id"],
        "tenant_id": tenant_id,
        "tenant_name": tenant["name"],
        "tenant_email": tenant.get("email"),
        "property_id": tenant["property_id"],
        "property_name": prop["name"] if prop else tenant.get("property_name"),
        "property_location": prop.get("location", "") if prop else "",
        "month": body.month,
        "amount": body.amount,
        "paid_on": paid_on,
        "payment_mode": body.payment_mode,
        "notes": body.notes,
        "landlord_name": user.get("name", ""),
        "landlord_email": user.get("email", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.rent_receipts.insert_one(receipt_doc.copy())
    receipt_doc.pop("_id", None)

    if body.send_email and tenant.get("email"):
        try:
            subj, html = notify.tpl_rent_receipt_email(tenant["name"], receipt_doc["property_name"], body.month, _inr(body.amount))
            notify.send_email(tenant["email"], subj, html)
        except Exception:
            logger.exception("receipt email failed")

    return receipt_doc


@api_router.get("/tenants/{tenant_id}/receipts")
async def list_receipts(tenant_id: str, user: dict = Depends(get_current_user)):
    tenant = await db.tenants.find_one({"id": tenant_id, "user_id": user["id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    return await db.rent_receipts.find({"tenant_id": tenant_id, "user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.get("/receipts/{receipt_id}/pdf")
async def receipt_pdf(receipt_id: str, user: dict = Depends(get_current_user)):
    r = await db.rent_receipts.find_one({"id": receipt_id, "user_id": user["id"]}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Receipt not found")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm)
    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle("t", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=22, textColor=colors.HexColor("#141311"), spaceAfter=4)
    sub_style = ParagraphStyle("s", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#999"), spaceAfter=18)
    body_style = ParagraphStyle("b", parent=styles["Normal"], fontSize=10, textColor=colors.HexColor("#141311"), leading=14)

    story.append(Paragraph("RENT RECEIPT", title_style))
    story.append(Paragraph(f"Receipt no: {r['receipt_no']} &nbsp;·&nbsp; Issued {datetime.fromisoformat(r['created_at']).strftime('%d %b %Y')}", sub_style))

    # Parties block
    party = [
        ["FROM (Landlord)", "TO (Tenant)"],
        [r.get("landlord_name") or "—", r["tenant_name"]],
        [r.get("landlord_email") or "", r.get("tenant_email") or ""],
    ]
    pt = Table(party, colWidths=[85 * mm, 85 * mm])
    pt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#999")),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(pt)
    story.append(Spacer(1, 14))

    # Details table
    data = [
        ["Property", r.get("property_name") or "—"],
        ["Location", r.get("property_location") or "—"],
        ["Month", r["month"]],
        ["Payment mode", r.get("payment_mode", "—")],
        ["Paid on", r.get("paid_on", "—")],
        ["Amount (INR)", f"₹ {r['amount']:,.2f}"],
    ]
    t = Table(data, colWidths=[45 * mm, 125 * mm])
    t.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#999")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#FAFAFA")),
        ("FONTNAME", (1, -1), (1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#E0DDD8")),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(t)

    if r.get("notes"):
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"<i>Notes: {r['notes']}</i>", body_style))

    story.append(Spacer(1, 28))
    story.append(Paragraph("Signature: _______________________________", body_style))
    story.append(Spacer(1, 18))
    story.append(Paragraph(
        "Generated by Estima. This receipt is computed from user-supplied inputs. Amounts are indicative — verify with your landlord, CA, and bank records before relying on it for tax purposes.",
        ParagraphStyle("f", parent=styles["Normal"], fontSize=7, textColor=colors.HexColor("#999")),
    ))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename=rent-receipt-{r["receipt_no"]}.pdf'},
    )


# ------------------------------------------------------------
# Builder Payment Plan Calculator
# ------------------------------------------------------------
class BuilderPlanRequest(BaseModel):
    property_price: float
    possession_months: int = 36          # time to possession
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    opportunity_return: float = 11.0     # what you would earn on idle cash (MF)
    subvention_rate_diff: float = 0.0    # builder pre-EMI savings if any


def _plan_total_cost(schedule: list, loan_amount: float, rate: float, tenure_years: int,
                     possession_months: int, opp_return: float) -> dict:
    """schedule: list of (month_offset, amount, who_pays_emi) — simplified cost model.

    Returns:
      total_cash_outflow (paid by buyer during construction)
      emi_during_construction (buyer-borne)
      opportunity_cost (idle-cash cost)
      total_loan_interest_to_possession
    """
    r = (rate / 100) / 12
    balance = 0.0
    months = 0
    buyer_emi_paid = 0.0
    total_paid = 0.0
    opp_cost = 0.0

    # amortize progressively: each payment from buyer adds to paid; loan disbursed proportionally
    for offset, amt, emi_by_builder in schedule:
        months = offset
        # before this tranche, opportunity cost on remaining cash (assume buyer had full price parked)
        # simplified: opp_cost = sum over tranches of amt * return * (months_until_paid / 12)
        opp_cost += amt * (opp_return / 100) * (offset / 12) * 0.5  # half because linearly deployed
        total_paid += amt
        balance += amt  # as if all cash from buyer; for mix with loan, skip
    # buyer EMI during construction (if subvention not applicable)
    emi = _emi(loan_amount, rate, tenure_years)
    construction_months = possession_months
    return {
        "emi_monthly": round(emi, 2),
        "total_cash_paid_by_possession": round(total_paid, 2),
        "opportunity_cost_idle_capital": round(opp_cost, 2),
    }


@api_router.post("/calc/builder-plan")
async def builder_plan(body: BuilderPlanRequest):
    """Compare popular builder payment plans.

    CLP: ~10% booking, balance progressive over 36 months, buyer pays own EMI.
    10:90: 10% now, 90% on possession — big balloon. Buyer usually avoids pre-EMI during build.
    20:80: 20% now, 80% on possession. Similar to 10:90.
    Subvention (pre-EMI paid by builder): buyer pays ~5-10% down, bank disburses, builder pays interest
                                          until possession. Buyer EMI starts at possession.
    """
    price = body.property_price
    months = max(body.possession_months, 1)
    rate = body.loan_rate
    r = (rate / 100) / 12
    n_total_months = body.loan_tenure_years * 12
    opp = body.opportunity_return / 100

    # Helper: pre-EMI interest-only during construction (common in subvention): buyer pays interest * principal
    def _total_pre_emi(loan_amount, construction_months):
        # interest-only monthly
        return loan_amount * r * construction_months

    def _emi_local(loan):
        return _emi(loan, rate, body.loan_tenure_years)

    plans = []

    # ----- CLP (Construction-Linked, 10 slabs over possession) -----
    clp_down = price * 0.10
    clp_loan = price - clp_down
    clp_pre_emi = _total_pre_emi(clp_loan, months)
    # Opportunity cost: buyer has already parked down payment; the rest follows slabs
    clp_opp = clp_down * opp * (months / 12)   # opp cost on initial 10% during build
    plans.append({
        "id": "clp",
        "name": "Construction-Linked Plan (CLP)",
        "description": "Pay in slabs linked to construction milestones.",
        "down_payment": round(clp_down, 2),
        "loan_amount": round(clp_loan, 2),
        "pre_emi_total": round(clp_pre_emi, 2),
        "pre_emi_by_buyer": round(clp_pre_emi, 2),
        "monthly_emi_after_possession": round(_emi_local(clp_loan), 2),
        "opportunity_cost_during_build": round(clp_opp, 2),
        "effective_total_cost": round(price + clp_pre_emi + clp_opp, 2),
    })

    # ----- 10:90 -----
    ten_down = price * 0.10
    ten_loan = price - ten_down
    # 10:90 — lender disburses at possession only, so no pre-EMI to buyer
    ten_pre_emi = 0
    ten_opp = ten_down * opp * (months / 12)
    plans.append({
        "id": "10_90",
        "name": "10:90 Plan",
        "description": "10% now, 90% at possession. No pre-EMI burden.",
        "down_payment": round(ten_down, 2),
        "loan_amount": round(ten_loan, 2),
        "pre_emi_total": 0,
        "pre_emi_by_buyer": 0,
        "monthly_emi_after_possession": round(_emi_local(ten_loan), 2),
        "opportunity_cost_during_build": round(ten_opp, 2),
        "effective_total_cost": round(price + ten_opp, 2),
    })

    # ----- 20:80 -----
    twenty_down = price * 0.20
    twenty_loan = price - twenty_down
    twenty_pre_emi = 0
    twenty_opp = twenty_down * opp * (months / 12)
    plans.append({
        "id": "20_80",
        "name": "20:80 Plan",
        "description": "20% now, 80% at possession. No pre-EMI during build.",
        "down_payment": round(twenty_down, 2),
        "loan_amount": round(twenty_loan, 2),
        "pre_emi_total": 0,
        "pre_emi_by_buyer": 0,
        "monthly_emi_after_possession": round(_emi_local(twenty_loan), 2),
        "opportunity_cost_during_build": round(twenty_opp, 2),
        "effective_total_cost": round(price + twenty_opp, 2),
    })

    # ----- Subvention (Pre-EMI paid by builder) -----
    sub_down = price * 0.10
    sub_loan = price - sub_down
    sub_pre_emi = _total_pre_emi(sub_loan, months)
    sub_opp = sub_down * opp * (months / 12)
    plans.append({
        "id": "subvention",
        "name": "Subvention (Pre-EMI by builder)",
        "description": "10% now, bank disburses full loan, builder pays pre-EMI interest till possession.",
        "down_payment": round(sub_down, 2),
        "loan_amount": round(sub_loan, 2),
        "pre_emi_total": round(sub_pre_emi, 2),
        "pre_emi_by_buyer": 0,
        "monthly_emi_after_possession": round(_emi_local(sub_loan), 2),
        "opportunity_cost_during_build": round(sub_opp, 2),
        "effective_total_cost": round(price + sub_opp, 2),
    })

    winner = min(plans, key=lambda p: p["effective_total_cost"])
    worst = max(plans, key=lambda p: p["effective_total_cost"])
    return {
        "plans": plans,
        "winner": winner["id"],
        "winner_name": winner["name"],
        "savings_vs_worst": round(worst["effective_total_cost"] - winner["effective_total_cost"], 2),
        "possession_months": months,
    }


# ------------------------------------------------------------
# Feedback
# ------------------------------------------------------------
class FeedbackIn(BaseModel):
    category: str = "general"   # general | bug | idea | love
    message: str
    rating: Optional[int] = None  # 1-5
    page: Optional[str] = None    # URL of page it was submitted from


@api_router.post("/feedback")
async def create_feedback(body: FeedbackIn, user: dict = Depends(get_current_user)):
    if not body.message.strip():
        raise HTTPException(400, "Message required")
    await db.feedback.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "category": body.category,
        "message": body.message.strip()[:4000],
        "rating": body.rating,
        "page": body.page,
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True}


@api_router.get("/admin/feedback")
async def admin_feedback(user: dict = Depends(get_current_user)):
    _require_admin(user)
    return await db.feedback.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api_router.post("/admin/feedback/{fid}/status")
async def admin_update_feedback(fid: str, body: dict, user: dict = Depends(get_current_user)):
    _require_admin(user)
    status = body.get("status", "triaged")
    await db.feedback.update_one({"id": fid}, {"$set": {"status": status}})
    return {"ok": True}


# ------------------------------------------------------------
# Wealth Narrative — property-first long-term wealth logic
# ------------------------------------------------------------
class WealthNarrativeRequest(BaseModel):
    property_price: float = 10000000
    down_payment_pct: float = 20
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    appreciation_pct: float = 7.0
    city_tier: Literal["tier1", "tier2", "tier3"] = "tier1"
    monthly_rent_today: float = 30000        # what you'd pay to rent equivalent
    rent_increase_pct: float = 8.0
    alt_return_pct: float = 12.0             # Nifty/MF alternative
    horizon_years: int = 25
    pass_to_generation: bool = True           # 0-cost inheritance for family
    legacy_bonus_pct: float = 15.0            # illiquidity premium for a held legacy asset


@api_router.post("/calc/wealth-narrative")
async def wealth_narrative(body: WealthNarrativeRequest):
    """Long-horizon property vs rent+invest comparison with:
        - rent inflation over the full horizon,
        - capital appreciation of the property,
        - EMI ending after tenure → 100% owned,
        - optional generational-transfer bonus (zero tax at inheritance in India for real estate),
        - tier-1 premium kicker on appreciation.
    """
    price = body.property_price
    dp = price * body.down_payment_pct / 100
    loan = price - dp
    emi = _emi(loan, body.loan_rate, body.loan_tenure_years)
    appr = body.appreciation_pct / 100
    if body.city_tier == "tier1":
        appr *= 1.15  # tier-1 premium: well-located tier-1 tends to outpace index appreciation
    elif body.city_tier == "tier3":
        appr *= 0.85

    r_alt = body.alt_return_pct / 100
    r_rent = body.rent_increase_pct / 100

    series = []
    rent_inv = dp  # renter invests the down payment instead
    cum_rent_paid = 0
    cum_emi_paid = 0
    monthly_rent = body.monthly_rent_today
    monthly_emi = emi
    tenure_months = body.loan_tenure_years * 12

    for y in range(1, body.horizon_years + 1):
        year_rent = monthly_rent * 12 * ((1 + r_rent) ** 0.5)  # mid-year approximation
        year_emi = monthly_emi * 12 if y * 12 <= tenure_months else 0
        cum_rent_paid += year_rent
        cum_emi_paid += year_emi

        # Property compounded value
        prop_value = price * ((1 + appr) ** y)

        # Renter's alternative portfolio: dp compounded + each year's rent-save (if any) invested
        # net monthly difference: emi (if owed) - rent
        rent_inv = rent_inv * (1 + r_alt)
        # Renter saves emi-vs-rent delta only when emi > rent? In India reality: buyer pays emi out of same income
        # Fair comparison: renter invests the DIFFERENCE (emi - rent) in alt every year
        annual_diff = (monthly_emi * 12 if y * 12 <= tenure_months else 0) - monthly_rent * 12
        if annual_diff > 0:
            rent_inv += annual_diff * (1 + r_alt) ** 0.5  # mid-year invest
        # if annual_diff < 0, renter could invest it too; but buyer also has extra after tenure

        # Post-tenure: buyer has no EMI → imagine buyer starts investing emi equivalent into alt
        # (accumulated into buy_savings_postTenure below)

        # Buyer net worth = property value + (savings after tenure) - outstanding loan balance
        months_paid = min(y * 12, tenure_months)
        outstanding_loan = _loan_balance(loan, body.loan_rate, body.loan_tenure_years, months_paid)
        buy_assets = prop_value - outstanding_loan
        buy_savings_postTenure = emi * 12 * max(0, y - body.loan_tenure_years) * (1 + r_alt) ** (max(0, y - body.loan_tenure_years) / 2)
        buy_nw = buy_assets + buy_savings_postTenure

        series.append({
            "year": y,
            "property_value": round(prop_value, 2),
            "outstanding_loan": round(outstanding_loan, 2),
            "buy_net_worth": round(buy_nw, 2),
            "rent_net_worth": round(rent_inv, 2),
            "rent_paid_cumulative": round(cum_rent_paid, 2),
            "monthly_rent_this_year": round(monthly_rent, 2),
        })

        monthly_rent *= (1 + r_rent)

    final = series[-1]
    buy_wealth = final["buy_net_worth"]
    if body.pass_to_generation:
        buy_wealth *= (1 + body.legacy_bonus_pct / 100)
    rent_wealth = final["rent_net_worth"]
    delta = buy_wealth - rent_wealth
    crossover = next((s["year"] for s in series if s["buy_net_worth"] >= s["rent_net_worth"]), None)

    narratives = [
        f"Over {body.horizon_years} years, your property compounds at ~{round(appr*100,1)}% p.a. — index appreciation plus the tier-1 premium of being in a land-constrained city.",
        f"Rent starting at ₹{int(body.monthly_rent_today):,}/mo grows to ₹{int(final['monthly_rent_this_year']):,}/mo by year {body.horizon_years} — an annual compounding that you escape the moment you own.",
        f"EMI ends after year {body.loan_tenure_years}. From year {body.loan_tenure_years+1} onwards every rupee that used to go to the bank becomes investable — compounding into your net worth.",
        f"Total rent you would have paid across the horizon: ₹{int(final['rent_paid_cumulative']):,}. This money is gone forever.",
    ]
    if body.pass_to_generation:
        narratives.append(f"Generational transfer: in India, property transferred via will/inheritance attracts 0% capital gains at the point of transfer — a {body.legacy_bonus_pct}% illiquidity/legacy premium is applied.")
    if crossover:
        narratives.append(f"Property net worth crosses rent-invest portfolio in year {crossover}.")

    return {
        "inputs": body.model_dump(),
        "series": series,
        "final_buy_wealth": round(buy_wealth, 2),
        "final_rent_wealth": round(rent_wealth, 2),
        "delta": round(delta, 2),
        "winner": "Buy" if delta > 0 else "Rent",
        "crossover_year": crossover,
        "narratives": narratives,
        "tier_premium_applied_pct": round((appr - body.appreciation_pct / 100) * 100, 2),
    }


def _loan_balance(principal: float, rate_annual_pct: float, tenure_years: int, months_paid: int) -> float:
    """Outstanding loan balance after `months_paid` EMIs."""
    if principal <= 0 or months_paid <= 0:
        return max(principal, 0)
    r = (rate_annual_pct / 100) / 12
    n = tenure_years * 12
    if r == 0:
        return max(principal - (principal / n) * months_paid, 0)
    m = months_paid
    # Standard amortization: bal = P * ((1+r)^n - (1+r)^m) / ((1+r)^n - 1)
    bal = principal * (((1 + r) ** n) - ((1 + r) ** m)) / (((1 + r) ** n) - 1)
    return max(bal, 0)


# ------------------------------------------------------------
# Rent-for-cashflow — what rent makes owned property cashflow-positive in N years
# ------------------------------------------------------------
class RentForCashflowRequest(BaseModel):
    current_value: float = 8000000
    outstanding_loan: float = 4500000
    current_emi: float                      # your actual EMI
    current_rent: float = 0                  # what it rents for today (0 if vacant)
    rent_increase_pct: float = 8.0
    maintenance_monthly: float = 3000.0
    property_tax_yearly: float = 12000.0
    target_years_to_positive: int = 3        # must be CF-positive by year N


@api_router.post("/calc/rent-for-cashflow")
async def rent_for_cashflow(body: RentForCashflowRequest):
    costs_monthly = body.maintenance_monthly + body.property_tax_yearly / 12
    # rent must cover: emi + costs at year N
    # current_rent * (1+g)^N >= emi + costs
    g = body.rent_increase_pct / 100
    required_rent_at_year_n = body.current_emi + costs_monthly
    required_rent_today = required_rent_at_year_n / ((1 + g) ** body.target_years_to_positive)
    gap_today = max(required_rent_today - body.current_rent, 0)

    # Year-by-year trajectory of cashflow at current rent
    trajectory = []
    rent = body.current_rent if body.current_rent > 0 else required_rent_today
    year_to_neutral = None
    for y in range(1, 16):
        cashflow = rent - body.current_emi - costs_monthly
        trajectory.append({
            "year": y,
            "rent": round(rent, 2),
            "emi": round(body.current_emi, 2),
            "costs": round(costs_monthly, 2),
            "monthly_cashflow": round(cashflow, 2),
        })
        if cashflow >= 0 and year_to_neutral is None:
            year_to_neutral = y
        rent *= (1 + g)

    gross_yield_today = (body.current_rent * 12 / body.current_value * 100) if body.current_value else 0
    required_yield = (required_rent_today * 12 / body.current_value * 100) if body.current_value else 0

    return {
        "required_rent_today": round(required_rent_today, 2),
        "required_rent_at_target_year": round(required_rent_at_year_n, 2),
        "current_rent": round(body.current_rent, 2),
        "gap_monthly": round(gap_today, 2),
        "gap_annual": round(gap_today * 12, 2),
        "gross_yield_today_pct": round(gross_yield_today, 2),
        "required_gross_yield_pct": round(required_yield, 2),
        "target_years": body.target_years_to_positive,
        "year_cashflow_turns_positive": year_to_neutral,
        "trajectory": trajectory,
        "verdict": (
            "Already cashflow-positive" if body.current_rent >= required_rent_at_year_n
            else f"Increase rent by ₹{int(gap_today):,}/mo OR wait {body.target_years_to_positive} years if your rent grows {body.rent_increase_pct}% p.a."
        ),
    }


# ------------------------------------------------------------
# Prepayment analysis — part-payment vs full-prepay vs invest-surplus
# ------------------------------------------------------------
class PrepaymentRequest(BaseModel):
    outstanding_loan: float = 4500000
    loan_rate: float = 8.5
    remaining_tenure_years: float = 15
    current_emi: float = 39200
    surplus_amount: float = 1000000          # lumpsum available
    alt_invest_return_pct: float = 12.0       # if instead you invest surplus in MF
    mode: Literal["part", "full", "invest", "all"] = "all"
    rental_income_monthly: float = 0.0        # for owned rental property
    maintenance_monthly: float = 0.0
    property_tax_yearly: float = 0.0


@api_router.post("/calc/prepayment-analysis")
async def prepayment_analysis(body: PrepaymentRequest):
    loan = body.outstanding_loan
    r = (body.loan_rate / 100) / 12
    n = int(body.remaining_tenure_years * 12)
    emi = body.current_emi
    surplus = body.surplus_amount

    # Interest saved on part payment (assuming tenure unchanged, EMI drops) — we compute both scenarios
    # Scenario A: Part payment reduces PRINCIPAL, EMI recalculated for remaining tenure
    new_principal_A = max(loan - surplus, 0)
    new_emi_A = _emi(new_principal_A, body.loan_rate, int(body.remaining_tenure_years))
    total_outflow_old = emi * n
    total_outflow_A = new_emi_A * n + surplus
    interest_saved_A = total_outflow_old - total_outflow_A

    # Scenario B: Full prepayment — only possible if surplus >= loan
    can_full = surplus >= loan
    if can_full:
        cash_leftover_B = surplus - loan
        interest_saved_B = emi * n - loan
        # leftover invested at alt return till loan would have ended
        final_leftover = cash_leftover_B * ((1 + body.alt_invest_return_pct / 100) ** body.remaining_tenure_years)
    else:
        cash_leftover_B = 0
        interest_saved_B = 0
        final_leftover = 0

    # Scenario C: Invest surplus in MF at alt_invest_return_pct
    years = body.remaining_tenure_years
    alt_final = surplus * ((1 + body.alt_invest_return_pct / 100) ** years)
    # Net wealth from Scenario C at end: alt_final (minus continuing EMI on full loan)

    # Scenario D: Part payment + continue investing monthly savings (emi - new_emi) into MF
    monthly_emi_savings = max(emi - new_emi_A, 0)
    if monthly_emi_savings > 0 and r != 0:
        # future value of an annuity of monthly savings for (remaining_tenure) months at alt rate (monthly)
        r_alt_m = (body.alt_invest_return_pct / 100) / 12
        fv_savings = monthly_emi_savings * ((((1 + r_alt_m) ** n) - 1) / r_alt_m) if r_alt_m > 0 else monthly_emi_savings * n
    else:
        fv_savings = 0

    # Rental implication: if rental property, part-payment increases monthly cashflow immediately
    cashflow_today_before = body.rental_income_monthly - emi - body.maintenance_monthly - body.property_tax_yearly / 12
    cashflow_today_after_part = body.rental_income_monthly - new_emi_A - body.maintenance_monthly - body.property_tax_yearly / 12
    cashflow_today_after_full = body.rental_income_monthly - body.maintenance_monthly - body.property_tax_yearly / 12 if can_full else cashflow_today_before

    scenarios = [
        {
            "id": "part",
            "name": "Part payment (lumpsum)",
            "principal_after": round(new_principal_A, 2),
            "new_emi": round(new_emi_A, 2),
            "interest_saved": round(interest_saved_A, 2),
            "monthly_cashflow_delta": round(cashflow_today_after_part - cashflow_today_before, 2),
            "effective_roi_pct": round((interest_saved_A / surplus * 100) / years if surplus > 0 else 0, 2),
            "best_for": "Owned rental where cashflow matters now and loan-rate > alt-return.",
        },
        {
            "id": "full",
            "name": "Full prepayment",
            "principal_after": 0,
            "new_emi": 0,
            "interest_saved": round(interest_saved_B, 2),
            "monthly_cashflow_delta": round(cashflow_today_after_full - cashflow_today_before, 2) if can_full else 0,
            "leftover_cash_invested_final": round(final_leftover, 2) if can_full else 0,
            "effective_roi_pct": round((interest_saved_B / surplus * 100) / years if surplus > 0 and can_full else 0, 2),
            "feasible": can_full,
            "best_for": "When the loan is near-end and emotional freedom > arbitrage.",
        },
        {
            "id": "invest",
            "name": "Invest surplus instead",
            "final_alt_value": round(alt_final, 2),
            "vs_part_interest_saved": round(alt_final - surplus - interest_saved_A, 2),
            "effective_roi_pct": body.alt_invest_return_pct,
            "best_for": f"When alt return {body.alt_invest_return_pct}% > loan rate {body.loan_rate}%.",
        },
        {
            "id": "part_plus_invest_savings",
            "name": "Part payment + invest EMI savings",
            "principal_after": round(new_principal_A, 2),
            "new_emi": round(new_emi_A, 2),
            "interest_saved": round(interest_saved_A, 2),
            "monthly_emi_savings": round(monthly_emi_savings, 2),
            "final_fv_of_emi_savings": round(fv_savings, 2),
            "total_benefit": round(interest_saved_A + fv_savings, 2),
            "best_for": "Hybrid — best of both worlds when alt ≈ loan rate.",
        },
    ]

    # Winner logic
    def _net_benefit(s):
        if s["id"] == "part":
            return s["interest_saved"]
        if s["id"] == "full":
            return s["interest_saved"] + s.get("leftover_cash_invested_final", 0) if s.get("feasible") else -1e18
        if s["id"] == "invest":
            return alt_final - surplus  # net gain over just holding cash
        if s["id"] == "part_plus_invest_savings":
            return s["total_benefit"]
        return 0

    winner = max(scenarios, key=_net_benefit)

    return {
        "inputs": body.model_dump(),
        "scenarios": scenarios,
        "winner": winner["id"],
        "winner_name": winner["name"],
        "current_monthly_cashflow": round(cashflow_today_before, 2),
    }


# ------------------------------------------------------------
# Builder / Upcoming projects directory
# ------------------------------------------------------------
@api_router.get("/builder-projects")
async def list_projects(city: Optional[str] = None, area: Optional[str] = None, status: Optional[str] = None):
    """Return curated upcoming / under-construction projects. Filterable by city + area."""
    projects = list(UPCOMING_PROJECTS)
    # Load user-submitted projects from DB (admins or user-contributed)
    try:
        extra = await db.community_projects.find({}, {"_id": 0}).to_list(500)
        projects = projects + extra
    except Exception:
        pass
    if city:
        projects = [p for p in projects if p.get("city", "").lower() == city.lower()]
    if area:
        projects = [p for p in projects if area.lower() in p.get("area", "").lower()]
    if status:
        projects = [p for p in projects if p.get("status", "").lower() == status.lower()]
    cities = sorted({p["city"] for p in UPCOMING_PROJECTS})
    return {"projects": projects, "count": len(projects), "cities": cities}


class CommunityProjectIn(BaseModel):
    city: str
    area: str
    name: str
    builder: str
    status: str = "Upcoming"
    possession: str = ""
    config: str = ""
    price_from_inr: float = 0
    price_per_sqft: float = 0
    highlight: str = ""
    rera_id: str = ""


@api_router.post("/builder-projects/community")
async def submit_community_project(body: CommunityProjectIn, user: dict = Depends(get_current_user)):
    doc = body.model_dump()
    doc["id"] = f"u-{uuid.uuid4().hex[:10]}"
    doc["submitted_by"] = user["id"]
    doc["submitted_at"] = datetime.now(timezone.utc).isoformat()
    await db.community_projects.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


# ------------------------------------------------------------
# XIRR — proper IRR for uneven cashflows
# ------------------------------------------------------------
def _xnpv(rate, cashflows):
    """cashflows: list of (days_from_t0, amount)."""
    if rate <= -1:
        return float("inf")
    return sum(amt / ((1 + rate) ** (d / 365.0)) for d, amt in cashflows)


def _xirr(cashflows, guess=0.1):
    """Newton-Raphson XIRR for list of (days_offset, amount). Returns annual rate."""
    if not cashflows or len(cashflows) < 2:
        return 0.0
    has_pos = any(a > 0 for _, a in cashflows)
    has_neg = any(a < 0 for _, a in cashflows)
    if not (has_pos and has_neg):
        return 0.0
    rate = guess
    for _ in range(120):
        npv = _xnpv(rate, cashflows)
        if abs(npv) < 1e-4:
            return rate
        # derivative
        dnpv = sum(-(d / 365.0) * amt / ((1 + rate) ** (d / 365.0 + 1)) for d, amt in cashflows)
        if dnpv == 0:
            break
        new_rate = rate - npv / dnpv
        if new_rate <= -0.999:
            new_rate = -0.999
        if abs(new_rate - rate) < 1e-7:
            return new_rate
        rate = new_rate
    # bisection fallback
    lo, hi = -0.9, 5.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if _xnpv(mid, cashflows) * _xnpv(lo, cashflows) < 0:
            hi = mid
        else:
            lo = mid
        if abs(hi - lo) < 1e-6:
            return mid
    return rate


class XirrRequest(BaseModel):
    cashflows: List[dict]   # [{"date": "2020-01-15", "amount": -500000}, ...]


@api_router.post("/calc/xirr")
async def xirr_endpoint(body: XirrRequest):
    try:
        cfs = []
        t0 = None
        for cf in body.cashflows:
            d = datetime.fromisoformat(cf["date"])
            if t0 is None:
                t0 = d
            cfs.append(((d - t0).days, float(cf["amount"])))
        cfs.sort(key=lambda x: x[0])
        rate = _xirr(cfs)
        return {"xirr_pct": round(rate * 100, 3), "n_flows": len(cfs)}
    except Exception as e:
        raise HTTPException(400, f"Bad cashflows: {e}")


# ------------------------------------------------------------
# Car vs Property — depreciating asset vs appreciating
# ------------------------------------------------------------
class CarVsPropertyRequest(BaseModel):
    # CAR finance
    car_price: float = 1500000
    car_dp: float = 300000                    # down payment on car
    car_loan_rate: float = 10.5               # car loans typically 10-12%
    car_loan_tenure_years: int = 5
    car_depreciation_pct: float = 15.0
    car_running_cost_monthly: float = 12000
    car_replace_years: int = 8
    # PROPERTY finance
    property_price: float = 8000000
    property_dp: float = 1600000
    property_loan_rate: float = 8.5
    property_loan_tenure_years: int = 20
    appreciation_pct: float = 7.0
    monthly_rent: float = 22000                # explicit rent income
    rent_increase_pct: float = 7.0
    years: int = 10
    # back-compat alias fields (some clients may still send these)
    amount: Optional[float] = None
    dp_pct: Optional[float] = None
    loan_rate: Optional[float] = None
    loan_tenure_years: Optional[int] = None
    rental_yield_pct: Optional[float] = None


@api_router.post("/calc/car-vs-property")
async def car_vs_property(body: CarVsPropertyRequest):
    """Full-finance car-vs-property comparison.
    CAR:       DP + EMI + running cost + periodic replacement vs salvage value
    PROPERTY:  DP + EMI − rent income, property value appreciates
    Returns yearly net worth trajectories, XIRR for each leg, winner, narrative.
    """
    # --- Legacy alias handling (if amount/dp_pct sent, map to new fields) ---
    if body.amount and body.dp_pct:
        body.car_price = body.amount
        body.car_dp = body.amount
        body.property_price = body.amount / (body.dp_pct / 100) if body.dp_pct > 0 else body.amount
        body.property_dp = body.amount
        if body.rental_yield_pct:
            body.monthly_rent = body.property_price * (body.rental_yield_pct / 100) / 12
        if body.loan_rate:
            body.property_loan_rate = body.loan_rate
        if body.loan_tenure_years:
            body.property_loan_tenure_years = body.loan_tenure_years

    # --- CAR journey ---
    car_loan = max(body.car_price - body.car_dp, 0)
    car_emi = _emi(car_loan, body.car_loan_rate, body.car_loan_tenure_years) if car_loan > 0 else 0
    car_series = []
    car_cfs = [(0, -body.car_dp)]   # XIRR flows
    car_value = body.car_price
    cum_car_outflow = body.car_dp
    replacements = 0
    for y in range(1, body.years + 1):
        # Depreciation
        car_value *= (1 - body.car_depreciation_pct / 100)
        # EMI in this year (0 after tenure ends)
        year_emi = car_emi * 12 if y * 12 <= body.car_loan_tenure_years * 12 else 0
        # Running cost
        year_running = body.car_running_cost_monthly * 12
        # Replacement (scrap + new purchase)
        replacement_outflow = 0
        if y % max(body.car_replace_years, 1) == 0 and y < body.years:
            scrap = car_value * 0.1
            replacement_outflow = body.car_price - scrap
            car_value = body.car_price        # new car starts at full price
            replacements += 1
        total_year_out = year_emi + year_running + replacement_outflow
        cum_car_outflow += total_year_out
        car_cfs.append((y * 365, -total_year_out))
        # Net worth = car_value − remaining_loan − running-cost burnt
        out_loan = _loan_balance(car_loan, body.car_loan_rate, body.car_loan_tenure_years, min(y * 12, body.car_loan_tenure_years * 12))
        net = car_value - out_loan - (cum_car_outflow - body.car_dp - sum(body.car_running_cost_monthly * 12 for _ in range(y))) - (body.car_running_cost_monthly * 12 * y)
        car_series.append({
            "year": y,
            "car_net_worth": round(car_value - out_loan - body.car_running_cost_monthly * 12 * y - replacements * body.car_price * 0.8, 2),
            "car_value": round(car_value, 2),
            "cumulative_running_cost": round(body.car_running_cost_monthly * 12 * y, 2),
            "outstanding_loan": round(out_loan, 2),
        })
    # Terminal car sale → salvage
    car_cfs.append((body.years * 365, car_value))
    try:
        car_xirr = _xirr(car_cfs) * 100
    except Exception:
        car_xirr = 0

    # --- PROPERTY journey ---
    prop_loan = max(body.property_price - body.property_dp, 0)
    prop_emi = _emi(prop_loan, body.property_loan_rate, body.property_loan_tenure_years) if prop_loan > 0 else 0
    prop_series = []
    prop_cfs = [(0, -body.property_dp)]
    monthly_rent = body.monthly_rent
    for y in range(1, body.years + 1):
        prop_value = body.property_price * ((1 + body.appreciation_pct / 100) ** y)
        year_emi = prop_emi * 12 if y * 12 <= body.property_loan_tenure_years * 12 else 0
        year_rent = monthly_rent * 12 * (1 + body.rent_increase_pct / 100) ** (y - 1)
        annual_cf = year_rent - year_emi
        prop_cfs.append((y * 365, annual_cf))
        out_loan = _loan_balance(prop_loan, body.property_loan_rate, body.property_loan_tenure_years, min(y * 12, body.property_loan_tenure_years * 12))
        net = prop_value - out_loan
        prop_series.append({
            "year": y,
            "property_net_worth": round(net, 2),
            "property_value": round(prop_value, 2),
            "year_rent": round(year_rent, 2),
            "year_emi": round(year_emi, 2),
            "outstanding_loan": round(out_loan, 2),
        })
    # Terminal: sell at final value
    final_value = body.property_price * ((1 + body.appreciation_pct / 100) ** body.years)
    prop_cfs.append((body.years * 365, final_value))
    try:
        prop_xirr = _xirr(prop_cfs) * 100
    except Exception:
        prop_xirr = 0

    final_car = car_series[-1]["car_net_worth"]
    final_prop = prop_series[-1]["property_net_worth"]
    delta = final_prop - final_car

    # Merge series for chart
    series = [{**c, **p} for c, p in zip(car_series, prop_series)]

    return {
        "inputs": body.model_dump(),
        "series": series,
        "car_emi": round(car_emi, 2),
        "car_loan": round(car_loan, 2),
        "property_emi": round(prop_emi, 2),
        "property_loan": round(prop_loan, 2),
        "final_car_net_worth": round(final_car, 2),
        "final_property_net_worth": round(final_prop, 2),
        "final_property_value": round(final_value, 2),
        "delta": round(delta, 2),
        "winner": "Property" if delta > 0 else "Car",
        "car_xirr_pct": round(car_xirr, 2),
        "property_xirr_pct": round(prop_xirr, 2),
        "replacements_over_horizon": replacements,
        "narrative": [
            f"Car: DP ₹{int(body.car_dp):,} + {body.car_loan_tenure_years}y loan at {body.car_loan_rate}% → EMI ₹{int(car_emi):,}. After {body.years} years it's worth ₹{int(car_value):,}.",
            f"Car also costs ₹{int(body.car_running_cost_monthly):,}/mo in fuel + insurance + service → ₹{int(body.car_running_cost_monthly * 12 * body.years):,} total over the horizon.",
            f"Property: DP ₹{int(body.property_dp):,} + {body.property_loan_tenure_years}y loan at {body.property_loan_rate}% → EMI ₹{int(prop_emi):,}. Value grows from ₹{int(body.property_price):,} to ₹{int(final_value):,} at {body.appreciation_pct}% p.a.",
            f"Rent starts at ₹{int(body.monthly_rent):,}/mo and compounds {body.rent_increase_pct}% a year.",
            f"Net worth at year {body.years}: property ₹{int(final_prop):,} vs car ₹{int(final_car):,} — gap of ₹{int(abs(delta)):,} in favour of {'property' if delta > 0 else 'car'}.",
            f"XIRR: car {round(car_xirr, 1)}% (salvage + loan cleared) vs property {round(prop_xirr, 1)}% (rent + sale at year {body.years}).",
        ],
    }


# ------------------------------------------------------------
# Under-construction projected possession value
# ------------------------------------------------------------
class UCProjectionRequest(BaseModel):
    purchase_price: float = 8000000
    down_payment_pct: float = 20
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    possession_months: int = 36
    area_price_inflation_pct: float = 7.0      # annual
    construction_cost_inflation_pct: float = 6.0  # annual — extras charged near possession
    post_possession_boost_pct: float = 5.0      # ready-to-move premium
    disbursement_schedule: Literal["clp", "linear"] = "clp"
    pre_emi_by_builder: bool = False            # subvention scheme
    builder_pre_emi_cap_months: int = 0         # 0 = till possession; else capped


@api_router.post("/calc/uc-projection")
async def uc_projection(body: UCProjectionRequest):
    """Projected property value + true effective cost at possession for an under-construction buy."""
    years = body.possession_months / 12.0
    dp = body.purchase_price * body.down_payment_pct / 100
    loan = body.purchase_price - dp
    r_m = (body.loan_rate / 100) / 12

    avg_frac = 0.5
    pre_emi_monthly_gross = (loan * avg_frac) * r_m if loan > 0 else 0
    cap = body.builder_pre_emi_cap_months if body.builder_pre_emi_cap_months > 0 else body.possession_months
    builder_months = min(cap, body.possession_months) if body.pre_emi_by_builder else 0
    buyer_months = body.possession_months - builder_months
    pre_emi_by_builder_total = pre_emi_monthly_gross * builder_months
    pre_emi_by_buyer_total = pre_emi_monthly_gross * buyer_months

    escalation = body.purchase_price * (((1 + body.construction_cost_inflation_pct / 100) ** years) - 1) * 0.3
    effective_acquisition = body.purchase_price + pre_emi_by_buyer_total + escalation

    appreciation = body.purchase_price * (((1 + body.area_price_inflation_pct / 100) ** years) - 1)
    possession_value = body.purchase_price * ((1 + body.area_price_inflation_pct / 100) ** years) * (1 + body.post_possession_boost_pct / 100)

    schedule = []
    for m in range(1, body.possession_months + 1):
        if body.disbursement_schedule == "linear":
            disbursed_frac = m / body.possession_months
        else:
            milestones = [(0.0, 0.20), (0.30, 0.40), (0.60, 0.60), (0.80, 0.80), (1.00, 1.00)]
            pos = m / body.possession_months
            disbursed_frac = 0
            for p, frac in milestones:
                if pos >= p:
                    disbursed_frac = frac
        disbursed = loan * disbursed_frac
        pre_emi_gross = disbursed * r_m
        builder_pays = body.pre_emi_by_builder and m <= builder_months
        schedule.append({
            "month": m,
            "disbursed": round(disbursed, 2),
            "pre_emi_monthly": round(0 if builder_pays else pre_emi_gross, 2),
            "pre_emi_monthly_gross": round(pre_emi_gross, 2),
            "paid_by_builder": bool(builder_pays),
            "cumulative_disbursed_pct": round(disbursed_frac * 100, 1),
        })

    profit = possession_value - effective_acquisition
    roi = (profit / dp * 100) / years if dp > 0 and years > 0 else 0

    # True XIRR: -dp, monthly -pre_emi (buyer only), +possession_value at handover
    cfs = [(0, -dp)]
    for m in range(1, body.possession_months + 1):
        builder_pays = body.pre_emi_by_builder and m <= builder_months
        if not builder_pays and pre_emi_monthly_gross > 0:
            cfs.append((m * 30, -pre_emi_monthly_gross))
    cfs.append((body.possession_months * 30, possession_value))
    try:
        xirr_rate = _xirr(cfs) * 100
    except Exception:
        xirr_rate = 0

    return {
        "inputs": body.model_dump(),
        "down_payment": round(dp, 2),
        "loan": round(loan, 2),
        "pre_emi_monthly_avg": round(pre_emi_monthly_gross, 2),
        "pre_emi_total": round(pre_emi_by_buyer_total, 2),
        "pre_emi_by_builder_total": round(pre_emi_by_builder_total, 2),
        "pre_emi_by_buyer_total": round(pre_emi_by_buyer_total, 2),
        "construction_cost_escalation": round(escalation, 2),
        "effective_acquisition_cost": round(effective_acquisition, 2),
        "appreciation_gain": round(appreciation, 2),
        "expected_possession_value": round(possession_value, 2),
        "projected_profit_at_possession": round(profit, 2),
        "annualized_roi_on_dp_pct": round(roi, 2),
        "xirr_pct": round(xirr_rate, 2),
        "subvention_saving": round(pre_emi_by_builder_total, 2),
        "disbursement_schedule": schedule,
        "narrative": [
            f"Today's price ₹{int(body.purchase_price):,} × {round(((1 + body.area_price_inflation_pct/100)**years), 3)} (area growth over {round(years, 1)} yr) + {body.post_possession_boost_pct}% RTM premium = ₹{int(possession_value):,} at possession.",
            (f"Subvention: builder bears ₹{int(pre_emi_by_builder_total):,} of pre-EMI ({builder_months} months). You pay ₹{int(pre_emi_by_buyer_total):,} over the remaining {buyer_months} months."
             if body.pre_emi_by_builder else
             f"Pre-EMI across construction: ₹{int(pre_emi_by_buyer_total):,} (avg ₹{int(pre_emi_monthly_gross):,}/mo on half-disbursed loan)."),
            f"Construction-cost pass-through: ~₹{int(escalation):,} (GST on hikes, registration, amenities).",
            f"Effective acquisition: ₹{int(effective_acquisition):,}. Net paper profit at possession: ₹{int(profit):,} — {round(roi, 1)}% annualized on DP.",
            f"True XIRR (time-value of pre-EMI outflows + final sale): {round(xirr_rate, 1)}% p.a.",
        ],
    }


# ------------------------------------------------------------
# Ready-to-move vs Under-construction breakeven
# ------------------------------------------------------------
class RtmVsUcBreakevenRequest(BaseModel):
    rtm_price: float = 9500000
    uc_price: float = 8500000
    possession_months: int = 36
    loan_rate: float = 8.5
    loan_tenure_years: int = 20
    monthly_rent_rtm: float = 32000
    expected_rent_at_possession_uc: float = 38000
    area_appreciation_pct: float = 7.0
    maintenance_monthly: float = 3000
    property_tax_yearly: float = 15000
    uc_pre_emi_by_builder: bool = False     # subvention
    uc_builder_pre_emi_cap_months: int = 0   # 0 = till possession


@api_router.post("/calc/breakeven-rtm-uc")
async def breakeven_rtm_uc(body: RtmVsUcBreakevenRequest):
    """For both RTM and UC: find the minimum down-payment such that rent covers EMI + costs once cashflow starts.
    Compute 5-year XIRR for each with real cashflows (rent, EMI, pre-EMI, sale at year 5).
    """
    costs_monthly = body.maintenance_monthly + body.property_tax_yearly / 12
    r_m = (body.loan_rate / 100) / 12

    def _find_breakeven(price, rent):
        avail = rent - costs_monthly
        if avail <= 0:
            return None
        for pct in range(1, 101):
            loan = price * (1 - pct / 100)
            emi = _emi(loan, body.loan_rate, body.loan_tenure_years)
            if emi <= avail:
                return {
                    "dp_pct": pct,
                    "dp_amount": round(price * pct / 100, 2),
                    "loan": round(loan, 2),
                    "emi": round(emi, 2),
                    "cashflow": round(avail - emi, 2),
                }
        return None

    rtm = _find_breakeven(body.rtm_price, body.monthly_rent_rtm)
    uc = _find_breakeven(body.uc_price, body.expected_rent_at_possession_uc)

    def _tco_rtm(dp_pct, years=5):
        loan = body.rtm_price * (1 - dp_pct / 100)
        emi = _emi(loan, body.loan_rate, body.loan_tenure_years)
        out = (emi + costs_monthly - body.monthly_rent_rtm) * 12 * years
        return round(out, 2)

    def _tco_uc(dp_pct, years=5):
        loan = body.uc_price * (1 - dp_pct / 100)
        emi = _emi(loan, body.loan_rate, body.loan_tenure_years)
        pre_emi_monthly_gross = (loan * 0.5) * r_m
        cap = body.uc_builder_pre_emi_cap_months if body.uc_builder_pre_emi_cap_months > 0 else body.possession_months
        builder_months = min(cap, body.possession_months) if body.uc_pre_emi_by_builder else 0
        buyer_months = body.possession_months - builder_months
        pre_emi_total_by_buyer = pre_emi_monthly_gross * buyer_months
        post_months = max(years * 12 - body.possession_months, 0)
        post = (emi + costs_monthly - body.expected_rent_at_possession_uc) * post_months
        return round(pre_emi_total_by_buyer + post, 2)

    years = body.possession_months / 12
    uc_value_at_possession = body.uc_price * ((1 + body.area_appreciation_pct / 100) ** years)
    rtm_value_at_same_horizon = body.rtm_price * ((1 + body.area_appreciation_pct / 100) ** years)
    uc_price_advantage = uc_value_at_possession - body.uc_price
    rtm_price_advantage = rtm_value_at_same_horizon - body.rtm_price

    # XIRR for RTM over 5 years: -dp, monthly cashflow, +sale at y5
    def _xirr_rtm(dp_pct):
        loan = body.rtm_price * (1 - dp_pct / 100)
        emi = _emi(loan, body.loan_rate, body.loan_tenure_years)
        dp_amt = body.rtm_price - loan
        cfs = [(0, -dp_amt)]
        for m in range(1, 61):
            net = body.monthly_rent_rtm - emi - costs_monthly
            cfs.append((m * 30, net))
        value_5y = body.rtm_price * ((1 + body.area_appreciation_pct / 100) ** 5)
        out_loan = _loan_balance(loan, body.loan_rate, body.loan_tenure_years, 60)
        cfs.append((5 * 365, value_5y - out_loan))
        try:
            return _xirr(cfs) * 100
        except Exception:
            return 0

    def _xirr_uc(dp_pct):
        loan = body.uc_price * (1 - dp_pct / 100)
        emi = _emi(loan, body.loan_rate, body.loan_tenure_years)
        dp_amt = body.uc_price - loan
        pre_emi_monthly_gross = (loan * 0.5) * r_m
        cap = body.uc_builder_pre_emi_cap_months if body.uc_builder_pre_emi_cap_months > 0 else body.possession_months
        builder_months = min(cap, body.possession_months) if body.uc_pre_emi_by_builder else 0
        cfs = [(0, -dp_amt)]
        # construction months
        for m in range(1, body.possession_months + 1):
            builder_pays = m <= builder_months
            if not builder_pays:
                cfs.append((m * 30, -pre_emi_monthly_gross))
        # post-possession months till 60 months total
        for m in range(body.possession_months + 1, max(body.possession_months + 1, 61)):
            net = body.expected_rent_at_possession_uc - emi - costs_monthly
            cfs.append((m * 30, net))
        # sale at 5y
        value_5y = body.uc_price * ((1 + body.area_appreciation_pct / 100) ** 5)
        post_months_paid = max(60 - body.possession_months, 0)
        out_loan = _loan_balance(loan, body.loan_rate, body.loan_tenure_years, post_months_paid)
        cfs.append((5 * 365, value_5y - out_loan))
        try:
            return _xirr(cfs) * 100
        except Exception:
            return 0

    rtm_xirr = _xirr_rtm(rtm["dp_pct"]) if rtm else None
    uc_xirr = _xirr_uc(uc["dp_pct"]) if uc else None

    winner = None
    if rtm and uc:
        winner = "UC" if (uc_xirr or 0) > (rtm_xirr or 0) else "RTM"

    subvention_saving_info = ""
    if body.uc_pre_emi_by_builder and uc:
        loan_tmp = body.uc_price * (1 - uc["dp_pct"] / 100)
        pre_emi_m = (loan_tmp * 0.5) * r_m
        cap = body.uc_builder_pre_emi_cap_months if body.uc_builder_pre_emi_cap_months > 0 else body.possession_months
        bm = min(cap, body.possession_months)
        subvention_saving_info = f"Builder subvention saves you ~₹{int(pre_emi_m * bm):,} over {bm} months."

    return {
        "inputs": body.model_dump(),
        "rtm": {
            **(rtm or {}),
            "feasible": rtm is not None,
            "value_at_5y_horizon": round(rtm_value_at_same_horizon, 2),
            "appreciation_gain": round(rtm_price_advantage, 2),
            "5y_carrying_cost": _tco_rtm(rtm["dp_pct"]) if rtm else None,
            "xirr_5y_pct": round(rtm_xirr, 2) if rtm_xirr is not None else None,
        },
        "uc": {
            **(uc or {}),
            "feasible": uc is not None,
            "value_at_possession": round(uc_value_at_possession, 2),
            "appreciation_gain_at_possession": round(uc_price_advantage, 2),
            "5y_carrying_cost_incl_pre_emi": _tco_uc(uc["dp_pct"]) if uc else None,
            "possession_months": body.possession_months,
            "xirr_5y_pct": round(uc_xirr, 2) if uc_xirr is not None else None,
            "pre_emi_by_builder": body.uc_pre_emi_by_builder,
        },
        "winner": winner,
        "narrative": [
            f"RTM: DP {rtm['dp_pct']}% (₹{int(rtm['dp_amount']):,}) makes rent cover EMI+costs immediately. 5-yr XIRR: {round(rtm_xirr, 1)}%." if rtm else "RTM: rent too low vs EMI+costs at any DP.",
            f"UC: DP {uc['dp_pct']}% (₹{int(uc['dp_amount']):,}) achieves rent-coverage post-possession. 5-yr XIRR: {round(uc_xirr, 1)}%." if uc else "UC: expected rent too low.",
            subvention_saving_info or f"UC buys ~₹{int(body.rtm_price - body.uc_price):,} cheaper today and gains ₹{int(uc_price_advantage):,} by possession.",
            f"Winner (by XIRR): {winner}." if winner else "Breakeven not found — rent too low vs EMI+costs.",
        ],
    }


# ------------------------------------------------------------
# Projects watchlist
# ------------------------------------------------------------
@api_router.post("/projects/{project_id}/watch")
async def watch_project(project_id: str, user: dict = Depends(get_current_user)):
    # idempotent upsert
    await db.project_watches.update_one(
        {"user_id": user["id"], "project_id": project_id},
        {"$set": {"user_id": user["id"], "project_id": project_id, "created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "project_id": project_id}


@api_router.delete("/projects/{project_id}/watch")
async def unwatch_project(project_id: str, user: dict = Depends(get_current_user)):
    await db.project_watches.delete_one({"user_id": user["id"], "project_id": project_id})
    return {"ok": True}


@api_router.get("/projects/watched")
async def my_watched_projects(user: dict = Depends(get_current_user)):
    watches = await db.project_watches.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    ids = [w["project_id"] for w in watches]
    # Resolve from curated + community
    curated = {p["id"]: p for p in UPCOMING_PROJECTS}
    community_docs = await db.community_projects.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
    community = {p["id"]: p for p in community_docs}
    resolved = []
    for w in watches:
        pid = w["project_id"]
        p = curated.get(pid) or community.get(pid)
        if p:
            resolved.append({**p, "watched_at": w.get("created_at")})
    return {"projects": resolved, "count": len(resolved)}


# ------------------------------------------------------------
# Tenant login + rent payment
# ------------------------------------------------------------
class TenantInviteRequest(BaseModel):
    password: Optional[str] = None    # if None, we generate a 10-char password


@api_router.post("/tenants/{tenant_id}/invite")
async def invite_tenant(tenant_id: str, body: TenantInviteRequest, user: dict = Depends(get_current_user)):
    tenant = await db.tenants.find_one({"id": tenant_id, "user_id": user["id"]}, {"_id": 0})
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    if not tenant.get("email"):
        raise HTTPException(400, "Tenant has no email on record — edit tenant and add email first")

    # Create tenant login if not exists
    email = tenant["email"].lower().strip()
    existing = await db.users.find_one({"email": email})
    pw = body.password or secrets.token_urlsafe(8)
    if existing:
        # re-link (or just update password if already a tenant)
        if existing.get("role") != "tenant":
            raise HTTPException(400, "Email already registered as a non-tenant user")
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "password_hash": hash_password(pw),
                "landlord_id": user["id"],
                "tenant_id": tenant_id,
            }},
        )
        tenant_user_id = str(existing["_id"])
    else:
        tenant_doc = {
            "email": email,
            "name": tenant.get("name", ""),
            "password_hash": hash_password(pw),
            "role": "tenant",
            "plan": "free",
            "plan_status": "active",
            "trial_ends_at": None,
            "plan_expires_at": None,
            "landlord_id": user["id"],
            "tenant_id": tenant_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        r = await db.users.insert_one(tenant_doc)
        tenant_user_id = str(r.inserted_id)

    await db.tenants.update_one(
        {"id": tenant_id},
        {"$set": {"portal_user_id": tenant_user_id, "portal_invited_at": datetime.now(timezone.utc).isoformat()}},
    )

    # Notify (stub if RESEND not configured)
    try:
        subj = "You're invited to the Estima tenant portal"
        html = f"<p>Hi {tenant.get('name', '')},</p><p>Your landlord has set up a tenant portal for rent receipts and payments.</p><p>Login: <b>{email}</b><br/>Password: <b>{pw}</b></p><p>Sign in at /login — change your password once inside.</p>"
        notify.send_email(email, subj, html)
    except Exception:
        logger.exception("tenant invite email failed")

    return {"ok": True, "tenant_email": email, "temp_password": pw, "tenant_user_id": tenant_user_id}


def _require_tenant(user: dict):
    if user.get("role") != "tenant":
        raise HTTPException(403, "Tenant access only")


@api_router.get("/tenant/me")
async def tenant_me(user: dict = Depends(get_current_user)):
    _require_tenant(user)
    u = await db.users.find_one({"_id": ObjectId(user["id"])}, {"_id": 0, "password_hash": 0})
    tenant_id = u.get("tenant_id") if u else None
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0}) if tenant_id else None
    return {"user": {"id": user["id"], "email": user["email"], "name": u.get("name", "") if u else ""}, "tenant": tenant}


@api_router.get("/tenant/receipts")
async def tenant_receipts(user: dict = Depends(get_current_user)):
    _require_tenant(user)
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    tenant_id = u.get("tenant_id") if u else None
    if not tenant_id:
        return []
    return await db.receipts.find({"tenant_id": tenant_id}, {"_id": 0}).sort("created_at", -1).to_list(300)


class TenantPayRequest(BaseModel):
    month: str
    amount: float
    notes: str = ""


@api_router.post("/tenant/pay/create-order")
async def tenant_create_order(body: TenantPayRequest, user: dict = Depends(get_current_user)):
    _require_tenant(user)
    if not razor_client:
        raise HTTPException(502, "Razorpay not configured on server")
    amount_paise = int(body.amount * 100)
    order = razor_client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "notes": {"tenant_user_id": user["id"], "month": body.month, "purpose": "rent"},
    })
    # track pending order
    await db.rent_orders.insert_one({
        "order_id": order["id"],
        "tenant_user_id": user["id"],
        "amount": body.amount,
        "month": body.month,
        "status": "created",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"order_id": order["id"], "amount": amount_paise, "currency": "INR", "razorpay_key_id": RAZORPAY_KEY_ID}


class TenantPayVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api_router.post("/tenant/pay/verify")
async def tenant_pay_verify(body: TenantPayVerifyRequest, user: dict = Depends(get_current_user)):
    _require_tenant(user)
    if not razor_client or not RAZORPAY_KEY_SECRET:
        raise HTTPException(502, "Razorpay not configured")
    msg = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    sig = hmac.new(RAZORPAY_KEY_SECRET.encode(), msg, hashlib.sha256).hexdigest()
    if sig != body.razorpay_signature:
        raise HTTPException(400, "Signature mismatch")
    order = await db.rent_orders.find_one({"order_id": body.razorpay_order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    u = await db.users.find_one({"_id": ObjectId(user["id"])})
    tenant_id = u.get("tenant_id") if u else None
    tenant = await db.tenants.find_one({"id": tenant_id}, {"_id": 0}) if tenant_id else None
    # Auto-generate receipt
    receipt_no = f"TRN-{datetime.now(timezone.utc).strftime('%Y%m')}-{secrets.token_hex(3).upper()}"
    receipt = {
        "id": str(uuid.uuid4()),
        "tenant_id": tenant_id,
        "user_id": tenant.get("user_id") if tenant else None,
        "month": order["month"],
        "amount": order["amount"],
        "paid_on": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "payment_mode": "Razorpay",
        "payment_id": body.razorpay_payment_id,
        "receipt_no": receipt_no,
        "notes": "Online payment via tenant portal",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.receipts.insert_one(receipt.copy())
    receipt.pop("_id", None)
    await db.rent_orders.update_one({"order_id": body.razorpay_order_id}, {"$set": {"status": "paid", "payment_id": body.razorpay_payment_id}})
    return {"ok": True, "receipt": receipt}


# ------------------------------------------------------------
# Generational transfer — admin creates new login for next-gen + transfers properties
# ------------------------------------------------------------
class LegacyTransferRequest(BaseModel):
    from_user_id: str
    new_email: EmailStr
    new_name: str
    transfer_properties: bool = True
    transfer_tenants: bool = True
    temp_password: Optional[str] = None
    note: Optional[str] = None


@api_router.post("/admin/legacy-transfer")
async def admin_legacy_transfer(body: LegacyTransferRequest, user: dict = Depends(get_current_user)):
    _require_admin(user)
    src = await db.users.find_one({"_id": ObjectId(body.from_user_id)})
    if not src:
        raise HTTPException(404, "Source user not found")
    new_email = body.new_email.lower().strip()
    existing = await db.users.find_one({"email": new_email})
    if existing:
        raise HTTPException(400, "New email already in use")

    pw = body.temp_password or secrets.token_urlsafe(10)
    now = datetime.now(timezone.utc)
    referral_code = secrets.token_urlsafe(6).replace("_", "").replace("-", "")[:8].upper()

    new_doc = {
        "email": new_email,
        "name": body.new_name.strip(),
        "password_hash": hash_password(pw),
        "role": "user",
        "plan": src.get("plan", "free"),
        "plan_status": src.get("plan_status", "none"),
        "trial_ends_at": src.get("trial_ends_at"),
        "plan_expires_at": src.get("plan_expires_at"),
        "referral_code": referral_code,
        "referred_by": None,
        "legacy_from": body.from_user_id,
        "legacy_from_email": src.get("email"),
        "legacy_transferred_at": now.isoformat(),
        "legacy_note": body.note or "",
        "created_at": now.isoformat(),
    }
    r = await db.users.insert_one(new_doc)
    new_uid = str(r.inserted_id)

    transfer_log = {"properties": 0, "tenants": 0, "receipts": 0, "shares": 0}
    if body.transfer_properties:
        pres = await db.properties.update_many(
            {"user_id": body.from_user_id},
            {"$set": {"user_id": new_uid, "legacy_from": body.from_user_id}},
        )
        transfer_log["properties"] = pres.modified_count
    if body.transfer_tenants:
        tres = await db.tenants.update_many(
            {"user_id": body.from_user_id},
            {"$set": {"user_id": new_uid, "legacy_from": body.from_user_id}},
        )
        transfer_log["tenants"] = tres.modified_count
        rres = await db.receipts.update_many(
            {"user_id": body.from_user_id},
            {"$set": {"user_id": new_uid, "legacy_from": body.from_user_id}},
        )
        transfer_log["receipts"] = rres.modified_count
    sres = await db.shares.update_many(
        {"user_id": body.from_user_id},
        {"$set": {"user_id": new_uid, "legacy_from": body.from_user_id}},
    )
    transfer_log["shares"] = sres.modified_count

    # Freeze source user (can still log in but plan=legacy_archived)
    await db.users.update_one(
        {"_id": src["_id"]},
        {"$set": {"legacy_transferred_to": new_uid, "legacy_transferred_at": now.isoformat(), "role": "legacy_archived"}},
    )

    # Notify
    try:
        subj = "You've inherited an Estima portfolio"
        html = f"<p>Hi {body.new_name},</p><p>{src.get('name', 'A family member')} has transferred their Estima portfolio to you.</p><p>Login: <b>{new_email}</b><br/>Temporary password: <b>{pw}</b></p><p>Transferred: {transfer_log['properties']} properties · {transfer_log['tenants']} tenants · {transfer_log['shares']} shared reports.</p>"
        notify.send_email(new_email, subj, html)
    except Exception:
        logger.exception("legacy transfer email failed")

    return {
        "ok": True,
        "new_user_id": new_uid,
        "new_email": new_email,
        "temp_password": pw,
        "transferred": transfer_log,
    }


# ------------------------------------------------------------
# Demo login (one-click) — seeds a demo user + sample data
# ------------------------------------------------------------
DEMO_EMAIL = "demo@estima.com"
DEMO_PASSWORD = "Demo@Estima2026"


async def _ensure_demo_user():
    """Create demo user + seed sample properties/tenants if missing."""
    u = await db.users.find_one({"email": DEMO_EMAIL})
    now = datetime.now(timezone.utc)
    if not u:
        doc = {
            "email": DEMO_EMAIL,
            "name": "Demo User",
            "password_hash": hash_password(DEMO_PASSWORD),
            "role": "user",
            "plan": "pro",
            "plan_status": "active",
            "trial_ends_at": None,
            "plan_expires_at": (now + timedelta(days=3650)).isoformat(),  # 10y
            "referral_code": "DEMO2026",
            "is_demo": True,
            "created_at": now.isoformat(),
        }
        r = await db.users.insert_one(doc)
        uid = str(r.inserted_id)
        # Seed properties
        sample_props = [
            {"id": str(uuid.uuid4()), "user_id": uid, "name": "Prestige Park Grove 3BHK", "type": "flat", "location": "Whitefield, Bengaluru",
             "price": 19500000, "area_sqft": 1580, "loan_rate": 8.5, "loan_tenure_years": 20, "status": "evaluating", "created_at": now.isoformat()},
            {"id": str(uuid.uuid4()), "user_id": uid, "name": "Sarjapur Villa", "type": "villa", "location": "Sarjapur Road, Bengaluru",
             "price": 32500000, "area_sqft": 2800, "loan_rate": 8.5, "loan_tenure_years": 20, "status": "evaluating", "created_at": now.isoformat()},
            {"id": str(uuid.uuid4()), "user_id": uid, "name": "Indiranagar Flat", "type": "flat", "location": "Indiranagar, Bengaluru",
             "price": 14500000, "area_sqft": 1200, "loan_rate": 8.5, "loan_tenure_years": 20, "status": "owned",
             "purchase_date": "2020-04-15", "purchase_price": 9500000, "current_value": 14500000, "current_loan_balance": 4800000,
             "monthly_rent_income": 38000, "rented": True, "created_at": now.isoformat()},
            {"id": str(uuid.uuid4()), "user_id": uid, "name": "Koramangala Flat (sold)", "type": "flat", "location": "Koramangala, Bengaluru",
             "price": 8500000, "area_sqft": 1050, "loan_rate": 9.0, "loan_tenure_years": 15, "status": "sold",
             "purchase_date": "2015-06-01", "purchase_price": 6000000, "sold_date": "2022-08-15", "sold_price": 11200000, "created_at": now.isoformat()},
        ]
        for p in sample_props:
            try:
                await db.properties.insert_one(p.copy())
            except Exception:
                pass
        logger.info("Seeded demo user + 4 sample properties")
    return u or {"email": DEMO_EMAIL, "id": str((await db.users.find_one({"email": DEMO_EMAIL}))["_id"])}


@api_router.post("/auth/demo-login", response_model=UserOut)
async def demo_login(response: Response):
    await _ensure_demo_user()
    u = await db.users.find_one({"email": DEMO_EMAIL})
    uid = str(u["_id"])
    access = create_access_token(uid, DEMO_EMAIL)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    u["id"] = uid
    return _user_out(u)


# ------------------------------------------------------------
# Personal Will — draft + PDF
# ------------------------------------------------------------
class WillBeneficiary(BaseModel):
    name: str
    relation: str = ""
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: str = ""


class WillAllocation(BaseModel):
    property_id: str
    splits: List[dict]    # [{"beneficiary_index": 0, "percentage": 50}, ...]


class WillRequest(BaseModel):
    testator_name: str = ""
    testator_pan: str = ""
    testator_address: str = ""
    executor_name: str = ""
    executor_relation: str = ""
    witness_1: str = ""
    witness_2: str = ""
    beneficiaries: List[WillBeneficiary] = []
    allocations: List[WillAllocation] = []
    preamble_notes: str = ""


@api_router.get("/will")
async def get_will(user: dict = Depends(get_current_user)):
    doc = await db.wills.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        return {"exists": False}
    return {"exists": True, **doc}


@api_router.post("/will")
async def save_will(body: WillRequest, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    data["user_id"] = user["id"]
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.wills.update_one(
        {"user_id": user["id"]},
        {"$set": data, "$setOnInsert": {"created_at": data["updated_at"]}},
        upsert=True,
    )
    saved = await db.wills.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"ok": True, "will": saved}


@api_router.get("/will/pdf")
async def will_pdf(user: dict = Depends(get_current_user)):
    will = await db.wills.find_one({"user_id": user["id"]}, {"_id": 0})
    if not will:
        raise HTTPException(404, "No Will drafted yet")
    properties = await db.properties.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    prop_by_id = {p["id"]: p for p in properties}
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("title", parent=styles["Title"], fontSize=22, leading=26, alignment=1)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13, leading=16, spaceBefore=10)
    body_s = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10, leading=14)

    story = []
    story.append(Paragraph("LAST WILL AND TESTAMENT", title_style))
    story.append(Spacer(1, 8 * mm))
    testator = will.get("testator_name") or "I, the undersigned"
    addr = will.get("testator_address") or ""
    pan = will.get("testator_pan") or ""
    story.append(Paragraph(
        f"I, <b>{testator}</b>{', PAN ' + pan if pan else ''}, residing at {addr or '[address]'}, being of sound mind and disposing memory and not acting under duress, do hereby declare this to be my Last Will and Testament, revoking all previous wills and codicils made by me.",
        body_s,
    ))
    if will.get("preamble_notes"):
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph(will["preamble_notes"], body_s))

    story.append(Paragraph("Executor", h2))
    story.append(Paragraph(
        f"I appoint <b>{will.get('executor_name') or '[executor name]'}</b>"
        f"{', ' + will['executor_relation'] if will.get('executor_relation') else ''} as the executor of this Will.",
        body_s,
    ))

    story.append(Paragraph("Beneficiaries", h2))
    bene = will.get("beneficiaries", [])
    if bene:
        b_rows = [["#", "Name", "Relation", "Contact"]]
        for i, b in enumerate(bene):
            b_rows.append([str(i + 1), b.get("name", ""), b.get("relation", ""), (b.get("email") or b.get("phone") or "—")])
        t = Table(b_rows, colWidths=[10 * mm, 60 * mm, 45 * mm, 55 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("(No beneficiaries listed)", body_s))

    story.append(Paragraph("Distribution of Immovable Property", h2))
    allocs = will.get("allocations", [])
    if allocs:
        a_rows = [["Property", "Location", "Beneficiary", "Share"]]
        for a in allocs:
            p = prop_by_id.get(a.get("property_id") or "")
            p_name = p["name"] if p else "(unknown property)"
            p_loc = (p.get("location", "") if p else "") if p else ""
            for s in a.get("splits", []):
                bi = s.get("beneficiary_index", 0)
                b_name = bene[bi]["name"] if 0 <= bi < len(bene) else "—"
                a_rows.append([p_name, p_loc, b_name, f"{s.get('percentage', 0)}%"])
        t = Table(a_rows, colWidths=[55 * mm, 50 * mm, 45 * mm, 20 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("(No property allocations — this Will covers only general dispositions)", body_s))

    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("Signed at _________________________ on this _____ day of ______________, ________.", body_s))
    story.append(Spacer(1, 10 * mm))
    sig_rows = [
        ["_________________________", "", "_________________________", "_________________________"],
        ["Testator: " + testator, "", f"Witness 1: {will.get('witness_1', '')}", f"Witness 2: {will.get('witness_2', '')}"],
    ]
    t = Table(sig_rows, colWidths=[55 * mm, 10 * mm, 55 * mm, 55 * mm])
    t.setStyle(TableStyle([("FONTSIZE", (0, 0), (-1, -1), 9)]))
    story.append(t)

    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(
        "<i>This document is a draft generated by Estima as an aid to estate planning. "
        "It is not legal advice. Please have it reviewed and witnessed per the Indian Succession Act, 1925 "
        "(or the succession law applicable to you) before relying on it. Minors cannot witness a Will.</i>",
        ParagraphStyle("dis", parent=body_s, fontSize=8, textColor=colors.grey),
    ))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename=last-will-{datetime.now().strftime('%Y%m%d')}.pdf"})


# ------------------------------------------------------------
# Root
# ------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"app": "Estima", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "healthy", "ts": datetime.now(timezone.utc).isoformat()}


# ------------------------------------------------------------
# Mount and Middleware
# ------------------------------------------------------------
app.include_router(api_router)

cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
if cors_origins_env == "*":
    origins = ["*"]
    allow_cred = False
else:
    origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    allow_cred = True

# We want credentials for cookie auth. Build allowed origins explicitly.
frontend_url = os.environ.get("FRONTEND_URL", "")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------------------------------------------
# Startup
# ------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.properties.create_index([("user_id", 1), ("id", 1)], unique=True)
        await db.login_attempts.create_index("identifier")
        await db.advisor_messages.create_index([("user_id", 1), ("created_at", -1)])
    except Exception:
        logger.exception("index creation failed")

    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@estima.com").lower()
    admin_pass = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    # Admin always gets Pro status (active for 100 years)
    forever = (datetime.now(timezone.utc) + timedelta(days=36500)).isoformat()
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_pass),
            "role": "admin",
            "plan": "pro",
            "plan_status": "active",
            "plan_expires_at": forever,
            "trial_ends_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin {admin_email}")
    else:
        updates = {}
        if not verify_password(admin_pass, existing["password_hash"]):
            updates["password_hash"] = hash_password(admin_pass)
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if existing.get("plan") != "pro" or existing.get("plan_status") != "active":
            updates["plan"] = "pro"
            updates["plan_status"] = "active"
            updates["plan_expires_at"] = forever
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
