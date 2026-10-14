# Caller Reputation & Intelligence Service

A privacy-first caller reputation and phone number intelligence service built with FastAPI, SQLAlchemy, and Google `phonenumbers`. Designed for the **Sentinel Voice Phishing Evaluator** platform.

---

## Features

- **Privacy-Preserving Number Storage**: Phone numbers are strictly hashed using HMAC-SHA256 with a secret salt (`NUMBER_HASH_SALT`). Raw phone numbers are **never** logged or stored on disk.
- **Strict Masking in Responses & Logs**: Responses and logs display masked representations (e.g. `+91 98•••••210`).
- **Heuristic Engine**:
  - TRAI 140/160 series recognition (labelled as registered telemarketers, not scam).
  - Indian mobile (6-9 series), landline, toll-free, and premium rate classification.
  - Foreign incoming, VoIP, invalid prefix, and spoofing risk indicators.
  - International routing spoof flag (`via_international=true`).
- **Recency-Decay Scoring**: Confidence-weighted reputation score decays over time (half-life of 90 days), fusing community reports, scraper intelligence, and heuristics.
- **Scammer.info Scraper**:
  - Compliant with `robots.txt` using `urllib.robotparser`.
  - Rate-limited polite crawling (>= 3s delays, exponential backoff).
  - **Zero-Evasion Policy**: Automatically aborts cleanly on Cloudflare/bot challenges or HTTP 403.
  - Fallback offline ingestion modes via `--from-file` (Discourse JSON / RSS / HTML) and `--from-csv`.
  - False-positive filters (strips tracking numbers, URLs, timestamps, quoted replies).
  - Idempotent tracking via `number_sources` and `scrape_log`.

---

## Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./reputation.db` | SQLAlchemy database connection string |
| `NUMBER_HASH_SALT` | *Required in Prod* | Secret salt for HMAC-SHA256 phone number hashing |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed CORS origins for dashboard UI |
| `CONTACT_EMAIL` | `security@example.com` | Contact email for Scraper User-Agent identification |
| `USER_AGENT` | `VoicePhishingEvaluatorBot/0.1...` | User agent header for polite scraping |
| `IPQS_API_KEY` | `""` | (Optional) IPQualityScore API key for third-party lookups |

---

## Setup & Running

### 1. Prerequisites
Python 3.10+ is recommended. Install dependencies:

```bash
pip install -r requirements.txt
```

### 2. Seed Database
Seed curated sample scam numbers and legitimate whitelist numbers:

```bash
python -m scripts.seed
```

### 3. Start the API Service
Run FastAPI with Uvicorn:

```bash
uvicorn app.main:app --port 8000 --reload
```

The service will run on `http://127.0.0.1:8000`.

---

## Running with the Frontend Dashboard

From the project root (`stitch_voice_phishing_evaluator_ui/`):

1. **Backend**:
   ```bash
   cd caller_reputation
   uvicorn app.main:app --port 8000 --reload
   ```

2. **Frontend**:
   ```bash
   npm install
   npm run dev
   ```
   The dashboard runs on `http://localhost:5173`. Requests to `/api/*` are automatically proxied by Vite to `http://127.0.0.1:8000`.

---

## API Endpoints

### 1. `GET /reputation/{number}`
Inspects number reputation, heuristics, and database records.

**Query Parameters:**
- `via_international` (bool, default: `false`): Set `true` if the call arrived via an international route.

**Response Structure:**
```json
{
  "in_database": true,
  "reputation_score": 0.88,
  "risk_level": "HIGH_RISK",
  "category": "kyc",
  "report_count": 10,
  "last_reported": "2026-10-13T10:00:00Z",
  "sources": ["community", "scammer.info"],
  "normalized_number_masked": "+91 98•••••210",
  "is_whitelisted": false,
  "whitelist_name": null,
  "heuristic_score": 0.45,
  "signals": ["indian_mobile", "invalid_routing"],
  "country_code": "IN",
  "number_type": "MOBILE",
  "third_party": null
}
```

*Risk Level Thresholds:*
- `0.00 - 0.39`: `SAFE`
- `0.40 - 0.69`: `SUSPICIOUS`
- `0.70 - 1.00`: `HIGH_RISK`

### 2. `POST /report`
Submit a scam report from the community or dashboard.

**Request Body:**
```json
{
  "number": "+91 98201 44820",
  "category": "bank_impersonation",
  "reporter_id": "anon-uuid-client-123",
  "notes": "Claimed to be SBI branch manager"
}
```

**Responses:**
- `200 OK`: Report submitted successfully.
- `409 Conflict`: Reporter has already reported this number within the cooldown window.
- `429 Too Many Requests`: Rate limit exceeded for this reporter.

### 3. `GET /stats`
Summary statistics for dashboard header strip.

```json
{
  "total_numbers": 15,
  "by_category": {
    "kyc": 4,
    "bank_impersonation": 5,
    "lottery": 3,
    "investment": 3
  },
  "by_source": {
    "community": 12,
    "scammer.info": 3
  },
  "last_scrape_time": "2026-10-13T16:15:00Z"
}
```

---

## Scraper (`scammer.info`)

Located at `caller_reputation/scrapers/scammer_info.py`.

### Politeness & Zero-Evasion Architecture
1. **Robots.txt check**: Evaluates `https://scammer.info/robots.txt` before any path crawl.
2. **Honest User-Agent**: Configured via `CONTACT_EMAIL` and `USER_AGENT`.
3. **Paced crawling**: Minimum 3-second delay between requests with exponential backoff.
4. **Cloudflare / Bot Challenge Abort**:
   - `scammer.info` is protected by Cloudflare bot protection.
   - Per requirements, **no evasion, proxy rotation, or fingerprint tampering is attempted**.
   - If a 403 or challenge page is returned, the scraper stops cleanly and exits with an informative message.

### Usage & Fallback Ingestion

#### 1. Live Crawl (respects robots.txt, stops cleanly if challenged)
```bash
python -m scrapers.scammer_info --max-pages 5
```

#### 2. Dry-Run Mode (prints masked numbers, writes nothing)
```bash
python -m scrapers.scammer_info --dry-run
```

#### 3. Ingestion from Downloaded File (`--from-file`)
Download Discourse topics JSON, RSS feed, or HTML page manually and ingest:
```bash
python -m scrapers.scammer_info --from-file tests/fixtures/sample_discourse.json
python -m scrapers.scammer_info --from-file tests/fixtures/sample_feed.rss
python -m scrapers.scammer_info --from-file tests/fixtures/sample_page.html
```

#### 4. Ingestion from CSV (`--from-csv`)
```bash
python -m scrapers.scammer_info --from-csv data/seed_numbers.csv
```

### Optional Cron Job Example
To run daily scraping at 02:00 AM:
```cron
0 2 * * * cd /path/to/caller_reputation && python -m scrapers.scammer_info --max-pages 3 >> /var/log/scammer_info.log 2>&1
```

---

## Running Tests

Execute pytest using the active Python environment:

```bash
pytest -v
```

All 26 unit and integration tests run offline against saved fixtures without external network calls.
