"""Scraper and ingestion tool for scammer.info Discourse forum.
Strictly adheres to robots.txt, polite rate-limiting, and Cloudflare non-evasion.

CLI Usage:
    python -m scrapers.scammer_info [--dry-run] [--max-pages N] [--since YYYY-MM-DD] [-v]
    python -m scrapers.scammer_info --from-file sample_posts.json [--dry-run]
    python -m scrapers.scammer_info --from-csv seed.csv [--dry-run]
"""
import argparse
import csv
import json
import logging
import re
import sys
import time
import urllib.robotparser
import warnings
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

import httpx
import phonenumbers
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from phonenumbers import Leniency

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

from app.config import DATABASE_URL, USER_AGENT
from app.db import NumberSource, ScamNumber, ScrapeLog, SessionLocal, Whitelist, init_db, utcnow
from app.heuristics import analyze_number
from app.reputation import hash_number, mask_number

logger = logging.getLogger("scammer_info_scraper")

BASE_URL = "https://scammer.info"
ROBOTS_URL = "https://scammer.info/robots.txt"
REQUEST_DELAY_SEC = 3.0  # Polite rate limit: at least 3 seconds between live requests

CATEGORY_KEYWORDS = {
    "digital_arrest": ["digital arrest", "cbi", "police", "customs arrest", "narcotics", "court order", "arrest warrant"],
    "kyc": ["kyc", "yono", "sim block", "pan card", "aadhaar", "document update", "debit card block", "account freeze"],
    "lottery": ["lottery", "kbc", "prize", "jackpot", "winner", "crorepati", "lucky draw"],
    "investment": ["investment", "trading", "crypto", "forex", "daily profit", "telegram task", "part time job", "stock tip"],
    "courier": ["courier", "fedex", "dhl", "customs", "parcel", "package seized", "drugs in parcel", "contraband"],
    "tech_support": ["tech support", "anydesk", "teamviewer", "microsoft support", "geek squad", "antivirus", "refund", "paypal support", "apple support"],
    "bank_impersonation": ["bank", "sbi", "hdfc", "icici", "axis", "pnb", "otp", "credit card", "bank manager", "netbanking"]
}

TELEPHONY_HINTS = [
    "call", "phone", "number", "tel", "whatsapp", "caller", "scam", "+91",
    "contact", "dial", "toll free", "helpline", "sms", "msg", "otp", "scammer", "spoke"
]


def check_bot_challenge(response: httpx.Response) -> bool:
    """Detect if site returned Cloudflare challenge, 403, or CAPTCHA."""
    if response.status_code == 403:
        return True
    body_lower = response.text.lower()
    cf_indicators = [
        "cf-mitigated",
        "cloudflare",
        "just a moment...",
        "attention required! | cloudflare",
        "challenge-running",
        "hcaptcha",
        "turnstile",
        "security check to access",
    ]
    if any(ind in body_lower for ind in cf_indicators):
        return True
    return False


def infer_category(title: str, tags: list[str] = None, text: str = "") -> str:
    """Infer scam category from topic title, tags, and text using keyword map."""
    combined = f"{title} {' '.join(tags or [])} {text[:300]}".lower()
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(kw in combined for kw in kws):
            return cat
    return "other"


def strip_unwanted_text(html_or_md: str) -> str:
    """Strip blockquotes, URLs, and code blocks to minimize false positives."""
    if not html_or_md:
        return ""

    # Parse HTML with BeautifulSoup if it looks like HTML
    if "<" in html_or_md and ">" in html_or_md:
        soup = BeautifulSoup(html_or_md, "html.parser")
        for tag in soup.find_all(["blockquote", "aside", "code", "pre", "svg"]):
            tag.decompose()
        text = soup.get_text(separator=" ")
    else:
        text = html_or_md

    # Remove markdown quotes
    text = re.sub(r"(?m)^\s*>.*$", "", text)
    # Remove URLs (avoid extracting numbers from URLs)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"www\.\S+", "", text)
    return text


def has_telephony_context(raw_text: str, match_start: int, match_end: int) -> bool:
    """Check if the matched number appears near telephony context words."""
    window_start = max(0, match_start - 60)
    window_end = min(len(raw_text), match_end + 60)
    surrounding = raw_text[window_start:window_end].lower()
    return any(hint in surrounding for hint in TELEPHONY_HINTS)


