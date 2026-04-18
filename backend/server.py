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

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

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


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "user"


# ------------------------------------------------------------
# Auth Endpoints
# ------------------------------------------------------------
@api_router.post("/auth/register", response_model=UserOut)
async def register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": email,
        "name": body.name.strip(),
        "password_hash": hash_password(body.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)
    access = create_access_token(uid, email)
    refresh = create_refresh_token(uid)
    set_auth_cookies(response, access, refresh)
    return UserOut(id=uid, email=email, name=doc["name"], role="user")


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
    return UserOut(id=uid, email=email, name=user.get("name", ""), role=user.get("role", "user"))


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(id=user["id"], email=user["email"], name=user.get("name", ""), role=user.get("role", "user"))


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


class PropertyOut(PropertyIn):
    id: str
    user_id: str
    created_at: str


@api_router.get("/properties", response_model=List[PropertyOut])
async def list_properties(user: dict = Depends(get_current_user)):
    docs = await db.properties.find({"user_id": user["id"]}, {"_id": 0}).to_list(500)
    return docs


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
    if not existing:
        await db.users.insert_one({
            "email": admin_email,
            "name": "Admin",
            "password_hash": hash_password(admin_pass),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin {admin_email}")
    elif not verify_password(admin_pass, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pass)}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
