import os
from pathlib import Path

# Load .env if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

HOME_REGION = "IN"
# Secret salt for hashing numbers. CHANGE IN PRODUCTION and never commit it.
SALT = os.getenv("NUMBER_HASH_SALT", "dev-only-change-me")
# sqlite for the prototype; use postgresql+psycopg2://user:pw@host/db for PostgreSQL
DB_FILE = Path(__file__).resolve().parent.parent / "reputation.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_FILE.as_posix()}")
IPQS_API_KEY = os.getenv("IPQS_API_KEY")  # optional third-party signal

REPORT_LIMIT = int(os.getenv("REPORT_LIMIT", "10"))         # max reports per reporter ...
REPORT_WINDOW_SEC = int(os.getenv("REPORT_WINDOW_SEC", "3600"))  # ... per hour

# CORS Origins
raw_cors = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000")
CORS_ORIGINS = [orig.strip() for orig in raw_cors.split(",") if orig.strip()]

# Scraper Contact Info
CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "security-research@example.com")
USER_AGENT = os.getenv(
    "SCRAPER_USER_AGENT",
    f"VoicePhishingEvaluatorBot/0.1 (student project; contact: {CONTACT_EMAIL})"
)
