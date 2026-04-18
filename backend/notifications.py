"""Email + WhatsApp notification helpers.

Scaffolded — real sends happen only when the relevant env vars are set.
Otherwise the payload is logged so flows can be developed without keys.
"""
import os
import logging
from typing import Optional

logger = logging.getLogger("estima.notify")


def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> dict:
    """Send email via Resend. No-op log if RESEND_API_KEY is absent."""
    api_key = os.environ.get("RESEND_API_KEY", "")
    sender = os.environ.get("RESEND_FROM", "Estima <onboarding@resend.dev>")
    if not api_key:
        logger.info(f"[email:stub] to={to} subject={subject!r} (no RESEND_API_KEY)")
        return {"ok": False, "stub": True, "reason": "RESEND_API_KEY missing"}
    try:
        import requests
        r = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": sender, "to": [to], "subject": subject, "html": html, "text": text or ""},
            timeout=10,
        )
        ok = r.status_code < 400
        if not ok:
            logger.warning(f"resend failed {r.status_code}: {r.text[:300]}")
        return {"ok": ok, "status": r.status_code, "response": r.json() if ok else None}
    except Exception as e:
        logger.exception("resend exception")
        return {"ok": False, "error": str(e)[:200]}


def send_whatsapp(to_number: str, body: str) -> dict:
    """Send WhatsApp via Twilio. No-op log if Twilio env vars absent.

    to_number should be in E.164 (e.g. +919876543210). We auto-prefix 'whatsapp:'.
    """
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    from_ = os.environ.get("TWILIO_WHATSAPP_FROM", "")
    if not (sid and token and from_):
        logger.info(f"[whatsapp:stub] to={to_number} body={body[:60]!r} (no Twilio keys)")
        return {"ok": False, "stub": True, "reason": "Twilio keys missing"}
    try:
        import requests
        if not to_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{to_number}"
        r = requests.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
            auth=(sid, token),
            data={"From": from_, "To": to_number, "Body": body},
            timeout=10,
        )
        ok = r.status_code < 400
        if not ok:
            logger.warning(f"twilio wa failed {r.status_code}: {r.text[:300]}")
        return {"ok": ok, "status": r.status_code}
    except Exception as e:
        logger.exception("twilio exception")
        return {"ok": False, "error": str(e)[:200]}


# Templates -----------------------------------------------------------
def tpl_welcome(name: str, trial_days: int = 10) -> tuple[str, str]:
    subject = "Welcome to Estima"
    html = f"""
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#141311;padding:24px;max-width:560px;margin:0 auto">
      <h1 style="font-family:Georgia,serif;font-size:30px;margin:0 0 8px">Welcome to Estima, {name}.</h1>
      <p style="color:#666">Your {trial_days}-day Pro trial is live — every feature is unlocked.</p>
      <p>A quick tour awaits you inside the app. Start by adding a single property and running a
      side-by-side comparison or a rent-vs-buy calculation.</p>
      <p><a href="https://property-decision-4.preview.emergentagent.com/app" style="background:#C85A32;color:#fff;padding:12px 18px;text-decoration:none;border-radius:2px;display:inline-block">Open Estima</a></p>
      <p style="color:#999;font-size:12px;margin-top:32px">Estima produces estimates only — not investment advice.</p>
    </div>
    """
    return subject, html


def tpl_referral_reward(referrer_name: str, referred_email: str, days: int) -> tuple[str, str]:
    subject = f"+{days} Pro days — {referred_email} joined via your invite"
    html = f"""
    <div style="font-family:system-ui,sans-serif;padding:24px;max-width:560px;margin:0 auto;color:#141311">
      <h1 style="font-family:Georgia,serif;font-size:26px">Nice one, {referrer_name}.</h1>
      <p>{referred_email} just joined Estima using your invite code — you&rsquo;ve earned
      <strong>{days} extra days of Pro</strong> on your account.</p>
      <p>Keep sharing — every signup extends your plan.</p>
    </div>
    """
    return subject, html


def tpl_rent_receipt_email(tenant_name: str, property_name: str, month: str, amount: str, receipt_url: Optional[str] = None) -> tuple[str, str]:
    subject = f"Rent receipt · {property_name} · {month}"
    link = f'<p><a href="{receipt_url}">Download receipt (PDF)</a></p>' if receipt_url else ""
    html = f"""
    <div style="font-family:system-ui,sans-serif;padding:24px;max-width:560px;margin:0 auto">
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 8px">Rent receipt</h1>
      <p>Hi {tenant_name}, this is a receipt for your rent payment for <strong>{property_name}</strong>
      — month of <strong>{month}</strong>, amount <strong>{amount}</strong>.</p>
      {link}
      <p style="color:#999;font-size:12px;margin-top:24px">Generated via Estima — estimates only, not tax advice.</p>
    </div>
    """
    return subject, html
