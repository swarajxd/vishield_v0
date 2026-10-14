import urllib.request
import urllib.parse
import json

BASE = "http://127.0.0.1:8000"

def req(url, data=None):
    if data:
        r = urllib.request.Request(
            url,
            data=json.dumps(data).encode(),
            headers={"Content-Type": "application/json"}
        )
    else:
        r = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(r) as res:
            return res.getcode(), json.loads(res.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

print("=== Step 1: Initial Database Stats ===")
code, stats = req(f"{BASE}/stats")
print(f"Stats ({code}): total={stats['total_scam_numbers']}, categories={list(stats['categories'].keys())}, sources={list(stats['sources'].keys())}")

print("\n=== Step 2: Check Number NOT in Database ===")
import time
test_num = f"+91 98{int(time.time()) % 100000000:08d}"
encoded_num = urllib.parse.quote(test_num)
code, res = req(f"{BASE}/reputation/{encoded_num}")
print(f"Check ({code}):")
print(f"  in_database: {res['in_database']}")
print(f"  risk_level:  {res['risk_level']}")
print(f"  score:       {res['score']}")
print(f"  masked:      {res['normalized_number_masked']}")
print(f"  signals:     {res['signals']}")
assert res["in_database"] is False, "Expected number to not be in DB"

print("\n=== Step 3: Report Number (POST /report) ===")
code, rep = req(f"{BASE}/report", {
    "number": test_num,
    "category": "bank_impersonation",
    "reporter_id": "tester-walkthrough-id",
    "notes": "Fake OTP verification call"
})
print(f"Report ({code}): {rep}")
assert code in (200, 201), f"Expected 200 or 201, got {code}"

print("\n=== Step 4: Re-Check Number (Now IN Database) ===")
code, res2 = req(f"{BASE}/reputation/{encoded_num}")
print(f"Check ({code}):")
print(f"  in_database:   {res2['in_database']}")
print(f"  risk_level:    {res2['risk_level']}")
print(f"  report_count:  {res2['report_count']}")
print(f"  sources:       {res2['sources']}")
print(f"  category:      {res2['category']}")
print(f"  last_reported: {res2['last_reported']}")
assert res2["in_database"] is True, "Expected number to now be in DB"
assert res2["report_count"] >= 1, "Expected report_count >= 1"
assert "community" in res2["sources"], "Expected 'community' in sources"

print("\n=== Step 5: Check Whitelisted Number ===")
code, w = req(f"{BASE}/reputation/%2B911800112211")
print(f"Whitelist ({code}):")
print(f"  is_whitelisted: {w['is_whitelisted']}")
print(f"  whitelist_name: {w['whitelist_name']}")
print(f"  risk_level:     {w['risk_level']}")
assert w["is_whitelisted"] is True, "Expected is_whitelisted == True"
assert w["risk_level"] == "SAFE", "Expected risk_level == SAFE"

print("\n=== Step 6: Check TRAI Telemarketer Number ===")
code, t = req(f"{BASE}/reputation/1409912345")
print(f"Telemarketer ({code}):")
print(f"  signals:     {t['signals']}")
print(f"  in_database: {t['in_database']}")
assert "trai_140_promotional_series" in t["signals"], "Expected trai_140_promotional_series"

print("\n=== Step 7: Check Scraped Number from Scammer.info ===")
# In fixtures, we have +91 98765 43210 and +91 91234 56789
code, s = req(f"{BASE}/reputation/%2B919876543210")
print(f"Scraped Number ({code}):")
print(f"  in_database:  {s['in_database']}")
print(f"  sources:      {s['sources']}")
print(f"  category:     {s['category']}")
print(f"  report_count: {s['report_count']}")
print(f"  masked:       {s['normalized_number_masked']}")

print("\n>>> ALL WALKTHROUGH CHECKS PASSED PERFECTLY! <<<")
