"""SAVE AS: build_hpv_data.py · LOCATION: C:/MarvelApps/dayhub/tools/build_hpv_data.py
HUB PREDICTED VALUE data (Home Hub, Scott 2026-10-14: "build home value first" / "hub predicted value").
Streams Redfin's free ZIP-code market tracker (Redfin Data Center, cite Redfin) and writes one small JSON per
ZIP3 to dayhub/hpv/<zip3>.json, so a phone only downloads its own area (a few KB).
Each ZIP keeps the LATEST rolling-90-day row per property type:
    [median $/sq ft, median sale price, homes sold, $/sq ft change vs a year ago (fraction)]
Run:  python tools/build_hpv_data.py            (streams ~1.5 GB, writes hpv/, prints a summary)
"""
import csv, gzip, io, json, os, sys, urllib.request
from collections import defaultdict

URL = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/zip_code_market_tracker.tsv000.gz"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "hpv")
TYPES = {"All Residential": "all", "Single Family Residential": "sfr", "Condo/Co-op": "condo", "Townhouse": "th"}

def num(x):
    try:
        return float(x) if x not in ("", "NA", None) else None
    except ValueError:
        return None

def main():
    best = {}   # (zip, type) -> (period_end, row tuple)
    resp = urllib.request.urlopen(URL, timeout=120)
    text = io.TextIOWrapper(gzip.GzipFile(fileobj=resp), encoding="utf-8", newline="")
    rows = csv.DictReader(text, delimiter="\t")
    n = 0
    for r in rows:
        r = {k.strip('"').lower(): v for k, v in r.items()}   # Redfin headers are "MEDIAN_PPSF" etc.
        n += 1
        if n % 2_000_000 == 0:
            print(f"  {n:,} rows", flush=True)
        t = TYPES.get(r.get("property_type", "").strip('"'))
        if not t or r.get("period_duration", "").strip('"') != "90":
            continue
        z = r.get("region", "").strip('"').replace("Zip Code: ", "").strip()
        if len(z) != 5 or not z.isdigit():
            continue
        end = r.get("period_end", "").strip('"')
        ppsf, price = num(r.get("median_ppsf")), num(r.get("median_sale_price"))
        if not ppsf or not price:
            continue
        k = (z, t)
        if k not in best or end > best[k][0]:
            best[k] = (end, [round(ppsf), round(price), int(num(r.get("homes_sold")) or 0),
                             round(num(r.get("median_ppsf_yoy")) or 0, 3)])
    shards, latest = defaultdict(dict), ""
    for (z, t), (end, row) in best.items():
        shards[z[:3]].setdefault(z, {})[t] = row + [end]
        latest = max(latest, end)
    os.makedirs(OUT, exist_ok=True)
    for z3, data in shards.items():
        with open(os.path.join(OUT, z3 + ".json"), "w", encoding="utf-8") as f:
            json.dump(data, f, separators=(",", ":"))
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump({"source": "Redfin Data Center", "through": latest, "zips": len({z for z, _ in best}),
                   "built": __import__("datetime").date.today().isoformat()}, f)
    print(f"rows {n:,} · zips {len({z for z, _ in best}):,} · shards {len(shards)} · data through {latest}")

if __name__ == "__main__":
    sys.exit(main())
