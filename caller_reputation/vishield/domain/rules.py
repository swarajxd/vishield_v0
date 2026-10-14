"""Baseline A: rule-based social-engineering indicator detector.

Each rule is a small regex family tagged with an indicator category and a weight.
The rule score saturates so that a single loud category cannot dominate, and every
hit is returned with its character span for explainability.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass

from vishield.domain.models import EvidenceSpan, Indicator, IndicatorCategory


@dataclass(frozen=True)
class Rule:
    rule_id: str
    category: IndicatorCategory
    description: str
    patterns: tuple[str, ...]
    weight: float = 1.0

    def compiled(self) -> list[re.Pattern[str]]:
        return [re.compile(p, re.IGNORECASE) for p in self.patterns]


@dataclass(frozen=True)
class RuleHit:
    rule_id: str
    category: IndicatorCategory
    text: str
    start: int
    end: int
    weight: float


CATEGORY_TITLES: dict[IndicatorCategory, tuple[str, str]] = {
    IndicatorCategory.URGENCY: (
        "Urgency or artificial deadline",
        "Pressure to act immediately reduces the listener's chance to verify.",
    ),
    IndicatorCategory.AUTHORITY: (
        "Claim of authority",
        "Caller claims to represent a bank, government body, police or well-known company.",
    ),
    IndicatorCategory.FEAR_THREAT: (
        "Fear, threat or account suspension",
        "Threats of blocking, arrest or loss are used to override careful thinking.",
    ),
    IndicatorCategory.CREDENTIAL_REQUEST: (
        "Request for OTP, PIN, password or sensitive data",
        "Legitimate organisations never ask you to read out OTPs, PINs or full card numbers.",
    ),
    IndicatorCategory.PAYMENT_REQUEST: (
        "Payment or money-transfer request",
        "Caller asks for a transfer, fee, gift card or wallet top-up.",
    ),
    IndicatorCategory.SECRECY: (
        "Secrecy or isolation instruction",
        "Caller asks you not to tell family, colleagues or the bank.",
    ),
    IndicatorCategory.SUSPICIOUS_CONTACT: (
        "Suspicious link or callback number",
        "Caller pushes a link, app or number that cannot be independently verified.",
    ),
    IndicatorCategory.REMOTE_ACCESS: (
        "Remote-access software request",
        "Requests to install screen-sharing or remote-control software.",
    ),
}


RULES: tuple[Rule, ...] = (
    Rule(
        "URG-01",
        IndicatorCategory.URGENCY,
        "Immediate action words",
        (
            r"\b(immediately|right now|right away|urgent(?:ly)?|asap|at once|without delay|turant|jaldi(?: se)?|abhi(?: hi)?|foran)\b",
            r"\b(within|in the next|only)\s+(?:the next\s+)?(?:\d+|one|two|five|ten|fifteen|thirty|sixty|few)\s*(minutes?|mins?|hours?|seconds?)\b",
            r"\b(last chance|final (?:warning|notice|reminder)|expires? (?:today|soon|shortly))\b",
            r"\b(before (?:it is|it's) too late|time is running out|don'?t (?:wait|delay))\b",
        ),
        weight=0.8,
    ),
    Rule(
        "AUTH-01",
        IndicatorCategory.AUTHORITY,
        "Claims to be from an institution",
        (
            r"\b(?:i am|i'm|this is|we are|we're|calling from|on behalf of)\s+(?:\w+\s+){0,3}(bank|police|cyber\s?cell|cyber\s?crime|income tax|tax department|customs|ministry|government|rbi|reserve bank|court|telecom|regulatory|fraud (?:department|team|unit)|security (?:department|team)|technical support|tech support|microsoft|customer care)\b",
            r"\b(senior (?:officer|inspector|manager)|officer\s+\w+\s+speaking|badge (?:number|id)|case (?:id|number|reference))\b",
            r"\b(official (?:call|notice|department)|authori[sz]ed (?:agent|representative))\b",
            r"\b(state bank|sbi|hdfc|icici|axis bank|pnb|rbi|income tax|cyber cell|cbi|ed)\b",
            r"\b(fraud (?:branch|department|team|unit)|customer care|bank (?:se|fraud))\b",
            r"\b(?:bank|police|cbi|ed|rbi)\s+(?:se|ka|ki|ke)\s+(?:bol|baat|department|officer)\b",
        ),
        weight=0.7,
    ),
    Rule(
        "FEAR-01",
        IndicatorCategory.FEAR_THREAT,
        "Threats of suspension, arrest or loss",
        (
            r"\b(account|card|sim|number|connection|service|kyc)\s+(?:will be|has been|is being|is|gets?)\s+(blocked|suspended|frozen|deactivated|closed|terminated|disconnected|cancelled|canceled)\b",
            r"\b(arrest(?:ed)?|warrant|legal action|police case|fir (?:has been|will be) (?:filed|registered)|jail|prosecut\w+|penalty|fine of)\b",
            r"\b(suspicious|unauthori[sz]ed|fraudulent|illegal)\s+(activity|transaction|login|access|attempt)s?\b",
            r"\b(lose (?:all )?your (?:money|funds|savings)|money (?:will be|is) (?:lost|stolen|debited))\b",
            r"\b(money laundering|drugs?|narcotics|parcel (?:contains|has))\b",
            r"\b(?:(?:has been|have been|is|are|was|were|got)\s+)?(hacked|compromised|infected)\b|\b(virus(?:es)?|malware|hackers?)\b",
            r"\b(account|kyc|card|sim)\s+block\b",
            r"\bblock ho (?:jayega|sakta|gaya|chuka|chuke)\b",
            r"\b(freeze|suspend|band)\s+ho\b",
        ),
        weight=0.9,
    ),
    Rule(
        "CRED-01",
        IndicatorCategory.CREDENTIAL_REQUEST,
        "Asks for OTP, PIN, CVV, password or card details",
        (
            r"\b(?:share|tell|read|give|provide|confirm|send|enter|type)\s+(?:me\s+|us\s+)?(?:the\s+|your\s+)?(?:\w+\s+){0,2}(otp|one[- ]time password|verification code|passcode|pin|cvv|password|security code|mpin|upi pin|atm pin|card number|expiry date|net ?banking (?:id|password))\b",
            r"\b(otp|one[- ]time password|verification code|pin|cvv|password|mpin)\s+(?:that|which)\s+(?:you|we)\s+(?:will\s+)?(?:receive|received|get|got|sent)\b",
            r"\b(what is|what'?s)\s+(?:the|your)\s+(otp|code|pin|cvv|password|mpin)\b",
            r"\b(otp|code|pin|password)\s+(?:that\s+)?(?:you|we)\s+(?:just\s+|have\s+|will\s+)?(?:received|receive|got|get|sent|send)\b",
            r"\b(aadhaar|aadhar|pan)\s+(?:card\s+)?(?:number|details)\b",
            r"\b(date of birth|mother'?s maiden name)\b",
            r"\b(otp|pin|password|cvv|mpin)\s+(?:share|verify|bhejo|batao|bataiye|do|dena|confirm|kijiye)\b",
            r"\b(?:share|verify|bhejo|batao|bataiye)\s+(?:\w+\s+){0,4}(otp|pin|password|cvv|mpin)\b",
        ),
        weight=1.2,
    ),
    Rule(
        "PAY-01",
        IndicatorCategory.PAYMENT_REQUEST,
        "Requests payment, transfer or gift cards",
        (
            r"\b(transfer|send|deposit|pay|wire|move)\s+(?:the\s+|an?\s+|some\s+)?(?:\w+\s+){0,2}(money|amount|funds|rupees|rs\.?|inr|dollars|\$|₹|fee|charge|balance)\b",
            r"\b(processing|verification|refundable|security|customs|clearance|re-?delivery|activation|unblocking)\s+(fee|charge|deposit|amount)\b",
            r"\b(gift ?cards?|prepaid cards?|voucher codes?|crypto(?:currency)?|bitcoin|wallet top[- ]?up)\b",
            r"\b(scan (?:this|the) qr|upi (?:id|request|collect)|payment (?:link|request))\b",
            r"\b(safe account|secure account|temporary account|holding account)\b",
        ),
        weight=1.0,
    ),
    Rule(
        "SEC-01",
        IndicatorCategory.SECRECY,
        "Instructs secrecy or isolation",
        (
            r"\b(do not|don'?t|never|shouldn'?t)\s+(?:tell|inform|discuss|mention|share (?:this|it))\s+(?:this\s+)?(?:with\s+|to\s+)?(?:anyone|anybody|your (?:family|wife|husband|parents|son|daughter|friends|colleagues|bank|branch)|the bank|the police)\b",
            r"\b(keep (?:this|it) (?:confidential|secret|between us|private)|strictly confidential|confidential (?:matter|case))\b",
            r"\b(do not|don'?t)\s+(?:hang up|disconnect|cut the call|end the call|go to the branch|visit the branch|call (?:the|your) bank)\b",
            r"\b(stay on the line|remain on the call)\b",
        ),
        weight=1.1,
    ),
    Rule(
        "LINK-01",
        IndicatorCategory.SUSPICIOUS_CONTACT,
        "Pushes a link, app download or callback number",
        (
            r"\b(click|tap|open|visit)\s+(?:on\s+)?(?:the|this|that)\s+(link|url|website|page|button)\b",
            r"\b(link|url)\s+(?:that\s+)?(?:i|we)\s+(?:have\s+|will\s+)?(?:sent|send|shared|share|texted|text|messaged|message)\b",
            r"\b(call (?:me )?back (?:on|at)|call (?:this|the following|our) (?:number|helpline)|dial\b)",
            r"\b(download|install)\s+(?:the|this|our|an?)\s+(?:\w+\s+){0,2}(app|application|apk|file)\b",
            r"\b(https?://|www\.|\[URL\]|dot com|dot in|dot net|\.apk)\b",
            r"\b(sms|text message|whatsapp)\s+(?:with\s+)?(?:a\s+|the\s+)?link\b",
        ),
        weight=0.8,
    ),
    Rule(
        "RA-01",
        IndicatorCategory.REMOTE_ACCESS,
        "Requests remote-control or screen-sharing software",
        (
            r"\b(anydesk|teamviewer|quick ?support|screen ?share|screen sharing|remote (?:access|desktop|control|support tool)|share your screen|control (?:of|over) your (?:computer|phone|device))\b",
            r"\b(give (?:me|us) (?:access|control)|allow (?:me|us) (?:to )?(?:access|control|connect))\b",
            r"\b(nine[- ]digit (?:code|id)|read (?:out )?the (?:id|code) (?:on|from) (?:the|your) screen)\b",
        ),
        weight=1.2,
    ),
)

_COMPILED: list[tuple[Rule, list[re.Pattern[str]]]] = [(r, r.compiled()) for r in RULES]


def detect_hits(text: str) -> list[RuleHit]:
    """Return every rule match with span information, ordered by position."""
    hits: list[RuleHit] = []
    for rule, patterns in _COMPILED:
        for pattern in patterns:
            for m in pattern.finditer(text):
                hits.append(
                    RuleHit(
                        rule_id=rule.rule_id,
                        category=rule.category,
                        text=m.group(0),
                        start=m.start(),
                        end=m.end(),
                        weight=rule.weight,
                    )
                )
    hits.sort(key=lambda h: (h.start, h.end))
    return _dedupe_overlaps(hits)


def _dedupe_overlaps(hits: list[RuleHit]) -> list[RuleHit]:
    """Drop hits fully contained in an earlier hit of the same category."""
    kept: list[RuleHit] = []
    for hit in hits:
        if any(
            k.category == hit.category and k.start <= hit.start and k.end >= hit.end for k in kept
        ):
            continue
        kept.append(hit)
    return kept


def rule_score(hits: list[RuleHit], saturation: float = 3.0) -> float:
    """Map rule hits to a [0, 1] score.

    Each category contributes its weight once plus a diminishing bonus for repeated hits,
    then the total passes through ``1 - exp(-total / saturation)`` so the score approaches
    1 asymptotically instead of clipping.
    """
    if not hits:
        return 0.0
    per_category: dict[IndicatorCategory, list[RuleHit]] = {}
    for hit in hits:
        per_category.setdefault(hit.category, []).append(hit)
    total = 0.0
    for category_hits in per_category.values():
        weight = category_hits[0].weight
        n = len(category_hits)
        total += weight * (1.0 + 0.5 * math.log1p(n - 1))
    return round(1.0 - math.exp(-total / saturation), 4)


def build_indicators(hits: list[RuleHit], max_evidence: int = 5) -> list[Indicator]:
    """Group hits by category into user-facing indicator cards."""
    grouped: dict[IndicatorCategory, list[RuleHit]] = {}
    for hit in hits:
        grouped.setdefault(hit.category, []).append(hit)
    indicators: list[Indicator] = []
    for category, category_hits in grouped.items():
        title, description = CATEGORY_TITLES[category]
        weight = category_hits[0].weight
        severity = min(1.0, weight * (1.0 + 0.25 * (len(category_hits) - 1)) / 1.5)
        evidence = [
            EvidenceSpan(text=h.text, start=h.start, end=h.end, rule_id=h.rule_id)
            for h in category_hits[:max_evidence]
        ]
        indicators.append(
            Indicator(
                category=category,
                title=title,
                description=description,
                severity=round(severity, 3),
                hits=len(category_hits),
                evidence=evidence,
            )
        )
    indicators.sort(key=lambda i: (-i.severity, i.category.value))
    return indicators


def rule_count() -> int:
    return len(RULES)