def extract_numbers_from_text(raw_text: str) -> list[str]:
    """
    Extract valid phone numbers from post text using libphonenumber + regex.
    Deduplicates and drops false positives.
    """
    cleaned_text = strip_unwanted_text(raw_text)
    candidates = []

    # 1. libphonenumber matcher for Indian region
    for match in phonenumbers.PhoneNumberMatcher(cleaned_text, "IN", leniency=Leniency.VALID):
        # Verify it's not a standalone timestamp or order ID
        s, e = match.start, match.end
        matched_str = cleaned_text[s:e]
        if has_telephony_context(cleaned_text, s, e) or matched_str.startswith("+") or matched_str.startswith("140") or matched_str.startswith("160"):
            candidates.append(matched_str)

    # 2. Regex pass for Indian mobile numbers (+91 / 91 / 0-prefix / bare 10 digits starting 6-9)
    in_regex = re.compile(
        r"(?:(?:\+91|91|0)[-\s]?)?([6-9]\d{4}[-\s]?\d{5})\b"
    )
    for m in in_regex.finditer(cleaned_text):
        num_str = m.group(0).strip()
        s, e = m.start(), m.end()
        if has_telephony_context(cleaned_text, s, e) or num_str.startswith("+"):
            candidates.append(num_str)

    # 3. Regex pass for international numbers with explicit leading '+'
    intl_regex = re.compile(r"\+\d{1,3}[-\s]?\(?\d{1,4}\)?[-\s]?\d{3,4}[-\s]?\d{3,4}\b")
    for m in intl_regex.finditer(cleaned_text):
        candidates.append(m.group(0).strip())

    # Filter through analyze_number
    valid_numbers = []
    seen = set()
    for cand in candidates:
        a = analyze_number(cand)
        if a.valid and a.category != "invalid":
            if a.canonical not in seen:
                seen.add(a.canonical)
                valid_numbers.append(a.canonical)

    return valid_numbers


