from pathlib import Path
import warnings
import httpx
import pytest
from bs4 import XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

from app.db import NumberSource, ScamNumber, ScrapeLog, SessionLocal, Whitelist, init_db, utcnow
from app.heuristics import analyze_number
from app.reputation import hash_number
from scrapers.scammer_info import (
    ScammerInfoScraper,
    check_bot_challenge,
    extract_numbers_from_text,
    infer_category,
    strip_unwanted_text,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_strip_unwanted_text():
    html = "<div>Call me on 9840211982 <blockquote>Quote with 9999999999</blockquote> Visit https://example.com/1234567890/test</div>"
    cleaned = strip_unwanted_text(html)
    assert "9840211982" in cleaned
    assert "9999999999" not in cleaned
    assert "https://example.com" not in cleaned


def test_extract_numbers_accuracy():
    text = "Scammer called me from +91 98402 11982 and also from phone 09820144820. Do not visit https://phish.com/track/919999988888"
    nums = extract_numbers_from_text(text)
    assert "+919840211982" in nums
    assert "+919820144820" in nums
    # URL number should not be matched
    assert "+919999988888" not in nums


def test_infer_category():
    assert infer_category("CBI Digital Arrest Police Warrant") == "digital_arrest"
    assert infer_category("SBI Yono KYC Account Freeze") == "kyc"
    assert infer_category("KBC Crorepati Jackpot Winner") == "lottery"
    assert infer_category("Geek Squad Refund AnyDesk") == "tech_support"
    assert infer_category("FedEx Customs Seizure") == "courier"
    assert infer_category("Random chatter topic") == "other"


def test_parse_discourse_json_fixture():
    scraper = ScammerInfoScraper(dry_run=True)
    json_path = FIXTURES_DIR / "sample_discourse.json"
    topics = scraper.parse_from_file(str(json_path))
    assert len(topics) == 3
    
    # Topic 1: digital arrest
    t1 = topics[0]
    assert t1["category"] == "digital_arrest"
    assert "+919840211982" in t1["numbers"]
    # Topic 2: kyc
    t2 = topics[1]
    assert t2["category"] == "kyc"
    assert "+917029144019" in t2["numbers"]
    # Topic 3: tech support
    t3 = topics[2]
    assert t3["category"] == "tech_support"
    assert "+18004910022" in t3["numbers"]


def test_parse_rss_fixture():
    scraper = ScammerInfoScraper(dry_run=True)
    rss_path = FIXTURES_DIR / "sample_feed.rss"
    topics = scraper.parse_from_file(str(rss_path))
    assert len(topics) == 2
    assert "+919910082741" in topics[0]["numbers"]
    assert "+919414018299" in topics[1]["numbers"]


def test_parse_html_fixture():
    scraper = ScammerInfoScraper(dry_run=True)
    html_path = FIXTURES_DIR / "sample_page.html"
    topics = scraper.parse_from_file(str(html_path))
    assert len(topics) == 1
    assert "+919820144820" in topics[0]["numbers"]


def test_ingestion_and_idempotency():
    init_db()
    scraper = ScammerInfoScraper(dry_run=False)
    canonical = "+919777700001"
    h = hash_number(canonical)

    with SessionLocal() as session:
        # Clean up any leftover
        session.query(NumberSource).filter_by(number_hash=h).delete()
        session.query(ScamNumber).filter_by(number_hash=h).delete()
        session.commit()

        # 1. First ingestion: should start with report_count = 3
        mock_topics = [{
            "topic_id": "test_t1",
            "title": "KYC Scam Alert",
            "url": "https://scammer.info/t/test_t1",
            "bumped_at": utcnow(),
            "category": "kyc",
            "numbers": [canonical]
        }]
        res1 = scraper.ingest_extracted_data(mock_topics, session)
        assert res1["new"] == 1

        row = session.get(ScamNumber, h)
        assert row is not None
        assert row.report_count == 3
        assert row.source == "scammer.info"

        # 2. Re-run with SAME topic: idempotent, should skip duplicate
        res2 = scraper.ingest_extracted_data(mock_topics, session)
        assert res2["skipped_duplicate_topic"] == 1
        assert res2["new"] == 0
        assert res2["updated"] == 0
        assert session.get(ScamNumber, h).report_count == 3

        # 3. New topic with SAME number: should increment count +1
        mock_topics_2 = [{
            "topic_id": "test_t2",
            "title": "Another report for same number",
            "url": "https://scammer.info/t/test_t2",
            "bumped_at": utcnow(),
            "category": "kyc",
            "numbers": [canonical]
        }]
        res3 = scraper.ingest_extracted_data(mock_topics_2, session)
        assert res3["updated"] == 1
        assert session.get(ScamNumber, h).report_count == 4


def test_whitelist_protection_in_scraper():
    init_db()
    scraper = ScammerInfoScraper(dry_run=False)
    canonical = "+911800112211"
    h = hash_number(canonical)

    with SessionLocal() as session:
        session.add(Whitelist(number_hash=h, label="SBI Official"))
        session.commit()

        mock_topics = [{
            "topic_id": "test_t_white",
            "title": "Phishing thread mistakenly listing official number",
            "url": "https://scammer.info/t/test_t_white",
            "bumped_at": utcnow(),
            "category": "bank_impersonation",
            "numbers": [canonical]
        }]
        res = scraper.ingest_extracted_data(mock_topics, session)
        assert res["skipped_whitelist"] == 1
        assert res["new"] == 0
        # Verify number is NOT added to scam_numbers
        assert session.get(ScamNumber, h) is None


def test_bot_challenge_detection():
    # Mock Cloudflare challenge response
    req = httpx.Request("GET", "https://scammer.info")
    r_403 = httpx.Response(status_code=403, request=req)
    assert check_bot_challenge(r_403) is True

    r_cf = httpx.Response(status_code=200, text="<html><title>Just a moment...</title>Cloudflare security check</html>", request=req)
    assert check_bot_challenge(r_cf) is True

    r_ok = httpx.Response(status_code=200, text='{"topic_list": {}}', request=req)
    assert check_bot_challenge(r_ok) is False


def test_robots_txt_disallow_honored():
    scraper = ScammerInfoScraper(dry_run=True)
    scraper.robots_loaded = True
    scraper.robot_parser.parse([
        "User-agent: *",
        "Disallow: /admin/",
        "Disallow: /private/",
        "Allow: /latest.json",
    ])
    assert scraper.is_allowed_path("/admin/secrets.json") is False
    assert scraper.is_allowed_path("/private/users") is False
    assert scraper.is_allowed_path("/latest.json") is True
