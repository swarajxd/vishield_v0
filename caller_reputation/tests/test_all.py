from datetime import timedelta

import phonenumbers
from fastapi.testclient import TestClient

from app.db import ScamNumber, SessionLocal, Whitelist, utcnow
from app.heuristics import analyze_number
from app.main import app
from app.reputation import db_score, hash_number

client = TestClient(app)


def ex(region, t=phonenumbers.PhoneNumberType.MOBILE):
    n = phonenumbers.example_number_for_type(region, t)
    return phonenumbers.format_number(n, phonenumbers.PhoneNumberFormat.E164)


def test_clean_indian_mobile_scores_zero_bonus():
    a = analyze_number(ex("IN"))
    assert a.valid and a.bonus == 0 and not a.signals


def test_telemarketer_series():
    assert analyze_number("1409912345").category == "telemarketer"
    assert analyze_number("1600123456").category == "telemarketer"


def test_foreign_high_risk_region():
    a = analyze_number(ex("PK"))
    assert "high_risk_origin_region" in a.signals and a.bonus == 0.3


def test_invalid_and_garbage():
    assert analyze_number("12345").category == "invalid"
    assert analyze_number("hello").category == "invalid"


def test_spoof_hint():
    assert "possible_spoofing_91_via_international_route" in analyze_number(ex("IN"), True).signals


def test_bonus_capped():
    assert analyze_number(ex("PK"), True).bonus <= 0.5


def test_recency_and_volume():
    now = utcnow()
    assert db_score(50, now - timedelta(days=7)) > 0.85
    assert db_score(2, now - timedelta(days=365)) < 0.05


def test_unknown_number_low_score():
    r = client.get(f"/reputation/{ex('IN')}").json()
    assert r["score"] == 0 and r["category"] == "unknown" and r["report_count"] == 0


def test_report_flow_dedupe_and_scoring():
    num = ex("IN", phonenumbers.PhoneNumberType.FIXED_LINE)
    r = client.post("/report", json={"number": num, "category": "kyc", "reporter_id": "u1"})
    assert r.status_code == 201 and "also_report_to" in r.json()
    assert client.post("/report", json={"number": num, "reporter_id": "u1"}).status_code == 409  # dup
    for i in range(2, 8):
        client.post("/report", json={"number": num, "category": "kyc", "reporter_id": f"u{i}"})
    rep = client.get(f"/reputation/{num}").json()
    assert rep["report_count"] == 7 and rep["category"] == "kyc" and rep["score"] > 0.6
    assert rep["number_hash"] != num and num not in str(rep)  # raw number never returned/stored


def test_rate_limit():
    codes = [client.post("/report", json={"number": f"+9198765{i:05d}", "reporter_id": "spammer"}).status_code
             for i in range(12)]
    assert codes.count(429) >= 2


def test_whitelist_wins():
    num = "+918012345678"
    with SessionLocal() as s:
        s.add(Whitelist(number_hash=hash_number(analyze_number(num).canonical), label="bank"))
        s.add(ScamNumber(number_hash=hash_number(analyze_number(num).canonical), report_count=40, category="kyc"))
        s.commit()
    r = client.get(f"/reputation/{num}").json()
    assert r["score"] == 0 and r["category"] == "whitelisted"
