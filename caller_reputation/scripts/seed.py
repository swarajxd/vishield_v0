"""Load seed data:  python -m scripts.seed
data/seed_numbers.csv : number,category,count,source
data/whitelist.csv    : number,label
Lines starting with # are skipped. Seed 'count' expresses confidence (e.g. 10 for a curated list)."""
import csv
from pathlib import Path

from app.db import NumberSource, ScamNumber, SessionLocal, Whitelist, init_db, utcnow
from app.heuristics import analyze_number
from app.reputation import hash_number

DATA = Path(__file__).resolve().parent.parent / "data"


def rows(name):
    p = DATA / name
    if not p.exists():
        return
    with p.open(newline="", encoding="utf-8") as f:
        for r in csv.reader(l for l in f if l.strip() and not l.startswith("#")):
            if r and r[0].strip().lower() != "number":
                yield [c.strip() for c in r]


def main():
    init_db()
    n_scam = n_white = 0
    with SessionLocal() as s:
        for num, cat, count, src in rows("seed_numbers.csv"):
            h = hash_number(analyze_number(num).canonical)
            if not s.get(ScamNumber, h):
                s.add(ScamNumber(number_hash=h, report_count=int(count), category=cat,
                                 source=src, first_reported=utcnow(), last_reported=utcnow()))
                n_scam += 1
            if not s.query(NumberSource).filter_by(number_hash=h, source=src).first():
                s.add(NumberSource(number_hash=h, source=src, first_seen=utcnow(), last_seen=utcnow()))
        for num, label in rows("whitelist.csv"):
            h = hash_number(analyze_number(num).canonical)
            if not s.get(Whitelist, h):
                s.add(Whitelist(number_hash=h, label=label))
                n_white += 1
        s.commit()
    print(f"seeded {n_scam} scam numbers, {n_white} whitelist entries")


if __name__ == "__main__":
    main()
