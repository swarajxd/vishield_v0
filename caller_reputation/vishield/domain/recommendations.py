"""Plain-language defensive recommendations keyed by indicator category."""

from __future__ import annotations

from vishield.domain.models import IndicatorCategory, RiskLevel

GENERAL_LOW = [
    "No strong phishing indicators were found, but stay alert: this tool can miss new tactics.",
    "If anything in the call felt unusual, verify through the organisation's official channel.",
]

GENERAL_ELEVATED = [
    "Do not act on the call. Hang up and contact the organisation using the number printed on "
    "your card, statement or official website.",
    "Never share OTPs, PINs, passwords or full card numbers with anyone, even if they claim to "
    "be from your bank or the police.",
    "Talk to a trusted family member, colleague or your bank branch before making any payment.",
]

BY_CATEGORY: dict[IndicatorCategory, str] = {
    IndicatorCategory.URGENCY: (
        "Genuine institutions allow time to verify. Treat any 'act now' deadline as a red flag "
        "and pause before responding."
    ),
    IndicatorCategory.AUTHORITY: (
        "Anyone can claim a title. Ask for a reference number, end the call and phone the "
        "organisation back on its published number."
    ),
    IndicatorCategory.FEAR_THREAT: (
        "Police and banks do not threaten arrest or account closure over the phone. Threats are a "
        "manipulation tactic, not evidence of a real problem."
    ),
    IndicatorCategory.CREDENTIAL_REQUEST: (
        "No legitimate organisation needs your OTP, PIN, CVV or password. Refuse and report the "
        "call to your bank."
    ),
    IndicatorCategory.PAYMENT_REQUEST: (
        "Do not transfer money, buy gift cards or scan QR codes on request. Verify any fee or "
        "refund independently first."
    ),
    IndicatorCategory.SECRECY: (
        "Being told to keep the call secret or stay on the line is a classic isolation tactic. "
        "Involve someone you trust immediately."
    ),
    IndicatorCategory.SUSPICIOUS_CONTACT: (
        "Do not click links or call back numbers given during the call. Type the official "
        "website address yourself or use the app you already have."
    ),
    IndicatorCategory.REMOTE_ACCESS: (
        "Never install remote-access or screen-sharing apps at a caller's request. If already "
        "installed, disconnect from the internet and uninstall it."
    ),
}

REPORTING_HINT = (
    "Report suspected voice phishing to your bank's fraud helpline and your national "
    "cyber-crime reporting portal."
)


def recommend(level: RiskLevel, categories: list[IndicatorCategory]) -> list[str]:
    """Return an ordered, de-duplicated list of defensive actions."""
    items: list[str] = []
    if level == RiskLevel.LOW:
        items.extend(GENERAL_LOW)
    else:
        items.extend(GENERAL_ELEVATED)
    for category in categories:
        tip = BY_CATEGORY.get(category)
        if tip and tip not in items:
            items.append(tip)
    if level != RiskLevel.LOW:
        items.append(REPORTING_HINT)
    return items
