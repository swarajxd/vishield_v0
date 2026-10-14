from fastapi.testclient import TestClient

from app.db import ScamNumber, SessionLocal, Whitelist, utcnow
from app.heuristics import analyze_number
from app.main import app
from app.reputation import hash_number, mask_number

client = TestClient(app)


def test_mask_number():
    assert mask_number("+919876543210") == "+91 98•••••210"
    assert mask_number("+919820144820") == "+91 98•••••820"
    assert mask_number("+14155552671") == "+1 41•••••671"
    assert "9876543210" not in mask_number("+919876543210")


def test_reputation_extended_fields_unknown():
    res = client.get("/reputation/+919999900001").json()
    assert res["in_database"] is False
    assert res["last_reported"] is None
    assert res["sources"] == []
    assert res["risk_level"] == "SAFE"
    assert "normalized_number_masked" in res
    assert "9999900001" not in res["normalized_number_masked"]
    assert res["normalized_number_masked"] == "+91 99•••••001"


def test_reputation_extended_fields_in_db():
    num = "+919888800002"
    client.post("/report", json={"number": num, "category": "lottery", "reporter_id": "test_reporter_ext_1"})
    
    res = client.get(f"/reputation/{num}").json()
    assert res["in_database"] is True
    assert res["last_reported"] is not None
    assert "community" in res["sources"]
    assert "normalized_number_masked" in res
    assert res["normalized_number_masked"] == "+91 98•••••002"
    assert "9888800002" not in str(res)


def test_reputation_whitelist_extended():
    num = "+918000000099"
    h = hash_number(analyze_number(num).canonical)
    with SessionLocal() as s:
        s.add(Whitelist(number_hash=h, label="Official Bank"))
        s.commit()

    res = client.get(f"/reputation/{num}").json()
    assert res["category"] == "whitelisted"
    assert res["score"] == 0.0
    assert res["risk_level"] == "SAFE"
    assert res["in_database"] is False
    assert "whitelist" in res["sources"]
    assert "normalized_number_masked" in res


def test_get_stats_endpoint():
    res = client.get("/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_scam_numbers" in data
    assert "total_reports" in data
    assert "whitelist_count" in data
    assert "categories" in data
    assert "sources" in data
    assert "last_scrape_time" in data
    assert isinstance(data["total_scam_numbers"], int)
    assert isinstance(data["categories"], dict)