class ScammerInfoScraper:
    def __init__(self, user_agent: str = USER_AGENT, dry_run: bool = False, verbose: bool = False):
        self.user_agent = user_agent
        self.dry_run = dry_run
        self.verbose = verbose
        self.client = httpx.Client(
            headers={"User-Agent": self.user_agent, "Accept": "application/json, text/html"},
            follow_redirects=True,
            timeout=12.0,
        )
        self.robot_parser = urllib.robotparser.RobotFileParser()
        self.robots_loaded = False

    def load_robots_txt(self) -> bool:
        """Fetch and parse robots.txt; cleanly abort if blocked."""
        try:
            if self.verbose:
                print(f"[INFO] Fetching {ROBOTS_URL} ...")
            r = self.client.get(ROBOTS_URL)
            if check_bot_challenge(r):
                print(f"[ABORT] Cloudflare / Bot detection encountered on robots.txt (HTTP {r.status_code}).")
                print("Stopping immediately to respect anti-scraping policy. Use --from-file mode instead.")
                return False
            self.robot_parser.parse(r.text.splitlines())
            self.robots_loaded = True
            return True
        except Exception as e:
            print(f"[WARNING] Could not fetch robots.txt ({e}). Proceeding defensively.")
            return False

    def is_allowed_path(self, path: str) -> bool:
        if not self.robots_loaded:
            return True
        full_url = urljoin(BASE_URL, path)
        return self.robot_parser.can_fetch(self.user_agent, full_url)

    def polite_sleep(self):
        time.sleep(REQUEST_DELAY_SEC)

    def fetch_json(self, path: str) -> dict | None:
        """Fetch endpoint adhering to robots.txt, rate limits, and Cloudflare checks."""
        if not self.is_allowed_path(path):
            print(f"[POLITENESS] robots.txt disallows path '{path}'. Skipping.")
            return None

        self.polite_sleep()
        url = urljoin(BASE_URL, path)
        retries = 2
        backoff = 4.0

        for attempt in range(retries + 1):
            try:
                r = self.client.get(url)
                if check_bot_challenge(r):
                    print(f"[ABORT] Live fetch blocked by Cloudflare/bot challenge (HTTP {r.status_code}) on {url}.")
                    print("Stopping immediately without evasion. Use --from-file fallback mode.")
                    return None
                if r.status_code == 200:
                    return r.json()
                elif r.status_code in (429, 500, 502, 503, 504):
                    if attempt < retries:
                        time.sleep(backoff)
                        backoff *= 2
                        continue
                print(f"[WARN] HTTP {r.status_code} returned for {url}")
                return None
            except Exception as e:
                if attempt < retries:
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                print(f"[ERROR] Request failed for {url}: {e}")
                return None
        return None

    def ingest_extracted_data(self, topics_data: list[dict], session) -> dict:
        """
        Process extracted topics:
        topics_data: list of dicts with {
            'topic_id': str,
            'title': str,
            'url': str,
            'bumped_at': datetime,
            'category': str,
            'numbers': list[str] (canonical E.164)
        }
        """
        summary = {
            "topics_scanned": len(topics_data),
            "numbers_found": 0,
            "new": 0,
            "updated": 0,
            "skipped_whitelist": 0,
            "skipped_duplicate_topic": 0,
        }

        for topic in topics_data:
            tid = str(topic["topic_id"])
            t_url = topic.get("url", f"{BASE_URL}/t/{tid}")
            t_date = topic.get("bumped_at") or utcnow()
            cat = topic.get("category", "other")
            nums = topic.get("numbers", [])

            for canonical in nums:
                summary["numbers_found"] += 1
                h = hash_number(canonical)
                masked = mask_number(canonical)

                # Check whitelist
                if session.get(Whitelist, h):
                    summary["skipped_whitelist"] += 1
                    if self.verbose:
                        print(f"  [SKIP WHITELIST] Number {masked} is on official whitelist.")
                    continue

                # Check if already recorded for this specific topic
                existing_src = (
                    session.query(NumberSource)
                    .filter_by(number_hash=h, source="scammer.info", topic_id=tid)
                    .first()
                )
                if existing_src:
                    summary["skipped_duplicate_topic"] += 1
                    continue

                if self.dry_run:
                    existing_scam = session.get(ScamNumber, h)
                    if existing_scam:
                        summary["updated"] += 1
                        print(f"  [DRY-RUN UPDATE] Number {masked} (+1 count, current: {existing_scam.report_count})")
                    else:
                        summary["new"] += 1
                        print(f"  [DRY-RUN NEW] Number {masked} (report_count=3, category={cat})")
                    continue

                # Ingestion
                row = session.get(ScamNumber, h)
                if row:
                    row.report_count = min(10, row.report_count + 1)
                    if t_date and (not row.last_reported or t_date > row.last_reported):
                        row.last_reported = t_date
                    if row.category == "other" and cat != "other":
                        row.category = cat
                    summary["updated"] += 1
                    if self.verbose:
                        print(f"  [UPDATE] Number {masked} -> count {row.report_count}")
                else:
                    session.add(
                        ScamNumber(
                            number_hash=h,
                            report_count=3,
                            category=cat,
                            source="scammer.info",
                            first_reported=t_date,
                            last_reported=t_date,
                        )
                    )
                    summary["new"] += 1
                    if self.verbose:
                        print(f"  [NEW] Number {masked} -> category {cat}")

                session.add(
                    NumberSource(
                        number_hash=h,
                        source="scammer.info",
                        topic_id=tid,
                        url=t_url,
                        first_seen=t_date,
                        last_seen=t_date,
                    )
                )

            # Record scrape log for topic
            if not self.dry_run and tid:
                bumped_str = t_date.isoformat() if hasattr(t_date, "isoformat") else str(t_date)
                scrape_entry = session.query(ScrapeLog).filter_by(topic_id=tid).first()
                if not scrape_entry:
                    session.add(ScrapeLog(topic_id=tid, last_bumped_at=bumped_str, scraped_at=utcnow()))
                else:
                    scrape_entry.last_bumped_at = bumped_str
                    scrape_entry.scraped_at = utcnow()

        if not self.dry_run:
            session.commit()

        return summary

    def parse_from_file(self, file_path: str) -> list[dict]:
        """Parse topics from locally saved Discourse JSON, RSS, or HTML."""
        p = Path(file_path)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        content = p.read_text(encoding="utf-8")
        topics_data = []

        # Try JSON
        try:
            data = json.loads(content)
            # Case A: Discourse /latest.json or /t/{id}.json
            if "topic_list" in data and "topics" in data["topic_list"]:
                # Multiple topics
                for t in data["topic_list"]["topics"]:
                    tid = t.get("id")
                    title = t.get("title", "")
                    tags = t.get("tags", [])
                    category = infer_category(title, tags)
                    date_val = t.get("bumped_at") or t.get("created_at")
                    dt = datetime.fromisoformat(date_val.replace("Z", "+00:00")).replace(tzinfo=None) if date_val else utcnow()
                    # Look for numbers in title + excerpt
                    text = f"{title} {t.get('excerpt', '')}"
                    numbers = extract_numbers_from_text(text)
                    topics_data.append({
                        "topic_id": str(tid),
                        "title": title,
                        "url": f"{BASE_URL}/t/{tid}",
                        "bumped_at": dt,
                        "category": category,
                        "numbers": numbers
                    })
            elif "post_stream" in data:
                # Single topic posts stream
                tid = data.get("id", "file_topic")
                title = data.get("title", "")
                tags = data.get("tags", [])
                category = infer_category(title, tags)
                dt = utcnow()
                posts_text = []
                for p_item in data["post_stream"].get("posts", []):
                    posts_text.append(p_item.get("cooked", "") or p_item.get("raw", ""))
                combined_text = f"{title} {' '.join(posts_text)}"
                numbers = extract_numbers_from_text(combined_text)
                topics_data.append({
                    "topic_id": str(tid),
                    "title": title,
                    "url": f"{BASE_URL}/t/{tid}",
                    "bumped_at": dt,
                    "category": category,
                    "numbers": numbers
                })
            elif isinstance(data, list):
                # Simple list of mock topics
                for item in data:
                    numbers = extract_numbers_from_text(f"{item.get('title', '')} {item.get('text', '')}")
                    topics_data.append({
                        "topic_id": str(item.get("topic_id", "local_1")),
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "bumped_at": utcnow(),
                        "category": infer_category(item.get("title", ""), [], item.get("text", "")),
                        "numbers": numbers
                    })
            return topics_data
        except json.JSONDecodeError:
            pass

        # Try RSS/XML or HTML
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", category=XMLParsedAsHTMLWarning)
            soup = BeautifulSoup(content, "html.parser")
        items = soup.find_all("item")
        if items:
            # RSS feed
            for it in items:
                title = it.find("title").get_text() if it.find("title") else ""
                link = it.find("link").get_text() if it.find("link") else ""
                desc = it.find("description").get_text() if it.find("description") else ""
                tid_match = re.search(r"/t/[^/]+/(\d+)", link) or re.search(r"/(\d+)$", link)
                tid = tid_match.group(1) if tid_match else str(abs(hash(link)))
                numbers = extract_numbers_from_text(f"{title} {desc}")
                category = infer_category(title, [], desc)
                topics_data.append({
                    "topic_id": tid,
                    "title": title,
                    "url": link,
                    "bumped_at": utcnow(),
                    "category": category,
                    "numbers": numbers
                })
            return topics_data

        # Fallback raw HTML page
        title = soup.find("title").get_text() if soup.find("title") else "HTML File"
        numbers = extract_numbers_from_text(soup.get_text())
        topics_data.append({
            "topic_id": "html_file",
            "title": title,
            "url": "local_file",
            "bumped_at": utcnow(),
            "category": infer_category(title, [], ""),
            "numbers": numbers
        })
        return topics_data

    def parse_from_csv(self, file_path: str) -> list[dict]:
        """Parse numbers from CSV formatted like seed_numbers.csv."""
        p = Path(file_path)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        topics_data = []
        with p.open(newline="", encoding="utf-8") as f:
            reader = csv.reader(line for line in f if line.strip() and not line.startswith("#"))
            for idx, row in enumerate(reader):
                if not row or row[0].strip().lower() == "number":
                    continue
                num_raw = row[0].strip()
                cat = row[1].strip() if len(row) > 1 else "other"
                a = analyze_number(num_raw)
                if a.valid and a.category != "invalid":
                    topics_data.append({
                        "topic_id": f"csv_row_{idx}",
                        "title": f"Reported number {a.canonical}",
                        "url": "csv_seed",
                        "bumped_at": utcnow(),
                        "category": cat,
                        "numbers": [a.canonical]
                    })
        return topics_data

    def run_live(self, max_pages: int = 5, since_date: str = None) -> dict:
        """Run polite live scrape of latest Discourse topics."""
        if not self.load_robots_txt():
            return {"error": "Aborted due to robots.txt / bot challenge"}

        init_db()
        with SessionLocal() as session:
            topics_to_ingest = []
            since_dt = datetime.strptime(since_date, "%Y-%m-%d") if since_date else None

            for page in range(max_pages):
                path = f"/latest.json?page={page}" if page > 0 else "/latest.json"
                if self.verbose:
                    print(f"[INFO] Fetching {path} ...")

                data = self.fetch_json(path)
                if not data or "topic_list" not in data:
                    break

                topics = data["topic_list"].get("topics", [])
                if not topics:
                    break

                for t in topics:
                    tid = str(t.get("id"))
                    title = t.get("title", "")
                    tags = t.get("tags", [])
                    category = infer_category(title, tags)
                    bumped_at_str = t.get("bumped_at") or t.get("created_at")
                    t_date = (
                        datetime.fromisoformat(bumped_at_str.replace("Z", "+00:00")).replace(tzinfo=None)
                        if bumped_at_str else utcnow()
                    )

                    if since_dt and t_date < since_dt:
                        continue

                    # Check if topic already scraped with same bumped_at
                    existing_log = session.query(ScrapeLog).filter_by(topic_id=tid).first()
                    if existing_log and existing_log.last_bumped_at == bumped_at_str:
                        if self.verbose:
                            print(f"  [SKIP UNCHANGED] Topic #{tid} unchanged since {bumped_at_str}")
                        continue

                    # Fetch topic detail posts
                    topic_json = self.fetch_json(f"/t/{tid}.json")
                    posts_text = [title]
                    if topic_json and "post_stream" in topic_json:
                        for p_item in topic_json["post_stream"].get("posts", [])[:20]:
                            posts_text.append(p_item.get("cooked", "") or p_item.get("raw", ""))

                    full_text = " ".join(posts_text)
                    numbers = extract_numbers_from_text(full_text)
                    if numbers:
                        topics_to_ingest.append({
                            "topic_id": tid,
                            "title": title,
                            "url": f"{BASE_URL}/t/{tid}",
                            "bumped_at": t_date,
                            "category": category,
                            "numbers": numbers,
                        })

            return self.ingest_extracted_data(topics_to_ingest, session)


