#!/usr/bin/env python3
"""Refresh the fashion desk from live public posts (Reddit + existing desk)."""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "docs" / "trends.json"

SUBS = [
    ("streetwear", "TikTok"),
    ("outfits", "TikTok"),
    ("femalefashionadvice", "Instagram"),
    ("malefashion", "Instagram"),
    ("fashionporn", "Instagram"),
]

MAP = [
    ("denim|jean", ["vintage-denim", "oxford-shirt"], "denim"),
    ("knit|sweater|camel", ["cashmere-crew", "wide-trousers", "loafer"], "camel knit"),
    ("blazer|suit|tailor", ["wool-blazer", "oxford-shirt", "loafer"], "blazer"),
    ("slip|satin|silk|dress", ["silk-slip", "satin-skirt", "poet-blouse"], "silk slip"),
    ("boot|western|suede", ["suede-jacket", "cowboy-boots", "vintage-denim"], "suede western"),
    ("jacket|leather|trench", ["leather-trench", "black-trouser"], "leather jacket"),
    ("shirt|oxford", ["oxford-shirt", "black-trouser", "loafer"], "oxford shirt"),
]


def get_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "UvelDesk/1.0 (fashion app)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def reddit_looks():
    out = []
    for sub, source in SUBS:
        try:
            data = get_json(f"https://www.reddit.com/r/{sub}/hot.json?limit=12")
        except Exception as e:
            print("reddit fail", sub, e)
            continue
        for child in data.get("data", {}).get("children", []):
            p = child.get("data", {})
            if p.get("stickied") or p.get("over_18"):
                continue
            url = p.get("url") or ""
            img = ""
            if url.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
                img = url
            else:
                try:
                    img = p["preview"]["images"][0]["source"]["url"].replace("&", "&")
                except Exception:
                    continue
            title = re.sub(r"\s+", " ", p.get("title") or "Today’s look").strip()[:72]
            blob = title.lower()
            gids, q = ["cashmere-crew", "oxford-shirt"], "outfit"
            for pat, ids, query in MAP:
                if re.search(pat, blob):
                    gids, q = ids, query
                    break
            tag = source
            if "tiktok" in blob:
                tag = "TikTok"
            elif "instagram" in blob or "insta" in blob:
                tag = "Instagram"
            elif "snap" in blob:
                tag = "Snapchat"
            out.append(
                {
                    "id": p.get("id") or title,
                    "slug": p.get("id") or title,
                    "title": title,
                    "source": tag,
                    "summary": f"Live from r/{sub}. {p.get('score', 0)} upvotes today.",
                    "imageUrl": img,
                    "postUrl": "https://www.reddit.com" + p.get("permalink", ""),
                    "garmentIds": gids,
                    "shopQuery": q,
                    "heat": f"{tag} · today",
                }
            )
            if sum(1 for x in out if x["source"] == tag) >= 3 and len(out) >= 8:
                break
    return out


def main():
    seed = json.loads(DEST.read_text()) if DEST.exists() else {"looks": []}
    live = reddit_looks()
    looks = live or seed.get("looks", [])
    # keep a couple of the last live X/IG stills if reddit was quiet
    if live:
        have = {x["imageUrl"] for x in live if x.get("imageUrl")}
        for row in seed.get("looks", []):
            if row.get("imageUrl") and row["imageUrl"] not in have:
                looks.append(row)
            if len(looks) >= 12:
                break
    out = {"updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "looks": looks[:12]}
    DEST.write_text(json.dumps(out, indent=2) + "\n")
    print("wrote", DEST, "looks", len(out["looks"]))


if __name__ == "__main__":
    main()
