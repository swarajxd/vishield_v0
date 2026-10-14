# Sentinel Evaluator: Voice Phishing Evaluator & Caller Intelligence

A comprehensive voice phishing evaluation and telecom fraud defense platform with real-time stream analysis, incident tracking, and a privacy-preserving caller reputation engine with TRAI carrier verification.

---

## Architecture Overview

```
stitch_voice_phishing_evaluator_ui/
├── src/                               # Frontend: React 18 + Vite + Tailwind CSS
│   ├── components/                    # Sidebar, Navigation, KillswitchModal, etc.
│   ├── views/                         # Overview, Live Stream, Incident History, NumberChecker
│   │   └── NumberCheckerView.jsx      # Number Checker Console (Apple HIG design)
│   └── services/                      # API client with persistent anonymous reporter ID
├── caller_reputation/                 # Backend: FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── main.py                    # REST API: reputation + live STT/scam routes
│   │   ├── live.py                    # Wires streaming ingestion onto the API
│   │   ├── reputation.py              # HMAC-SHA256 salted hashing, recency-decay scoring
│   │   ├── heuristics.py              # TRAI 140/160 series, VoIP, spoofing indicators
│   │   ├── db.py                      # Models: ScamNumber, NumberSource, ScrapeLog, Whitelist
│   │   └── config.py                  # Environment config and CORS settings
│   └── vishield/                      # Self-contained live ingest: ElevenLabs STT, chunking, rules
│   ├── scrapers/
│   │   └── scammer_info.py            # Polite Discourse forum scraper with fallback modes
│   ├── tests/                         # Pytest test suite with offline fixtures
│   └── data/                          # Seed datasets for scam numbers & whitelist
```

---

## Getting Started

### 1. Requirements
- Node.js 18+ & npm
- Python 3.10+

### 2. Running Backend and Frontend

#### Terminal 1 — Backend (`caller_reputation`)
```bash
cd caller_reputation
python -m pip install -r requirements.txt
python -m scripts.seed
uvicorn app.main:app --port 8000 --reload
```
*The FastAPI backend will start at `http://127.0.0.1:8000`.*

#### Terminal 2 — Frontend Dashboard
```bash
npm install
npm run dev
```
*The Vite frontend dashboard will start at `http://localhost:5173`.*
*API requests to `/api/*` are automatically proxied to `http://127.0.0.1:8000`.*

---

## Active Consoles

- **Overview Dashboard**: System status, high-level metrics, and incident distribution.
- **Live Stream Analysis**: Upload or microphone-capture a consented call. Audio is chunked (PCM16, ~8s), transcribed with **ElevenLabs Scribe** (Hinglish / Hindi / Indian English), redacted, then scored by the rule-based scam detector. Transcripts stream over WebSocket. This pipeline lives in `caller_reputation/vishield` and does **not** require the top-level `vishield/` folder.

Set `ELEVEN_LABS_API_KEY` in `caller_reputation/.env`. If the key is missing, the live tab uses a deterministic mock STT so the UI still runs offline.
- **High-Risk Warning**: Immediate alert and mitigation triggers.
- **Call Analysis Report**: Deep-dive post-call forensic evaluation.
- **Incident History**: Historical log of flagged threats with severity tags and audio previews.
- **Number Checker** *(New)*: Telephony intelligence and community reputation lookup with 4 distinct evaluation states:
  1. **In Database**: Confidence score, report counts, categories, and danger indicators.
  2. **Not in Database**: Heuristic analysis only without presenting unconfirmed numbers as safe.
  3. **Verified Official**: TRAI/bank verified toll-free numbers.
  4. **Telemarketer**: TRAI 140/160 registered telemarketer series.

---

## Scammer.info Scraper

Polite Discourse scraper complying with `robots.txt`, zero bot-evasion policy, and full idempotency:

```bash
cd caller_reputation

# Dry-run analysis
python -m scrapers.scammer_info --dry-run

# Ingest from downloaded Discourse JSON / RSS / HTML
python -m scrapers.scammer_info --from-file tests/fixtures/sample_discourse.json
python -m scrapers.scammer_info --from-file tests/fixtures/sample_feed.rss
python -m scrapers.scammer_info --from-file tests/fixtures/sample_page.html

# Ingest from CSV
python -m scrapers.scammer_info --from-csv data/seed_numbers.csv
```

---

## Running Automated Tests

```bash
cd caller_reputation
pytest -v
python walkthrough_test.py
```