def main():
    parser = argparse.ArgumentParser(description="Scammer.info polite forum scraper & ingestion")
    parser.add_argument("--dry-run", action="store_true", help="Print summary with masked numbers only; write nothing to database")
    parser.add_argument("--max-pages", type=int, default=5, help="Hard cap on pages per run (default: 5)")
    parser.add_argument("--since", type=str, default=None, help="Filter topics since YYYY-MM-DD")
    parser.add_argument("--from-file", type=str, default=None, help="Ingest topics from a local JSON, RSS, or HTML file")
    parser.add_argument("--from-csv", type=str, default=None, help="Ingest numbers from a CSV file")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output")

    args = parser.parse_args()

    scraper = ScammerInfoScraper(dry_run=args.dry_run, verbose=args.verbose)
    init_db()

    print("=" * 65)
    print("Sentinel Voice Security — Scammer.info Ingestion Engine")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE DATABASE WRITE'}")
    print(f"User-Agent: {scraper.user_agent}")
    print("=" * 65)

    with SessionLocal() as session:
        if args.from_file:
            print(f"[INPUT] Reading file: {args.from_file}")
            topics = scraper.parse_from_file(args.from_file)
            summary = scraper.ingest_extracted_data(topics, session)
        elif args.from_csv:
            print(f"[INPUT] Reading CSV: {args.from_csv}")
            topics = scraper.parse_from_csv(args.from_csv)
            summary = scraper.ingest_extracted_data(topics, session)
        else:
            print(f"[INPUT] Running live scraper on {BASE_URL} (max-pages: {args.max_pages}) ...")
            summary = scraper.run_live(max_pages=args.max_pages, since_date=args.since)

    print("\n" + "=" * 65)
    print("Ingestion Summary:")
    for k, v in summary.items():
        print(f"  {k.replace('_', ' ').title()}: {v}")
    print("=" * 65)


if __name__ == "__main__":
    main()
